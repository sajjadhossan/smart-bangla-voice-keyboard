package com.smartbangla.voicekeyboard

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Unlimited, persistent clipboard history. There is deliberately NO item cap —
 * entries are appended to a JSON file in app-private storage and only bounded
 * by device storage. The IME registers a real ClipboardManager listener so
 * every copy made while it is the active keyboard is captured.
 */
object ClipboardStore {
    data class Item(val text: String, val time: Long)

    private const val FILE = "clipboard_history.json"
    private const val PINNED_FILE = "clipboard_pinned.json"
    private var appContext: Context? = null

    fun init(context: Context) {
        appContext = context.applicationContext
    }

    private fun file(): File? = appContext?.let { File(it.filesDir, FILE) }

    /** Newest first. Immediate duplicates are ignored. */
    fun add(text: String) {
        val value = text.trim()
        if (value.isEmpty()) return
        synchronized(this) {
            val target = file() ?: return
            val items = readLocked(target).toMutableList()
            if (items.firstOrNull()?.text == value) return
            items.add(0, Item(value, System.currentTimeMillis()))
            writeLocked(target, items)
        }
    }

    fun all(): List<Item> = synchronized(this) {
        file()?.let { readLocked(it) } ?: emptyList()
    }

    /** Items pinned by the user, kept in a separate file so old history still loads. */
    fun pinned(): Set<String> = synchronized(this) {
        val target = appContext?.let { File(it.filesDir, PINNED_FILE) } ?: return emptySet()
        if (!target.exists()) return emptySet()
        val raw = runCatching { target.readText() }.getOrNull() ?: return emptySet()
        val array = runCatching { JSONArray(raw) }.getOrNull() ?: return emptySet()
        val result = mutableSetOf<String>()
        for (index in 0 until array.length()) {
            val value = array.optString(index, "")
            if (value.isNotEmpty()) result.add(value)
        }
        result
    }

    fun isPinned(text: String): Boolean = text in pinned()

    /** Pinned items first (still newest-first inside each group). */
    fun allSorted(): List<Item> {
        val pinnedValues = pinned()
        val (pinnedItems, rest) = all().partition { it.text in pinnedValues }
        return pinnedItems + rest
    }

    fun togglePin(text: String) {
        synchronized(this) {
            val target = appContext?.let { File(it.filesDir, PINNED_FILE) } ?: return
            val values = pinned().toMutableSet()
            if (!values.add(text)) values.remove(text)
            val array = JSONArray()
            for (value in values) array.put(value)
            target.writeText(array.toString())
        }
    }

    fun clear() {
        synchronized(this) {
            file()?.writeText("[]")
            appContext?.let { File(it.filesDir, PINNED_FILE) }?.writeText("[]")
        }
    }

    fun removeAt(index: Int) {
        synchronized(this) {
            val target = file() ?: return
            val items = readLocked(target).toMutableList()
            if (index in items.indices) {
                val removed = items.removeAt(index)
                writeLocked(target, items)
                val pinTarget = appContext?.let { File(it.filesDir, PINNED_FILE) }
                if (pinTarget != null && removed.text in pinned()) {
                    val values = JSONArray(pinTarget.readText())
                    val kept = JSONArray()
                    for (i in 0 until values.length()) {
                        val value = values.optString(i, "")
                        if (value != removed.text) kept.put(value)
                    }
                    pinTarget.writeText(kept.toString())
                }
            }
        }
    }

    /** Explicit user copy action — writes the real system clipboard too. */
    fun copyToSystem(context: Context, text: String) {
        val manager = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
        if (manager != null) {
            manager.setPrimaryClip(ClipData.newPlainText("Smart Bangla Voice Keyboard", text))
        }
        add(text)
    }

    private fun readLocked(source: File): List<Item> {
        if (!source.exists()) return emptyList()
        val raw = runCatching { source.readText() }.getOrNull() ?: return emptyList()
        val array = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
        val result = mutableListOf<Item>()
        for (index in 0 until array.length()) {
            val obj = array.optJSONObject(index) ?: continue
            val text = obj.optString("text", "")
            if (text.isNotEmpty()) result.add(Item(text, obj.optLong("time", 0L)))
        }
        return result
    }

    private fun writeLocked(target: File, items: List<Item>) {
        val array = JSONArray()
        for (item in items) {
            array.put(JSONObject().put("text", item.text).put("time", item.time))
        }
        target.writeText(array.toString())
    }
}
