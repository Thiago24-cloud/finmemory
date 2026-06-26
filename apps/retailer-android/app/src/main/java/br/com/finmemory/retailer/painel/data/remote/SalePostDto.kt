package br.com.finmemory.retailer.painel.data.remote

import kotlinx.serialization.Serializable

@Serializable
data class SaleLineItem(
    val produtoId: String? = null,
    val insumoId: String? = null,
    val nome: String,
    val quantidade: Double,
    val precoUnitarioCentavos: Long,
)

/**
 * Corpo do POST de venda — endpoint a ser criado no retailer (Fase 3):
 * POST /api/merchant/vendas
 */
@Serializable
data class SalePostRequest(
    val lojaId: String,
    val itens: List<SaleLineItem>,
    val totalCentavos: Long,
    val formaPagamento: String,
    /** NSU / identificador retornado pelo Stone SDK após captura */
    val stoneTransactionId: String? = null,
    val stoneAuthorizationCode: String? = null,
    val vendidoEmEpochMs: Long = System.currentTimeMillis(),
    val idempotencyKey: String,
)

@Serializable
data class SalePostResponse(
    val vendaId: String,
    val estoqueAtualizado: Boolean = true,
)
