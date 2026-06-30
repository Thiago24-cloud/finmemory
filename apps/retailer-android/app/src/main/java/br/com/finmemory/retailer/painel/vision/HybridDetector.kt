package br.com.finmemory.retailer.painel.vision

class HybridDetector(
    private val local: LocalDetector = LocalDetector(),
    private val server: ServerDetector = ServerDetector(),
    private val threshold: Float = LOCAL_CONFIDENCE_THRESHOLD,
) : DetectorService {

    suspend fun init() {
        local.load()
    }

    override suspend fun isReady(): Boolean = local.isReady()

    override suspend fun detect(frame: ByteArray, width: Int, height: Int): VisionDetection {
        val localResult = local.detect(frame, width, height)
        if (localResult.confidence >= threshold && localResult.label != "unknown") {
            return localResult.copy(usedServer = false)
        }
        return server.detect(frame, width, height)
    }

    fun dispose() {
        local.dispose()
    }
}
