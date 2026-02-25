package com.example.meutreino

import android.app.AlertDialog
import android.os.Bundle
import android.util.Log
import androidx.fragment.app.Fragment
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import com.google.firebase.auth.ktx.auth
import com.google.firebase.ktx.Firebase

class ExerciciosTreinoFragment : Fragment() {

    companion object {
        private const val ARG_NOME_TREINO = "nome_treino"
        private const val ARG_UID_ALVO = "uid_alvo"

        fun newInstance(nomeTreino: String, uidAlvo: String?): ExerciciosTreinoFragment {
            val f = ExerciciosTreinoFragment()
            val b = Bundle()
            b.putString(ARG_NOME_TREINO, nomeTreino)
            b.putString(ARG_UID_ALVO, uidAlvo)
            f.arguments = b
            return f
        }
    }

    private var nomeTreino: String = ""
    private var uidAlvo: String? = null

    private lateinit var tvTitulo: TextView
    private lateinit var listExercicios: ListView
    private lateinit var btnAdicionar: Button
    private lateinit var btnApagarTreino: Button

    private var treinos = mutableListOf<TreinoPlan>()
    private var treinoAtual: TreinoPlan? = null

    private lateinit var adapter: ExerciciosListAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        nomeTreino = arguments?.getString(ARG_NOME_TREINO) ?: ""
        uidAlvo = arguments?.getString(ARG_UID_ALVO)
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {

        val view = inflater.inflate(R.layout.fragment_exercicios_treino, container, false)

        tvTitulo = view.findViewById(R.id.tvTituloTreino)
        listExercicios = view.findViewById(R.id.listExercicios)
        btnAdicionar = view.findViewById(R.id.btnAdicionarExercicio)
        btnApagarTreino = view.findViewById(R.id.btnApagarTreino)

        tvTitulo.text = "Treino: $nomeTreino"

        val alvo = resolverUidAlvo()
        if (alvo.isNullOrBlank()) {
            Toast.makeText(requireContext(), "Erro: UID alvo inválido.", Toast.LENGTH_SHORT).show()
            parentFragmentManager.popBackStack()
            return view
        }

        // ✅ Carrega SEMPRE da nuvem do UID alvo (aluno selecionado, ou o próprio aluno)
        PlanoTreinoFirestoreRepository.carregarTreinos(
            uidAlvo = alvo,
            onOk = { lista ->
                if (!isAdded) return@carregarTreinos

                treinos = lista.toMutableList()

                treinoAtual = treinos.firstOrNull {
                    it.nome.trim().equals(nomeTreino.trim(), ignoreCase = true)
                }

                if (treinoAtual == null) {
                    Toast.makeText(requireContext(), "Treino não encontrado.", Toast.LENGTH_SHORT).show()
                    parentFragmentManager.popBackStack()
                    return@carregarTreinos
                }

                val exerciciosDoTreino = treinoAtual?.exercicios
                if (exerciciosDoTreino == null) {
                    Toast.makeText(requireContext(), "Treino inválido.", Toast.LENGTH_SHORT).show()
                    parentFragmentManager.popBackStack()
                    return@carregarTreinos
                }

                // ✅ Adapter com callback: qualquer mudança -> salva no UID alvo
                adapter = ExerciciosListAdapter(
                    requireContext(),
                    exerciciosDoTreino
                ) {
                    salvarTreinoAtual(alvo)
                }

                listExercicios.adapter = adapter

                btnAdicionar.setOnClickListener { abrirDialogAdicionarExercicio(alvo) }

                listExercicios.setOnItemLongClickListener { _, _, position, _ ->
                    mostrarAcoesExercicio(position, alvo)
                    true
                }

                btnApagarTreino.setOnClickListener { confirmarApagarTreino(alvo) }
            },
            onErro = { e ->
                if (!isAdded) return@carregarTreinos
                Log.e("EX_TREINO", "Erro ao carregar", e)
                Toast.makeText(requireContext(), "Sem acesso/erro: ${e.message}", Toast.LENGTH_LONG).show()
            }
        )

        return view
    }

