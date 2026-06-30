package br.com.finmemory.retailer.painel.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "insumo_cache",
    indices = [
        Index("ean"),
        Index("nome_norm"),
        Index("loja_id"),
    ],
)
data class InsumoCacheEntity(
    @PrimaryKey val id: String,
    val loja_id: String,
    val nome: String,
    val nome_norm: String,
    val ean: String?,
    val quantidade_atual: Double?,
)
