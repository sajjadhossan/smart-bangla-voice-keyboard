package com.smartbangla.voicekeyboard

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Real Gemini translation for voice-derived text. This is the Kotlin mirror of
 * the shared provider's translate() capability — the APK cannot run the TS
 * core, so the same verified endpoint/model/prompt contract lives here.
 *
 * Hard rules:
 *  - voice consent is re-checked before any request;
 *  - no key ⇒ not_configured, no fake translation;
 *  - only the transcript is sent (never stored audio, never a log);
 *  - HTTP result is derived from the real response; errors are surfaced as-is.
 */
object GeminiVoiceClient {

    private const val ENDPOINT =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent"

    sealed interface TranslateResult {
        data class Success(val text: String) : TranslateResult
        data class Failure(val state: String) : TranslateResult
    }

    /** mode C: Bengali speech → English. mode D: English speech → Bengali. */
    fun translate(context: Context, transcript: String, mode: String): TranslateResult {
        if (!SecureStore.voiceConsent(context)) return TranslateResult.Failure("consent_denied")
        // Translating a transcript sends user text to Gemini, so the separate
        // text-consent toggle must also be on. Neither egress is ever implicit.
        if (!SecureStore.textConsent(context)) return TranslateResult.Failure("text_consent_denied")
        val key = SecureStore.readApiKey(context)
        if (key.isBlank()) return TranslateResult.Failure("not_configured")
        if (transcript.isBlank()) return TranslateResult.Failure("empty_input")

        val body = JSONObject()
            .put(
                "contents",
                JSONArray().put(
                    JSONObject().put(
                        "parts",
                        JSONArray().put(JSONObject().put("text", promptFor(mode, transcript))),
                    ),
                ),
            )
            .toString()

        var connection: HttpURLConnection? = null
        try {
            connection = URL(ENDPOINT).openConnection() as HttpURLConnection
            connection.apply {
                requestMethod = "POST"
                setRequestProperty("x-goog-api-key", key)
                setRequestProperty("Content-Type", "application/json")
                connectTimeout = 15_000
                readTimeout = 30_000
                doOutput = true
            }
            connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }

            val code = connection.responseCode
            if (code != HttpURLConnection.HTTP_OK) {
                val state = when (code) {
                    400 -> "invalid_api_key"
                    401, 403 -> "authentication_failed"
                    429 -> "quota_exceeded"
                    503 -> "service_unavailable"
                    else -> "service_unavailable (HTTP $code)"
                }
                return TranslateResult.Failure(state)
            }

            val response = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            val text = extractText(response)
            return if (text.isEmpty()) {
                TranslateResult.Failure("invalid_response")
            } else {
                TranslateResult.Success(text)
            }
        } catch (_: IOException) {
            return TranslateResult.Failure("network_error")
        } catch (_: Exception) {
            return TranslateResult.Failure("invalid_response")
        } finally {
            connection?.disconnect()
        }
    }

    /**
     * Translation + polish in ONE Gemini call: natural target language, fixed
     * punctuation/grammar, preserved facts. This is deliberately a separate
     * call from speech recognition (the recognizer produced `transcript`).
     */
    private fun promptFor(mode: String, transcript: String): String = when (mode) {
        "D" -> "Translate the following English speech transcript into natural, correct Bengali (Bangla). Fix punctuation and grammar, make it sound professional, and preserve names, dates, numbers and amounts exactly. Return only the translated Bengali text.\n\n$transcript"
        else -> "Translate the following Bengali speech transcript into natural, correct English. Fix punctuation and grammar, make it sound professional, and preserve names, dates, numbers and amounts exactly. Return only the translated English text.\n\n$transcript"
    }

    /** Scan all candidates/parts, skip thinking parts, join real text. */
    private fun extractText(response: String): String {
        val root = JSONObject(response)
        val candidates = root.optJSONArray("candidates") ?: return ""
        val parts = candidates.optJSONObject(0)
            ?.optJSONObject("content")
            ?.optJSONArray("parts") ?: return ""
        val result = StringBuilder()
        for (index in 0 until parts.length()) {
            val part = parts.optJSONObject(index) ?: continue
            if (part.optBoolean("thought")) continue
            val text = part.optString("text", "")
            if (text.isNotEmpty()) result.append(text)
        }
        return result.toString().trim()
    }
}
