package com.example.meutreino

import android.util.Log
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.FieldValue
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

    private fun treinoPayload(
        treino: TreinoPlan,
        alunoUid: String,
        createdBy: String,
        createdAt: Any,
        updatedAt: Long
    ): Map<String, Any> {
        val exerciciosMap: List<Map<String, Any>> = treino.exercicios.map { ex ->
            mapOf(
                "nome" to ex.nome,
                "series" to ex.series,
                "repsMin" to ex.repsMin,
                "repsMax" to ex.repsMax,
                "descanso" to ex.descanso,
                "tecnica" to ex.tecnica,
                "rir" to ex.rir
            )
        }

        return mapOf(
            "nome" to treino.nome,
            "ordem" to (treino.ordem ?: 0),
            "exercicios" to exerciciosMap,
            "assignedTo" to alunoUid,
            "createdBy" to createdBy,
            "updatedAt" to updatedAt,
            "createdAt" to createdAt
        )
    }

    private fun notificationPayload(fromUid: String, mensagem: String, now: Long): Map<String, Any> {
        return mapOf(
            "type" to "TREINO_ATUALIZADO",
            "message" to mensagem,
            "read" to false,
            "createdAt" to now,
            "fromUid" to fromUid
        )
    }

    private fun profileUpdatePayload(mensagem: String, now: Long): Map<String, Any> {
        return mapOf(
            "lastWorkoutUpdateAt" to now,
            "lastWorkoutUpdateMessage" to mensagem,
            "updatedAt" to now
        )
    }

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
                    val ordem = (doc.getLong("ordem") ?: doc.getDouble("ordem")?.toLong())?.toInt()
                    val treino = TreinoPlan(nome = nome, ordem = ordem)

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
                val listaOrdenada = lista
                    .sortedWith(compareBy<TreinoPlan> { it.ordem ?: Int.MAX_VALUE }.thenBy { it.nome.lowercase() })
                    .toMutableList()

                listaOrdenada.forEachIndexed { index, treino ->
                    if (treino.ordem == null) treino.ordem = index
                }

                onOk(listaOrdenada)
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "❌ Erro ao carregar treinos uid=$uidAlvo", e)
                onErro?.invoke(e)
            }
    }

    fun salvarTreinoParaAlunoFromPlan(
        alunoUid: String,
        treino: TreinoPlan,
        notifyStudent: Boolean = true,
        notificationMessage: String? = null,
        onOk: (() -> Unit)? = null,
        onErro: ((Exception) -> Unit)? = null
    ) {
        val user = Firebase.auth.currentUser
        if (user == null) {
            onErro?.invoke(IllegalStateException("Usuário não logado"))
            return
        }

        val db = Firebase.firestore
        val treinoRef = db.collection("users")
            .document(alunoUid)
            .collection("treinos")
            .document(docIdSeguro(treino.nome))
        val now = System.currentTimeMillis()
        val shouldNotify = notifyStudent && user.uid != alunoUid
        val mensagem = notificationMessage
            ?: "Seu treinador atualizou o treino \"${treino.nome}\"."
        val notificationRef = db.collection("users")
            .document(alunoUid)
            .collection("notifications")
            .document()
        val profileRef = db.collection("users").document(alunoUid)

        db.runTransaction { transaction ->
            val existing = transaction.get(treinoRef)
            val createdAt = existing.get("createdAt") ?: now
            val createdBy = existing.getString("createdBy") ?: user.uid

            transaction.set(
                treinoRef,
                treinoPayload(treino, alunoUid, createdBy, createdAt, now),
                SetOptions.merge()
            )

            if (shouldNotify) {
                transaction.set(notificationRef, notificationPayload(user.uid, mensagem, now))
                transaction.set(
                    profileRef,
                    profileUpdatePayload(mensagem, now),
                    SetOptions.merge()
                )
            }
            true
        }
            .addOnSuccessListener { onOk?.invoke() }
            .addOnFailureListener { e -> onErro?.invoke(e) }
    }

    fun renomearTreinoDoAluno(
        alunoUid: String,
        nomeAntigo: String,
        treinoRenomeado: TreinoPlan,
        notifyStudent: Boolean = true,
        onOk: (() -> Unit)? = null,
        onErro: ((Exception) -> Unit)? = null
    ) {
        val user = Firebase.auth.currentUser
        if (user == null) {
            onErro?.invoke(IllegalStateException("Usuário não logado"))
            return
        }

        val nomeNovo = treinoRenomeado.nome.trim()
        if (nomeNovo.isBlank()) {
            onErro?.invoke(IllegalArgumentException("Digite um nome para o treino."))
            return
        }

        val db = Firebase.firestore
        val base = db.collection("users").document(alunoUid).collection("treinos")
        val oldId = docIdSeguro(nomeAntigo)
        val newId = docIdSeguro(nomeNovo)
        val oldRef = base.document(oldId)
        val newRef = base.document(newId)
        val now = System.currentTimeMillis()
        val shouldNotify = notifyStudent && user.uid != alunoUid
        val mensagem = "Seu treinador renomeou o treino \"$nomeAntigo\" para \"$nomeNovo\"."
        val notificationRef = db.collection("users")
            .document(alunoUid)
            .collection("notifications")
            .document()
        val profileRef = db.collection("users").document(alunoUid)

        db.runTransaction { transaction ->
            val oldSnapshot = transaction.get(oldRef)
            if (!oldSnapshot.exists()) {
                throw IllegalStateException("O treino original não foi encontrado.")
            }

            if (oldId != newId) {
                val collision = transaction.get(newRef)
                if (collision.exists()) {
                    throw IllegalStateException("Já existe outro treino com esse nome.")
                }
            }

            val createdAt = oldSnapshot.get("createdAt") ?: now
            val createdBy = oldSnapshot.getString("createdBy") ?: user.uid
            val payload = treinoPayload(treinoRenomeado, alunoUid, createdBy, createdAt, now)

            if (oldId == newId) {
                transaction.set(newRef, payload, SetOptions.merge())
            } else {
                transaction.set(newRef, payload)
                transaction.delete(oldRef)
            }

            if (shouldNotify) {
                transaction.set(notificationRef, notificationPayload(user.uid, mensagem, now))
                transaction.set(
                    profileRef,
                    profileUpdatePayload(mensagem, now),
                    SetOptions.merge()
                )
            }
            true
        }
            .addOnSuccessListener { onOk?.invoke() }
            .addOnFailureListener { e -> onErro?.invoke(e) }
    }

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
            .addOnSuccessListener {
                registrarAtualizacaoTreino(
                    alunoUid = alunoUid,
                    mensagem = "Seu treinador removeu o treino \"$nomeTreino\"."
                )
                onOk?.invoke()
            }
            .addOnFailureListener { e -> onErro?.invoke(e) }
    }


    fun atualizarOrdemTreinos(
        alunoUid: String,
        treinos: List<TreinoPlan>,
        notifyStudent: Boolean = false,
        onOk: (() -> Unit)? = null,
        onErro: ((Exception) -> Unit)? = null
    ) {
        val db = Firebase.firestore
        val batch = db.batch()
        val base = db.collection("users")
            .document(alunoUid)
            .collection("treinos")
        val now = System.currentTimeMillis()

        treinos.forEachIndexed { index, treino ->
            treino.ordem = index
            val ref = base.document(docIdSeguro(treino.nome))
            batch.set(ref, mapOf("ordem" to index, "updatedAt" to now), SetOptions.merge())
        }

        val user = Firebase.auth.currentUser
        if (notifyStudent && user != null && user.uid != alunoUid) {
            val mensagem = "Seu treinador reorganizou a ordem dos seus treinos."
            val notificationRef = db.collection("users")
                .document(alunoUid)
                .collection("notifications")
                .document()
            batch.set(notificationRef, notificationPayload(user.uid, mensagem, now))
            batch.set(
                db.collection("users").document(alunoUid),
                profileUpdatePayload(mensagem, now),
                SetOptions.merge()
            )
        }

        batch.commit()
            .addOnSuccessListener { onOk?.invoke() }
            .addOnFailureListener { e -> onErro?.invoke(e) }
    }

    private fun registrarAtualizacaoTreino(alunoUid: String, mensagem: String) {
        val user = Firebase.auth.currentUser ?: return
        if (user.uid == alunoUid) return

        val db = Firebase.firestore
        val now = System.currentTimeMillis()

        val payload = hashMapOf(
            "type" to "TREINO_ATUALIZADO",
            "message" to mensagem,
            "read" to false,
            "createdAt" to now,
            "fromUid" to user.uid
        )

        db.collection("users")
            .document(alunoUid)
            .collection("notifications")
            .add(payload)

        db.collection("users")
            .document(alunoUid)
            .set(
                mapOf(
                    "lastWorkoutUpdateAt" to now,
                    "lastWorkoutUpdateMessage" to mensagem,
                    "updatedAt" to FieldValue.serverTimestamp()
                ),
                SetOptions.merge()
            )
    }

    fun carregarTreinos(
        onOk: (List<TreinoPlan>) -> Unit,
        onErro: ((Exception) -> Unit)? = null
    ) {
        val uid = Firebase.auth.currentUser?.uid
        if (uid == null) {
            onOk(emptyList())
            return
        }
        carregarTreinos(uid, onOk, onErro)
    }

    fun salvarTreino(
        treino: TreinoPlan,
        onOk: (() -> Unit)? = null,
        onErro: ((Exception) -> Unit)? = null
    ) {
        val uid = Firebase.auth.currentUser?.uid ?: return
        salvarTreinoParaAlunoFromPlan(
            alunoUid = uid,
            treino = treino,
            notifyStudent = false,
            onOk = onOk,
            onErro = onErro
        )
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
