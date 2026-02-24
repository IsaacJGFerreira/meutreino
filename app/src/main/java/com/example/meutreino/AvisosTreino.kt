package com.example.meutreino

import kotlin.math.abs

object AvisosTreino {

    data class Avisos(
        val aumentarPeso: Boolean,
        val diminuirPeso: Boolean,
        val pesoVariando: Boolean,
        val mensagem: String
    )

    /**
     * Recebe as séries preenchidas de um exercício e gera avisos:
     * - aumentar: todas as reps > repsMax
     * - diminuir: todas as reps < repsMin
     * - pesoVariando: pesos não são (praticamente) iguais entre si
     */
    fun avaliarExercicio(ex: ExercicioPlan, series: List<Pair<Double, Int>>): Avisos {
        // series = listOf(Pair(kg, reps)) já filtrada (somente preenchidas)

        if (series.isEmpty()) {
            return Avisos(false, false, false, "Sem séries preenchidas para ${ex.nome}.")
        }

        val reps = series.map { it.second }
        val pesos = series.map { it.first }

        val todasAcima = reps.all { it > ex.repsMax }
        val todasAbaixo = reps.all { it < ex.repsMin }

        // Se tiver mais de 1 peso e algum for diferente do primeiro (com tolerância)
        val primeiro = pesos.first()
        val pesoVariando = pesos.size >= 2 && pesos.any { abs(it - primeiro) >= 0.5 } // tolerância 0.5kg

        val msgs = mutableListOf<String>()

        if (todasAcima) {
            msgs.add("✅ ${ex.nome}: todas as séries ficaram ACIMA do máximo (${ex.repsMax}). Próxima vez: pode AUMENTAR o peso.")
        }

        if (todasAbaixo) {
            msgs.add("⚠️ ${ex.nome}: todas as séries ficaram ABAIXO do mínimo (${ex.repsMin}). Próxima vez: pode DIMINUIR o peso.")
        }

        if (pesoVariando) {
            msgs.add("⚠️ ${ex.nome}: você mudou o peso entre as séries. Não é o ideal para acompanhar evolução (mas pode continuar registrando).")
        }

        val mensagemFinal = if (msgs.isEmpty()) {
            "Sem avisos para ${ex.nome}."
        } else {
            msgs.joinToString("\n\n")
        }

        return Avisos(
            aumentarPeso = todasAcima,
            diminuirPeso = todasAbaixo,
            pesoVariando = pesoVariando,
            mensagem = mensagemFinal
        )
    }
}
