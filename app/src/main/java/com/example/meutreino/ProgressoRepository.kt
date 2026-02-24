package com.example.meutreino

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object ProgressoRepository {
    private const val PREFS = "progresso_prefs"
    private const val KEY = "progresso_lista"

    fun carregar(context: Context): MutableList<ProgressoRegistro> {
        val sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val jsonStr = sp.getString(KEY, "[]") ?: "[]"
        val arr = JSONArray(jsonStr)

        val lista = mutableListOf<ProgressoRegistro>()
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            lista.add(
                ProgressoRegistro(
                    id = o.getString("id"),
                    data = o.getString("data"),
                    pesoKg = o.getDouble("pesoKg"),
                    fotoFrenteUri = o.optString("fotoFrenteUri", null),
                    fotoLadoUri = o.optString("fotoLadoUri", null),
                    fotoCostasUri = o.optString("fotoCostasUri", null) // ✅ sem vírgula aqui
                )
            )
        }
        return lista
    }

    fun salvar(context: Context, lista: List<ProgressoRegistro>) {
        val arr = JSONArray()
        lista.forEach { p ->
            val o = JSONObject()
            o.put("id", p.id)
            o.put("data", p.data)
            o.put("pesoKg", p.pesoKg)
            o.put("fotoFrenteUri", p.fotoFrenteUri)
            o.put("fotoLadoUri", p.fotoLadoUri)
            o.put("fotoCostasUri", p.fotoCostasUri)
            arr.put(o)
        }

        val sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        sp.edit().putString(KEY, arr.toString()).apply()
    }
}
