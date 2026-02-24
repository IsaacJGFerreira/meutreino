package com.example.meutreino

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

object CardioRepository {

    private const val PREFS = "meutreino_prefs"
    private const val KEY_CARDIO = "cardio_lista"

    private val gson = Gson()

    fun carregar(context: Context): List<CardioRegistro> {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY_CARDIO, null) ?: return emptyList()

        return try {
            val type = object : TypeToken<List<CardioRegistro>>() {}.type
            gson.fromJson(json, type) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun salvar(context: Context, lista: List<CardioRegistro>) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val json = gson.toJson(lista)
        prefs.edit().putString(KEY_CARDIO, json).apply()
    }

    fun adicionar(context: Context, item: CardioRegistro) {
        val atual = carregar(context).toMutableList()
        atual.add(0, item) // mais recente primeiro
        salvar(context, atual)
    }

    fun remover(context: Context, id: String) {
        val atual = carregar(context).toMutableList()
        atual.removeAll { it.id == id }
        salvar(context, atual)
    }
}
