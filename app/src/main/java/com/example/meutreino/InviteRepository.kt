package com.example.meutreino

import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import kotlin.random.Random

class InviteRepository {

    private val db = Firebase.firestore

    private fun gerarCodigo(tamanho: Int = 6): String {
        val chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // sem I/O/0/1 (evita confusão)
        return (1..tamanho)
            .map { chars[Random.nextInt(chars.length)] }
            .joinToString("")
    }

    fun criarConviteTreinador(adminUid: String, onOk: (String) -> Unit, onErr: (Exception) -> Unit) {
        criarConvite(
            type = "TREINADOR",
            trainerUid = null,
            adminUid = adminUid,
            onOk = onOk,
            onErr = onErr
        )
    }

    fun criarConviteAluno(trainerUid: String, adminUid: String, onOk: (String) -> Unit, onErr: (Exception) -> Unit) {
        criarConvite(
            type = "ALUNO",
            trainerUid = trainerUid,
            adminUid = adminUid,
            onOk = onOk,
            onErr = onErr
        )
    }

    private fun criarConvite(
        type: String,
        trainerUid: String?,
        adminUid: String,
        onOk: (String) -> Unit,
        onErr: (Exception) -> Unit
    ) {
        // Gera até conseguir um código que não existe (colisão é raríssima, mas tratamos)
        fun tentar() {
            val code = gerarCodigo(6)
            val ref = db.collection("invites").document(code)

            db.runTransaction { tx ->
                val snap = tx.get(ref)
                if (snap.exists()) throw IllegalStateException("Código já existe, tente novamente.")
                tx.set(ref, InviteDoc(
                    type = type,
                    trainerUid = trainerUid,
                    createdBy = adminUid,
                    createdAt = System.currentTimeMillis(),
                    usedAt = null,
                    usedByUid = null
                ))
            }.addOnSuccessListener { onOk(code) }
                .addOnFailureListener { e ->
                    // Se por acaso colisão, tenta de novo. Se for outro erro, retorna.
                    if (e is IllegalStateException) tentar() else onErr(e)
                }
        }

        tentar()
    }
}
