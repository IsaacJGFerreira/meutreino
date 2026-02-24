package com.example.meutreino

import androidx.lifecycle.ViewModel

data class DraftSerie(
    var kg: String = "",
    var reps: String = ""
)

class TreinoDraftViewModel : ViewModel() {

    // chave = "treino|exercicio|serie"
    private val dados = mutableMapOf<String, DraftSerie>()

    fun get(treino: String, exercicio: String, serie: Int): DraftSerie {
        val key = chave(treino, exercicio, serie)
        return dados.getOrPut(key) { DraftSerie() }
    }

    fun setKg(treino: String, exercicio: String, serie: Int, kg: String) {
        get(treino, exercicio, serie).kg = kg
    }

    fun setReps(treino: String, exercicio: String, serie: Int, reps: String) {
        get(treino, exercicio, serie).reps = reps
    }

    fun limparTreino(treino: String) {
        val prefixo = "$treino|"
        dados.keys.removeAll { it.startsWith(prefixo) }
    }

    fun limparTudo() {
        dados.clear()
    }

    private fun chave(t: String, e: String, s: Int) = "$t|$e|$s"
}
