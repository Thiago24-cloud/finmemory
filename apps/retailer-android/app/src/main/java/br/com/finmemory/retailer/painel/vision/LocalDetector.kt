package br.com.finmemory.retailer.painel.vision

/**
 * Detector offline — PLUG TensorFlow Lite.
 *
 * 1. Coloque `stock_detector.tflite` em `assets/`
 * 2. Adicione `org.tensorflow:tensorflow-lite` no Gradle
 * 3. Substitua [runModel] por Interpreter.run()
 */
class LocalDetector(
    private val modelAssetPath: String = "stock_detector.tflite",
) : DetectorService {

    private var ready = false
    // private var interpreter: Interpreter? = null

    suspend fun load() {
        // val model = loadModelFile(context, modelAssetPath)
        // interpreter = Interpreter(model)
        ready = true
    }

    override suspend fun isReady(): Boolean = ready

    override suspend fun detect(frame: ByteArray, width: Int, height: Int): VisionDetection {
        val started = System.currentTimeMillis()
        val raw = runModel(frame, width, height)
        return VisionDetection(
            label = raw.label,
            confidence = raw.confidence,
            source = DetectionSource.LOCAL,
            ean = raw.ean,
            sku = raw.sku,
            insumoId = raw.insumoId,
            inferenceMs = System.currentTimeMillis() - started,
        )
    }

    private data class RawInference(
        val label: String,
        val confidence: Float,
        val ean: String? = null,
        val sku: String? = null,
        val insumoId: String? = null,
    )

    /** Stub — retorna baixa confiança até o .tflite ser plugado. */
    private suspend fun runModel(
        @Suppress("UNUSED_PARAMETER") frame: ByteArray,
        @Suppress("UNUSED_PARAMETER") width: Int,
        @Suppress("UNUSED_PARAMETER") height: Int,
    ): RawInference = RawInference(label = "unknown", confidence = 0f)

    fun dispose() {
        // interpreter?.close()
        ready = false
    }
}
