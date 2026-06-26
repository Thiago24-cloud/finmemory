package br.com.finmemory.retailer.painel

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import br.com.finmemory.retailer.painel.data.repository.NetworkConnectivityRepository
import org.koin.android.ext.android.inject

/**
 * Activity inicial — UI de PDV/catálogo virá nas fases 2–4.
 * Já inicia o monitoramento de rede para a fila de vendas offline.
 */
class MainActivity : AppCompatActivity() {

    private val networkConnectivityRepository: NetworkConnectivityRepository by inject()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        networkConnectivityRepository.start()
    }

    override fun onDestroy() {
        networkConnectivityRepository.stop()
        super.onDestroy()
    }
}
