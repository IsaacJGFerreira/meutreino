package com.example.meutreino

import android.content.Context

object LocalDataReset {

    // ✅ nomes reais que você me passou
    private val PREFS_NAMES = listOf(
        "banco_exercicios_prefs",
        "meutreino_prefs",
        "plano_treino_prefs",
        "progresso_prefs",
        "registro_treino_prefs"
    )

    fun wipeAllLocal(context: Context) {
        // 1) SharedPreferences
        PREFS_NAMES.forEach { prefsName ->
            context.getSharedPreferences(prefsName, Context.MODE_PRIVATE)
                .edit()
                .clear()
                .apply()
        }

        // 2) arquivos do app (se algum repo usa arquivo .json/.txt)
        context.filesDir?.listFiles()?.forEach { it.delete() }

        // 3) cache (miniaturas, imagens, etc.)
        context.cacheDir?.listFiles()?.forEach { it.delete() }
    }
}
