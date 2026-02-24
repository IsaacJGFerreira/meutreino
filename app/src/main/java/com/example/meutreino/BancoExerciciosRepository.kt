package com.example.meutreino

import android.content.Context

/**
 * Banco local de exercícios (somente nomes)
 * - Você alimenta automaticamente quando cria um exercício
 * - Serve para autocomplete/sugestões
 */
object BancoExerciciosRepository {

    private const val PREFS = "banco_exercicios_prefs"
    private const val KEY_EXERCICIOS = "exercicios_nomes"

    fun obterNomes(context: Context): MutableList<String> {
        val set = context
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet(KEY_EXERCICIOS, emptySet()) ?: emptySet()

        return set.toMutableList().sorted().toMutableList()
    }

    fun adicionar(context: Context, nome: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val atual = prefs.getStringSet(KEY_EXERCICIOS, emptySet())
            ?.toMutableSet() ?: mutableSetOf()

        val limpo = nome.trim()
        if (limpo.isEmpty()) return

        atual.add(limpo) // Set evita duplicados
        prefs.edit().putStringSet(KEY_EXERCICIOS, atual).apply()
    }
}
