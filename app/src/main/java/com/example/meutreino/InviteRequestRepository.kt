package com.example.meutreino

import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase

class InviteRequestRepository {

    private val db = Firebase.firestore

    fun criarPedido(
        trainerUid: String,
        qty: Int,
        onOk: () -> Unit,
        onErr: (String) -> Unit
    ) {
        // pega nome do treinador (pra facilitar no painel admin)
        db.collection("users").document(trainerUid).get()
            .addOnSuccessListener { doc ->
                val trainerName = doc.getString("name") ?: "Sem nome"

                val data = hashMapOf(
                    "trainerUid" to trainerUid,
                    "trainerName" to trainerName,
                    "qty" to qty,
                    "status" to "PENDING",
                    "createdAt" to System.currentTimeMillis(),
                    "reviewedAt" to null,
                    "reviewedBy" to null
                )

                db.collection("invite_requests").add(data)
                    .addOnSuccessListener { onOk() }
                    .addOnFailureListener { e -> onErr(e.message ?: "Erro ao criar pedido.") }
            }
            .addOnFailureListener { e -> onErr(e.message ?: "Erro ao ler treinador.") }
    }

    fun listarPendentes(onOk: (List<InviteRequestItem>) -> Unit, onErr: (String) -> Unit) {
        db.collection("invite_requests")
            .whereEqualTo("status", "PENDING")
            .get()
            .addOnSuccessListener { snap ->
                val list = snap.documents.map { d ->
                    InviteRequestItem(
                        id = d.id,
                        trainerUid = d.getString("trainerUid") ?: "",
                        trainerName = d.getString("trainerName") ?: "Sem nome",
                        qty = (d.getLong("qty") ?: 0L).toInt(),
                        createdAt = d.getLong("createdAt") ?: 0L
                    )
                }.sortedByDescending { it.createdAt }
                onOk(list)
            }
            .addOnFailureListener { e -> onErr(e.message ?: "Erro ao listar pedidos.") }
    }

    fun aprovarPedido(
        requestId: String,
        trainerUid: String,
        qty: Int,
        adminUid: String,
        onOk: (List<String>) -> Unit,
        onErr: (String) -> Unit
    ) {
        val inviteRepo = InviteRepository()
        val db = Firebase.firestore

        // Vamos gerar códigos em sequência (simples e confiável)
        val codesGerados = mutableListOf<String>()

        fun gerarUm() {
            if (codesGerados.size >= qty) {
                // terminou -> salva request como APPROVED e grava codes na subcoleção
                val reqRef = db.collection("invite_requests").document(requestId)

                val batch = db.batch()
                batch.update(reqRef, mapOf(
                    "status" to "APPROVED",
                    "reviewedAt" to System.currentTimeMillis(),
                    "reviewedBy" to adminUid
                ))

                // salva cada code na subcoleção
                for (code in codesGerados) {
                    val codeRef = reqRef.collection("codes").document(code)
                    batch.set(codeRef, mapOf(
                        "code" to code,
                        "createdAt" to System.currentTimeMillis()
                    ))
                }

                batch.commit()
                    .addOnSuccessListener { onOk(codesGerados) }
                    .addOnFailureListener { e -> onErr(e.message ?: "Erro ao finalizar aprovação.") }

                return
            }

            inviteRepo.criarConviteAluno(
                trainerUid = trainerUid,
                adminUid = adminUid,
                onOk = { code ->
                    codesGerados.add(code)
                    gerarUm()
                },
                onErr = { e ->
                    onErr(e.message ?: "Erro ao gerar código.")
                }
            )
        }

        gerarUm()
    }

    fun rejeitarPedido(requestId: String, adminUid: String, onOk: () -> Unit, onErr: (String) -> Unit) {
        db.collection("invite_requests").document(requestId)
            .update(mapOf(
                "status" to "REJECTED",
                "reviewedAt" to System.currentTimeMillis(),
                "reviewedBy" to adminUid
            ))
            .addOnSuccessListener { onOk() }
            .addOnFailureListener { e -> onErr(e.message ?: "Erro ao rejeitar.") }
    }
}

data class InviteRequestItem(
    val id: String,
    val trainerUid: String,
    val trainerName: String,
    val qty: Int,
    val createdAt: Long
)
