package br.com.finmemory.retailer.painel.di

import br.com.finmemory.retailer.painel.data.local.RetailerDatabase
import br.com.finmemory.retailer.painel.data.local.SecureTokenStore
import br.com.finmemory.retailer.painel.data.remote.FinMemoryApiClient
import br.com.finmemory.retailer.painel.data.repository.NetworkConnectivityRepository
import br.com.finmemory.retailer.painel.data.repository.SaleSyncRepository
import br.com.finmemory.retailer.painel.payment.stone.StonePaymentGateway
import br.com.finmemory.retailer.painel.payment.stone.StonePaymentGatewayStub
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module

val appModule = module {
    single { SecureTokenStore(androidContext()) }
    single { NetworkConnectivityRepository(androidContext()) }
    single { FinMemoryApiClient() }
    single {
        RetailerDatabase.build(androidContext())
    }
    single { get<RetailerDatabase>().pendingSaleDao() }
    single {
        SaleSyncRepository(
            api = get(),
            tokenStore = get(),
            connectivity = get(),
            pendingSaleDao = get(),
        )
    }
    single<StonePaymentGateway> { StonePaymentGatewayStub() }
}
