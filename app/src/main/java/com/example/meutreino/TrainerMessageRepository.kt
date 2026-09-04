package com.example.meutreino

import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.SetOptions
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase

object TrainerMessageRepository {

    const val MAX_MESSAGE_LENGTH = 100

    fun enviarParaAluno(
        alunoUid: String,
        mensagemRaw: String,
        onOk: (() -> Unit)? = null,
        onErro: ((Exception) -> Unit)? = null
    ) {
        val professor = Firebase.auth.currentUser
        if (professor == null) {
            onErro?.invoke(IllegalStateException("Usuário não logado."))
            return
        }

        val mensagem = mensagemRaw.replace("\\s+".toRegex(), " ").trim()
        when {
            alunoUid.isBlank() || alunoUid == professor.uid -> {
                onErro?.invoke(IllegalArgumentException("Selecione um aluno válido."))
                return
            }
            mensagem.isBlank() -> {
                onErro?.invoke(IllegalArgumentException("Digite uma mensagem."))
                return
            }
            mensagem.length > MAX_MESSAGE_LENGTH -> {
                onErro?.invoke(IllegalArgumentException("A mensagem deve ter no máximo 100 caracteres."))
                return
            }
        }

        val now = System.currentTimeMillis()
        val db = Firebase.firestore
        val notificationRef = db.collection("users")
            .document(alunoUid)
            .collection("notifications")
            .document()
        val profileRef = db.collection("users").document(alunoUid)

        profileRef.get()
            .addOnSuccessListener { aluno ->
                val treinadorVinculado = aluno.getString("trainerId")
                    ?: aluno.getString("trainerUid")
                    ?: ""
                if (!aluno.exists() || treinadorVinculado != professor.uid) {
                    onErro?.invoke(IllegalStateException("Este aluno não está vinculado ao treinador atual."))
                    return@addOnSuccessListener
                }

                val batch = db.batch()
                batch.set(
                    notificationRef,
                    mapOf(
                        "type" to "MENSAGEM_TREINADOR",
                        "title" to "Mensagem do professor",
                        "message" to mensagem,
                        "read" to false,
                        "createdAt" to now,
                        "fromUid" to professor.uid
                    )
                )
                batch.set(
                    profileRef,
                    mapOf(
                        "lastTrainerMessageAt" to now,
                        "lastTrainerMessage" to mensagem,
                        "updatedAt" to now
                    ),
                    SetOptions.merge()
                )

                batch.commit()
                    .addOnSuccessListener { onOk?.invoke() }
                    .addOnFailureListener { error -> onErro?.invoke(error) }
            }
            .addOnFailureListener { error -> onErro?.invoke(error) }
    }
}
