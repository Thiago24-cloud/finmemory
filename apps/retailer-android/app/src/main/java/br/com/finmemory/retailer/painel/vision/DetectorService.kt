package br.com.finmemory.retailer.painel.vision

/**
 * Resultado padronizado do pipeline de visão (espelha `lib/vision/types.js`).
 */
data class VisionDetection(
    val label: String,
    val confidence: Float,
    val source: DetectionSource,
    val insumoId: String? = null,
    val ean: String? = null,
    val sku: String? = null,
    val inferenceMs: Long = 0,
    val usedServer: Boolean = false,
)

enum class DetectionSource { LOCAL, SERVER }

const val LOCAL_CONFIDENCE_THRESHOLD = 0.72f

interface DetectorService {
    suspend fun isReady(): Boolean
    suspend fun detect(frame: ByteArray, width: Int, height: Int): VisionDetection
}
