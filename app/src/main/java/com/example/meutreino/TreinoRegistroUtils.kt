package com.example.meutreino

import java.text.SimpleDateFormat
import java.text.ParsePosition
import java.util.Locale

object TreinoRegistroUtils {

    private val datePatterns = listOf(
        "dd/MM/yyyy, HH:mm",
        "dd/MM/yyyy HH:mm",
        "dd/MM/yyyy"
    )

    /**
     * Returns the most reliable timestamp available for a workout record.
     * Older local records did not persist createdAt, so dataHora remains a
     * backwards-compatible fallback for those records.
     */
    fun timeOf(record: TreinoRegistro): Long {
        if (record.createdAt > 0L) return record.createdAt
        return parseDataHora(record.dataHora)
    }

    fun parseDataHora(value: String): Long {
        val normalized = value.trim()
        return datePatterns.firstNotNullOfOrNull { pattern ->
            val position = ParsePosition(0)
            val parsed = SimpleDateFormat(pattern, Locale("pt", "BR"))
                .apply { isLenient = false }
                .parse(normalized, position)
            parsed?.takeIf { position.index == normalized.length }?.time
        } ?: 0L
    }
}
