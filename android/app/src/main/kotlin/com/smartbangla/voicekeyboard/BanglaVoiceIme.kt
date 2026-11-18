package com.smartbangla.voicekeyboard

import android.app.PendingIntent
import android.inputmethodservice.InputMethodService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.speech.RecognizerIntent
import android.view.Gravity
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.View
import android.view.inputmethod.ExtractedTextRequest
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

/**
 * Real system-wide input method. Offline typing works with the network off;
 * voice and any egress require explicit, revocable consent stored encrypted.
 * Corrections are always previewed and applied only on an explicit tap.
 */
class BanglaVoiceIme : InputMethodService() {

    private lateinit var suggestionBar: LinearLayout
    private val keyRows = arrayOfNulls<LinearLayout>(4)
    private var language = "bn"
    private var layer = BanglaKeys.LAYER_LETTERS
    private var shifted = false
    private var pendingText: String? = null

    private val voiceReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val results = intent.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            val heard = results?.firstOrNull()?.trim().orEmpty()
            if (heard.isEmpty()) {
                showBarText(getString(R.string.voice_unavailable))
                return
            }
            renderVoiceResult(heard)
        }
    }

    override fun onCreate() {
        super.onCreate()
        val filter = IntentFilter(ACTION_VOICE_RESULT)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(voiceReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(voiceReceiver, filter)
        }
    }

    override fun onDestroy() {
        runCatching { unregisterReceiver(voiceReceiver) }
        super.onDestroy()
    }

    override fun onCreateInputView(): View {
        val view = LayoutInflater.from(this).inflate(R.layout.keyboard_view, null)
        suggestionBar = view.findViewById(R.id.suggestionBar)
        keyRows[0] = view.findViewById(R.id.keyRow1)
        keyRows[1] = view.findViewById(R.id.keyRow2)
        keyRows[2] = view.findViewById(R.id.keyRow3)
        keyRows[3] = view.findViewById(R.id.keyRow4)
        renderKeys()
        renderDefaultSuggestions()
        return view
    }

    override fun onStartInputView(info: android.view.inputmethod.EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        pendingText = null
        renderDefaultSuggestions()
    }

    // ---------- key rendering ----------

    private fun renderKeys() {
        val rows = BanglaKeys.rows(layer, language)
        for (index in 0..2) {
            val container = keyRows[index] ?: continue
            container.removeAllViews()
            for (label in rows.getOrNull(index).orEmpty()) {
                container.addView(makeKey(label, 1f) { onCharacter(label) })
            }
        }
        val controls = keyRows[3] ?: return
        controls.removeAllViews()
        val layerLabel = if (language == "en") "123" else getString(R.string.key_layer)
        controls.addView(makeKey(layerLabel, 1.2f) { cycleLayer() })
        controls.addView(makeKey(getString(R.string.key_shift), 1f) {
            shifted = !shifted
            renderKeys()
        })
        controls.addView(makeKey(if (language == "bn") "EN" else "BN", 1f) {
            language = if (language == "bn") "en" else "bn"
            layer = BanglaKeys.LAYER_LETTERS
            renderKeys()
            renderDefaultSuggestions()
        })
        controls.addView(makeKey(getString(R.string.key_space), 3f) { commit(" ") })
        controls.addView(makeKey(getString(R.string.key_backspace), 1.3f) { backspace() })
        controls.addView(makeKey(getString(R.string.key_enter), 1.3f) { enter() })
    }

    private fun makeKey(label: String, weight: Float, onClick: () -> Unit): Button =
        Button(this).apply {
            text = label
            textSize = 18f
            isAllCaps = false
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, weight)
            setOnClickListener { onClick() }
        }

    private fun onCharacter(raw: String) {
        val value = if (shifted && language == "en") raw.uppercase() else raw
        commit(value)
    }

    // ---------- editing ----------

    private fun commit(text: String) {
        currentInputConnection?.commitText(text, 1) ?: showBarText("No input field focused")
        clearPendingIfVisible()
    }

    private fun backspace() {
        val connection = currentInputConnection ?: return
        val selected = connection.getSelectedText(0)
        if (selected != null && selected.isNotEmpty()) {
            connection.commitText("", 1)
        } else {
            connection.deleteSurroundingText(1, 0)
        }
    }

    private fun enter() {
        val info = currentInputEditorInfo
        // Editor action occupies the low 24 bits of imeOptions.
        val action = info?.imeOptions?.and(0x00FFFFFF)
        if (action != null && action != android.view.inputmethod.EditorInfo.IME_ACTION_NONE &&
            action != android.view.inputmethod.EditorInfo.IME_ACTION_UNSPECIFIED
        ) {
            currentInputConnection?.performEditorAction(action)
        } else {
            currentInputConnection?.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ENTER))
            currentInputConnection?.sendKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_ENTER))
        }
    }

    private fun cycleLayer() {
        layer = when (layer) {
            BanglaKeys.LAYER_LETTERS -> BanglaKeys.LAYER_VOWELS
            BanglaKeys.LAYER_VOWELS -> BanglaKeys.LAYER_NUMBERS
            else -> BanglaKeys.LAYER_LETTERS
        }
        renderKeys()
    }

    private fun currentText(): String =
        currentInputConnection?.getExtractedText(ExtractedTextRequest(), 0)?.text?.toString().orEmpty()

    private fun clearPendingIfVisible() {
        if (pendingText != null) {
            pendingText = null
            renderDefaultSuggestions()
        }
    }

    // ---------- suggestion bar ----------

    private fun barButton(label: String, weight: Float = 1f, onClick: () -> Unit): Button = Button(this).apply {
        text = label
        textSize = 13f
        isAllCaps = false
        layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, weight)
        setOnClickListener { onClick() }
    }

    private fun resetBar() {
        suggestionBar.removeAllViews()
        suggestionBar.gravity = Gravity.CENTER_VERTICAL
    }

    private fun addBar(label: String, weight: Float = 1f, onClick: () -> Unit) {
        suggestionBar.addView(barButton(label, weight, onClick))
    }

    private fun showBarText(message: String) {
        resetBar()
        suggestionBar.addView(TextView(this).apply {
            text = message
            gravity = Gravity.CENTER_VERTICAL
            setPadding(16, 0, 16, 0)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.MATCH_PARENT,
            )
        })
    }

    private fun renderDefaultSuggestions() {
        resetBar()
        val token = currentText().trim().split(Regex("\\s+")).lastOrNull().orEmpty()
        for (word in OfflineText.suggestions(token).take(3)) {
            addBar(word) { commit(word) }
        }
        addBar(getString(R.string.suggestion_ai), 1f) { showAiMenu() }
        addBar(getString(R.string.suggestion_mic), 1f) { onMicTapped() }
        addBar(getString(R.string.suggestion_language), 1f) {
            language = if (language == "bn") "en" else "bn"
            layer = BanglaKeys.LAYER_LETTERS
            renderKeys()
            renderDefaultSuggestions()
        }
    }

    private fun showAiMenu() {
        resetBar()
        addBar(getString(R.string.ai_format), 2f) { previewCorrection("format") }
        addBar(getString(R.string.ai_shorter), 2f) { previewCorrection("shorter") }
        addBar("back", 1f) { renderDefaultSuggestions() }
    }

    /** Corrections are NEVER applied silently — show original→candidate first. */
    private fun previewCorrection(kind: String) {
        val original = currentText()
        if (original.isBlank()) {
            showBarText("Nothing to correct")
            return
        }
        val candidate = if (kind == "shorter") OfflineText.shorter(original) else OfflineText.format(original)
        if (candidate == original) {
            showBarText("No change needed")
            return
        }
        pendingText = candidate
        resetBar()
        suggestionBar.addView(TextView(this).apply {
            text = getString(R.string.ai_preview_title)
            gravity = Gravity.CENTER_VERTICAL
            setPadding(12, 0, 12, 0)
        })
        addBar("→ " + candidate.take(18), 3f) { }
        addBar(getString(R.string.ai_apply), 1f) { applyPending() }
        addBar(getString(R.string.ai_cancel), 1f) { renderDefaultSuggestions().also { pendingText = null } }
    }

    private fun applyPending() {
        val replacement = pendingText ?: return
        val connection = currentInputConnection ?: return
        val length = currentText().length
        connection.beginBatchEdit()
        connection.setComposingRegion(0, length)
        connection.commitText(replacement, 1)
        connection.endBatchEdit()
        pendingText = null
        renderDefaultSuggestions()
        Toast.makeText(this, "Applied", Toast.LENGTH_SHORT).show()
    }

    // ---------- voice (consent-gated, real system recognizer) ----------

    private fun onMicTapped() {
        if (!SecureStore.voiceConsent(this)) {
            showConsentPrompt()
            return
        }
        startSystemRecognizer()
    }

    private fun showConsentPrompt() {
        resetBar()
        suggestionBar.addView(TextView(this).apply {
            text = "Voice needs consent"
            gravity = Gravity.CENTER_VERTICAL
            setPadding(12, 0, 12, 0)
        })
        addBar("Enable", 1f) {
            SecureStore.setVoiceConsent(this, true)
            startSystemRecognizer()
        }
        addBar("Not now", 1f) { renderDefaultSuggestions() }
    }

    private fun startSystemRecognizer() {
        val callback = PendingIntent.getBroadcast(
            this,
            100,
            Intent(ACTION_VOICE_RESULT),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val intent = Intent(this, VoicePermissionActivity::class.java).apply {
            putExtra(VoicePermissionActivity.EXTRA_CALLBACK, callback)
            putExtra(VoicePermissionActivity.EXTRA_LANGUAGE, language)
        }
        try {
            startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (_: Exception) {
            showBarText(getString(R.string.voice_unavailable))
        }
    }

    private fun renderVoiceResult(heard: String) {
        pendingText = heard
        resetBar()
        suggestionBar.addView(TextView(this).apply {
            text = "heard: $heard"
            gravity = Gravity.CENTER_VERTICAL
            setPadding(12, 0, 12, 0)
        })
        addBar("Insert", 1f) {
            commitIfFocused(heard)
            pendingText = null
        }
        addBar("Discard", 1f) {
            pendingText = null
            renderDefaultSuggestions()
        }
    }

    private fun commitIfFocused(text: String) {
        if (currentInputConnection == null) {
            showBarText("No input field focused")
            return
        }
        commit(text)
    }

    companion object {
        const val ACTION_VOICE_RESULT = "com.smartbangla.voicekeyboard.VOICE_RESULT"
    }
}
