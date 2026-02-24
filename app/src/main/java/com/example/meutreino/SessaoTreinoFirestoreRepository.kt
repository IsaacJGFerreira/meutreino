package com.example.meutreino

import android.util.Log
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase

object SessaoTreinoFirestoreRepository {

    private const val TAG = "SESSAO_FS"

    fun salvarSessao(
        treinoNome: String,
        data: String,
        exercicios: List<Map<String, Any>>
    ) {
        val user = Firebase.auth.currentUser
        if (user == null) {
            Log.e(TAG, "Usuário não logado. Não vai salvar sessão.")
            return
        }

        val uid = user.uid
        val db = Firebase.firestore

        val sessionId = System.currentTimeMillis().toString()

        val payload = hashMapOf(
            "treinoNome" to treinoNome,
            "data" to data,
            "createdAt" to System.currentTimeMillis(),
            "exercicios" to exercicios
        )

        db.collection("users")
            .document(uid)
            .collection("sessions")
            .document(sessionId)
            .set(payload)
            .addOnSuccessListener {
                Log.d(TAG, "✅ Sessão salva: users/$uid/sessions/$sessionId")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "❌ Erro ao salvar sessão", e)
            }
    }

    fun carregarSessoes(
        onOk: (List<Map<String, Any>>) -> Unit,
        onErro: ((Exception) -> Unit)? = null
    ) {
        val user = Firebase.auth.currentUser
        if (user == null) {
            onOk(emptyList())
            return
        }

        val uid = user.uid
        val db = Firebase.firestore

        db.collection("users")
            .document(uid)
            .collection("sessions")
            .orderBy("createdAt")
            .get()
            .addOnSuccessListener { snap ->
                val lista = snap.documents.mapNotNull { it.data }
                onOk(lista)
            }
            .addOnFailureListener { e ->
                onErro?.invoke(e)
            }
    }
}
