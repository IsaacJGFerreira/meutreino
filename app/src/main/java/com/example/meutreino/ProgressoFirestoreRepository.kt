package com.example.meutreino

import android.net.Uri
import android.util.Log
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import com.google.firebase.storage.ktx.storage

object ProgressoFirestoreRepository {

    private const val TAG = "PROGRESSO_FS"

    // users/{uid}/progresso/{registroId}
    fun carregar(
        uidAlvo: String,
        onOk: (List<ProgressoRegistro>) -> Unit,
        onErro: (Exception) -> Unit
    ) {
        val db = Firebase.firestore

        db.collection("users")
            .document(uidAlvo)
            .collection("progresso")
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .get()
            .addOnSuccessListener { snap ->
                val lista = snap.documents.mapNotNull { doc ->
                    val id = doc.getString("id") ?: doc.id
                    val data = doc.getString("data") ?: return@mapNotNull null

                    val pesoKg = doc.getDouble("pesoKg")
                        ?: (doc.getLong("pesoKg")?.toDouble()) // segurança se alguém salvou como int
                        ?: return@mapNotNull null

                    val frente = doc.getString("fotoFrenteUri")
                    val lado = doc.getString("fotoLadoUri")
                    val costas = doc.getString("fotoCostasUri")

                    ProgressoRegistro(
                        id = id,
                        data = data,
                        pesoKg = pesoKg,
                        fotoFrenteUri = frente,
                        fotoLadoUri = lado,
                        fotoCostasUri = costas
                    )
                }

                Log.d(TAG, "✅ Carregou ${lista.size} progressos do Firestore (uid=$uidAlvo)")
                onOk(lista)
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "❌ Erro ao carregar progresso do Firestore (uid=$uidAlvo)", e)
                onErro(e)
            }
    }

    // ✅ Salva: sobe fotos pro Storage e salva o doc no Firestore com as URLs
    // OBS: isso será usado apenas pelo ALUNO (no fragment a gente vai esconder do TREINADOR)
    fun salvarComFotos(
        registroId: String,
        data: String,
        pesoKg: Double,
        uriFrenteLocal: String?,
        uriLadoLocal: String?,
        uriCostasLocal: String?,
        onOk: (ProgressoRegistro) -> Unit,
        onErro: (Exception) -> Unit
    ) {
        val user = Firebase.auth.currentUser
        if (user == null) {
            onErro(IllegalStateException("Usuário não logado"))
            return
        }

        val uid = user.uid
        val storage = Firebase.storage
        val db = Firebase.firestore

        fun uploadOne(nomeArquivo: String, uriStr: String?, onDone: (String?) -> Unit) {
            if (uriStr.isNullOrBlank()) {
                onDone(null)
                return
            }

            val ref = storage.reference
                .child("users/$uid/progresso/$registroId/$nomeArquivo")

            ref.putFile(Uri.parse(uriStr))
                .addOnSuccessListener {
                    ref.downloadUrl
                        .addOnSuccessListener { url -> onDone(url.toString()) }
                        .addOnFailureListener { e -> onErro(e) }
                }
                .addOnFailureListener { e -> onErro(e) }
        }

        uploadOne("frente.jpg", uriFrenteLocal) { urlFrente ->
            uploadOne("lado.jpg", uriLadoLocal) { urlLado ->
                uploadOne("costas.jpg", uriCostasLocal) { urlCostas ->

                    val docData = hashMapOf(
                        "id" to registroId,
                        "data" to data,
                        "pesoKg" to pesoKg,
                        "fotoFrenteUri" to urlFrente,
                        "fotoLadoUri" to urlLado,
                        "fotoCostasUri" to urlCostas,
                        "createdAt" to System.currentTimeMillis()
                    )

                    db.collection("users")
                        .document(uid)
                        .collection("progresso")
                        .document(registroId)
                        .set(docData)
                        .addOnSuccessListener {
                            Log.d(TAG, "✅ Progresso salvo em users/$uid/progresso/$registroId")

                            onOk(
                                ProgressoRegistro(
                                    id = registroId,
                                    data = data,
                                    pesoKg = pesoKg,
                                    fotoFrenteUri = urlFrente,
                                    fotoLadoUri = urlLado,
                                    fotoCostasUri = urlCostas
                                )
                            )
                        }
                        .addOnFailureListener { e ->
                            Log.e(TAG, "❌ Erro ao salvar progresso no Firestore", e)
                            onErro(e)
                        }
                }
            }
        }
    }
    // ✅ Versão antiga (não quebra Loading/Sync/Telas antigas)
    fun carregar(
        onOk: (List<ProgressoRegistro>) -> Unit,
        onErro: (Exception) -> Unit
    ) {
        val user = Firebase.auth.currentUser
        if (user == null) {
            onErro(IllegalStateException("Usuário não logado"))
            return
        }

        carregar(
            uidAlvo = user.uid,
            onOk = onOk,
            onErro = onErro
        )
    }

    // OBS: usado apenas pelo ALUNO
    fun apagar(
        registroId: String,
        onOk: () -> Unit,
        onErro: (Exception) -> Unit
    ) {
        val user = Firebase.auth.currentUser
        if (user == null) {
            onErro(IllegalStateException("Usuário não logado"))
            return
        }

        val uid = user.uid
        val db = Firebase.firestore

        db.collection("users")
            .document(uid)
            .collection("progresso")
            .document(registroId)
            .delete()
            .addOnSuccessListener { onOk() }
            .addOnFailureListener { e -> onErro(e) }
    }
}
