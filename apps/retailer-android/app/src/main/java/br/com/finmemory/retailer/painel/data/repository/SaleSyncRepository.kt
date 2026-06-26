package br.com.finmemory.retailer.painel.data.repository

import br.com.finmemory.retailer.painel.data.local.PendingSaleDao
import br.com.finmemory.retailer.painel.data.local.PendingSaleEntity
import br.com.finmemory.retailer.painel.data.local.SecureTokenStore
import br.com.finmemory.retailer.painel.data.remote.FinMemoryApiClient
import br.com.finmemory.retailer.painel.data.remote.FinMemoryApiException
import br.com.finmemory.retailer.painel.data.remote.SalePostRequest
import br.com.finmemory.retailer.painel.data.remote.SalePostResponse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

sealed class SaleSubmitResult {
    data class Sent(val response: SalePostResponse) : SaleSubmitResult()
    data class QueuedOffline(val pendingId: Long) : SaleSubmitResult()
    data class AuthRequired(val reason: String) : SaleSubmitResult()
    data class Failed(val message: String) : SaleSubmitResult()
}

data class SaleSyncState(
    val isOnline: Boolean = false,
    val pendingCount: Int = 0,
    val isSyncing: Boolean = false,
    val lastSyncError: String? = null,
)

/**
 * Orquestra POSTs de venda com fila offline:
 * - online + token → envia imediatamente
 * - offline → persiste em Room e sincroniza quando a rede voltar
 */
class SaleSyncRepository(
    private val api: FinMemoryApiClient,
    private val tokenStore: SecureTokenStore,
    private val connectivity: NetworkConnectivityRepository,
    private val pendingSaleDao: PendingSaleDao,
    private val json: Json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    },
) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val flushMutex = Mutex()

    private val _state = MutableStateFlow(SaleSyncState())
    val state: StateFlow<SaleSyncState> = _state.asStateFlow()

    init {
        scope.launch {
            connectivity.isOnline
                .distinctUntilChanged()
                .collect { online ->
                    _state.value = _state.value.copy(isOnline = online)
                    refreshPendingCount()
                    if (online) {
                        flushPendingSales()
                    }
                }
        }
    }

    suspend fun submitSale(sale: SalePostRequest): SaleSubmitResult = withContext(Dispatchers.IO) {
        val token = tokenStore.getAccessToken()
        if (token == null) {
            return@withContext SaleSubmitResult.AuthRequired("Sessão ausente — faça login no painel.")
        }

        if (!connectivity.isOnline.value) {
            val id = enqueue(sale)
            refreshPendingCount()
            return@withContext SaleSubmitResult.QueuedOffline(id)
        }

        sendOrQueue(token, sale)
    }

    suspend fun flushPendingSales(): Int = flushMutex.withLock {
        if (!connectivity.isOnline.value) return@withLock 0

        val token = tokenStore.getAccessToken()
        if (token == null) {
            _state.value = _state.value.copy(
                lastSyncError = "Token ausente — sincronização pausada.",
            )
            return@withLock 0
        }

        _state.value = _state.value.copy(isSyncing = true, lastSyncError = null)
        var synced = 0

        try {
            val pending = pendingSaleDao.listAll()
            for (item in pending) {
                val sale = runCatching {
                    json.decodeFromString<SalePostRequest>(item.payloadJson)
                }.getOrElse { error ->
                    pendingSaleDao.markAttemptFailed(item.id, error.message ?: "JSON inválido")
                    continue
                }

                when (val result = sendOrQueue(token, sale, item.id)) {
                    is SaleSubmitResult.Sent -> synced++
                    is SaleSubmitResult.QueuedOffline -> break
                    is SaleSubmitResult.Failed -> {
                        _state.value = _state.value.copy(lastSyncError = result.message)
                        break
                    }
                    is SaleSubmitResult.AuthRequired -> {
                        _state.value = _state.value.copy(lastSyncError = result.reason)
                        break
                    }
                }
            }
        } finally {
            refreshPendingCount()
            _state.value = _state.value.copy(isSyncing = false)
        }

        synced
    }

    private suspend fun sendOrQueue(
        token: String,
        sale: SalePostRequest,
        pendingId: Long? = null,
    ): SaleSubmitResult {
        return try {
            val response = api.postSale(token, sale)
            if (pendingId != null) {
                pendingSaleDao.deleteById(pendingId)
            }
            refreshPendingCount()
            SaleSubmitResult.Sent(response)
        } catch (error: FinMemoryApiException) {
            if (error.code == 401 || error.code == 403) {
                SaleSubmitResult.AuthRequired(error.message)
            } else if (!connectivity.isOnline.value) {
                val id = pendingId ?: enqueue(sale)
                refreshPendingCount()
                SaleSubmitResult.QueuedOffline(id)
            } else if (pendingId != null) {
                pendingSaleDao.markAttemptFailed(pendingId, error.message)
                SaleSubmitResult.Failed(error.message)
            } else {
                val id = enqueue(sale)
                refreshPendingCount()
                SaleSubmitResult.QueuedOffline(id)
            }
        } catch (error: Exception) {
            if (!connectivity.isOnline.value) {
                val id = pendingId ?: enqueue(sale)
                refreshPendingCount()
                SaleSubmitResult.QueuedOffline(id)
            } else if (pendingId != null) {
                pendingSaleDao.markAttemptFailed(pendingId, error.message ?: "Erro de rede")
                SaleSubmitResult.Failed(error.message ?: "Erro de rede")
            } else {
                SaleSubmitResult.Failed(error.message ?: "Erro de rede")
            }
        }
    }

    private suspend fun enqueue(sale: SalePostRequest): Long {
        val entity = PendingSaleEntity(
            payloadJson = json.encodeToString(sale),
            createdAtEpochMs = System.currentTimeMillis(),
        )
        return pendingSaleDao.insert(entity)
    }

    private suspend fun refreshPendingCount() {
        val count = pendingSaleDao.count()
        _state.value = _state.value.copy(pendingCount = count)
    }
}
