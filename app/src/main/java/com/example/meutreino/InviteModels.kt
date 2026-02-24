package com.example.meutreino

data class InviteDoc(
    val type: String = "",            // "TREINADOR" | "ALUNO"
    val trainerUid: String? = null,    // só para ALUNO
    val createdBy: String = "",        // uid do admin
    val createdAt: Long = 0L,          // System.currentTimeMillis()
    val usedAt: Long? = null,
    val usedByUid: String? = null
)
