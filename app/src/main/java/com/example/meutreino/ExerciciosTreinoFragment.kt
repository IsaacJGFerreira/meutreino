package com.example.meutreino

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
        private const val ARG_IS_NEW_TREINO = "is_new_treino"

        fun newInstance(nomeTreino: String, uidAlvo: String?, isNewTreino: Boolean = false): ExerciciosTreinoFragment {
            val f = ExerciciosTreinoFragment()
            val b = Bundle()
            b.putString(ARG_NOME_TREINO, nomeTreino)
            b.putString(ARG_UID_ALVO, uidAlvo)
            b.putBoolean(ARG_IS_NEW_TREINO, isNewTreino)
            f.arguments = b
            return f
        }
    }

    private var nomeTreino: String = ""
    private var uidAlvo: String? = null
    private var isNewTreinoFlow: Boolean = false

    private lateinit var tvTitulo: TextView
    private lateinit var listExercicios: ListView
    private lateinit var btnAdicionar: Button
    private lateinit var btnApagarTreino: Button
    private lateinit var btnSalvarTreino: Button

    private var treinos = mutableListOf<TreinoPlan>()
    private var treinoAtual: TreinoPlan? = null
    private var treinoAlterado: Boolean = false

    private lateinit var adapter: ExerciciosListAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        nomeTreino = arguments?.getString(ARG_NOME_TREINO) ?: ""
        uidAlvo = arguments?.getString(ARG_UID_ALVO)
        isNewTreinoFlow = arguments?.getBoolean(ARG_IS_NEW_TREINO, false) ?: false
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
        btnSalvarTreino = view.findViewById(R.id.btnSalvarTreino)

        tvTitulo.text = "Treino: $nomeTreino"

        val alvo = resolverUidAlvo()
        if (alvo.isNullOrBlank()) {
            AppUiFeedback.showToast(requireContext(), "Erro: UID alvo inválido.", Toast.LENGTH_SHORT)
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
                    AppUiFeedback.showToast(requireContext(), "Treino não encontrado.", Toast.LENGTH_SHORT)
                    parentFragmentManager.popBackStack()
                    return@carregarTreinos
                }

                val exerciciosDoTreino = treinoAtual?.exercicios
                if (exerciciosDoTreino == null) {
                    AppUiFeedback.showToast(requireContext(), "Treino inválido.", Toast.LENGTH_SHORT)
                    parentFragmentManager.popBackStack()
                    return@carregarTreinos
                }

                // ✅ Adapter com callback: qualquer mudança -> salva no UID alvo
                adapter = ExerciciosListAdapter(
                    requireContext(),
                    exerciciosDoTreino
                ) {
                    treinoAlterado = true
                }

                listExercicios.adapter = adapter

                btnAdicionar.setOnClickListener { abrirDialogAdicionarExercicio() }

                // Toque normal: edita o exercício.
                listExercicios.setOnItemClickListener { _, _, position, _ ->
                    abrirDialogEditarExercicio(position)
                }

                // Toque longo no card: exclui somente o exercício do treino.
                listExercicios.setOnItemLongClickListener { _, _, position, _ ->
                    confirmarRemocaoExercicio(position, alvo)
                    true
                }

                btnApagarTreino.setOnClickListener { confirmarApagarTreino(alvo) }
                btnSalvarTreino.setOnClickListener { validarESalvarTreino(alvo) }
            },
            onErro = { e ->
                if (!isAdded) return@carregarTreinos
                Log.e("EX_TREINO", "Erro ao carregar", e)
                AppUiFeedback.showToast(requireContext(), "Sem acesso/erro: ${e.message}", Toast.LENGTH_LONG)
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

    private fun salvarTreinoAtual(
        uidDestino: String,
        mensagemNotificacao: String? = null,
        onOk: (() -> Unit)? = null
    ) {
        val t = treinoAtual ?: return

        PlanoTreinoFirestoreRepository.salvarTreinoParaAlunoFromPlan(
            alunoUid = uidDestino,
            treino = t,
            notifyStudent = true,
            notificationMessage = mensagemNotificacao,
            onOk = {
                treinoAlterado = false
                onOk?.invoke()
            },
            onErro = { e ->
                if (!isAdded) return@salvarTreinoParaAlunoFromPlan
                AppUiFeedback.showToast(requireContext(), "Erro ao salvar: ${e.message}", Toast.LENGTH_SHORT)
            }
        )
    }


    private fun validarESalvarTreino(uidDestino: String) {
        val treino = treinoAtual ?: return
        val totalExercicios = treino.exercicios.size

        if (totalExercicios == 0) {
            AppUiFeedback.dialogBuilder(requireContext())
                .setTitle("Adicionar exercício obrigatório")
                .setMessage("Há a necessidade de adicionar pelo menos 1 exercício. Caso contrário, este treino será apagado.")
                .setPositiveButton("Continuar") { _, _ ->
                    PlanoTreinoFirestoreRepository.apagarTreinoDoAluno(
                        alunoUid = uidDestino,
                        nomeTreino = nomeTreino,
                        onOk = {
                            if (!isAdded) return@apagarTreinoDoAluno
                            AppUiFeedback.showToast(requireContext(), "Treino apagado por falta de exercícios.", Toast.LENGTH_SHORT)
                            parentFragmentManager.popBackStack()
                        },
                        onErro = { e ->
                            if (!isAdded) return@apagarTreinoDoAluno
                            AppUiFeedback.showToast(requireContext(), "Erro ao apagar treino: ${e.message}", Toast.LENGTH_SHORT)
                        }
                    )
                }
                .setNegativeButton("Voltar", null)
                .show()
            return
        }

        val mensagem: String? = if (isNewTreinoFlow) {
            "Novo treino \"${treino.nome}\" com $totalExercicios exercício(s) foi adicionado pelo seu professor."
        } else {
            null
        }

        val tinhaAlteracao = treinoAlterado || isNewTreinoFlow
        if (!tinhaAlteracao) {
            AppUiFeedback.showToast(requireContext(), "Nenhuma alteração para salvar.", Toast.LENGTH_SHORT)
            return
        }

        salvarTreinoAtual(
            uidDestino = uidDestino,
            mensagemNotificacao = mensagem,
            onOk = {
                if (!isAdded) return@salvarTreinoAtual
                val textoSucesso = if (tinhaAlteracao) "Treino salvo com sucesso!" else "Treino confirmado e salvo!"
                AppUiFeedback.showToast(requireContext(), textoSucesso, Toast.LENGTH_SHORT)
                isNewTreinoFlow = false
            }
        )
    }

    // ============================
    // UI: Adicionar exercício
    // ============================
    private fun abrirDialogAdicionarExercicio() {
        abrirDialogExercicio()
    }

    private fun abrirDialogEditarExercicio(position: Int) {
        val ex = treinoAtual?.exercicios?.getOrNull(position) ?: return
        abrirDialogExercicio(
            exercicioEdicao = ex,
            positionEdicao = position
        )
    }

    private fun abrirDialogExercicio(
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

        etNome?.hintPortugueseIme()
        etDesc?.hintPortugueseIme()
        etTecnica?.hintPortugueseIme()
        etRir?.hintPortugueseIme()

        val dialog = AppUiFeedback.dialogBuilder(requireContext())
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
            etNome?.isEnabled = false
            etNome?.keyListener = null
            dialogView.findViewById<com.google.android.material.textfield.TextInputLayout>(R.id.tilNome)
                ?.helperText = "O nome do exercício não pode ser alterado na edição."
            dialogView.findViewById<TextView>(R.id.tvTituloDialog)?.text = "Editar exercício"
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
            AppUiFeedback.showToast(requireContext(), "Erro: IDs do dialog não batem com o XML.", Toast.LENGTH_LONG)
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
            val nome = exercicioEdicao?.nome ?: etNome?.text?.toString()?.trim().orEmpty()
            val seriesStr = etSeries?.text?.toString()?.trim().orEmpty()
            val repsMinStr = etRepsMin?.text?.toString()?.trim().orEmpty()
            val repsMaxStr = etRepsMax?.text?.toString()?.trim().orEmpty()
            val desc = etDesc?.text?.toString()?.trim().orEmpty()
            val tecnica = etTecnica?.text?.toString()?.trim().orEmpty()
            val rir = etRir?.text?.toString()?.trim().orEmpty()

            if (nome.isBlank() || seriesStr.isBlank() || repsMinStr.isBlank() ||
                repsMaxStr.isBlank() || desc.isBlank() || rir.isBlank()
            ) {
                AppUiFeedback.showToast(requireContext(), "Preencha os campos obrigatórios", Toast.LENGTH_SHORT)
                return@setOnClickListener
            }

            val series = seriesStr.toIntOrNull()
            val repsMin = repsMinStr.toIntOrNull()
            val repsMax = repsMaxStr.toIntOrNull()

            if (series == null || repsMin == null || repsMax == null ||
                series <= 0 || repsMin <= 0 || repsMax <= 0
            ) {
                AppUiFeedback.showToast(requireContext(), "Valores numéricos inválidos", Toast.LENGTH_SHORT)
                return@setOnClickListener
            }

            if (repsMin > repsMax) {
                AppUiFeedback.showToast(
                    requireContext(),
                    "As repetições mínimas não podem ser maiores que as máximas",
                    Toast.LENGTH_SHORT
                )
                return@setOnClickListener
            }

            // banco exercícios (local + nuvem se novo)
            if (exercicioEdicao == null) {
                val nomesBanco = BancoExerciciosRepository.obterNomes(requireContext())
                val jaExiste = nomesBanco.any { it.equals(nome, true) }
                if (!jaExiste) {
                    BancoExerciciosRepository.adicionar(requireContext(), nome)
                    BancoExerciciosFirestoreRepository.adicionar(nome)
                }
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

            treinoAlterado = true
            dialog.dismiss()
        }

        dialog.show()
    }

    // ============================
    // Ações do exercício
    // ============================
    private fun mostrarAcoesExercicio(position: Int) {
        val ex = treinoAtual?.exercicios?.getOrNull(position) ?: return

        AppUiFeedback.dialogBuilder(requireContext())
            .setTitle(ex.nome)
            .setItems(arrayOf("Editar exercício", "Remover exercício")) { _, which ->
                when (which) {
                    0 -> abrirDialogEditarExercicio(position)
                    1 -> resolverUidAlvo()?.let { confirmarRemocaoExercicio(position, it) }
                }
            }
            .show()
    }

    private fun confirmarRemocaoExercicio(position: Int, uidDestino: String) {
        val t = treinoAtual ?: return
        val ex = t.exercicios.getOrNull(position) ?: return

        if (t.exercicios.size <= 1) {
            AppUiFeedback.showToast(requireContext(), "O treino precisa manter pelo menos 1 exercício.", Toast.LENGTH_SHORT)
            return
        }

        AppUiFeedback.dialogBuilder(requireContext())
            .setTitle("Remover exercício")
            .setMessage("Remover \"${ex.nome}\" deste treino?\n\nA alteração será salva no Firebase.")
            .setPositiveButton("Remover") { _, _ ->
                t.exercicios.removeAt(position)
                adapter.atualizar()
                treinoAlterado = true

                salvarTreinoAtual(
                    uidDestino = uidDestino,
                    mensagemNotificacao = "Seu treinador removeu o exercício \"${ex.nome}\" do treino \"${t.nome}\".",
                    onOk = {
                        if (!isAdded) return@salvarTreinoAtual
                        AppUiFeedback.showToast(requireContext(), "Exercício removido e treino salvo.", Toast.LENGTH_SHORT)
                    }
                )
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    // ============================
    // Apagar treino inteiro
    // ============================
    private fun confirmarApagarTreino(uidDestino: String) {
        AppUiFeedback.dialogBuilder(requireContext())
            .setTitle("Apagar treino")
            .setMessage("Deseja apagar o treino \"$nomeTreino\"?")
            .setPositiveButton("Apagar") { _, _ ->
                PlanoTreinoFirestoreRepository.apagarTreinoDoAluno(
                    alunoUid = uidDestino,
                    nomeTreino = nomeTreino,
                    onOk = {
                        if (!isAdded) return@apagarTreinoDoAluno
                        AppUiFeedback.showToast(requireContext(), "Treino apagado!", Toast.LENGTH_SHORT)
                        parentFragmentManager.popBackStack()
                    },
                    onErro = { e ->
                        if (!isAdded) return@apagarTreinoDoAluno
                        AppUiFeedback.showToast(requireContext(), "Erro ao apagar: ${e.message}", Toast.LENGTH_SHORT)
                    }
                )
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }
}
