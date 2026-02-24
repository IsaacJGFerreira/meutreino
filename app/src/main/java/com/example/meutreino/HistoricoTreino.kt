package com.example.meutreino

import android.content.Context

object HistoricoTreino {

    // 🔹 Lista em memória (usada pelo Fragment)
    val lista = mutableListOf<String>()

    private const val PREFS_NAME = "historico_treino"
    private const val KEY_SERIES = "series"
    // 🔹 Carrega as séries salvas no celular para a memória do app
    fun carregar(context: Context) {
        val prefs = context.getSharedPreferences("historico_treino", Context.MODE_PRIVATE)
        val conjunto = prefs.getStringSet("series", emptySet())

        lista.clear()
        lista.addAll(conjunto ?: emptySet())
    }
    // 🔹 Adiciona uma nova série
    fun adicionar(context: Context, serie: String) {
        lista.add(serie)

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putStringSet(KEY_SERIES, lista.toSet())
            .apply()
    }

    // 🔹 Recupera as séries salvas no celular
    fun obterSeries(context: Context): List<String> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val set = prefs.getStringSet(KEY_SERIES, emptySet()) ?: emptySet()

        lista.clear()
        lista.addAll(set)

        return lista
    }
    fun obterSeriesOrganizadasPorData(): List<String> {
        val mapa = mutableMapOf<String, MutableList<String>>()

        for (serie in lista) {
            val linhas = serie.lines()

            val linhaData = linhas.find { it.contains("📅") } ?: continue
            val data = linhaData.replace("📅", "").trim().split(" ")[0]

            val treino = linhas.first()

            if (!mapa.containsKey(data)) {
                mapa[data] = mutableListOf()
            }
            mapa[data]!!.add(treino)
        }

        val resultado = mutableListOf<String>()

        mapa.toSortedMap(compareByDescending { it }).forEach { (data, treinos) ->
            resultado.add("📆 $data")
            treinos.forEach { resultado.add(it) }
        }

        return resultado
    }
    fun obterSeriesFiltradasPorExpansao(
        datasExpandidas: Set<String>
    ): List<String> {

        val mapa = mutableMapOf<String, MutableList<String>>()

        for (serie in lista) {
            val linhas = serie.lines()
            val linhaData = linhas.find { it.contains("📅") } ?: continue
            val data = "📆 " + linhaData.replace("📅", "").trim().split(" ")[0]
            val treino = linhas.first()

            mapa.getOrPut(data) { mutableListOf() }.add(treino)
        }

        val resultado = mutableListOf<String>()

        mapa.toSortedMap(compareByDescending { it }).forEach { (data, treinos) ->
            resultado.add(data)

            // 🔹 Só adiciona os treinos se a data estiver expandida
            if (datasExpandidas.contains(data)) {
                treinos.forEach { resultado.add(it) }
            }
        }

        return resultado
    }
}