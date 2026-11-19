package com.smartbangla.voicekeyboard

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Real encrypted storage using only platform APIs — no extra Maven dependency,
 * so offline builds still work. The API key is sealed with an AES-GCM key held
 * by the Android Keystore (non-exportable). Consent defaults to DENIED.
 */
object SecureStore {
    private const val PREFS = "sbvk_secure_v1"
    private const val KEY_ALIAS = "sbvk_aes_gcm_v1"
    private const val PREF_API_KEY = "gemini_api_key"
    private const val PREF_CONSENT = "voice_consent"
    private const val PREF_TEXT_CONSENT = "text_consent"
    private const val PREF_LANGUAGE = "language_mode"
    private const val PREF_NUMBER_ROW = "number_row"

    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun secretKey(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(spec)
        return generator.generateKey()
    }

    private fun encrypt(plain: String): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val payload = cipher.iv + cipher.doFinal(plain.toByteArray(Charsets.UTF_8))
        return Base64.encodeToString(payload, Base64.NO_WRAP)
    }

    private fun decrypt(encoded: String): String {
        val payload = Base64.decode(encoded, Base64.NO_WRAP)
        val iv = payload.copyOfRange(0, 12)
        val body = payload.copyOfRange(12, payload.size)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(128, iv))
        return String(cipher.doFinal(body), Charsets.UTF_8)
    }

    fun saveApiKey(context: Context, apiKey: String) {
        prefs(context).edit().putString(PREF_API_KEY, encrypt(apiKey)).apply()
    }

    fun readApiKey(context: Context): String {
        val stored = prefs(context).getString(PREF_API_KEY, null) ?: return ""
        return try {
            decrypt(stored)
        } catch (_: Exception) {
            ""
        }
    }

    fun hasApiKey(context: Context): Boolean = readApiKey(context).isNotBlank()

    fun clearApiKey(context: Context) {
        prefs(context).edit().remove(PREF_API_KEY).apply()
    }

    /** Default false — no audio capture or egress until the user opts in. */
    fun voiceConsent(context: Context): Boolean =
        prefs(context).getBoolean(PREF_CONSENT, false)

    fun setVoiceConsent(context: Context, granted: Boolean) {
        prefs(context).edit().putBoolean(PREF_CONSENT, granted).apply()
    }

    fun textConsent(context: Context): Boolean =
        prefs(context).getBoolean(PREF_TEXT_CONSENT, false)

    fun setTextConsent(context: Context, granted: Boolean) {
        prefs(context).edit().putBoolean(PREF_TEXT_CONSENT, granted).apply()
    }

    /** Remembered typing mode so the keyboard opens in the user's language. */
    fun languageMode(context: Context): String =
        prefs(context).getString(PREF_LANGUAGE, "bn") ?: "bn"

    fun setLanguageMode(context: Context, mode: String) {
        prefs(context).edit().putString(PREF_LANGUAGE, mode).apply()
    }

    /** The always-visible number row above the letters is on by default. */
    fun numberRowVisible(context: Context): Boolean =
        prefs(context).getBoolean(PREF_NUMBER_ROW, true)

    fun setNumberRowVisible(context: Context, visible: Boolean) {
        prefs(context).edit().putBoolean(PREF_NUMBER_ROW, visible).apply()
    }
}
