package br.com.finmemory.retailer.painel

import android.app.Application
import br.com.finmemory.retailer.painel.di.appModule
import org.koin.android.ext.koin.androidContext
import org.koin.core.context.startKoin

class FinMemoryRetailerApp : Application() {

    override fun onCreate() {
        super.onCreate()
        startKoin {
            androidContext(this@FinMemoryRetailerApp)
            modules(appModule)
        }
    }
}
