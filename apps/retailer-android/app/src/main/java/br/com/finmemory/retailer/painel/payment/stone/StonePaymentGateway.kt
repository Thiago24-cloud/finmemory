package br.com.finmemory.retailer.painel.payment.stone

/**
 * Ponto de integração com o Stone SDK (SmartPOS).
 *
 * Deeplink foi descartado: precisamos de captura + callback na mesma Activity
 * para baixa automática de estoque após aprovação do pagamento.
 *
 * Fase 1 — após credenciais PackageCloud:
 * 1. Adicionar dependência `br.com.stone:stone-sdk` em app/build.gradle.kts
 * 2. Implementar [StonePaymentGateway] com Stone SDK (transação crédito/débito/PIX)
 * 3. Chamar [SaleSyncRepository.submitSale] no onSuccess com stoneTransactionId preenchido
 */
interface StonePaymentGateway {
    suspend fun chargeAmountCentavos(amountCentavos: Long): StonePaymentResult
}

sealed class StonePaymentResult {
    data class Approved(
        val transactionId: String,
        val authorizationCode: String?,
    ) : StonePaymentResult()

    data class Declined(val reason: String) : StonePaymentResult()
    data class Cancelled : StonePaymentResult()
    data class Error(val message: String) : StonePaymentResult()
}

/** Implementação stub até o AAR Stone estar no classpath. */
class StonePaymentGatewayStub : StonePaymentGateway {
    override suspend fun chargeAmountCentavos(amountCentavos: Long): StonePaymentResult =
        StonePaymentResult.Error("Stone SDK não configurado — ver README em apps/retailer-android")
}
