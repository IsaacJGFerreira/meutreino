package com.example.meutreino

import android.content.Intent
import android.os.Bundle
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase

class LoadingActivity : AppCompatActivity() {

    companion object {
        private const val PREFS = "meutreino_prefs"
        private const val KEY_LAST_UID = "last_uid"
    }

    private lateinit var tvStatus: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_loading)
        supportActionBar?.hide()

        tvStatus = findViewById(R.id.tvLoadingStatus)

        val user = Firebase.auth.currentUser
        if (user == null) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        // 1) limpa local
        tvStatus.text = "Preparando seu ambiente…"
        limparTudoLocal()
        val sp = getSharedPreferences(PREFS, MODE_PRIVATE)
        val lastUid = sp.getString(KEY_LAST_UID, null)

        if (lastUid != null && lastUid != user.uid) {
            limparSelecaoAluno()
            limparTudoLocal() // se você realmente usa isso
        }

        // 2) descobre role e sincroniza conforme o perfil
        tvStatus.text = "Sincronizando seus dados…"

        carregarRole(user.uid,
            onOk = { role ->
                sincronizarTudoDaNuvem(
                    role = role,
                    onOk = {
                        // 3) salva UID atual como “último UID”
                        getSharedPreferences(PREFS, MODE_PRIVATE)
                            .edit()
                            .putString(KEY_LAST_UID, user.uid)
                            .apply()

                        // 4) volta pro app já sincronizado
                        val i = Intent(this, MainActivity::class.java)
                        i.putExtra(MainActivity.EXTRA_SYNC_OK, true)
                        startActivity(i)
                        finish()
                    },
                    onErro = { msg ->
                        AppUiFeedback.showToast(this, msg, Toast.LENGTH_LONG)

                        // Mesmo com erro, entra offline
                        val i = Intent(this, MainActivity::class.java)
                        i.putExtra(MainActivity.EXTRA_SYNC_OK, true)
                        startActivity(i)
                        finish()
                    }
                )
            },
            onErro = { msg ->
                // Se falhar ao ler role, entra do mesmo jeito (evita travar)
                AppUiFeedback.showToast(this, msg, Toast.LENGTH_LONG)
                val i = Intent(this, MainActivity::class.java)
                i.putExtra(MainActivity.EXTRA_SYNC_OK, true)
                startActivity(i)
                finish()
            }
        )
    }

    private fun carregarRole(uid: String, onOk: (String) -> Unit, onErro: (String) -> Unit) {
        Firebase.firestore.collection("users").document(uid).get()
            .addOnSuccessListener { doc ->
                val role = (doc.getString("role") ?: "ALUNO").trim().uppercase()
                onOk(role)
            }
            .addOnFailureListener { e ->
                onErro("Falha ao ler perfil: ${e.message}")
            }
    }

    private fun limparTudoLocal() {
        // ✅ Se você tiver funções reais de limpar, coloque aqui.
        // Ex:
        // PlanoTreinoRepository.limpar(this)
        // ProgressoRepository.limpar(this)
        // BancoExerciciosRepository.limpar(this)
        // RegistroTreinoRepository.limpar(this)
    }

    private fun limparSelecaoAluno() {
        getSharedPreferences("meutreino_prefs", MODE_PRIVATE)
            .edit()
            .remove("selected_student_uid")
            .remove("selected_student_name")
            .apply()
    }

    private fun sincronizarTudoDaNuvem(
        role: String,
        onOk: () -> Unit,
        onErro: (String) -> Unit
    ) {
        // ✅ TREINADOR: NÃO sincroniza progresso nem registros do aluno aqui
        // ✅ ALUNO: sincroniza tudo

        val isAluno = (role == "ALUNO")

        // 1) Treinos (faz sentido para ambos)
        val uid = Firebase.auth.currentUser?.uid
        if (uid == null) {
            onErro("Usuário não logado.")
            return
        }

        PlanoTreinoFirestoreRepository.carregarTreinos(
            uidAlvo = uid,
            onOk = { treinos ->
                PlanoTreinoRepository.salvarTreinos(this, treinos)

                ProgressoFirestoreRepository.carregar(
                    onOk = { progresso ->
                        ProgressoRepository.salvar(this, progresso)

                        BancoExerciciosFirestoreRepository.carregar(
                            onOk = { nomes ->
                                val setLocal = BancoExerciciosRepository.obterNomes(this).map { it.lowercase() }.toSet()
                                nomes.forEach { n ->
                                    if (!setLocal.contains(n.lowercase())) {
                                        BancoExerciciosRepository.adicionar(this, n)
                                    }
                                }

                                RegistroTreinoFirestoreRepository.carregarRegistros(
                                    onOk = { _ -> onOk() },
                                    onErro = { onOk() }
                                )
                            },
                            onErro = { onErro("Falha ao sincronizar banco de exercícios.") }
                        )
                    },
                    onErro = { onErro("Falha ao sincronizar progresso.") }
                )
            },
            onErro = { e -> onErro("Falha ao sincronizar treinos.") }
        )

    }
}
