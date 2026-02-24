package com.example.meutreino

import android.content.Intent
import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase

class SyncLoadingActivity : AppCompatActivity() {

    private lateinit var tvStatus: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_sync_loading)

        tvStatus = findViewById(R.id.tvStatus)
        iniciarSincronizacao()
    }

    private fun iniciarSincronizacao() {
        tvStatus.text = "Limpando dados locais…"
        limparDadosLocais()

        val user = Firebase.auth.currentUser
        if (user == null) {
            abrirMain()
            return
        }

        tvStatus.text = "Verificando sua conta…"
        Firebase.firestore.collection("users").document(user.uid).get()
            .addOnSuccessListener { doc ->
                val role = (doc.getString("role") ?: "ALUNO").trim().uppercase()
                val isAluno = role == "ALUNO"

                tvStatus.text = "Baixando dados da nuvem…"
                sincronizarDaNuvem(
                    isAluno = isAluno,
                    onOk = {
                        tvStatus.text = "Finalizando…"
                        abrirMain()
                    },
                    onErro = {
                        tvStatus.text = "Sem internet: usando dados disponíveis."
                        abrirMain()
                    }
                )
            }
            .addOnFailureListener {
                abrirMain()
            }
    }

    private fun abrirMain() {
        val i = Intent(this, MainActivity::class.java)
        i.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(i)
        finish()
    }

    private fun limparDadosLocais() {
        // suas limpezas reais aqui
    }

    private fun sincronizarDaNuvem(isAluno: Boolean, onOk: () -> Unit, onErro: (String) -> Unit) {

        // Sempre sincroniza treinos/banco (se fizer sentido no seu app)
        var pendencias = if (isAluno) 3 else 2

        fun done() {
            pendencias--
            if (pendencias <= 0) onOk()
        }

        fun fail(e: String) {
            onErro(e)
        }

        // 1) Treinos
        val uid = Firebase.auth.currentUser?.uid
        if (uid == null) {
            onErro("Usuário não logado.")
            return
        }

        PlanoTreinoFirestoreRepository.carregarTreinos(
            uidAlvo = uid,
            onOk = { treinos ->
                PlanoTreinoRepository.salvarTreinos(this, treinos.toMutableList())
                done()
            },
            onErro = { e -> fail(e.message ?: "Erro ao sincronizar treinos") }
        )


        // 2) Banco Exercícios (se existir)
        BancoExerciciosFirestoreRepository.carregar(
            onOk = { nomes ->
                val setLocal = BancoExerciciosRepository.obterNomes(this).map { it.lowercase() }.toSet()
                nomes.forEach { n ->
                    if (!setLocal.contains(n.lowercase())) {
                        BancoExerciciosRepository.adicionar(this, n)
                    }
                }
                done()
            },
            onErro = { fail("Erro ao sincronizar banco exercícios") }
        )

        if (!isAluno) return

        // 3) Progresso (só aluno)
        ProgressoFirestoreRepository.carregar(
            onOk = { lista ->
                ProgressoRepository.salvar(this, lista.toMutableList())
                done()
            },
            onErro = { fail("Erro ao sincronizar progresso") }
        )
    }
}
