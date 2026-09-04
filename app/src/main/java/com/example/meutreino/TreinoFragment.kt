package com.example.meutreino

import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.fragment.app.Fragment
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.activityViewModels
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import java.util.Locale

class TreinoFragment : Fragment() {

    private val draftVM: TreinoDraftViewModel by activityViewModels()

    private lateinit var rvTreinosDia: RecyclerView
    private lateinit var adapter: TreinoDiaAdapter
    private lateinit var tvCronometroTitulo: TextView
    private lateinit var tvCronometroTreino: TextView
    private lateinit var tvCronometroStatus: TextView
    private lateinit var tvCronometroEstado: TextView
    private val treinos = mutableListOf<TreinoPlan>()
    private val cronometroHandler = Handler(Looper.getMainLooper())
    private var cronometroTreinoNome: String? = null
    private var cronometroInicioMs: Long? = null
    private val cronometroRunnable = object : Runnable {
        override fun run() {
            renderizarCronometro()
            if (cronometroInicioMs != null) cronometroHandler.postDelayed(this, 1000L)
        }
    }

    private var meuRole: String = "ALUNO"

    private val PREFS = "meutreino_prefs"
    private val KEY_SELECTED_STUDENT = "selected_student_uid"

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {

        val view = inflater.inflate(R.layout.fragment_treino, container, false)

        rvTreinosDia = view.findViewById(R.id.rvTreinosDia)
        tvCronometroTitulo = view.findViewById(R.id.tvCronometroTitulo)
        tvCronometroTreino = view.findViewById(R.id.tvCronometroTreino)
        tvCronometroStatus = view.findViewById(R.id.tvCronometroStatus)
        tvCronometroEstado = view.findViewById(R.id.tvCronometroEstado)
        rvTreinosDia.layoutManager = LinearLayoutManager(requireContext())

        draftVM.initialize(requireContext())

        // ✅ Adapter primeiro (usa a lista "treinos" como referência)
        adapter = TreinoDiaAdapter(
            treinos = treinos,
            contarRealizacoes = { nomeEx ->
                RegistroTreinoRepository.contarRealizacoesExercicio(requireContext(), nomeEx)
            },
            getAnterior = { treinoNome, exercicioNome, serieNumero ->
                buscarSerieAnterior(treinoNome, exercicioNome, serieNumero)
            },
            draftVM = draftVM,
            onTreinoAtivoAlterado = { nomeTreino, inicioMs ->
                atualizarEstadoCronometro(nomeTreino, inicioMs)
            }
        ) { treino, preenchimentoDoTreino, completo, duracaoSegundos ->

            if (!isAdded) return@TreinoDiaAdapter

            // ✅ Treinador NÃO registra nada
            if (meuRole == "TREINADOR") {
                AppUiFeedback.showToast(requireContext(), "Treinador não registra treino.", Toast.LENGTH_SHORT)
                return@TreinoDiaAdapter
            }

            val createdAt = System.currentTimeMillis()
            val dataHora = java.text.SimpleDateFormat(
                "dd/MM/yyyy HH:mm",
                java.util.Locale.getDefault()
            ).format(java.util.Date(createdAt))

            val registro = TreinoRegistro(
                id = "${dataHora}_${treino.nome}",
                dataHora = dataHora,
                nomeTreino = treino.nome,
                completo = completo,
                exercicios = montarExerciciosRegistro(treino, preenchimentoDoTreino),
                duracaoSegundos = duracaoSegundos,
                createdAt = createdAt
            )

            // ✅ aluno salva local + nuvem
            RegistroTreinoRepository.salvarTreino(requireContext(), registro)
            RegistroTreinoFirestoreRepository.salvarRegistro(registro)

            AppUiFeedback.showToast(
                requireContext(),
                if (completo) "Treino salvo completo!" else "Treino salvo incompleto!",
                Toast.LENGTH_SHORT
            )
        }

        rvTreinosDia.adapter = adapter
        atualizarEstadoCronometro(draftVM.treinoAtivo(), draftVM.inicioTreinoMs())

        // ✅ 1) Carrega cache local (rápido/offline) — só para ALUNO faz sentido
        carregarCacheLocal()

        // ✅ 2) Descobre role e carrega da nuvem (aluno: próprio uid / treinador: aluno selecionado)
        carregarTreinosDaNuvemComRole()

        return view
    }

