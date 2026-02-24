package com.example.meutreino

import android.util.Log
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.SetOptions
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase

object PlanoTreinoFirestoreRepository {

    private const val TAG = "TREINO_FS"

    private fun docIdSeguro(nome: String): String {
        return nome.trim().lowercase()
            .replace("\\s+".toRegex(), "_")
            .replace("[^a-z0-9_\\-]".toRegex(), "")
            .ifBlank { "treino_sem_nome" }
    }

    // ---------- NOVO: carregar treinos de um UID alvo ----------
    fun carregarTreinos(
        uidAlvo: String,
        onOk: (List<TreinoPlan>) -> Unit,
        onErro: ((Exception) -> Unit)? = null
    ) {
        val db = Firebase.firestore
        db.collection("users")
            .document(uidAlvo)
            .collection("treinos")
            .get()
            .addOnSuccessListener { snap ->
                val lista = snap.documents.mapNotNull { doc ->
                    val nome = doc.getString("nome") ?: return@mapNotNull null
                    val treino = TreinoPlan(nome = nome)

                    val exList = doc.get("exercicios") as? List<*>
                    exList?.forEach { item ->
                        val m = item as? Map<*, *> ?: return@forEach
                        val ex = ExercicioPlan(
                            nome = m["nome"] as? String ?: return@forEach,
                            series = (m["series"] as? Number)?.toInt() ?: 0,
                            repsMin = (m["repsMin"] as? Number)?.toInt() ?: 0,
                            repsMax = (m["repsMax"] as? Number)?.toInt() ?: 0,
                            descanso = m["descanso"] as? String ?: "—",
                            tecnica = m["tecnica"] as? String ?: "—",
                            rir = m["rir"] as? String ?: "—"
                        )
                        treino.exercicios.add(ex)
                    }
                    treino
                }
                onOk(lista)
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "❌ Erro ao carregar treinos uid=$uidAlvo", e)
                onErro?.invoke(e)
            }
    }

    // ---------- NOVO: salvar treino NO UID alvo (para aluno) ----------
    fun salvarTreinoParaAlunoFromPlan(
        alunoUid: String,
        treino: TreinoPlan,
        onOk: (() -> Unit)? = null,
        onErro: ((Exception) -> Unit)? = null
    ) {
        val user = Firebase.auth.currentUser
        if (user == null) {
            onErro?.invoke(IllegalStateException("Usuário não logado"))
            return
        }

        val treinoId = docIdSeguro(treino.nome)

        val exerciciosMap = treino.exercicios.map { ex ->
            hashMapOf(
                "nome" to ex.nome,
                "series" to ex.series,
                "repsMin" to ex.repsMin,
                "repsMax" to ex.repsMax,
                "descanso" to ex.descanso,
                "tecnica" to ex.tecnica,
                "rir" to ex.rir
            )
        }

        val payload = hashMapOf(
            "nome" to treino.nome,
            "exercicios" to exerciciosMap,
            // campos exigidos pelas rules do treinador:
            "assignedTo" to alunoUid,
            "createdBy" to user.uid,
            "updatedAt" to System.currentTimeMillis(),
            "createdAt" to System.currentTimeMillis()
        )

        Firebase.firestore.collection("users")
            .document(alunoUid)
            .collection("treinos")
            .document(treinoId)
            .set(payload, SetOptions.merge())
            .addOnSuccessListener { onOk?.invoke() }
            .addOnFailureListener { e -> onErro?.invoke(e) }
    }

    // ---------- NOVO: apagar treino NO UID alvo ----------
    fun apagarTreinoDoAluno(
        alunoUid: String,
        nomeTreino: String,
        onOk: (() -> Unit)? = null,
        onErro: ((Exception) -> Unit)? = null
    ) {
        val docId = docIdSeguro(nomeTreino)
        Firebase.firestore.collection("users")
            .document(alunoUid)
            .collection("treinos")
            .document(docId)
            .delete()
            .addOnSuccessListener { onOk?.invoke() }
            .addOnFailureListener { e -> onErro?.invoke(e) }
    }
    fun carregarTreinos(
        onOk: (List<TreinoPlan>) -> Unit,
        onErro: ((Exception) -> Unit)? = null
    ) {
        val uid = Firebase.auth.currentUser?.uid
        if (uid == null) { onOk(emptyList()); return }
        carregarTreinos(uid, onOk, onErro)
    }

    fun salvarTreino(
        treino: TreinoPlan,
        onOk: (() -> Unit)? = null,
        onErro: ((Exception) -> Unit)? = null
    ) {
        val uid = Firebase.auth.currentUser?.uid ?: return
        salvarTreinoParaAlunoFromPlan(uid, treino, onOk, onErro)
    }

    fun apagarTreino(
        nomeTreino: String,
        onOk: (() -> Unit)? = null,
        onErro: ((Exception) -> Unit)? = null
    ) {
        val uid = Firebase.auth.currentUser?.uid ?: return
        apagarTreinoDoAluno(uid, nomeTreino, onOk, onErro)
    }

}
