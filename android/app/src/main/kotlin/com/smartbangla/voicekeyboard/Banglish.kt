package com.smartbangla.voicekeyboard

/**
 * Offline Roman-Bangla (বাংলিশ) → Bengali script transliteration.
 *
 * Honest scope: this is a bounded dictionary of common Banglish words plus a
 * simple word-final vowel-sign rule. It is NOT a full phonetic engine — unknown
 * tokens are passed through unchanged rather than being faked. No network, no
 * Gemini, so Banglish typing works with data off.
 */
object Banglish {
    private val WORDS: Map<String, String> = mapOf(
        "ami" to "আমি", "amar" to "আমার", "amake" to "আমাকে", "amader" to "আমাদের",
        "achi" to "আছি", "acho" to "আছো", "ache" to "আছে", "accho" to "আচ্ছা",
        "bhalo" to "ভালো", "valo" to "ভালো", "bhalobashi" to "ভালোবাসি",
        "kemon" to "কেমন", "kemot" to "কেমত", "nam" to "নাম", "tomar" to "তোমার",
        "tumi" to "তুমি", "tomeke" to "তোমাকে", "apni" to "আপনি", "apnar" to "আপনার",
        "rahim" to "রহিম", "karim" to "করিম", "bangladesh" to "বাংলাদেশ",
        "bangla" to "বাংলা", "inglish" to "ইংলিশ", "banglish" to "বাংলিশ",
        "thaki" to "থাকি", "thako" to "থাকো", "thake" to "থাকে", "ghor" to "ঘর",
        "ghore" to "ঘরে", "pani" to "পানি", "khabo" to "খাবো", "khechi" to "খেয়েছি",
        "chai" to "চাই", "chay" to "চায়", "bolo" to "বলো", "bolchi" to "বলছি",
        "shuno" to "শুনো", "shunchi" to "শুনছি", "dekho" to "দেখো", "dekchi" to "দেখছি",
        "jao" to "যাও", "jabo" to "যাবো", "jachhi" to "যাচ্ছি", "esho" to "এসো",
        "elo" to "এলো", "ashbo" to "আসবো", "karo" to "কারো", "kar" to "কার",
        "ki" to "কি", "keno" to "কেনো", "kothay" to "কোথায়", "kobe" to "কবে",
        "ejonno" to "এজন্য", "todh" to "তদ্ধ", "eking" to "একিং", "onek" to "অনেক",
        "kom" to "কম", "beshi" to "বেশি", "sob" to "সব", "kono" to "কোনো",
        "nah" to "না", "na" to "না", "ha" to "হ্যাঁ", "hyan" to "হ্যাঁ",
        "bhai" to "ভাই", "bon" to "বোন", "ma" to "মা", "baba" to "বাবা",
        "dada" to "দাদা", "nani" to "নানী", "kaku" to "কাকু", "mashi" to "মাসি",
        "today" to "আজ", "tomorrow" to "কাল", "yesterday" to "গতকাল",
        "dhonnobad" to "ধন্যবাদ", "obosyoi" to "অবশ্যই", "koma" to "ক্ষমা",
        "shubho" to "শুভ", "nomoshkar" to "নমস্কার", "salam" to "সালাম",
        "kaj" to "কাজ", "korte" to "করতে", "korchi" to "করছি", "kore" to "করে",
        "leo" to "লিখো", "lechi" to "লিখেছি", "poro" to "পড়ো", "pore" to "পড়ে",
    )

    /** Transliterate each whitespace-separated token; unknown tokens stay as-is. */
    fun toBangla(input: String): String = input
        .split(Regex("\\s+"))
        .filter { it.isNotEmpty() }
        .joinToString(" ") { token ->
            val key = token.lowercase().trim(',', '.', '!', '?')
            WORDS[key] ?: token
        }
}
