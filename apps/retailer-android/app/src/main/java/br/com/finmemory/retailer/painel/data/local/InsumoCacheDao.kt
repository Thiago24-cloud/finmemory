package br.com.finmemory.retailer.painel.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface InsumoCacheDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(rows: List<InsumoCacheEntity>)

    @Query("DELETE FROM insumo_cache")
    suspend fun clearAll()

    @Query("SELECT * FROM insumo_cache WHERE id = :id LIMIT 1")
    suspend fun findById(id: String): InsumoCacheEntity?

    @Query("SELECT * FROM insumo_cache WHERE ean = :ean LIMIT 1")
    suspend fun findByEan(ean: String): InsumoCacheEntity?

    @Query("SELECT * FROM insumo_cache")
    suspend fun getAll(): List<InsumoCacheEntity>
}
