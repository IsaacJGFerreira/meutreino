package com.example.meutreino

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object PlanoTreinoRepository {

    private const val PREFS = "plano_treino_prefs"
    private const val KEY_TREINOS = "treinos"

    fun salvarTreinos(context: Context, treinos: List<TreinoPlan>) {
        val arrTreinos = JSONArray()

        for (t in treinos) {
            val objTreino = JSONObject()
            objTreino.put("nome", t.nome)
            objTreino.put("ordem", t.ordem ?: arrTreinos.length())

            val arrExercicios = JSONArray()
            for (ex in t.exercicios) {
                val objEx = JSONObject()
                objEx.put("nome", ex.nome)
                objEx.put("series", ex.series)
                objEx.put("repsMin", ex.repsMin)
                objEx.put("repsMax", ex.repsMax)
                objEx.put("descanso", ex.descanso)
                objEx.put("tecnica", ex.tecnica)
                objEx.put("rir", ex.rir)
                arrExercicios.put(objEx)
            }

            objTreino.put("exercicios", arrExercicios)
            arrTreinos.put(objTreino)
        }

        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_TREINOS, arrTreinos.toString())
            .apply()
    }

    fun carregarTreinos(context: Context): MutableList<TreinoPlan> {
        val json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_TREINOS, null) ?: return mutableListOf()

        val arrTreinos = JSONArray(json)
        val lista = mutableListOf<TreinoPlan>()

        for (i in 0 until arrTreinos.length()) {
            val objTreino = arrTreinos.getJSONObject(i)
            val nomeTreino = objTreino.getString("nome")

            val ordem = if (objTreino.has("ordem")) objTreino.optInt("ordem", i) else i
            val treino = TreinoPlan(nome = nomeTreino, ordem = ordem)

            val arrExercicios = objTreino.optJSONArray("exercicios") ?: JSONArray()
            for (j in 0 until arrExercicios.length()) {
                val objEx = arrExercicios.getJSONObject(j)

                treino.exercicios.add(
                    ExercicioPlan(
                        nome = objEx.getString("nome"),
                        series = objEx.getInt("series"),
                        repsMin = objEx.getInt("repsMin"),
                        repsMax = objEx.getInt("repsMax"),
                        descanso = objEx.getString("descanso"),
                        tecnica = objEx.getString("tecnica"),
                        rir = objEx.getString("rir")
                    )
                )
            }

            lista.add(treino)
        }

        return lista.sortedWith(compareBy<TreinoPlan> { it.ordem ?: Int.MAX_VALUE }.thenBy { it.nome.lowercase() }).toMutableList()
    }
}
