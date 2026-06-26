package br.com.finmemory.retailer.painel.data.local

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Persistência criptografada do token de sessão (Supabase JWT / cookie de merchant).
 * Nunca armazene o token em SharedPreferences simples ou em texto plano.
 */
class SecureTokenStore(context: Context) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        PREFS_FILE,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    fun saveAccessToken(token: String) {
        prefs.edit().putString(KEY_ACCESS_TOKEN, token.trim()).apply()
    }

    fun getAccessToken(): String? =
        prefs.getString(KEY_ACCESS_TOKEN, null)?.takeIf { it.isNotBlank() }

    fun saveRefreshToken(token: String) {
        prefs.edit().putString(KEY_REFRESH_TOKEN, token.trim()).apply()
    }

    fun getRefreshToken(): String? =
        prefs.getString(KEY_REFRESH_TOKEN, null)?.takeIf { it.isNotBlank() }

    fun clear() {
        prefs.edit().clear().apply()
    }

    fun hasSession(): Boolean = getAccessToken() != null

    companion object {
        private const val PREFS_FILE = "finmemory_retailer_secure_prefs"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
    }
}