    override fun onResume() {
        super.onResume()
        atualizarEstadoCronometro(draftVM.treinoAtivo(), draftVM.inicioTreinoMs())
    }

    override fun onPause() {
        cronometroHandler.removeCallbacks(cronometroRunnable)
        super.onPause()
    }

    override fun onDestroyView() {
        cronometroHandler.removeCallbacks(cronometroRunnable)
        super.onDestroyView()
    }

    private fun atualizarEstadoCronometro(nomeTreino: String?, inicioMs: Long?) {
        cronometroHandler.removeCallbacks(cronometroRunnable)
        cronometroTreinoNome = nomeTreino
        cronometroInicioMs = if (!nomeTreino.isNullOrBlank()) inicioMs else null
        renderizarCronometro()
        if (cronometroInicioMs != null) cronometroHandler.postDelayed(cronometroRunnable, 1000L)
    }

    private fun renderizarCronometro() {
        if (!::tvCronometroTreino.isInitialized) return
        val inicioMs = cronometroInicioMs
        val ativo = !cronometroTreinoNome.isNullOrBlank() && inicioMs != null
        val duracaoSegundos = if (ativo) {
            ((System.currentTimeMillis() - inicioMs!!) / 1000L).coerceAtLeast(0L)
        } else {
            0L
        }

        tvCronometroTitulo.text = if (ativo) "TEMPO DE TREINO" else "CRONÔMETRO DE TREINO"
        tvCronometroTreino.text = formatarCronometro(duracaoSegundos)
        tvCronometroStatus.text = if (ativo) cronometroTreinoNome else "Inicie um treino abaixo para começar"
        tvCronometroEstado.text = if (ativo) "EM ANDAMENTO" else "PRONTO"
        tvCronometroTreino.contentDescription = "Tempo de treino: ${formatarCronometro(duracaoSegundos)}"
    }

    private fun formatarCronometro(totalSegundos: Long): String {
        val horas = totalSegundos / 3600L
        val minutos = (totalSegundos % 3600L) / 60L
        val segundos = totalSegundos % 60L
        return String.format(Locale.US, "%02d:%02d:%02d", horas, minutos, segundos)
    }

    private fun montarExerciciosRegistro(
        treino: TreinoPlan,
        preenchimentoDoTreino: Map<String, Pair<String, String>>
    ): List<ExercicioRegistro> {
        return treino.exercicios.map { ex ->
            val series = (1..ex.series).mapNotNull { serieNumero ->
                val key = "${treino.nome}|${ex.nome}|$serieNumero"
                val (kgRaw, repsRaw) = preenchimentoDoTreino[key] ?: return@mapNotNull null
                val kg = kgRaw.trim().toDoubleOrNull() ?: return@mapNotNull null
                val reps = repsRaw.trim().toIntOrNull() ?: return@mapNotNull null

                SerieRegistro(
                    serieNumero = serieNumero,
                    kg = kg,
                    reps = reps
                )
            }

            ExercicioRegistro(
                nomeExercicio = ex.nome,
                series = series
            )
        }
    }

    private fun buscarSerieAnterior(
        treinoNome: String,
        exercicioNome: String,
        serieNumero: Int
    ): String {
        val registros = RegistroTreinoRepository.carregarTreinos(requireContext())
        val registroAnterior = registros
            .asSequence()
            .filter { it.nomeTreino.equals(treinoNome, ignoreCase = true) }
            .maxByOrNull { TreinoRegistroUtils.timeOf(it) }
            ?: return "—"

        val serie = registroAnterior.exercicios
            .firstOrNull { it.nomeExercicio.equals(exercicioNome, ignoreCase = true) }
            ?.series
            ?.firstOrNull { it.serieNumero == serieNumero }
            ?: return "—"

        return "${serie.kg}kg x ${serie.reps}"
    }

    private fun carregarCacheLocal() {
        try {
            val local = PlanoTreinoRepository.carregarTreinos(requireContext())
            treinos.clear()
            treinos.addAll(local)
            adapter.notifyDataSetChanged()
        } catch (e: Exception) {
            Log.e("TREINO_FRAGMENT", "Erro ao carregar cache local", e)
        }
    }

