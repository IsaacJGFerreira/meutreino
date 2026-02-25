package com.example.meutreino

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import android.app.AlertDialog
import com.google.firebase.auth.ktx.auth

class AdminTrainerDetailFragment : Fragment() {

    companion object {
        private const val ARG_TRAINER_UID = "trainer_uid"

        fun newInstance(trainerUid: String): AdminTrainerDetailFragment {
            val f = AdminTrainerDetailFragment()
            val b = Bundle()
            b.putString(ARG_TRAINER_UID, trainerUid)
            f.arguments = b
            return f
        }
    }

    private lateinit var tvNome: TextView
    private lateinit var tvEmail: TextView
    private lateinit var tvStatus: TextView
    private lateinit var btnToggleAtivo: Button
    private lateinit var rvAlunos: RecyclerView

    private lateinit var adapter: AdminStudentAdapter
    private var trainerUid: String = ""

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        val view = inflater.inflate(R.layout.fragment_admin_trainer_detail, container, false)

        trainerUid = arguments?.getString(ARG_TRAINER_UID) ?: ""

        tvNome = view.findViewById(R.id.tvTrainerNome)
        tvEmail = view.findViewById(R.id.tvTrainerEmail)
        tvStatus = view.findViewById(R.id.tvTrainerStatus)
        btnToggleAtivo = view.findViewById(R.id.btnToggleAtivo)
        rvAlunos = view.findViewById(R.id.rvAlunosDoTreinador)

        val btnCodigoAluno = view.findViewById<Button>(R.id.btnGerarCodigoAluno)
        val repo = InviteRepository()

        btnCodigoAluno.setOnClickListener {
            val admin = Firebase.auth.currentUser ?: return@setOnClickListener
            repo.criarConviteAluno(
                trainerUid = trainerUid,
                adminUid = admin.uid,
                onOk = { code ->
                    AppUiFeedback.dialogBuilder(requireContext())
                        .setTitle("Código de Aluno")
                        .setMessage("Código: $code\n\n(Use 1 vez. Depois expira.)")
                        .setPositiveButton("OK", null)
                        .show()
                },
                onErr = {
                    AppUiFeedback.dialogBuilder(requireContext())
                        .setTitle("Erro")
                        .setMessage("Não foi possível gerar código.")
                        .setPositiveButton("OK", null)
                        .show()
                }
            )
        }

        adapter = AdminStudentAdapter(mutableListOf(),
            onRemoveVinculo = { alunoUid ->
                removerVinculoAluno(alunoUid)
            },
            onToggleAtivo = { alunoUid, ativoAtual ->
                setUserActive(alunoUid, !ativoAtual)
            }
        )

        rvAlunos.layoutManager = LinearLayoutManager(requireContext())
        rvAlunos.adapter = adapter

        carregarTreinador()
        carregarAlunos()

        return view
    }

    private fun carregarTreinador() {
        Firebase.firestore.collection("users").document(trainerUid).get()
            .addOnSuccessListener { doc ->
                val nome = doc.getString("name") ?: "Sem nome"
                val email = doc.getString("email") ?: "Sem email"
                val active = doc.getBoolean("active") ?: true

                tvNome.text = nome
                tvEmail.text = email
                tvStatus.text = if (active) "Status: Ativo" else "Status: Inativo"

                btnToggleAtivo.text = if (active) "Desativar treinador" else "Reativar treinador"

                btnToggleAtivo.setOnClickListener {
                    if (active) {
                        desativarTreinadorEDesvincularAlunos()
                    } else {
                        setUserActive(trainerUid, true)
                    }
                }
            }
    }

    private fun carregarAlunos() {
        Firebase.firestore.collection("users")
            .whereEqualTo("role", "ALUNO")
            .whereEqualTo("trainerId", trainerUid)
            .get()
            .addOnSuccessListener { snap ->
                val alunos = snap.documents.map { doc ->
                    AdminStudentItem(
                        uid = doc.id,
                        name = doc.getString("name") ?: "Sem nome",
                        email = doc.getString("email") ?: "Sem email",
                        active = doc.getBoolean("active") ?: true
                    )
                }.sortedBy { it.name.lowercase() }

                adapter.update(alunos)
            }
    }

    private fun removerVinculoAluno(alunoUid: String) {
        Firebase.firestore.collection("users").document(alunoUid)
            .update("trainerId", null)
            .addOnSuccessListener { carregarAlunos() }
    }

    private fun setUserActive(uid: String, active: Boolean) {
        Firebase.firestore.collection("users").document(uid)
            .update("active", active)
            .addOnSuccessListener {
                carregarTreinador()
                carregarAlunos()
            }
    }

    // A regra que você escolheu: desativou treinador => desvincula todos alunos
    private fun desativarTreinadorEDesvincularAlunos() {
        val db = Firebase.firestore

        db.collection("users")
            .whereEqualTo("role", "ALUNO")
            .whereEqualTo("trainerId", trainerUid)
            .get()
            .addOnSuccessListener { snap ->
                val batch = db.batch()

                // desativa treinador
                val trainerRef = db.collection("users").document(trainerUid)
                batch.update(trainerRef, "active", false)

                // desvincula alunos
                for (doc in snap.documents) {
                    batch.update(doc.reference, "trainerId", null)
                }

                batch.commit().addOnSuccessListener {
                    carregarTreinador()
                    carregarAlunos()
                }
            }
    }
}
