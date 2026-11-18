package com.smartbangla.voicekeyboard

import android.app.PendingIntent
import android.inputmethodservice.InputMethodService
import android.content.BroadcastReceiver
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.speech.RecognizerIntent
import android.view.Gravity
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.ExtractedTextRequest
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

/**
 * Real system-wide input method.
 *
 * Top toolbar (mic pinned top-right): Clipboard · Lang · Translate · Mic.
 * Offline typing works with the network off. Voice capture, clipboard and any
 * Gemini translation require the relevant explicit consent; results are always
 * previewed before insert. No decorative buttons.
 */
class BanglaVoiceIme : InputMethodService() {

    private lateinit var suggestionBar: LinearLayout
    private lateinit var btnClipboard: Button
    private lateinit var btnLang: Button
    private lateinit var btnTranslate: Button
    private lateinit var btnMic: Button
    private val keyRows = arrayOfNulls<LinearLayout>(4)

    // Typing mode: bn (Bengali script), en (English), banglish (roman → Bengali).
    private var language = "bn"
    private var layer = BanglaKeys.LAYER_LETTERS
    private var shifted = false
    private var pendingText: String? = null

    // Language the user WILL SPEAK into the mic: bn | en | banglish.
    private var pendingVoiceSource = "bn"
    private var pendingTranslateText: String? = null
    private var pendingTranslateMode = "C"
    private val mainHandler = Handler(Looper.getMainLooper())

