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
    private var atualizandoOrdem = false

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        val view = inflater.inflate(R.layout.fragment_montar_treino, container, false)

        val btnAdicionar = view.findViewById<Button>(R.id.btnAdicionarTreino)
        listTreinos = view.findViewById(R.id.listTreinos)

        adapter = TreinoListAdapter(
            context = requireContext(),
            treinos = treinos,
            onMoveUp = { position -> moverTreino(position, position - 1) },
            onMoveDown = { position -> moverTreino(position, position + 1) },
            onRename = { position -> abrirDialogRenomearTreino(position) }
        )
        listTreinos.adapter = adapter

        val user = Firebase.auth.currentUser
        if (user == null) {
            AppUiFeedback.showToast(requireContext(), "Usuário não logado.", Toast.LENGTH_SHORT)
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
                        AppUiFeedback.showToast(requireContext(), "Selecione um aluno no Perfil.", Toast.LENGTH_SHORT)
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
            abrirAcoesTreino(position)
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
                treinos.forEachIndexed { index, treino -> if (treino.ordem == null) treino.ordem = index }
                adapter.atualizar(treinos)

                // opcional: cache local
                runCatching { PlanoTreinoRepository.salvarTreinos(requireContext(), treinos) }
            },
            onErro = { e ->
                if (!isAdded) return@carregarTreinos
                Log.e("MONTAR_TREINO", "Erro ao carregar treinos uid=$uidAlvo", e)
                AppUiFeedback.showToast(requireContext(), "Sem acesso/erro: ${e.message}", Toast.LENGTH_SHORT)
            }
        )
    }

    private fun abrirDialogAdicionarTreino() {
        val input = EditText(requireContext())
        input.hint = "Nome do treino (ex: Treino A...)"
        input.hintPortugueseIme()

        AppUiFeedback.dialogBuilder(requireContext())
            .setTitle("Adicionar treino")
            .setView(input)
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Salvar") { _, _ ->
                val nome = input.text.toString().trim()
                if (nome.isEmpty()) {
                    AppUiFeedback.showToast(requireContext(), "Digite um nome", Toast.LENGTH_SHORT)
                    return@setPositiveButton
                }
                if (treinos.any { it.nome.equals(nome, ignoreCase = true) }) {
                    AppUiFeedback.showToast(requireContext(), "Esse treino já existe", Toast.LENGTH_SHORT)
                    return@setPositiveButton
                }

                val novo = TreinoPlan(nome = nome, ordem = treinos.size)
                treinos.add(novo)
                adapter.atualizar(treinos)

                val alvo = if (meuRole == "TREINADOR") alunoUidSelecionado else Firebase.auth.currentUser?.uid
                if (alvo.isNullOrBlank()) {
                    AppUiFeedback.showToast(requireContext(), "Selecione um aluno no Perfil.", Toast.LENGTH_SHORT)
                    return@setPositiveButton
                }

                // ✅ salva no aluno (treinador) / ou no próprio (aluno)
                PlanoTreinoFirestoreRepository.salvarTreinoParaAlunoFromPlan(
                    alunoUid = alvo,
                    treino = novo,
                    notifyStudent = false,
                    onOk = {
                        if (!isAdded) return@salvarTreinoParaAlunoFromPlan

                        parentFragmentManager.beginTransaction()
                            .replace(
                                R.id.fragmentContainer,
                                ExerciciosTreinoFragment.newInstance(novo.nome, alvo, true)
                            )
                            .addToBackStack("montar_treino")
                            .commitAllowingStateLoss()
                    },
                    onErro = { e ->
                        AppUiFeedback.showToast(requireContext(), "Erro ao salvar: ${e.message}", Toast.LENGTH_SHORT)
                    }
                )
            }
            .show()
    }


    private fun abrirAcoesTreino(position: Int) {
        val treino = treinos.getOrNull(position) ?: return
        val opcoes = mutableListOf<String>()

        if (position > 0) opcoes.add("Mover para cima")
        if (position < treinos.lastIndex) opcoes.add("Mover para baixo")
        opcoes.add("Editar nome")
        opcoes.add("Remover treino")

        AppUiFeedback.dialogBuilder(requireContext())
            .setTitle(treino.nome)
            .setItems(opcoes.toTypedArray()) { _, which ->
                when (opcoes[which]) {
                    "Mover para cima" -> moverTreino(position, position - 1)
                    "Mover para baixo" -> moverTreino(position, position + 1)
                    "Editar nome" -> abrirDialogRenomearTreino(position)
                    "Remover treino" -> confirmarRemocaoTreino(position)
                }
            }
            .show()
    }

    private fun abrirDialogRenomearTreino(position: Int) {
        val treinoAtual = treinos.getOrNull(position) ?: return
        val alvo = if (meuRole == "TREINADOR") alunoUidSelecionado else Firebase.auth.currentUser?.uid
        if (alvo.isNullOrBlank()) {
            AppUiFeedback.showToast(requireContext(), "Selecione um aluno no Perfil.", Toast.LENGTH_SHORT)
            return
        }

        val input = EditText(requireContext()).apply {
            setText(treinoAtual.nome)
            selectAll()
            hint = "Nome do treino"
            hintPortugueseIme()
        }

        val dialog = AppUiFeedback.dialogBuilder(requireContext())
            .setTitle("Editar nome do treino")
            .setView(input)
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Salvar", null)
            .create()

        dialog.setOnShowListener {
            val saveButton = dialog.getButton(AlertDialog.BUTTON_POSITIVE)
            saveButton.setOnClickListener {
                val novoNome = input.text.toString().trim()
                if (novoNome.isBlank()) {
                    input.error = "Digite um nome"
                    return@setOnClickListener
                }
                if (treinos.indices.any { index ->
                        index != position && treinos[index].nome.equals(novoNome, ignoreCase = true)
                    }) {
                    input.error = "Esse treino já existe"
                    return@setOnClickListener
                }
                if (novoNome == treinoAtual.nome) {
                    dialog.dismiss()
                    return@setOnClickListener
                }

                val treinoRenomeado = TreinoPlan(
                    nome = novoNome,
                    exercicios = treinoAtual.exercicios.toMutableList(),
                    ordem = treinoAtual.ordem
                )
                saveButton.isEnabled = false

                PlanoTreinoFirestoreRepository.renomearTreinoDoAluno(
                    alunoUid = alvo,
                    nomeAntigo = treinoAtual.nome,
                    treinoRenomeado = treinoRenomeado,
                    notifyStudent = meuRole == "TREINADOR",
                    onOk = {
                        if (!isAdded) return@renomearTreinoDoAluno
                        treinos[position] = treinoRenomeado
                        adapter.atualizar(treinos)
                        runCatching { PlanoTreinoRepository.salvarTreinos(requireContext(), treinos) }
                        AppUiFeedback.showToast(requireContext(), "Nome do treino atualizado.", Toast.LENGTH_SHORT)
                        dialog.dismiss()
                    },
                    onErro = { error ->
                        if (!isAdded) return@renomearTreinoDoAluno
                        saveButton.isEnabled = true
                        AppUiFeedback.showToast(
                            requireContext(),
                            "Erro ao renomear: ${error.message}",
                            Toast.LENGTH_SHORT
                        )
                    }
                )
            }
        }
        dialog.show()
    }

    private fun moverTreino(origem: Int, destino: Int) {
        if (atualizandoOrdem || origem !in treinos.indices || destino !in treinos.indices || origem == destino) return

        val alvo = if (meuRole == "TREINADOR") alunoUidSelecionado else Firebase.auth.currentUser?.uid
        if (alvo.isNullOrBlank()) {
            AppUiFeedback.showToast(requireContext(), "Selecione um aluno no Perfil.", Toast.LENGTH_SHORT)
            return
        }

        val ordemAnterior = treinos.toList()
        val item = treinos.removeAt(origem)
        treinos.add(destino, item)
        treinos.forEachIndexed { index, treino -> treino.ordem = index }
        adapter.atualizar(treinos)

        atualizandoOrdem = true
        PlanoTreinoFirestoreRepository.atualizarOrdemTreinos(
            alunoUid = alvo,
            treinos = treinos,
            notifyStudent = meuRole == "TREINADOR",
            onOk = {
                atualizandoOrdem = false
                if (!isAdded) return@atualizarOrdemTreinos
                runCatching { PlanoTreinoRepository.salvarTreinos(requireContext(), treinos) }
                AppUiFeedback.showToast(requireContext(), "Ordem dos treinos atualizada.", Toast.LENGTH_SHORT)
            },
            onErro = { e ->
                atualizandoOrdem = false
                treinos.clear()
                treinos.addAll(ordemAnterior)
                treinos.forEachIndexed { index, treino -> treino.ordem = index }
                adapter.atualizar(treinos)
                if (!isAdded) return@atualizarOrdemTreinos
                AppUiFeedback.showToast(requireContext(), "Erro ao atualizar ordem: ${e.message}", Toast.LENGTH_SHORT)
            }
        )
    }

    private fun confirmarRemocaoTreino(position: Int) {
        val treino = treinos.getOrNull(position) ?: return
        val nome = treino.nome

        AppUiFeedback.dialogBuilder(requireContext())
            .setTitle("Remover treino")
            .setMessage("Deseja remover \"$nome\"?")
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Remover") { _, _ ->
                treinos.removeAt(position)
                treinos.forEachIndexed { index, item -> item.ordem = index }
                adapter.atualizar(treinos)

                val alvo = if (meuRole == "TREINADOR") alunoUidSelecionado else Firebase.auth.currentUser?.uid
                if (alvo.isNullOrBlank()) return@setPositiveButton

                PlanoTreinoFirestoreRepository.apagarTreinoDoAluno(
                    alunoUid = alvo,
                    nomeTreino = nome,
                    onOk = {
                        PlanoTreinoFirestoreRepository.atualizarOrdemTreinos(alvo, treinos)
                    }
                )
            }
            .show()
    }
}
