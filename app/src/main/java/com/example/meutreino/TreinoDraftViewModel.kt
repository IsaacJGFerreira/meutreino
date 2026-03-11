package com.example.meutreino

import android.content.Context
import android.content.SharedPreferences
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
        private const val KEY_TREINO_ATIVO = "treino_ativo"
        private const val PREFS_NAME = "meutreino_draft_prefs"
        private const val PREF_KEY_DRAFTS = "drafts_serializados"
        private const val PREF_KEY_TREINO_ATIVO = "treino_ativo"
    }

    // chave = "treino|exercicio|serie"
    private val dados = mutableMapOf<String, DraftSerie>()
    private var prefs: SharedPreferences? = null

    init {
        restaurarDoEstadoSalvo()
    }

    fun initialize(context: Context) {
        if (prefs != null) return
        prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        restaurarDoDisco()
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
        if (treinoAtivo() == treino) {
            definirTreinoAtivo(null)
        }
        persistirEstado()
    }

    fun limparTudo() {
        dados.clear()
        definirTreinoAtivo(null)
        persistirEstado()
    }

    fun treinoAtivo(): String? {
        return savedStateHandle.get<String>(KEY_TREINO_ATIVO)
    }

    fun definirTreinoAtivo(nomeTreino: String?) {
        savedStateHandle[KEY_TREINO_ATIVO] = nomeTreino
        prefs?.edit()?.putString(PREF_KEY_TREINO_ATIVO, nomeTreino)?.apply()
    }

    private fun chave(t: String, e: String, s: Int) = "$t|$e|$s"

    private fun persistirEstado() {
        val serializado = dados.mapValues { (_, v) -> "${v.kg}\u0000${v.reps}" }
        savedStateHandle[KEY_DRAFTS] = HashMap(serializado)
        val json = org.json.JSONObject()
        serializado.forEach { (key, value) -> json.put(key, value) }
        prefs?.edit()?.putString(PREF_KEY_DRAFTS, json.toString())?.apply()
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

    private fun restaurarDoDisco() {
        val prefsLocal = prefs ?: return

        if (dados.isEmpty()) {
            val bruto = prefsLocal.getString(PREF_KEY_DRAFTS, null)
            if (!bruto.isNullOrBlank()) {
                val json = org.json.JSONObject(bruto)
                val restaurado = mutableMapOf<String, String>()
                json.keys().forEach { key ->
                    restaurado[key] = json.optString(key, "")
                }

                if (restaurado.isNotEmpty()) {
                    savedStateHandle[KEY_DRAFTS] = HashMap(restaurado)
                    restaurarDoEstadoSalvo()
                }
            }
        }

        val ativo = prefsLocal.getString(PREF_KEY_TREINO_ATIVO, null)
        if (!ativo.isNullOrBlank()) {
            savedStateHandle[KEY_TREINO_ATIVO] = ativo
        }
    }
}