    private val voiceReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val results = intent.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            val heard = results?.firstOrNull()?.trim().orEmpty()
            if (heard.isEmpty()) {
                showBarText(getString(R.string.voice_unavailable))
                return
            }
            // Banglish speech is recognized as romanized text, then converted offline.
            val shown = if (pendingVoiceSource == "banglish") Banglish.toBangla(heard) else heard
            renderTranscript(shown)
        }
    }

    /** Real clipboard monitor — captures every copy while this IME is active. */
    private val clipboardListener = ClipboardManager.OnPrimaryClipChangedListener {
        val manager = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            ?: return@OnPrimaryClipChangedListener
        val text = manager.primaryClip?.getItemAt(0)?.text?.toString()?.trim().orEmpty()
        if (text.isNotEmpty()) ClipboardStore.add(text)
    }

    override fun onCreate() {
        super.onCreate()
        ClipboardStore.init(this)
        val filter = IntentFilter(ACTION_VOICE_RESULT)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(voiceReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(voiceReceiver, filter)
        }
        (getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager)
            ?.addPrimaryClipChangedListener(clipboardListener)
    }

    override fun onDestroy() {
        runCatching { unregisterReceiver(voiceReceiver) }
        (getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager)
            ?.removePrimaryClipChangedListener(clipboardListener)
        super.onDestroy()
    }

    override fun onCreateInputView(): View {
        val view = LayoutInflater.from(this).inflate(R.layout.keyboard_view, null)
        btnClipboard = view.findViewById(R.id.btnClipboard)
        btnLang = view.findViewById(R.id.btnLang)
        btnTranslate = view.findViewById(R.id.btnTranslate)
        btnMic = view.findViewById(R.id.btnMic)
        suggestionBar = view.findViewById(R.id.suggestionBar)
        keyRows[0] = view.findViewById(R.id.keyRow1)
        keyRows[1] = view.findViewById(R.id.keyRow2)
        keyRows[2] = view.findViewById(R.id.keyRow3)
        keyRows[3] = view.findViewById(R.id.keyRow4)

        btnClipboard.setOnClickListener { showClipboardPanel() }
        btnLang.setOnClickListener { showLanguageMenu() }
        btnTranslate.setOnClickListener { showTranslateMenu(currentText()) }
        btnMic.setOnClickListener { onMicTapped() }

        renderKeys()
        renderDefaultSuggestions()
        return view
    }

    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        pendingText = null
        renderDefaultSuggestions()
    }

    // ---------- key rendering ----------

    private fun renderKeys() {
        val rows = BanglaKeys.rows(layer, if (language == "bn") "bn" else "en")
        for (index in 0..2) {
            val container = keyRows[index] ?: continue
            container.removeAllViews()
            for (label in rows.getOrNull(index).orEmpty()) {
                container.addView(makeKey(label, 1f) { onCharacter(label) })
            }
        }
        val controls = keyRows[3] ?: return
        controls.removeAllViews()
        val layerLabel = if (language == "bn") getString(R.string.key_layer) else "123"
        controls.addView(makeKey(layerLabel, 1.2f) { cycleLayer() })
        controls.addView(makeKey(getString(R.string.key_shift), 1f) {
            shifted = !shifted
            renderKeys()
        })
        val modeLabel = when (language) {
            "bn" -> "BN"
            "en" -> "EN"
            else -> "BANG"
        }
        controls.addView(makeKey(modeLabel, 1f) { cycleLanguage() })
        controls.addView(makeKey(getString(R.string.key_space), 3f) { commitSpace() })
        controls.addView(makeKey(getString(R.string.key_backspace), 1.3f) { backspace() })
        controls.addView(makeKey(getString(R.string.key_enter), 1.3f) { enter() })
    }

    private fun makeKey(label: String, weight: Float, onClick: () -> Unit): Button = Button(this).apply {
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

    /** In Banglish mode, space transliterates the current roman token to Bengali. */
    private fun commitSpace() {
        if (language == "banglish") {
            val token = currentText().trim().split(Regex("\\s+")).lastOrNull().orEmpty()
            val bangla = Banglish.toBangla(token)
            if (token.isNotEmpty() && bangla != token) {
                currentInputConnection?.deleteSurroundingText(token.length, 0)
                commit(bangla + " ")
                return
            }
        }
        commit(" ")
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
        val action = info?.imeOptions?.and(0x00FFFFFF)
        if (action != null && action != EditorInfo.IME_ACTION_NONE &&
            action != EditorInfo.IME_ACTION_UNSPECIFIED
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

    private fun setLanguage(mode: String) {
        language = mode
        layer = BanglaKeys.LAYER_LETTERS
        shifted = false
        renderKeys()
        renderDefaultSuggestions()
    }

    private fun cycleLanguage() {
        setLanguage(when (language) {
            "bn" -> "en"
            "en" -> "banglish"
            else -> "bn"
        })
    }

    private fun currentText(): String =
        currentInputConnection?.getExtractedText(ExtractedTextRequest(), 0)?.text?.toString().orEmpty()

    private fun clearPendingIfVisible() {
        if (pendingText != null) {
            pendingText = null
            renderDefaultSuggestions()
        }
    }

    // ---------- suggestion bar helpers ----------

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

    private fun addBarText(message: String, weight: Float = 1f) {
        suggestionBar.addView(TextView(this).apply {
            text = message
            gravity = Gravity.CENTER_VERTICAL
            setPadding(12, 0, 12, 0)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, weight)
        })
    }

    private fun showBarText(message: String) {
        resetBar()
        addBarText(message, 6f)
    }

    private fun renderDefaultSuggestions() {
        resetBar()
        val token = currentText().trim().split(Regex("\\s+")).lastOrNull().orEmpty()
        for (word in OfflineText.suggestions(token).take(3)) {
            addBar(word) { commit(word) }
        }
        addBar(getString(R.string.suggestion_ai), 1f) { showAiMenu() }
        addBar(getString(R.string.tool_lang), 1f) { showLanguageMenu() }
    }

    private fun showAiMenu() {
        resetBar()
        addBar(getString(R.string.ai_format), 2f) { previewCorrection("format") }
        addBar(getString(R.string.ai_shorter), 2f) { previewCorrection("shorter") }
        addBar(getString(R.string.btn_back), 1f) { renderDefaultSuggestions() }
    }

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
        addBarText(getString(R.string.ai_preview_title), 2f)
        addBar("→ " + candidate.take(18), 3f) { }
        addBar(getString(R.string.ai_apply), 1f) { applyPending() }
        addBar(getString(R.string.ai_cancel), 1f) { pendingText = null; renderDefaultSuggestions() }
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

    // ---------- language mode menu ----------

    private fun showLanguageMenu() {
        resetBar()
        addBarText(getString(R.string.lang_title), 2f)
        addBar(getString(R.string.lang_bn), 2f) { setLanguage("bn") }
        addBar(getString(R.string.lang_en), 2f) { setLanguage("en") }
        addBar(getString(R.string.lang_banglish), 2f) { setLanguage("banglish") }
        addBar(getString(R.string.btn_back), 1f) { renderDefaultSuggestions() }
    }

    // ---------- unlimited clipboard ----------

    private fun showClipboardPanel() {
        val items = ClipboardStore.all()
        resetBar()
        addBarText(getString(R.string.clip_title, items.size), 2f)
        addBar(getString(R.string.clip_copy), 2f) {
            val text = currentText().trim()
            if (text.isEmpty()) {
                showBarText("Nothing to copy")
            } else {
                ClipboardStore.copyToSystem(this, text)
                showClipboardPanel()
            }
        }
        addBar(getString(R.string.clip_clear), 1f) {
            ClipboardStore.clear()
            showClipboardPanel()
        }
        addBar(getString(R.string.btn_back), 1f) { renderDefaultSuggestions() }
        for (item in items.take(12)) {
            addBar(item.text.take(14), 2f) { commit(item.text) }
        }
        if (items.size > 12) {
            addBarText(getString(R.string.clip_more, items.size - 12), 3f)
        }
        if (items.isEmpty()) addBarText(getString(R.string.clip_empty), 3f)
    }

    // ---------- mic: consent → source language → record → text ----------

    private fun onMicTapped() {
        if (!SecureStore.voiceConsent(this)) {
            showConsentPrompt()
            return
        }
        showVoiceSourceMenu()
    }

    private fun showConsentPrompt() {
        resetBar()
        addBarText(getString(R.string.voice_consent_needed), 3f)
        addBar(getString(R.string.btn_enable_short), 1f) {
            SecureStore.setVoiceConsent(this, true)
            showVoiceSourceMenu()
        }
        addBar(getString(R.string.btn_not_now), 1f) { renderDefaultSuggestions() }
    }

    private fun showVoiceSourceMenu() {
        resetBar()
        addBarText(getString(R.string.voice_source_title), 2f)
        addBar(getString(R.string.voice_src_bn), 2f) { startVoiceForSource("bn") }
        addBar(getString(R.string.voice_src_en), 2f) { startVoiceForSource("en") }
        addBar(getString(R.string.voice_src_banglish), 2f) { startVoiceForSource("banglish") }
        addBar(getString(R.string.btn_back), 1f) { renderDefaultSuggestions() }
    }

    private fun startVoiceForSource(source: String) {
        pendingVoiceSource = source
        val recognizerLanguage = if (source == "bn") "bn" else "en"
        val callback = PendingIntent.getBroadcast(
            this, 100, Intent(ACTION_VOICE_RESULT),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val intent = Intent(this, VoicePermissionActivity::class.java).apply {
            putExtra(VoicePermissionActivity.EXTRA_CALLBACK, callback)
            putExtra(VoicePermissionActivity.EXTRA_LANGUAGE, recognizerLanguage)
        }
        try {
            startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (_: Exception) {
            showBarText(getString(R.string.voice_unavailable))
        }
    }

    /** Speech is now plain text — insert it directly, translate it, or discard. */
    private fun renderTranscript(text: String) {
        pendingText = text
        resetBar()
        addBarText(getString(R.string.voice_heard, text.take(20)), 3f)
        addBar(getString(R.string.voice_insert), 1f) { commitIfFocused(text); pendingText = null }
        addBar(getString(R.string.tool_translate), 1f) { showTranslateMenu(text) }
        addBar(getString(R.string.btn_discard), 1f) { pendingText = null; renderDefaultSuggestions() }
    }

    // ---------- translate: BN→EN / EN→BN (Gemini, text-only consent) ----------

    private fun showTranslateMenu(text: String) {
        if (text.isBlank()) {
            showBarText("Nothing to translate")
            return
        }
        pendingTranslateText = text
        if (!SecureStore.textConsent(this)) {
            showTranslateConsentGate(text)
            return
        }
        resetBar()
        addBarText(getString(R.string.translate_title), 2f)
        addBar(getString(R.string.tr_bn_en), 2f) { runTranslate(text, "C") }
        addBar(getString(R.string.tr_en_bn), 2f) { runTranslate(text, "D") }
        addBar(getString(R.string.btn_back), 1f) { renderDefaultSuggestions() }
    }

    private fun showTranslateConsentGate(text: String) {
        resetBar()
        addBarText(getString(R.string.voice_text_consent_needed), 3f)
        addBar(getString(R.string.btn_enable_short), 1f) {
            SecureStore.setTextConsent(this, true)
            showTranslateMenu(text)
        }
        addBar(getString(R.string.btn_not_now), 1f) { renderDefaultSuggestions() }
    }

    private fun runTranslate(text: String, mode: String) {
        pendingTranslateMode = mode
        showBarText(getString(R.string.voice_translating))
        Thread {
            val result = GeminiVoiceClient.translateText(this@BanglaVoiceIme, text, mode)
            mainHandler.post {
                when (result) {
                    is GeminiVoiceClient.TranslateResult.Success ->
                        showTranslationPreview(result.text)
                    is GeminiVoiceClient.TranslateResult.Failure ->
                        showTranslationFailure(result.state)
                }
            }
        }.start()
    }

    private fun showTranslationPreview(translated: String) {
        pendingText = translated
        resetBar()
        addBarText(getString(R.string.voice_translated_title), 2f)
        addBar("→ " + translated.take(24), 3f) { }
        addBar(getString(R.string.voice_insert), 1f) { commitIfFocused(translated); pendingText = null }
        addBar(getString(R.string.btn_discard), 1f) { pendingText = null; renderDefaultSuggestions() }
    }

    private fun showTranslationFailure(state: String) {
        resetBar()
        addBarText(getString(R.string.voice_translate_failed, state), 3f)
        addBar(getString(R.string.btn_retry), 1f) {
            val text = pendingTranslateText.orEmpty()
            if (text.isNotEmpty()) runTranslate(text, pendingTranslateMode)
        }
        addBar(getString(R.string.btn_back), 1f) { renderDefaultSuggestions() }
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
