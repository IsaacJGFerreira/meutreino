package com.example.meutreino

data class CardioRegistro(
    val id: String,
    val dataHora: String,
    val atividade: String,
    val tempoMin: Int,
    val ritmo: String,
    val createdAt: Long = 0L
)
