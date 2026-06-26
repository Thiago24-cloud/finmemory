package br.com.finmemory.retailer.painel.data.remote

import br.com.finmemory.retailer.painel.BuildConfig
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import java.util.concurrent.TimeUnit

class FinMemoryApiClient(
    private val json: Json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    },
) {

    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .apply {
            if (BuildConfig.DEBUG) {
                addInterceptor(
                    HttpLoggingInterceptor().apply {
                        level = HttpLoggingInterceptor.Level.BASIC
                    }
                )
            }
        }
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    /**
     * @throws FinMemoryApiException em 4xx/5xx ou corpo inválido
     */
    fun postSale(accessToken: String, sale: SalePostRequest): SalePostResponse {
        val body = json.encodeToString(sale).toRequestBody(jsonMediaType)
        val request = Request.Builder()
            .url("${BuildConfig.FINMEMORY_API_BASE_URL.trimEnd('/')}/api/merchant/vendas")
            .post(body)
            .header("Authorization", "Bearer $accessToken")
            .header("Content-Type", "application/json")
            .header("X-Idempotency-Key", sale.idempotencyKey)
            .build()

        client.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw FinMemoryApiException(
                    code = response.code,
                    message = raw.ifBlank { response.message },
                )
            }
            return json.decodeFromString<SalePostResponse>(raw)
        }
    }
}

class FinMemoryApiException(
    val code: Int,
    override val message: String,
) : Exception("HTTP $code: $message")