    // ============================
    // Helpers
    // ============================
    private fun resolverUidAlvo(): String? {
        // Se vier uid do aluno selecionado, usa.
        // Se não vier (ex: aluno mexendo no próprio), usa o uid logado.
        val passed = uidAlvo?.trim()
        return if (!passed.isNullOrBlank()) passed else Firebase.auth.currentUser?.uid
    }

    private fun salvarTreinoAtual(uidDestino: String) {
        val t = treinoAtual ?: return

        PlanoTreinoFirestoreRepository.salvarTreinoParaAlunoFromPlan(
            alunoUid = uidDestino,
            treino = t,
            onOk = { /* ok */ },
            onErro = { e ->
                if (!isAdded) return@salvarTreinoParaAlunoFromPlan
                Toast.makeText(requireContext(), "Erro ao salvar: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        )
    }

    // ============================
    // UI: Adicionar exercício
    // ============================
    private fun abrirDialogAdicionarExercicio(uidDestino: String) {
        abrirDialogExercicio(uidDestino = uidDestino)
    }

    private fun abrirDialogEditarExercicio(position: Int, uidDestino: String) {
        val ex = treinoAtual?.exercicios?.getOrNull(position) ?: return
        abrirDialogExercicio(
            uidDestino = uidDestino,
            exercicioEdicao = ex,
            positionEdicao = position
        )
    }

    private fun abrirDialogExercicio(
        uidDestino: String,
        exercicioEdicao: ExercicioPlan? = null,
        positionEdicao: Int? = null
    ) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_adicionar_exercicio, null)

        val etNome = dialogView.findViewById<AutoCompleteTextView>(R.id.etNomeExercicio)
        val etSeries = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.etSeries)
        val etRepsMin = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.etRepsMin)
        val etRepsMax = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.etRepsMax)
        val etDesc = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.etDescanso)
        val etTecnica = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.etTecnica)
        val etRir = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.etRir)

        val btnSalvar = dialogView.findViewById<com.google.android.material.button.MaterialButton>(R.id.btnSalvarExercicioDialog)
        val btnFechar = dialogView.findViewById<View>(R.id.btnFecharDialog)

        val dialog = AlertDialog.Builder(requireContext())
            .setView(dialogView)
            .create()

        dialog.setOnShowListener {
            dialog.window?.setBackgroundDrawable(
                android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT)
            )
        }

        btnFechar?.setOnClickListener { dialog.dismiss() }

        if (exercicioEdicao != null) {
            etNome?.setText(exercicioEdicao.nome)
            etSeries?.setText(exercicioEdicao.series.toString())
            etRepsMin?.setText(exercicioEdicao.repsMin.toString())
            etRepsMax?.setText(exercicioEdicao.repsMax.toString())
            etDesc?.setText(exercicioEdicao.descanso)
            etTecnica?.setText(exercicioEdicao.tecnica)
            etRir?.setText(exercicioEdicao.rir)
            btnSalvar?.text = "Salvar edição"
        }

        // ✅ Sugestões local
        val sugestoesLocal = BancoExerciciosRepository.obterNomes(requireContext())
        val autoAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, sugestoesLocal)
        etNome?.setAdapter(autoAdapter)
        etNome?.threshold = 0
        if (etNome == null || etSeries == null || etRepsMin == null || etRepsMax == null ||
            etDesc == null || etTecnica == null || etRir == null || btnSalvar == null || btnFechar == null
        ) {
            Toast.makeText(requireContext(), "Erro: IDs do dialog não batem com o XML.", Toast.LENGTH_LONG).show()
            return
        }


        // ✅ Atualiza com a nuvem (autocomplete)
        BancoExerciciosFirestoreRepository.carregar(
            onOk = { nomesNuvem ->
                val setLocal = BancoExerciciosRepository.obterNomes(requireContext())
                    .map { it.lowercase() }
                    .toSet()

                nomesNuvem.forEach { nomeN ->
                    if (!setLocal.contains(nomeN.lowercase())) {
                        BancoExerciciosRepository.adicionar(requireContext(), nomeN)
                    }
                }

                val atualizado = BancoExerciciosRepository.obterNomes(requireContext())
                autoAdapter.clear()
                autoAdapter.addAll(atualizado)
                autoAdapter.notifyDataSetChanged()
            }
        )

        btnSalvar?.setOnClickListener {
            val nome = etNome?.text?.toString()?.trim().orEmpty()
            val seriesStr = etSeries?.text?.toString()?.trim().orEmpty()
            val repsMinStr = etRepsMin?.text?.toString()?.trim().orEmpty()
            val repsMaxStr = etRepsMax?.text?.toString()?.trim().orEmpty()
            val desc = etDesc?.text?.toString()?.trim().orEmpty()
            val tecnica = etTecnica?.text?.toString()?.trim().orEmpty()
            val rir = etRir?.text?.toString()?.trim().orEmpty()

            if (nome.isBlank() || seriesStr.isBlank() || repsMinStr.isBlank() ||
                repsMaxStr.isBlank() || desc.isBlank() || rir.isBlank()
            ) {
                Toast.makeText(requireContext(), "Preencha os campos obrigatórios", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val series = seriesStr.toIntOrNull()
            val repsMin = repsMinStr.toIntOrNull()
            val repsMax = repsMaxStr.toIntOrNull()

            if (series == null || repsMin == null || repsMax == null ||
                series <= 0 || repsMin <= 0 || repsMax <= 0
            ) {
                Toast.makeText(requireContext(), "Valores numéricos inválidos", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // banco exercícios (local + nuvem se novo)
            val nomesBanco = BancoExerciciosRepository.obterNomes(requireContext())
            val jaExiste = nomesBanco.any { it.equals(nome, true) }
            if (!jaExiste) {
                BancoExerciciosRepository.adicionar(requireContext(), nome)
                BancoExerciciosFirestoreRepository.adicionar(nome)
            }

            val ex = ExercicioPlan(
                nome = nome,
                series = series,
                repsMin = repsMin,
                repsMax = repsMax,
                descanso = desc,
                tecnica = if (tecnica.isBlank()) "—" else tecnica,
                rir = rir
            )

            val lista = treinoAtual?.exercicios ?: return@setOnClickListener
            if (positionEdicao != null && positionEdicao in lista.indices) {
                lista[positionEdicao] = ex
            } else {
                lista.add(ex)
            }
            adapter.atualizar()

            // ✅ salva no UID alvo (aluno)
            salvarTreinoAtual(uidDestino = uidDestino)

            dialog.dismiss()
        }

        dialog.show()
    }

    // ============================
    // Ações do exercício
    // ============================
    private fun mostrarAcoesExercicio(position: Int, uidDestino: String) {
        val ex = treinoAtual?.exercicios?.getOrNull(position) ?: return

        AlertDialog.Builder(requireContext())
            .setTitle(ex.nome)
            .setItems(arrayOf("Editar exercício", "Remover exercício")) { _, which ->
                when (which) {
                    0 -> abrirDialogEditarExercicio(position, uidDestino)
                    1 -> confirmarRemocaoExercicio(position, uidDestino)
                }
            }
            .show()
    }

    private fun confirmarRemocaoExercicio(position: Int, uidDestino: String) {
        val t = treinoAtual ?: return
        val ex = t.exercicios.getOrNull(position) ?: return

        AlertDialog.Builder(requireContext())
            .setTitle("Remover exercício")
            .setMessage("Remover \"${ex.nome}\"?")
            .setPositiveButton("Remover") { _, _ ->
                t.exercicios.removeAt(position)
                adapter.atualizar()
                salvarTreinoAtual(uidDestino)
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    // ============================
    // Apagar treino inteiro
    // ============================
    private fun confirmarApagarTreino(uidDestino: String) {
        AlertDialog.Builder(requireContext())
            .setTitle("Apagar treino")
            .setMessage("Deseja apagar o treino \"$nomeTreino\"?")
            .setPositiveButton("Apagar") { _, _ ->
                PlanoTreinoFirestoreRepository.apagarTreinoDoAluno(
                    alunoUid = uidDestino,
                    nomeTreino = nomeTreino,
                    onOk = {
                        if (!isAdded) return@apagarTreinoDoAluno
                        Toast.makeText(requireContext(), "Treino apagado!", Toast.LENGTH_SHORT).show()
                        parentFragmentManager.popBackStack()
                    },
                    onErro = { e ->
                        if (!isAdded) return@apagarTreinoDoAluno
                        Toast.makeText(requireContext(), "Erro ao apagar: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                )
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }
}
