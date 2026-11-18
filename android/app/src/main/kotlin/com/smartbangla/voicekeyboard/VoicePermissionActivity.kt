package com.smartbangla.voicekeyboard

import android.Manifest
import android.app.Activity
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.RecognizerIntent

/**
 * A Service (IME) cannot request runtime permissions, so this transparent
 * Activity asks for RECORD_AUDIO only after the in-keyboard consent gate was
 * accepted, then hands the real speech result to the caller via a PendingIntent.
 */
class VoicePermissionActivity : Activity() {

    private var callback: PendingIntent? = null
    private var language = "bn"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        callback = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(EXTRA_CALLBACK, PendingIntent::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(EXTRA_CALLBACK)
        }
        language = intent.getStringExtra(EXTRA_LANGUAGE) ?: "bn"
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            launchRecognizer()
        } else {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_MIC)
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_MIC && grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            launchRecognizer()
        } else {
            setResult(RESULT_CANCELED)
            finish()
        }
    }

    private fun launchRecognizer() {
        val pending = callback
        if (pending == null) {
            finish()
            return
        }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, if (language == "bn") "bn-BD" else "en-US")
            putExtra(
                RecognizerIntent.EXTRA_RESULTS_PENDINGINTENT,
                pending,
            )
        }
        try {
            startActivity(intent)
        } catch (_: Exception) {
            setResult(RESULT_CANCELED)
        }
        finish()
    }

    companion object {
        const val EXTRA_CALLBACK = "voice_callback"
        const val EXTRA_LANGUAGE = "voice_language"
        private const val REQUEST_MIC = 1101
    }
}
