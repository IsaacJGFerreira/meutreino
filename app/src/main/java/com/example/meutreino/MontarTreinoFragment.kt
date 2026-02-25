package com.example.meutreino

import android.app.AlertDialog
import android.content.Context
import android.os.Bundle
import android.util.Log
import androidx.fragment.app.Fragment
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.ListView
import android.widget.Toast
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase

class MontarTreinoFragment : Fragment() {

    private val treinos = mutableListOf<TreinoPlan>()
    private lateinit var adapter: TreinoListAdapter
    private lateinit var listTreinos: ListView

    private val PREFS = "meutreino_prefs"
    private val KEY_SELECTED_STUDENT = "selected_student_uid"

    private var meuRole: String = "ALUNO"
    private var alunoUidSelecionado: String? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        val view = inflater.inflate(R.layout.fragment_montar_treino, container, false)

        val btnAdicionar = view.findViewById<Button>(R.id.btnAdicionarTreino)
        listTreinos = view.findViewById(R.id.listTreinos)

        adapter = TreinoListAdapter(requireContext(), treinos)
        listTreinos.adapter = adapter

        val user = Firebase.auth.currentUser
        if (user == null) {
            Toast.makeText(requireContext(), "Usuário não logado.", Toast.LENGTH_SHORT).show()
            return view
        }

        // Descobre role
        Firebase.firestore.collection("users").document(user.uid).get()
            .addOnSuccessListener { doc ->
                meuRole = (doc.getString("role") ?: "ALUNO").trim().uppercase()

                if (meuRole == "TREINADOR") {
                    val prefs = requireContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    alunoUidSelecionado = prefs.getString(KEY_SELECTED_STUDENT, null)

                    if (alunoUidSelecionado.isNullOrBlank()) {
                        Toast.makeText(requireContext(), "Selecione um aluno no Perfil.", Toast.LENGTH_SHORT).show()
                        treinos.clear()
                        adapter.atualizar(treinos)
                        return@addOnSuccessListener
                    }

                    // ✅ Treinador carrega treinos DO ALUNO (nuvem manda)
                    alunoUidSelecionado?.let(::carregarTreinosDoAluno)
                } else {
                    // (se você quiser manter aluno aqui, pode carregar local/nuvem do próprio uid)
                    carregarTreinosDoAluno(user.uid)
                }
            }
            .addOnFailureListener {
                // fallback
                carregarTreinosDoAluno(user.uid)
            }

        btnAdicionar.setOnClickListener { abrirDialogAdicionarTreino() }

        listTreinos.setOnItemClickListener { _, _, position, _ ->
            val nomeTreino = treinos.getOrNull(position)?.nome ?: return@setOnItemClickListener
            val alvo = if (meuRole == "TREINADOR") alunoUidSelecionado else Firebase.auth.currentUser?.uid

            parentFragmentManager.beginTransaction()
                .replace(R.id.fragmentContainer, ExerciciosTreinoFragment.newInstance(nomeTreino, alvo))
                .addToBackStack("montar_treino")
                .commitAllowingStateLoss()
        }

        listTreinos.setOnItemLongClickListener { _, _, position, _ ->
            confirmarRemocaoTreino(position)
            true
        }

        return view
    }

    private fun carregarTreinosDoAluno(uidAlvo: String) {
        PlanoTreinoFirestoreRepository.carregarTreinos(
            uidAlvo = uidAlvo,
            onOk = { lista ->
                if (!isAdded) return@carregarTreinos
                treinos.clear()
                treinos.addAll(lista)
                adapter.atualizar(treinos)

                // opcional: cache local
                runCatching { PlanoTreinoRepository.salvarTreinos(requireContext(), treinos) }
            },
            onErro = { e ->
                if (!isAdded) return@carregarTreinos
                Log.e("MONTAR_TREINO", "Erro ao carregar treinos uid=$uidAlvo", e)
                Toast.makeText(requireContext(), "Sem acesso/erro: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        )
    }

    private fun abrirDialogAdicionarTreino() {
        val input = EditText(requireContext())
        input.hint = "Nome do treino (ex: Treino A...)"

        AlertDialog.Builder(requireContext())
            .setTitle("Adicionar treino")
            .setView(input)
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Salvar") { _, _ ->
                val nome = input.text.toString().trim()
                if (nome.isEmpty()) {
                    Toast.makeText(requireContext(), "Digite um nome", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                if (treinos.any { it.nome.equals(nome, ignoreCase = true) }) {
                    Toast.makeText(requireContext(), "Esse treino já existe", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }

                val novo = TreinoPlan(nome)
                treinos.add(novo)
                adapter.atualizar(treinos)

                val alvo = if (meuRole == "TREINADOR") alunoUidSelecionado else Firebase.auth.currentUser?.uid
                if (alvo.isNullOrBlank()) {
                    Toast.makeText(requireContext(), "Selecione um aluno no Perfil.", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }

                // ✅ salva no aluno (treinador) / ou no próprio (aluno)
                PlanoTreinoFirestoreRepository.salvarTreinoParaAlunoFromPlan(
                    alunoUid = alvo,
                    treino = novo,
                    onOk = { },
                    onErro = { e ->
                        Toast.makeText(requireContext(), "Erro ao salvar: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                )
            }
            .show()
    }

    private fun confirmarRemocaoTreino(position: Int) {
        val treino = treinos.getOrNull(position) ?: return
        val nome = treino.nome

        AlertDialog.Builder(requireContext())
            .setTitle("Remover treino")
            .setMessage("Deseja remover \"$nome\"?")
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Remover") { _, _ ->
                treinos.removeAt(position)
                adapter.atualizar(treinos)

                val alvo = if (meuRole == "TREINADOR") alunoUidSelecionado else Firebase.auth.currentUser?.uid
                if (alvo.isNullOrBlank()) return@setPositiveButton

                PlanoTreinoFirestoreRepository.apagarTreinoDoAluno(
                    alunoUid = alvo,
                    nomeTreino = nome
                )
            }
            .show()
    }
}
