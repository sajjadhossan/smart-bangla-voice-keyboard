package com.smartbangla.voicekeyboard

/**
 * Pure/offline logic for the dedicated voice assistant.
 *
 * Detects the language of a speech transcript from its Unicode script, and
 * parses a spoken translation command ("অনুবাদ করো" / "translate"). No network,
 * no Gemini here — the assistant only decides WHAT to do. Gemini is called
 * later, and only when a translation is actually requested.
 */
object VoiceAssistant {
    data class Command(val translate: Boolean, val target: String?, val cleanText: String)

    private val TRANSLATE_PHRASES = listOf(
        "অনুবাদ করে দাও", "অনুবাদ করে দ", "অনুবাদ করো", "অনুবাদ কর", "অনুবাদ",
        "ট্রান্সলেশন", "ট্রান্সলেট", "translate this for me", "translate this",
        "translate it", "translate", "translation",
    ).sortedByDescending { it.length }

    private val TARGET_BN = listOf(
        "বাংলা ভাষায়", "বাংলাতে", "বাংলায়", "বাংলা করে", "to bengali",
        "to bangla", "in bengali", "in bangla",
    ).sortedByDescending { it.length }

    private val TARGET_EN = listOf(
        "ইংরেজিতে", "ইংলিশে", "ইংলিশ করে", "to english", "in english",
    ).sortedByDescending { it.length }

    /** Bengali script occupies U+0980–U+09FF; Latin script means English. */
    fun detectLanguage(text: String): String =
        if (text.any { it.code in 0x0980..0x09FF }) "bn" else "en"

    /** Parse the transcript: strip command words, keep the actual content. */
    fun parse(raw: String): Command {
        val lower = raw.lowercase()
        val translate = TRANSLATE_PHRASES.any { lower.contains(it) }
        var target: String? = null
        if (TARGET_BN.any { lower.contains(it) }) target = "bn"
        if (TARGET_EN.any { lower.contains(it) }) target = "en"

        var clean = raw
        for (phrase in TRANSLATE_PHRASES + TARGET_BN + TARGET_EN) {
            clean = clean.replace(Regex(Regex.escape(phrase), RegexOption.IGNORE_CASE), " ")
        }
        clean = clean.replace(Regex("\\s+"), " ").trim(' ', ',', '.', '!', '?', '।', '،')
        return Command(translate, target, clean)
    }

    /**
     * With no explicit target, translate to the OTHER language.
     * Mode C = Bengali→English, mode D = English→Bengali (shared vocabulary).
     */
    fun direction(source: String, target: String?): String {
        val destination = target ?: if (source == "bn") "en" else "bn"
        return if (destination == "en") "C" else "D"
    }
}
