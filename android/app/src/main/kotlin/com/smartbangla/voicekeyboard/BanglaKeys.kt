package com.smartbangla.voicekeyboard

/**
 * Native mirror of the shared TypeScript layout contract (shared/keyboard/layouts.ts).
 * The APK cannot run the TS core, so the key matrix lives here; the vocabulary
 * and offline text helpers stay in one place and never call the network.
 */
object BanglaKeys {
    const val LAYER_LETTERS = 0
    const val LAYER_VOWELS = 1
    const val LAYER_NUMBERS = 2

    private val LETTERS: List<List<String>> = listOf(
        listOf("ক", "খ", "গ", "ঘ", "ঙ", "চ", "ছ", "জ", "ঝ", "ঞ"),
        listOf("ট", "ঠ", "ড", "ঢ", "ণ", "ত", "থ", "দ", "ধ", "ন"),
        listOf("প", "ফ", "ব", "ভ", "ম", "য", "র", "ল", "শ", "ষ"),
    )

    private val VOWELS: List<List<String>> = listOf(
        listOf("অ", "আ", "ই", "ঈ", "উ", "ঊ", "এ", "ঐ", "ও", "ঔ"),
        listOf("া", "ি", "ু", "ূ", "ে", "ৈ", "ো", "ৌ", "ং", "ঃ"),
        listOf("ড়", "ঢ়", "য়", "ৎ", "ঽ", "ঁ"),
    )

    private val NUMBERS: List<List<String>> = listOf(
        listOf("০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"),
        listOf("+", "-", "×", "÷", "=", "%", "(", ")", ",", "."),
        listOf("৳", "₹", "$", "#", "@", "&", "*", "!", "?"),
    )

    private val ENGLISH: List<List<String>> = listOf(
        listOf("q", "w", "e", "r", "t", "y", "u", "i", "o", "p"),
        listOf("a", "s", "d", "f", "g", "h", "j", "k", "l", "'"),
        listOf("z", "x", "c", "v", "b", "n", "m", ",", ".", "?"),
    )

    fun rows(layer: Int, language: String): List<List<String>> {
        if (language == "en") return ENGLISH
        return when (layer) {
            LAYER_VOWELS -> VOWELS
            LAYER_NUMBERS -> NUMBERS
            else -> LETTERS
        }
    }
}

/** Offline helpers. No network, no Gemini — the keyboard works with data off. */
object OfflineText {
    private val TRANSLITERATION: Map<String, String> = mapOf(
        "ami" to "আমি", "amar" to "আমার", "achi" to "আছি", "acho" to "আছো",
        "bhalo" to "ভালো", "valo" to "ভালো", "bangladesh" to "বাংলাদেশ",
        "kemon" to "কেমন", "nam" to "নাম", "rahim" to "রহিম", "thaki" to "থাকি",
    )

    private val WORDS: List<String> = listOf(
        "আমি", "আমার", "ভালো", "বাংলাদেশ", "আছি", "আছো", "কেমন", "নাম", "রহিম", "থাকি", "ঘর", "পানি",
    )

    fun transliterate(token: String): String? = TRANSLITERATION[token.lowercase()]

    /** Word + transliteration suggestions for the current token. */
    fun suggestions(token: String): List<String> {
        if (token.isEmpty()) return WORDS.take(3)
        val direct = WORDS.filter { it.startsWith(token) }.take(3)
        val roman = transliterate(token)
        return if (roman != null && roman !in direct) direct + roman else direct
    }

    fun format(text: String): String = text.trim()
        .replace(Regex("[ \\t]{2,}"), " ")
        .replace(Regex("\\s+([,!?;:।])"), "$1")

    fun shorter(text: String): String = format(
        text.replace(Regex("(?i)\\b(actually|basically|literally|really|just|you know|I mean)\\b,?\\s*"), "")
    )
}
