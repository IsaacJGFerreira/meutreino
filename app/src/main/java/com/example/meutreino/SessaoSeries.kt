package com.example.meutreino

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * 🔹 Guarda as séries feitas hoje por (Treino + Exercício)
 * Serve para aplicar a regra:
 * - Se TODAS as séries > repsMax => sugerir aumentar peso
 * - Se TODAS as séries < repsMin => sugerir diminuir peso
 */
object SessaoSeries {

    private data class DadosExecucao(
        val reps: MutableList<Int> = mutableListOf()
    )

    private val mapa = mutableMapOf<String, DadosExecucao>()

    private fun hoje(): String {
        return SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()).format(Date())
    }

    // 🔹 Chave única do "exercício do dia"
    private fun chave(treinoNome: String, exercicioNome: String): String {
        return "${hoje()}|$treinoNome|$exercicioNome"
    }

    /**
     * Registra uma série e retorna o que deve acontecer.
     */
    fun registrarSerie(
        treinoNome: String,
        exercicio: ExercicioPlan,
        repsFeitas: Int
    ): Resultado {

        val key = chave(treinoNome, exercicio.nome)
        val dados = mapa.getOrPut(key) { DadosExecucao() }

        // adiciona as reps da série
        dados.reps.add(repsFeitas)

        val feitas = dados.reps.size
        val total = exercicio.series

        // ainda faltam séries
        if (feitas < total) {
            return Resultado.Andamento(feitas, total)
        }

        // completou todas as séries -> aplicar a regra
        val todasAcimaDoMax = dados.reps.all { it > exercicio.repsMax }
        val todasAbaixoDoMin = dados.reps.all { it < exercicio.repsMin }

        return when {
            todasAcimaDoMax -> Resultado.SugerirAumentar
            todasAbaixoDoMin -> Resultado.SugerirDiminuir
            else -> Resultado.SemSugestao
        }
    }

    /**
     * Se você quiser "zerar" o controle desse exercício no dia (opcional).
     * Por enquanto não vamos usar, mas pode ser útil.
     */
    fun resetarExercicioHoje(treinoNome: String, exercicioNome: String) {
        mapa.remove(chave(treinoNome, exercicioNome))
    }

    sealed class Resultado {
        data class Andamento(val feitas: Int, val total: Int) : Resultado()
        object SugerirAumentar : Resultado()
        object SugerirDiminuir : Resultado()
        object SemSugestao : Resultado()
    }
}
