package br.com.finmemory.retailer.painel.data.local

import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.PrimaryKey
import androidx.room.Query

@Entity(tableName = "pending_sales")
data class PendingSaleEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    /** JSON serializado de [SalePostRequest] */
    val payloadJson: String,
    val createdAtEpochMs: Long,
    val attemptCount: Int = 0,
    val lastError: String? = null,
)

@Dao
interface PendingSaleDao {

    @Insert
    suspend fun insert(entity: PendingSaleEntity): Long

    @Query("SELECT * FROM pending_sales ORDER BY createdAtEpochMs ASC")
    suspend fun listAll(): List<PendingSaleEntity>

    @Query("DELETE FROM pending_sales WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query(
        """
        UPDATE pending_sales
        SET attemptCount = attemptCount + 1, lastError = :error
        WHERE id = :id
        """
    )
    suspend fun markAttemptFailed(id: Long, error: String)

    @Query("SELECT COUNT(*) FROM pending_sales")
    suspend fun count(): Int
}
