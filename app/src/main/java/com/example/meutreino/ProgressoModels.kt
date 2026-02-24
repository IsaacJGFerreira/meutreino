package com.example.meutreino

data class ProgressoRegistro(
    val id: String,
    val data: String,      // "dd/MM/yyyy"
    val pesoKg: Double,
    val fotoFrenteUri: String?,
    val fotoLadoUri: String?,
    val fotoCostasUri: String?
)