    private fun carregarTreinosDaNuvemComRole() {
        val user = Firebase.auth.currentUser
        if (user == null) {
            AppUiFeedback.showToast(requireContext(), "Usuário não logado.", Toast.LENGTH_SHORT)
            return
        }

        Firebase.firestore.collection("users").document(user.uid).get()
            .addOnSuccessListener { doc ->
                meuRole = (doc.getString("role") ?: "ALUNO").trim().uppercase()

                val uidAlvo = if (meuRole == "TREINADOR") {
                    val prefs = requireContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    prefs.getString(KEY_SELECTED_STUDENT, null)
                } else {
                    user.uid
                }

                if (uidAlvo.isNullOrBlank()) {
                    // treinador sem aluno selecionado
                    if (meuRole == "TREINADOR") {
                        treinos.clear()
                        adapter.notifyDataSetChanged()
                        AppUiFeedback.showToast(requireContext(), "Selecione um aluno no Perfil.", Toast.LENGTH_SHORT)
                    }
                    return@addOnSuccessListener
                }

                // ✅ Carrega treinos do UID alvo na nuvem
                PlanoTreinoFirestoreRepository.carregarTreinos(
                    uidAlvo = uidAlvo,
                    onOk = { lista ->
                        if (!isAdded) return@carregarTreinos

                        treinos.clear()
                        treinos.addAll(lista)
                        adapter.notifyDataSetChanged()

                        // ✅ se for ALUNO (e uidAlvo==meu uid), salva cache local pro offline
                        if (meuRole != "TREINADOR" && uidAlvo == user.uid) {
                            try {
                                PlanoTreinoRepository.salvarTreinos(requireContext(), treinos)
                            } catch (e: Exception) {
                                Log.e("TREINO_FRAGMENT", "Erro ao salvar cache local", e)
                            }
                        }

                        // ✅ sincroniza registros só pro ALUNO (evita poluir cache do treinador)
                        if (meuRole != "TREINADOR" && uidAlvo == user.uid) {
                            carregarRegistrosNuvem(uidAlvo)
                        }

                        // feedback
                        if (treinos.isEmpty()) {
                            AppUiFeedback.showToast(requireContext(), "Nenhum treino recebido ainda.", Toast.LENGTH_SHORT)
                        }
                    },
                    onErro = { e ->
                        if (!isAdded) return@carregarTreinos
                        Log.e("TREINO_FRAGMENT", "Erro ao carregar treinos da nuvem", e)

                        // fallback (cache local já carregado)
                        AppUiFeedback.showToast(requireContext(), "Sem internet: usando cache local.", Toast.LENGTH_SHORT)
                    }
                )
            }
            .addOnFailureListener { e ->
                Log.e("TREINO_FRAGMENT", "Erro ao ler role", e)
                // fallback: assume ALUNO e tenta nuvem do próprio uid
                meuRole = "ALUNO"
                PlanoTreinoFirestoreRepository.carregarTreinos(
                    uidAlvo = user.uid,
                    onOk = { lista ->
                        if (!isAdded) return@carregarTreinos
                        treinos.clear()
                        treinos.addAll(lista)
                        adapter.notifyDataSetChanged()
                        try {
                            PlanoTreinoRepository.salvarTreinos(requireContext(), treinos)
                        } catch (_: Exception) {}
                        carregarRegistrosNuvem(user.uid)
                    },
                    onErro = { /* fica no cache local */ }
                )
            }
    }

    // ✅ Agora recebe uidAlvo para não ficar “travado” no usuário logado
    private fun carregarRegistrosNuvem(uidAlvo: String) {
        RegistroTreinoFirestoreRepository.listarTreinos(
            uidAlvo = uidAlvo,
            onOk = { registros ->
                if (!isAdded) return@listarTreinos

                // só salva cache local se for o próprio aluno logado
                val meuUid = Firebase.auth.currentUser?.uid
                if (meuUid == uidAlvo) {
                    registros.forEach { registro ->
                        val idSincronizado = if (registro.id.isBlank()) {
                            "${registro.dataHora}_${registro.nomeTreino}"
                        } else {
                            registro.id
                        }

                        RegistroTreinoRepository.salvarOuAtualizar(
                            requireContext(),
                            registro.copy(id = idSincronizado)
                        )
                    }
                }

                adapter.notifyDataSetChanged()
            },
            onErro = { e ->
                Log.e("TREINO_FRAGMENT", "Erro ao carregar registros nuvem", e)
            }
        )
    }
}
