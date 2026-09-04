package com.example.meutreino

object CardioMinutes {

    const val MIN = 1

    fun parse(raw: CharSequence?): Int? {
        val value = raw?.toString()?.trim().orEmpty()
        if (value.isEmpty() || value.any { it !in '0'..'9' }) return null

        val parsed = value.toLongOrNull() ?: return null
        return parsed.takeIf { it >= MIN.toLong() && it <= Int.MAX_VALUE }?.toInt()
    }
}
