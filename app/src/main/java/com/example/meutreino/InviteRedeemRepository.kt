package com.example.meutreino

import android.util.Log
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase

class InviteRedeemRepository {

    private val db = Firebase.firestore

    private fun criarVinculoNoTreinador(trainerUid: String) {
        val u = Firebase.auth.currentUser ?: return

        db.collection("users").document(u.uid).get()
            .addOnSuccessListener { doc ->
                val payload = hashMapOf(
                    "uid" to u.uid,
                    "name" to (doc.getString("name") ?: "Sem nome"),
                    "email" to (doc.getString("email") ?: (u.email ?: "Sem email")),
                    "active" to (doc.getBoolean("active") ?: true),
                    "approved" to (doc.getBoolean("approved") ?: true),
                    "linkedAt" to System.currentTimeMillis()
                )

                db.collection("trainers")
                    .document(trainerUid)
                    .collection("students")
                    .document(u.uid)
                    .set(payload)
                    .addOnSuccessListener {
                        Log.d("INVITE_REDEEM", "✅ Vínculo criado: trainers/$trainerUid/students/${u.uid}")
                    }
                    .addOnFailureListener { e ->
                        Log.e("INVITE_REDEEM", "❌ Falha ao criar vínculo no treinador", e)
                    }
            }
            .addOnFailureListener { e ->
                Log.e("INVITE_REDEEM", "❌ Falha ao ler users/${u.uid} para montar vínculo", e)
            }
    }

    fun resgatarCodigo(
        code: String,
        uid: String,
        onOk: (String) -> Unit,
        onErr: (String) -> Unit
    ) {
        val ref = db.collection("invites").document(code)
        var trainerUidParaVinculo: String? = null

        db.runTransaction { tx ->
            val snap = tx.get(ref)
            if (!snap.exists()) throw IllegalStateException("Código não existe.")

            val usedAt = snap.getLong("usedAt")
            if (usedAt != null) throw IllegalStateException("Código já foi usado.")

            val type = snap.getString("type") ?: throw IllegalStateException("Convite inválido.")

            val userRef = db.collection("users").document(uid)
            val userSnap = tx.get(userRef)
            if (!userSnap.exists()) throw IllegalStateException("Perfil do usuário não existe no Firestore.")

            val userRole = (userSnap.getString("role") ?: "").trim().uppercase()

            if (type == "TREINADOR") {
                if (userRole != "TREINADOR") throw IllegalStateException("Este código é para TREINADOR.")
                tx.update(userRef, mapOf("approved" to true))

            } else if (type == "ALUNO") {
                if (userRole != "ALUNO") throw IllegalStateException("Este código é para ALUNO.")

                val trainerUid = snap.getString("trainerUid")
                if (trainerUid.isNullOrBlank()) throw IllegalStateException("Convite de aluno sem treinador.")

                trainerUidParaVinculo = trainerUid

                tx.update(userRef, mapOf(
                    "trainerId" to trainerUid,
                    "approved" to true
                ))

            } else {
                throw IllegalStateException("Tipo de convite desconhecido.")
            }

            tx.update(ref, mapOf(
                "usedAt" to System.currentTimeMillis(),
                "usedByUid" to uid
            ))

            type
        }.addOnSuccessListener { tipo ->
            if (tipo == "ALUNO" && !trainerUidParaVinculo.isNullOrBlank()) {
                // cria o espelho na subcoleção do treinador
                criarVinculoNoTreinador(trainerUidParaVinculo!!)
            }
            onOk(tipo)
        }.addOnFailureListener { e ->
            onErr(e.message ?: "Erro ao resgatar código.")
        }
    }
}
