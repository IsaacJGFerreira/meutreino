package com.example.meutreino

import android.util.Log
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase

object BancoExerciciosFirestoreRepository {
    private const val TAG = "EX_BANK_FS"

    private fun ref(uid: String) =
        Firebase.firestore.collection("users").document(uid).collection("exercise_bank")

    private fun docIdSeguro(nome: String): String {
        return nome.trim().lowercase()
            .replace("\\s+".toRegex(), "_")
            .replace("[^a-z0-9_\\-]".toRegex(), "")
            .ifBlank { "exercicio" }
    }

    fun adicionar(nome: String) {
        val user = Firebase.auth.currentUser ?: run {
            Log.e(TAG, "Usuário não logado.")
            return
        }

        val uid = user.uid
        val docId = docIdSeguro(nome)

        val data = hashMapOf(
            "nome" to nome,
            "updatedAt" to System.currentTimeMillis()
        )

        ref(uid).document(docId).set(data)
            .addOnSuccessListener { Log.d(TAG, "✅ Adicionado no banco (nuvem): $nome") }
            .addOnFailureListener { e -> Log.e(TAG, "❌ Erro ao adicionar no banco (nuvem)", e) }
    }

    fun carregar(onOk: (List<String>) -> Unit, onErro: ((Exception) -> Unit)? = null) {
        val user = Firebase.auth.currentUser
        if (user == null) {
            onOk(emptyList())
            return
        }

        val uid = user.uid

        ref(uid).get()
            .addOnSuccessListener { snap ->
                val nomes = snap.documents.mapNotNull { it.getString("nome") }
                    .distinct()
                    .sorted()
                onOk(nomes)
            }
            .addOnFailureListener { e ->
                onErro?.invoke(e)
            }
    }
}
