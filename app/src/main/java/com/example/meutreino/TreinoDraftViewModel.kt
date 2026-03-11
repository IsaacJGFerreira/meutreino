package com.example.meutreino

import androidx.lifecycle.ViewModel
import androidx.lifecycle.SavedStateHandle

data class DraftSerie(
    var kg: String = "",
    var reps: String = ""
)

class TreinoDraftViewModel(
    private val savedStateHandle: SavedStateHandle
) : ViewModel() {

    companion object {
        private const val KEY_DRAFTS = "treino_drafts"
    }

    // chave = "treino|exercicio|serie"
    private val dados = mutableMapOf<String, DraftSerie>()

    init {
        restaurarDoEstadoSalvo()
    }

    fun get(treino: String, exercicio: String, serie: Int): DraftSerie {
        val key = chave(treino, exercicio, serie)
        return dados.getOrPut(key) { DraftSerie() }
    }

    fun setKg(treino: String, exercicio: String, serie: Int, kg: String) {
        get(treino, exercicio, serie).kg = kg
        persistirEstado()
    }

    fun setReps(treino: String, exercicio: String, serie: Int, reps: String) {
        get(treino, exercicio, serie).reps = reps
        persistirEstado()
    }

    fun limparTreino(treino: String) {
        val prefixo = "$treino|"
        dados.keys.removeAll { it.startsWith(prefixo) }
        persistirEstado()
    }

    fun limparTudo() {
        dados.clear()
        persistirEstado()
    }

    private fun chave(t: String, e: String, s: Int) = "$t|$e|$s"

    private fun persistirEstado() {
        val serializado = dados.mapValues { (_, v) -> "${v.kg}\u0000${v.reps}" }
        savedStateHandle[KEY_DRAFTS] = HashMap(serializado)
    }

    private fun restaurarDoEstadoSalvo() {
        val salvo = savedStateHandle.get<Map<String, String>>(KEY_DRAFTS) ?: return
        if (salvo.isEmpty()) return

        dados.clear()
        salvo.forEach { (key, value) ->
            val partes = value.split('\u0000', limit = 2)
            val kg = partes.getOrNull(0).orEmpty()
            val reps = partes.getOrNull(1).orEmpty()
            dados[key] = DraftSerie(kg = kg, reps = reps)
        }
    }
}
