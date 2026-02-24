package com.example.meutreino

import android.content.Context
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase

object TargetUser {

    private const val PREFS = "meutreino_prefs"
    private const val KEY_SELECTED_STUDENT = "selected_student_uid"
    private const val KEY_SELECTED_STUDENT_NAME = "selected_student_name"

    data class Result(
        val role: String,
        val approved: Boolean,
        val targetUid: String?,     // null quando treinador não selecionou aluno
        val targetName: String?     // nome do aluno selecionado (se tiver)
    )

    fun getSelectedStudentUid(context: Context): String? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return prefs.getString(KEY_SELECTED_STUDENT, null)
    }

    fun getSelectedStudentName(context: Context): String? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return prefs.getString(KEY_SELECTED_STUDENT_NAME, null)
    }

    /**
     * Decide:
     * - Se usuário é ALUNO -> targetUid = uid dele
     * - Se usuário é TREINADOR -> targetUid = aluno selecionado (ou null)
     */
    fun resolve(context: Context, onOk: (Result) -> Unit, onErr: (String) -> Unit) {
        val user = Firebase.auth.currentUser ?: run {
            onErr("Usuário não logado.")
            return
        }

        Firebase.firestore.collection("users").document(user.uid).get()
            .addOnSuccessListener { doc ->
                val role = (doc.getString("role") ?: "ALUNO").trim().uppercase()
                val approved = doc.getBoolean("approved") ?: false

                if (role == "ALUNO") {
                    onOk(Result(role, approved, user.uid, null))
                    return@addOnSuccessListener
                }

                if (role == "TREINADOR") {
                    val selectedUid = getSelectedStudentUid(context)
                    val selectedName = getSelectedStudentName(context)
                    onOk(Result(role, approved, selectedUid, selectedName))
                    return@addOnSuccessListener
                }

                // ADMIN ou qualquer outro: não tem target (não deve cair aqui nas abas)
                onOk(Result(role, approved, null, null))
            }
            .addOnFailureListener { e ->
                onErr(e.message ?: "Erro ao ler role.")
            }
    }
}
