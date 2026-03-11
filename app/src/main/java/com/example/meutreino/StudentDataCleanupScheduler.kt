package com.example.meutreino

import android.content.Context
import android.util.Log
import com.google.android.gms.tasks.Tasks
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase

object StudentDataCleanupScheduler {

    private const val TAG = "STUDENT_CLEANUP"
    private const val PREFS = "meutreino_prefs"
    private const val KEY_LAST_CLEANUP_PREFIX = "last_student_cleanup_at_"
    private const val TWELVE_MONTHS_MS = 365L * 24L * 60L * 60L * 1000L

    fun executarSeNecessario(context: Context, uid: String, onConcluido: ((Boolean) -> Unit)? = null) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val key = KEY_LAST_CLEANUP_PREFIX + uid
        val ultimoCleanup = prefs.getLong(key, 0L)
        val agora = System.currentTimeMillis()

        if (agora - ultimoCleanup < TWELVE_MONTHS_MS) {
            onConcluido?.invoke(false)
            return
        }

        val db = Firebase.firestore
        val tarefas = listOf(
            apagarUltimoRegistro(db, uid, "treino_registros"),
            apagarUltimoRegistro(db, uid, "progresso"),
            apagarUltimoRegistro(db, uid, "cardio")
        )

        Tasks.whenAllComplete(tarefas)
            .addOnSuccessListener {
                prefs.edit().putLong(key, agora).apply()
                Log.d(TAG, "✅ Limpeza anual executada para uid=$uid")
                onConcluido?.invoke(true)
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "❌ Falha na limpeza anual para uid=$uid", e)
                onConcluido?.invoke(false)
            }
    }

    private fun apagarUltimoRegistro(
        db: com.google.firebase.firestore.FirebaseFirestore,
        uid: String,
        colecao: String
    ) = db.collection("users")
        .document(uid)
        .collection(colecao)
        .orderBy("createdAt", Query.Direction.ASCENDING)
        .limit(1)
        .get()
        .continueWithTask { task ->
            if (!task.isSuccessful) {
                return@continueWithTask Tasks.forException(task.exception ?: IllegalStateException("Erro ao ler coleção $colecao"))
            }

            val doc = task.result?.documents?.firstOrNull()
            if (doc == null) {
                Tasks.forResult(null)
            } else {
                doc.reference.delete()
            }
        }
}
