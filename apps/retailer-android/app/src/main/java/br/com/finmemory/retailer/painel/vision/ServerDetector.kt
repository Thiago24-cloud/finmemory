package br.com.finmemory.retailer.painel.vision

/**
 * Fallback online — envia frame JPEG base64 para POST /estoque/detect.
 *
 * PLUG: injete [FinMemoryApiClient] com token de sessão quando a tela de visão existir.
 */
class ServerDetector : DetectorService {

    override suspend fun isReady(): Boolean = true

    override suspend fun detect(
        @Suppress("UNUSED_PARAMETER") frame: ByteArray,
        @Suppress("UNUSED_PARAMETER") width: Int,
        @Suppress("UNUSED_PARAMETER") height: Int,
    ): VisionDetection = VisionDetection(
        label = "unknown",
        confidence = 0f,
        source = DetectionSource.SERVER,
        usedServer = true,
    )
}
