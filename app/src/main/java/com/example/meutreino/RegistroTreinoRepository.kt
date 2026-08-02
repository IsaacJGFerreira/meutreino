package com.example.meutreino

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object RegistroTreinoRepository {

    private const val PREFS = "registro_treino_prefs"
    private const val KEY = "treinos_registrados"

    fun salvarTreino(context: Context, treino: TreinoRegistro) {
        salvarOuAtualizar(context, treino)
    }


    fun carregarTreinos(context: Context): List<TreinoRegistro> {
        val sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val jsonStr = sp.getString(KEY, "[]") ?: "[]"

        val arr = JSONArray(jsonStr)
        val lista = mutableListOf<TreinoRegistro>()

        for (i in 0 until arr.length()) {
            val obj = arr.getJSONObject(i)

            val exerciciosArr = obj.getJSONArray("exercicios")
            val exercicios = mutableListOf<ExercicioRegistro>()

            for (j in 0 until exerciciosArr.length()) {
                val exObj = exerciciosArr.getJSONObject(j)
                val seriesArr = exObj.getJSONArray("series")

                val series = mutableListOf<SerieRegistro>()
                for (k in 0 until seriesArr.length()) {
                    val sObj = seriesArr.getJSONObject(k)
                    series.add(
                        SerieRegistro(
                            serieNumero = sObj.getInt("serieNumero"),
                            kg = sObj.getDouble("kg"),
                            reps = sObj.getInt("reps")
                        )
                    )
                }

                exercicios.add(
                    ExercicioRegistro(
                        nomeExercicio = exObj.getString("nomeExercicio"),
                        series = series
                    )
                )
            }

            lista.add(
                TreinoRegistro(
                    id = obj.getString("id"),
                    dataHora = obj.getString("dataHora"),
                    nomeTreino = obj.getString("nomeTreino"),
                    completo = obj.optBoolean("completo", true),
                    exercicios = exercicios,
                    duracaoSegundos = obj.optLong("duracaoSegundos", 0L)
                )
            )
        }

        return lista
    }

    fun contarRealizacoesExercicio(context: Context, nomeExercicio: String): Int {
        // Conta quantos treinos registrados contêm esse exercício
        val treinos = carregarTreinos(context)
        return treinos.count { treino ->
            treino.exercicios.any { it.nomeExercicio.equals(nomeExercicio, ignoreCase = true) }
        }
    }
    fun salvarOuAtualizar(context: Context, treino: TreinoRegistro) {
        val lista = carregarTreinos(context).toMutableList()

        val idx = lista.indexOfFirst { it.id == treino.id }
        if (idx >= 0) {
            lista[idx] = treino
        } else {
            lista.add(treino)
        }

        salvarLista(context, lista)
    }

    private fun salvarLista(context: Context, lista: List<TreinoRegistro>) {
        val arr = JSONArray()

        lista.forEach { treino ->
            val obj = JSONObject()
            obj.put("id", treino.id)
            obj.put("dataHora", treino.dataHora)
            obj.put("nomeTreino", treino.nomeTreino)
            obj.put("completo", treino.completo)
            obj.put("duracaoSegundos", treino.duracaoSegundos)

            val exerciciosArr = JSONArray()
            treino.exercicios.forEach { ex ->
                val exObj = JSONObject()
                exObj.put("nomeExercicio", ex.nomeExercicio)

                val seriesArr = JSONArray()
                ex.series.forEach { s ->
                    val sObj = JSONObject()
                    sObj.put("serieNumero", s.serieNumero)
                    sObj.put("kg", s.kg)
                    sObj.put("reps", s.reps)
                    seriesArr.put(sObj)
                }

                exObj.put("series", seriesArr)
                exerciciosArr.put(exObj)
            }

            obj.put("exercicios", exerciciosArr)
            arr.put(obj)
        }

        val sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        sp.edit().putString(KEY, arr.toString()).apply()
    }
}
