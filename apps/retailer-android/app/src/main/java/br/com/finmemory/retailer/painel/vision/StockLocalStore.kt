package br.com.finmemory.retailer.painel.vision

import br.com.finmemory.retailer.painel.data.local.InsumoCacheDao
import br.com.finmemory.retailer.painel.data.local.InsumoCacheEntity
import java.text.Normalizer
import java.util.Locale

class StockLocalStore(
    private val dao: InsumoCacheDao,
) {
    suspend fun syncFromApi(insumos: List<InsumoCacheEntity>) {
        dao.clearAll()
        if (insumos.isNotEmpty()) dao.upsertAll(insumos)
    }

    suspend fun findById(id: String): InsumoCacheEntity? = dao.findById(id)

    suspend fun findByEan(ean: String): InsumoCacheEntity? {
        val digits = ean.filter { it.isDigit() }
        if (digits.isEmpty()) return null
        return dao.findByEan(digits)
    }

    suspend fun findByLabel(label: String): InsumoCacheEntity? {
        val needle = normName(label)
        if (needle.isEmpty()) return null
        val all = dao.getAll()
        all.find { it.nome_norm == needle }?.let { return it }
        return all.find {
            it.nome_norm.contains(needle) || needle.contains(it.nome_norm)
        }
    }

    companion object {
        fun normName(name: String): String =
            Normalizer.normalize(name, Normalizer.Form.NFD)
                .replace("\\p{M}+".toRegex(), "")
                .lowercase(Locale.ROOT)
                .trim()

        fun fromApiRow(
            id: String,
            lojaId: String,
            nome: String,
            ean: String?,
            quantidadeAtual: Double?,
        ) = InsumoCacheEntity(
            id = id,
            loja_id = lojaId,
            nome = nome,
            nome_norm = normName(nome),
            ean = ean?.filter { it.isDigit() },
            quantidade_atual = quantidadeAtual,
        )
    }
}
