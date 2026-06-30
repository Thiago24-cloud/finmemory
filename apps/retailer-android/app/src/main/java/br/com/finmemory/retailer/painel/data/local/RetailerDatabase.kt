package br.com.finmemory.retailer.painel.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [PendingSaleEntity::class, InsumoCacheEntity::class],
    version = 2,
    exportSchema = false,
)
abstract class RetailerDatabase : RoomDatabase() {

    abstract fun pendingSaleDao(): PendingSaleDao
    abstract fun insumoCacheDao(): InsumoCacheDao

    companion object {
        fun build(context: Context): RetailerDatabase =
            Room.databaseBuilder(
                context.applicationContext,
                RetailerDatabase::class.java,
                "finmemory_retailer.db",
            ).fallbackToDestructiveMigration()
                .build()
    }
}
