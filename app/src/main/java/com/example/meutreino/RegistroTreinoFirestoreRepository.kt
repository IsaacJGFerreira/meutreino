package com.example.meutreino

import android.util.Log
import com.google.firebase.Timestamp
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase

object RegistroTreinoFirestoreRepository {

    private const val TAG = "TREINO_REG_FS"

    /**
     * ✅ SALVAR registro (ALUNO salvando o PRÓPRIO registro)
     * Caminho:
     * users/{uid}/treino_registros/{docId}
     */
    fun salvarRegistro(registro: TreinoRegistro) {
        val user = Firebase.auth.currentUser
        if (user == null) {
            Log.e(TAG, "Usuário não logado. Não vai salvar registro.")
            return
        }

        val uid = user.uid
        val db = Firebase.firestore

        val docId = System.currentTimeMillis().toString()
        val createdAt = TreinoRegistroUtils.timeOf(registro).takeIf { it > 0L }
            ?: System.currentTimeMillis()

        val exerciciosMap = registro.exercicios.map { ex ->
            hashMapOf(
                "nomeExercicio" to ex.nomeExercicio,
                "series" to ex.series.map { s ->
                    hashMapOf(
                        "serieNumero" to s.serieNumero,
                        "kg" to s.kg,          // pode ser Int ou Double, Firestore aceita Number
                        "reps" to s.reps
                    )
                }
            )
        }

        val payload = hashMapOf(
            "idLocal" to registro.id,
            "dataHora" to registro.dataHora,
            "nomeTreino" to registro.nomeTreino,
            "completo" to registro.completo,
            "duracaoSegundos" to registro.duracaoSegundos,
            "createdAt" to createdAt,
            "exercicios" to exerciciosMap
        )

        db.collection("users")
            .document(uid)
            .collection("treino_registros")
            .document(docId)
            .set(payload)
            .addOnSuccessListener {
                Log.d(TAG, "✅ Registro salvo: users/$uid/treino_registros/$docId")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "❌ Erro ao salvar registro", e)
            }
    }

    /**
     * ✅ FUNÇÃO ANTIGA (para não quebrar LoadingActivity / TreinoFragment antigos)
     * Carrega os registros do usuário logado e entrega MAPs.
     */
    fun carregarRegistros(
        onOk: (List<Map<String, Any>>) -> Unit,
        onErro: ((Exception) -> Unit)? = null
    ) {
        val user = Firebase.auth.currentUser
        if (user == null) {
            onOk(emptyList())
            return
        }
        carregarRegistros(uidAlvo = user.uid, onOk = onOk, onErro = onErro)
    }

    /**
     * ✅ NOVA: carrega MAPs do Firestore para um UID alvo
     * (Treinador vai usar isso com uid do aluno selecionado)
     */
    fun carregarRegistros(
        uidAlvo: String,
        onOk: (List<Map<String, Any>>) -> Unit,
        onErro: ((Exception) -> Unit)? = null
    ) {
        val db = Firebase.firestore

        db.collection("users")
            .document(uidAlvo)
            .collection("treino_registros")
            .get()
            .addOnSuccessListener { snap ->
                val lista = snap.documents
                    .mapNotNull { document ->
                        document.data?.toMutableMap()?.apply {
                            val idLocal = this["idLocal"] as? String
                            if (idLocal.isNullOrBlank()) this["idLocal"] = document.id
                        }
                    }
                    .sortedByDescending { recordTime(it) }
                onOk(lista)
            }
            .addOnFailureListener { e ->
                onErro?.invoke(e)
            }
    }

    /**
     * ✅ NOVA: o que o Desempenho precisa de verdade:
     * Retorna List<TreinoRegistro> já montada.
     */
    fun listarTreinos(
        uidAlvo: String,
        onOk: (List<TreinoRegistro>) -> Unit,
        onErro: ((Exception) -> Unit)? = null
    ) {
        carregarRegistros(
            uidAlvo = uidAlvo,
            onOk = { maps ->
                val lista = maps.mapNotNull { mapToTreinoRegistro(it) }
                onOk(lista)
            },
            onErro = onErro
        )
    }

    // -------------------------
    // Conversor Map -> TreinoRegistro
    // -------------------------
    private fun mapToTreinoRegistro(m: Map<String, Any>): TreinoRegistro? {
        val id = (m["idLocal"] as? String) ?: ""
        val dataHora = (m["dataHora"] as? String) ?: return null
        val nomeTreino = (m["nomeTreino"] as? String) ?: return null
        val completo = (m["completo"] as? Boolean) ?: false
        val duracaoSegundos = (m["duracaoSegundos"] as? Number)?.toLong() ?: 0L
        val createdAt = timestampOf(m["createdAt"])

        val exerciciosRaw = m["exercicios"] as? List<*> ?: emptyList<Any>()
        val exercicios = exerciciosRaw.mapNotNull { exAny ->
            val exMap = exAny as? Map<*, *> ?: return@mapNotNull null
            val nomeEx = exMap["nomeExercicio"] as? String ?: return@mapNotNull null

            val seriesRaw = exMap["series"] as? List<*> ?: emptyList<Any>()
            val series = seriesRaw.mapNotNull { sAny ->
                val sMap = sAny as? Map<*, *> ?: return@mapNotNull null
                val n = (sMap["serieNumero"] as? Number)?.toInt() ?: return@mapNotNull null
                val kg = (sMap["kg"] as? Number)?.toDouble() ?: 0.0
                val reps = (sMap["reps"] as? Number)?.toInt() ?: 0

                // ✅ nomes corretos do seu projeto
                SerieRegistro(
                    serieNumero = n,
                    kg = kg,
                    reps = reps
                )
            }.toMutableList()

            // ✅ nomes corretos do seu projeto
            ExercicioRegistro(
                nomeExercicio = nomeEx,
                series = series
            )
        }.toMutableList()

        return TreinoRegistro(
            id = id,
            dataHora = dataHora,
            nomeTreino = nomeTreino,
            completo = completo,
            exercicios = exercicios,
            duracaoSegundos = duracaoSegundos,
            createdAt = createdAt
        )

    }

    private fun recordTime(record: Map<String, Any>): Long {
        val createdAt = timestampOf(record["createdAt"])
        if (createdAt > 0L) return createdAt
        val dataHora = record["dataHora"] as? String ?: return 0L
        return TreinoRegistroUtils.parseDataHora(dataHora)
    }

    private fun timestampOf(value: Any?): Long {
        return when (value) {
            is Number -> value.toLong()
            is Timestamp -> value.toDate().time
            is String -> value.toLongOrNull() ?: 0L
            else -> 0L
        }
    }
}
