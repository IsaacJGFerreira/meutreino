package com.example.meutreino

import android.util.Log
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import com.google.firebase.firestore.ListenerRegistration
import java.text.SimpleDateFormat
import java.util.Locale

object CardioFirestoreRepository {

    private const val TAG = "CARDIO_FS_REPO"

    // users/{uidAlvo}/cardio/{id}
    fun carregar(
        uidAlvo: String,
        onOk: (List<CardioRegistro>) -> Unit,
        onErro: (Exception) -> Unit
    ) {
        Firebase.firestore.collection("users")
            .document(uidAlvo)
            .collection("cardio")
            .get()
            .addOnSuccessListener { snap ->
                val lista = snap.documents.mapNotNull { doc ->
                    val id = doc.getString("id") ?: doc.id
                    val dataHora = doc.getString("dataHora") ?: return@mapNotNull null
                    val atividade = doc.getString("atividade") ?: return@mapNotNull null
                    val tempoMin = (doc.getLong("tempoMin") ?: 0L).toInt()
                    val ritmo = doc.getString("ritmo") ?: "—"
                    val createdAt = doc.getLong("createdAt") ?: 0L

                    CardioRegistro(
                        id = id,
                        dataHora = dataHora,
                        atividade = atividade,
                        tempoMin = tempoMin,
                        ritmo = ritmo,
                        createdAt = createdAt
                    )
                }.sortedByDescending(::registroTime)
                Log.d(TAG, "✅ Carregou ${lista.size} cardio(s) de users/$uidAlvo/cardio")
                onOk(lista)
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "❌ Erro ao carregar cardio de users/$uidAlvo/cardio", e)
                onErro(e)
            }
    }

    fun observar(
        uidAlvo: String,
        onOk: (List<CardioRegistro>) -> Unit,
        onErro: (Exception) -> Unit
    ): ListenerRegistration {
        return Firebase.firestore.collection("users")
            .document(uidAlvo)
            .collection("cardio")
            .addSnapshotListener { snap, error ->
                if (error != null) {
                    Log.e(TAG, "❌ Erro ao observar cardio de users/$uidAlvo/cardio", error)
                    onErro(error)
                    return@addSnapshotListener
                }

                val lista = snap?.documents.orEmpty().mapNotNull { doc ->
                    val id = doc.getString("id") ?: doc.id
                    val dataHora = doc.getString("dataHora") ?: return@mapNotNull null
                    val atividade = doc.getString("atividade") ?: return@mapNotNull null
                    CardioRegistro(
                        id = id,
                        dataHora = dataHora,
                        atividade = atividade,
                        tempoMin = (doc.getLong("tempoMin") ?: 0L).toInt(),
                        ritmo = doc.getString("ritmo") ?: "—",
                        createdAt = doc.getLong("createdAt") ?: 0L
                    )
                }.sortedByDescending(::registroTime)
                onOk(lista)
            }
    }

    fun salvar(
        uidAlvo: String,
        registro: CardioRegistro,
        onOk: (() -> Unit)? = null,
        onErro: ((Exception) -> Unit)? = null
    ) {
        val createdAt = registro.createdAt.takeIf { it > 0L } ?: System.currentTimeMillis()
        val data = hashMapOf<String, Any?>(
            "id" to registro.id,
            "dataHora" to registro.dataHora,
            "dataChave" to registro.dataHora.trim().split(" ").firstOrNull(),
            "atividade" to registro.atividade,
            "tempoMin" to registro.tempoMin,
            "ritmo" to registro.ritmo,
            "createdAt" to createdAt
        )

        Firebase.firestore.collection("users")
            .document(uidAlvo)
            .collection("cardio")
            .document(registro.id)
            .set(data)
            .addOnSuccessListener {
                Log.d(TAG, "✅ Salvou cardio em users/$uidAlvo/cardio/${registro.id}")
                onOk?.invoke()
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "❌ Erro ao salvar cardio em users/$uidAlvo/cardio/${registro.id}", e)
                onErro?.invoke(e)
            }
    }

    fun apagar(
        uidAlvo: String,
        id: String,
        onOk: (() -> Unit)? = null,
        onErro: ((Exception) -> Unit)? = null
    ) {
        Firebase.firestore.collection("users")
            .document(uidAlvo)
            .collection("cardio")
            .document(id)
            .delete()
            .addOnSuccessListener {
                Log.d(TAG, "✅ Apagou cardio em users/$uidAlvo/cardio/$id")
                onOk?.invoke()
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "❌ Erro ao apagar cardio em users/$uidAlvo/cardio/$id", e)
                onErro?.invoke(e)
            }
    }

    private fun registroTime(registro: CardioRegistro): Long {
        if (registro.createdAt > 0L) return registro.createdAt
        return runCatching {
            SimpleDateFormat("dd/MM/yyyy HH:mm", Locale("pt", "BR"))
                .parse(registro.dataHora)?.time ?: 0L
        }.getOrDefault(0L)
    }
}
