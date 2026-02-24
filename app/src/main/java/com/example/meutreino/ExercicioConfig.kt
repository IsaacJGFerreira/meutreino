package com.example.meutreino

// 🔹 Configuração do exercício (definida na aba "Montar treino")
data class ExercicioConfig(
    val nome: String,
    val repsMin: Int,
    val repsMax: Int,
    val tecnica: String,
    val rir: String,
    val descanso: String
)