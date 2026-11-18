package com.smartbangla.voicekeyboard

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Real launcher / setup screen. An IME service alone has no app icon, so this
 * activity is what makes the installed app openable. Every control here is
 * wired to a real platform action — there are no decorative buttons.
 */
class MainActivity : Activity() {

    private lateinit var statusText: TextView
    private lateinit var keyInput: EditText
    private lateinit var connectionText: TextView
    private var keyVisible = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = ScrollView(this)
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 48, 48, 48)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            )
        }
        root.addView(box)
        setContentView(root)

        box.addView(sectionTitle(getString(R.string.app_name)))
        box.addView(info(getString(R.string.main_intro)))

        box.addView(sectionTitle(getString(R.string.status_heading)))
        statusText = info("")
        box.addView(statusText)
        box.addView(action(getString(R.string.btn_enable)) { openInputMethodSettings() })
        box.addView(action(getString(R.string.btn_picker)) { showKeyboardPicker() })

        box.addView(sectionTitle(getString(R.string.consent_heading)))
        box.addView(consentBox(getString(R.string.consent_voice), SecureStore.voiceConsent(this)) {
            SecureStore.setVoiceConsent(this, it)
            refreshStatus()
        })
        box.addView(consentBox(getString(R.string.consent_text), SecureStore.textConsent(this)) {
            SecureStore.setTextConsent(this, it)
            refreshStatus()
        })

        box.addView(sectionTitle(getString(R.string.api_heading)))
        keyInput = EditText(this).apply {
            hint = getString(R.string.api_hint)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        box.addView(keyInput)
        lateinit var showButton: Button
        showButton = action(getString(R.string.btn_show_key)) {
            keyVisible = !keyVisible
            keyInput.inputType = if (keyVisible) {
                InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
            } else {
                InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            }
            showButton.text = getString(if (keyVisible) R.string.btn_hide_key else R.string.btn_show_key)
        }
        box.addView(showButton)
        box.addView(action(getString(R.string.btn_save_key)) {
            val value = keyInput.text.toString().trim()
            if (value.isEmpty()) {
                Toast.makeText(this, R.string.key_empty, Toast.LENGTH_SHORT).show()
                return@action
            }
            SecureStore.saveApiKey(this, value)
            keyInput.text.clear()
            Toast.makeText(this, R.string.key_saved, Toast.LENGTH_SHORT).show()
            refreshStatus()
        })
        box.addView(action(getString(R.string.btn_remove_key)) {
            SecureStore.clearApiKey(this)
            keyInput.text.clear()
            Toast.makeText(this, R.string.key_removed, Toast.LENGTH_SHORT).show()
            refreshStatus()
        })
        box.addView(action(getString(R.string.btn_test)) { testConnection() })
        connectionText = info("")
        box.addView(connectionText)

        refreshStatus()
    }

    override fun onResume() {
        super.onResume()
        refreshStatus()
    }

    private fun refreshStatus() {
        val enabled = try {
            val list = Settings.Secure.getString(contentResolver, Settings.Secure.ENABLED_INPUT_METHODS) ?: ""
            list.split(':').any { it.contains(packageName) }
        } catch (_: Exception) {
            false
        }
        statusText.text = buildString {
            append("Keyboard enabled: ")
            append(if (enabled) "YES" else "NO — tap the button above")
            append('\n')
            append("Voice consent: ")
            append(if (SecureStore.voiceConsent(this@MainActivity)) "on" else "off")
            append('\n')
            append("Text consent: ")
            append(if (SecureStore.textConsent(this@MainActivity)) "on" else "off")
            append('\n')
            append("API key: ")
            append(if (SecureStore.hasApiKey(this@MainActivity)) "saved (encrypted)" else "not saved")
        }
        connectionText.text = if (SecureStore.hasApiKey(this)) {
            "Tap Test connection to send only the key to Google (no typing/audio)."
        } else {
            getString(R.string.key_missing)
        }
    }

    private fun openInputMethodSettings() {
        startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
    }

    private fun showKeyboardPicker() {
        val manager = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
        manager.showInputMethodPicker()
    }

    /** Explicit user action only. Sends the key alone — never user text or audio. */
    private fun testConnection() {
        val key = SecureStore.readApiKey(this)
        if (key.isBlank()) {
            connectionText.text = "not_configured — save a key first"
            return
        }
        connectionText.text = getString(R.string.testing)
        Thread {
            val state = probeModels(key)
            runOnUiThread { connectionText.text = state }
        }.start()
    }

    /** GET /models — the same real probe as the shared Gemini provider. */
    private fun probeModels(key: String): String {
        var connection: HttpURLConnection? = null
        try {
            val url = URL("https://generativelanguage.googleapis.com/v1beta/models")
            connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.setRequestProperty("x-goog-api-key", key)
            connection.connectTimeout = 10_000
            connection.readTimeout = 10_000
            return when (val code = connection.responseCode) {
                200 -> "connected"
                400 -> "invalid_api_key"
                401, 403 -> "authentication_failed"
                429 -> "quota_exceeded"
                503 -> "service_unavailable"
                else -> "service_unavailable (HTTP $code)"
            }
        } catch (_: IOException) {
            return "network_error"
        } finally {
            connection?.disconnect()
        }
    }

    private fun sectionTitle(text: String): TextView = TextView(this).apply {
        this.text = text
        textSize = 20f
        setPadding(0, 32, 0, 12)
    }

    private fun info(text: String): TextView = TextView(this).apply {
        this.text = text
        textSize = 15f
        setPadding(0, 8, 0, 16)
    }

    private fun action(label: String, onClick: () -> Unit): Button = Button(this).apply {
        text = label
        isAllCaps = false
        setOnClickListener { onClick() }
    }

    private fun consentBox(label: String, initial: Boolean, onChange: (Boolean) -> Unit): CheckBox =
        CheckBox(this).apply {
            text = label
            isChecked = initial
            setOnCheckedChangeListener { _, checked -> onChange(checked) }
        }
}
