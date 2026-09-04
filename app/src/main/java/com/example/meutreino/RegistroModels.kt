package com.example.meutreino

data class SerieRegistro(
    val serieNumero: Int,
    val kg: Double,
    val reps: Int
)

data class ExercicioRegistro(
    val nomeExercicio: String,
    val series: List<SerieRegistro>
)

data class TreinoRegistro(
    val id: String,
    val dataHora: String,
    val nomeTreino: String,
    val completo: Boolean, // ✅ novo
    val exercicios: List<ExercicioRegistro>,
    val duracaoSegundos: Long = 0L,
    /** Timestamp do evento no Firestore/Android, em milissegundos. */
    val createdAt: Long = 0L
)
