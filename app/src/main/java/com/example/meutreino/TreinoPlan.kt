package com.example.meutreino

// 🔹 Exercício dentro de um treino (configurado na aba "Montar treino")
data class ExercicioPlan(
    val nome: String,
    val series: Int,
    val repsMin: Int,
    val repsMax: Int,
    val descanso: String,
    val tecnica: String,
    val rir: String
)

// 🔹 Um treino (LegDay, A, B...) com sua lista de exercícios
data class TreinoPlan(
    val nome: String,
    val exercicios: MutableList<ExercicioPlan> = mutableListOf(),
    var ordem: Int? = null
)
