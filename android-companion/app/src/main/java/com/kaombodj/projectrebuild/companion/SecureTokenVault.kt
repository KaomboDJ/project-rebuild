package com.kaombodj.projectrebuild.companion

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SecureTokenVault(context: Context) {
    private val preferences = context.getSharedPreferences("rebuild_companion_secure", Context.MODE_PRIVATE)
    private val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    private fun key(): SecretKey {
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(
                KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .build(),
            )
        }.generateKey()
    }

    private fun encrypt(value: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val payload = cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        return Base64.encodeToString(payload, Base64.NO_WRAP)
    }

    private fun decrypt(value: String): String? = runCatching {
        val payload = Base64.decode(value, Base64.NO_WRAP)
        require(payload.size > IV_LENGTH)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, payload.copyOfRange(0, IV_LENGTH)))
        String(cipher.doFinal(payload.copyOfRange(IV_LENGTH, payload.size)), Charsets.UTF_8)
    }.getOrNull()

    fun save(token: String, sourceId: String?) {
        preferences.edit()
            .putString(TOKEN_KEY, encrypt(token))
            .apply { sourceId?.let { putString(SOURCE_KEY, encrypt(it)) } }
            .apply()
    }

    fun token(): String? = preferences.getString(TOKEN_KEY, null)?.let(::decrypt)
    fun sourceId(): String? = preferences.getString(SOURCE_KEY, null)?.let(::decrypt)
    fun saveSourceId(sourceId: String) = preferences.edit().putString(SOURCE_KEY, encrypt(sourceId)).apply()

    fun clear() {
        preferences.edit().clear().apply()
        runCatching { keyStore.deleteEntry(KEY_ALIAS) }
    }

    companion object {
        private const val KEY_ALIAS = "project_rebuild_companion_token_v1"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val IV_LENGTH = 12
        private const val TOKEN_KEY = "device_token"
        private const val SOURCE_KEY = "health_source_id"
    }
}

