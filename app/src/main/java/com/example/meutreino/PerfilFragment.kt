package com.example.meutreino

import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.gms.tasks.Tasks
import com.google.android.material.textfield.TextInputEditText
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlin.math.max
import kotlin.math.min

class PerfilFragment : Fragment() {

    companion object {
        private const val PREFS = "meutreino_prefs"
        private const val KEY_SELECTED_STUDENT = "selected_student_uid"
        private const val KEY_SELECTED_STUDENT_NAME = "selected_student_name"
        private const val KEY_LAST_NOTIFICATION_TS = "last_workout_notification_ts"
        private const val DEFAULT_CARDIO_GOAL = 180
    }

    private val repoRedeem = InviteRedeemRepository()
    private val repoRequest = InviteRequestRepository()
    private var notificationsListener: ListenerRegistration? = null
    private var unreadNotificationIds: List<String> = emptyList()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {

        val view = inflater.inflate(R.layout.fragment_perfil, container, false)

        val tvTitulo = view.findViewById<TextView>(R.id.tvPerfilTitulo)
        val tvKicker = view.findViewById<TextView>(R.id.tvPerfilKicker)
        val tvProfileHeroName = view.findViewById<TextView>(R.id.tvProfileHeroName)
        val tvInfo = view.findViewById<TextView>(R.id.tvPerfilInfo)
        val btnCodigo = view.findViewById<Button>(R.id.btnInserirCodigo)
        val btnSolicitar = view.findViewById<Button>(R.id.btnSolicitarCodigos)

        val tvProfileName = view.findViewById<TextView>(R.id.tvProfileName)
        val tvProfileCardTitle = view.findViewById<TextView>(R.id.tvProfileCardTitle)
        val tvProfileEmail = view.findViewById<TextView>(R.id.tvProfileEmail)
        val tvProfileRole = view.findViewById<TextView>(R.id.tvProfileRole)
        val tvProfileStatus = view.findViewById<TextView>(R.id.tvProfileStatus)
        val tvProfilePlan = view.findViewById<TextView>(R.id.tvProfilePlan)
        val tvProfileSince = view.findViewById<TextView>(R.id.tvProfileSince)

        val tvTituloCodigos = view.findViewById<TextView>(R.id.tvTituloCodigos)
        val rvCodigos = view.findViewById<RecyclerView>(R.id.rvCodigosDisponiveis)
        val tvTituloAlunos = view.findViewById<TextView>(R.id.tvTituloAlunos)
        val rvAlunos = view.findViewById<RecyclerView>(R.id.rvMeusAlunos)

        val boxAcompanhando = view.findViewById<View>(R.id.boxAcompanhando)
        val tvAcompanhando = view.findViewById<TextView>(R.id.tvAcompanhando)
        val btnTrocarAluno = view.findViewById<Button>(R.id.btnTrocarAluno)

        val cardStudentMetrics = view.findViewById<View>(R.id.cardStudentMetrics)
        val etIdade = view.findViewById<TextInputEditText>(R.id.etIdade)
        val etAltura = view.findViewById<TextInputEditText>(R.id.etAltura)
        val etPeso = view.findViewById<TextInputEditText>(R.id.etPeso)
        val btnSalvarDadosAluno = view.findViewById<Button>(R.id.btnSalvarDadosAluno)

        val cardStudentStatus = view.findViewById<View>(R.id.cardStudentStatus)
        val tvUltimoTreino = view.findViewById<TextView>(R.id.tvUltimoTreino)
        val tvUltimoPeso = view.findViewById<TextView>(R.id.tvUltimoPeso)
        val tvUltimoProgresso = view.findViewById<TextView>(R.id.tvUltimoProgresso)
        val tvUltimoCardio = view.findViewById<TextView>(R.id.tvUltimoCardio)
        val tvTreinosSemana = view.findViewById<TextView>(R.id.tvTreinosSemana)
        val tvResumoMetaCardio = view.findViewById<TextView>(R.id.tvResumoMetaCardio)

        val cardWeeklyProgress = view.findViewById<View>(R.id.cardWeeklyProgress)
        val layoutSemanaDots = view.findViewById<LinearLayout>(R.id.layoutSemanaDots)
        val tvResumoTreinoSemana = view.findViewById<TextView>(R.id.tvResumoTreinoSemana)
        val tvMetaCardioValor = view.findViewById<TextView>(R.id.tvMetaCardioValor)
        val progressCardioMeta = view.findViewById<ProgressBar>(R.id.progressCardioMeta)
        val tvFaltamCardio = view.findViewById<TextView>(R.id.tvFaltamCardio)

        val cardNotification = view.findViewById<View>(R.id.cardNotification)
        val tvNotificacaoTitulo = view.findViewById<TextView>(R.id.tvNotificacaoTitulo)
        val tvNotificacaoMensagem = view.findViewById<TextView>(R.id.tvNotificacaoMensagem)
        val layoutNotificacoes = view.findViewById<LinearLayout>(R.id.layoutNotificacoes)
        val btnMarcarNotificacaoLida = view.findViewById<Button>(R.id.btnMarcarNotificacaoLida)

        val cardTeacherMessage = view.findViewById<View>(R.id.cardTeacherMessage)
        val tvMensagemAlunoDestino = view.findViewById<TextView>(R.id.tvMensagemAlunoDestino)
        val etMensagemAluno = view.findViewById<EditText>(R.id.etMensagemAluno)
        val tvContadorMensagemAluno = view.findViewById<TextView>(R.id.tvContadorMensagemAluno)
        val btnEnviarMensagemAluno = view.findViewById<Button>(R.id.btnEnviarMensagemAluno)

        tvTitulo.text = "Perfil"
        tvUltimoPeso.visibility = View.GONE
        tvUltimoProgresso.visibility = View.GONE

        val codeAdapter = InviteCodeAdapter(mutableListOf()) { code -> copiarParaClipboard(code) }
        rvCodigos.layoutManager = LinearLayoutManager(requireContext())
        rvCodigos.adapter = codeAdapter

        val studentsAdapter = TrainerStudentsAdapter(mutableListOf()) { aluno ->
            salvarAlunoSelecionado(aluno.uid, aluno.name)
            atualizarBannerAlunoSelecionado(boxAcompanhando, tvAcompanhando)
            atualizarComposerMensagem(cardTeacherMessage, tvMensagemAlunoDestino, aluno.uid, aluno.name)
            AppUiFeedback.showToast(requireContext(), "Agora acompanhando: ${aluno.name}", Toast.LENGTH_SHORT)
        }
        rvAlunos.layoutManager = LinearLayoutManager(requireContext())
        rvAlunos.adapter = studentsAdapter

        btnTrocarAluno.setOnClickListener {
            limparAlunoSelecionado()
            boxAcompanhando.visibility = View.GONE
            cardTeacherMessage.visibility = View.GONE
            etMensagemAluno.setText("")
            AppUiFeedback.showToast(requireContext(), "Seleção de aluno limpa.", Toast.LENGTH_SHORT)
        }

        cardStudentMetrics.visibility = View.GONE
        cardStudentStatus.visibility = View.GONE
        cardWeeklyProgress.visibility = View.GONE
        cardNotification.visibility = View.GONE
        cardTeacherMessage.visibility = View.GONE

        etMensagemAluno.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(text: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(text: CharSequence?, start: Int, before: Int, count: Int) {
                tvContadorMensagemAluno.text = "${text?.length ?: 0}/100"
            }
            override fun afterTextChanged(editable: Editable?) = Unit
        })

        btnEnviarMensagemAluno.setOnClickListener {
            val prefs = requireContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val alunoUid = prefs.getString(KEY_SELECTED_STUDENT, null).orEmpty()
            val mensagem = etMensagemAluno.text?.toString().orEmpty()
            if (alunoUid.isBlank()) {
                AppUiFeedback.showToast(requireContext(), "Selecione um aluno primeiro.", Toast.LENGTH_SHORT)
                return@setOnClickListener
            }

            btnEnviarMensagemAluno.isEnabled = false
            TrainerMessageRepository.enviarParaAluno(
                alunoUid = alunoUid,
                mensagemRaw = mensagem,
                onOk = {
                    if (!isAdded) return@enviarParaAluno
                    etMensagemAluno.setText("")
                    btnEnviarMensagemAluno.isEnabled = true
                    AppUiFeedback.showToast(requireContext(), "Mensagem enviada.", Toast.LENGTH_SHORT)
                },
                onErro = { error ->
                    if (!isAdded) return@enviarParaAluno
                    btnEnviarMensagemAluno.isEnabled = true
                    AppUiFeedback.showToast(requireContext(), error.message ?: "Não foi possível enviar.", Toast.LENGTH_LONG)
                }
            )
        }

        tvTituloCodigos.visibility = View.GONE
        rvCodigos.visibility = View.GONE
        tvTituloAlunos.visibility = View.GONE
        rvAlunos.visibility = View.GONE
        boxAcompanhando.visibility = View.GONE
        btnSolicitar.visibility = View.GONE

        val user = Firebase.auth.currentUser
        if (user == null) {
            tvInfo.text = "Usuário não logado."
            tvProfileName.text = "Usuário não logado"
            tvProfileEmail.text = "—"
            tvProfileRole.text = "—"
            tvProfileStatus.text = "Bloqueado"
            tvProfileHeroName.text = "Usuário não logado"
            tvProfilePlan.text = "Inativo"
            tvProfileSince.text = "—"
            btnCodigo.visibility = View.GONE
            return view
        }

        btnCodigo.setOnClickListener { abrirDialogInserirCodigo() }

        Firebase.firestore.collection("users").document(user.uid)
            .get()
            .addOnSuccessListener { doc ->
                if (!isAdded) return@addOnSuccessListener

                val name = doc.getString("name") ?: "Sem nome"
                val email = doc.getString("email") ?: (user.email ?: "Sem email")
                val role = (doc.getString("role") ?: "ALUNO").trim().uppercase()
                val approved = doc.getBoolean("approved") ?: false
                val active = doc.getBoolean("active") ?: approved
                val createdAt = doc.getLong("createdAt")
                    ?: doc.getTimestamp("createdAt")?.toDate()?.time
                    ?: user.metadata?.creationTimestamp
                    ?: System.currentTimeMillis()
                val metaInicial = readInt(doc, "cardioMetaSemanalMin")
                    ?: readInt(doc, "metaSemanalCardioMin")
                    ?: readInt(doc, "cardioGoalMin")
                    ?: DEFAULT_CARDIO_GOAL

                tvInfo.text = "Nome: $name\nEmail: $email\nTipo: $role\nStatus: ${if (approved) "Liberado" else "Aguardando código"}"
                tvProfileName.text = name
                tvProfileEmail.text = email
                tvProfileRole.text = role
                tvProfileStatus.text = if (approved) "✓ Liberado" else "Aguardando"
                tvKicker.text = role
                tvProfileHeroName.text = name
                tvProfileCardTitle.text = if (role == "TREINADOR") "♙  Perfil do treinador" else "♙  Perfil do aluno"
                tvProfilePlan.text = if (active) "★ Ativo" else "Inativo"
                tvProfileSince.text = SimpleDateFormat("yyyy", Locale.getDefault()).format(Date(createdAt))

                btnCodigo.visibility = if (approved) View.GONE else View.VISIBLE

                if (role == "TREINADOR" && approved) {
                    tvTituloCodigos.visibility = View.VISIBLE
                    rvCodigos.visibility = View.VISIBLE
                    tvTituloAlunos.visibility = View.VISIBLE
                    rvAlunos.visibility = View.VISIBLE

                    atualizarBannerAlunoSelecionado(boxAcompanhando, tvAcompanhando)
                    val prefs = requireContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    atualizarComposerMensagem(
                        cardTeacherMessage,
                        tvMensagemAlunoDestino,
                        prefs.getString(KEY_SELECTED_STUDENT, null),
                        prefs.getString(KEY_SELECTED_STUDENT_NAME, null)
                    )
                    carregarCodigosDisponiveis(codeAdapter)
                    carregarMeusAlunos(studentsAdapter)

                    btnSolicitar.visibility = View.VISIBLE
                    btnSolicitar.setOnClickListener { abrirDialogSolicitarCodigos() }
                } else {
                    tvTituloCodigos.visibility = View.GONE
                    rvCodigos.visibility = View.GONE
                    tvTituloAlunos.visibility = View.GONE
                    rvAlunos.visibility = View.GONE
                    boxAcompanhando.visibility = View.GONE
                    cardTeacherMessage.visibility = View.GONE
                    btnSolicitar.visibility = View.GONE
                }

                if (role == "ALUNO" && approved) {
                    cardStudentMetrics.visibility = View.VISIBLE
                    cardStudentStatus.visibility = View.VISIBLE
                    cardWeeklyProgress.visibility = View.VISIBLE
                    cardNotification.visibility = View.VISIBLE

                    StudentDataCleanupScheduler.executarSeNecessario(requireContext(), user.uid) { limpou ->
                        if (limpou && isAdded) {
                            AppUiFeedback.showToast(
                                requireContext(),
                                "Limpeza anual automática concluída.",
                                Toast.LENGTH_SHORT
                            )
                            carregarPainelAcompanhamentoAluno(
                                uid = user.uid,
                                metaInicial = metaInicial,
                                tvUltimoTreino = tvUltimoTreino,
                                tvUltimoCardio = tvUltimoCardio,
                                tvTreinosSemana = tvTreinosSemana,
                                tvResumoMetaCardio = tvResumoMetaCardio,
                                layoutSemanaDots = layoutSemanaDots,
                                tvResumoTreinoSemana = tvResumoTreinoSemana,
                                tvMetaCardioValor = tvMetaCardioValor,
                                progressCardioMeta = progressCardioMeta,
                                tvFaltamCardio = tvFaltamCardio
                            )
                        }
                    }

                    carregarDadosAluno(user.uid, etIdade, etAltura, etPeso)
                    carregarPainelAcompanhamentoAluno(
                        uid = user.uid,
                        metaInicial = metaInicial,
                        tvUltimoTreino = tvUltimoTreino,
                        tvUltimoCardio = tvUltimoCardio,
                        tvTreinosSemana = tvTreinosSemana,
                        tvResumoMetaCardio = tvResumoMetaCardio,
                        layoutSemanaDots = layoutSemanaDots,
                        tvResumoTreinoSemana = tvResumoTreinoSemana,
                        tvMetaCardioValor = tvMetaCardioValor,
                        progressCardioMeta = progressCardioMeta,
                        tvFaltamCardio = tvFaltamCardio
                    )
                    iniciarListenerNotificacoesAluno(user.uid, tvNotificacaoTitulo, tvNotificacaoMensagem, layoutNotificacoes)

                    btnSalvarDadosAluno.setOnClickListener {
                        salvarDadosAluno(user.uid, etIdade.text?.toString(), etAltura.text?.toString(), etPeso.text?.toString())
                    }

                    btnMarcarNotificacaoLida.setOnClickListener {
                        marcarNotificacoesComoLidas(user.uid, tvNotificacaoTitulo, tvNotificacaoMensagem)
                    }
                }
            }
            .addOnFailureListener {
                if (!isAdded) return@addOnFailureListener
                tvInfo.text = "Erro ao carregar dados do perfil."
                tvProfileName.text = "Erro ao carregar perfil"
                tvProfileEmail.text = "—"
                tvProfileRole.text = "—"
                tvProfileStatus.text = "Erro"
                tvProfileHeroName.text = "Erro ao carregar perfil"
                tvProfilePlan.text = "—"
                tvProfileSince.text = "—"
                btnCodigo.visibility = View.GONE
                btnSolicitar.visibility = View.GONE
            }

        return view
    }

    override fun onDestroyView() {
        super.onDestroyView()
        notificationsListener?.remove()
        notificationsListener = null
    }

    private fun carregarDadosAluno(
        uid: String,
        etIdade: TextInputEditText,
        etAltura: TextInputEditText,
        etPeso: TextInputEditText
    ) {
        Firebase.firestore.collection("users").document(uid)
            .get()
            .addOnSuccessListener { doc ->
                if (!isAdded) return@addOnSuccessListener
                val idade = (doc.getLong("idade") ?: 0L).toInt()
                val altura = doc.getDouble("alturaCm") ?: doc.getLong("alturaCm")?.toDouble()
                val peso = doc.getDouble("pesoKg") ?: doc.getLong("pesoKg")?.toDouble()

                if (idade > 0) etIdade.setText(idade.toString())
                if (altura != null && altura > 0) {
                    val isInteger = altura % 1.0 == 0.0
                    etAltura.setText(if (isInteger) altura.toInt().toString() else altura.toString())
                }
                if (peso != null && peso > 0) {
                    val isInteger = peso % 1.0 == 0.0
                    etPeso.setText(if (isInteger) peso.toInt().toString() else peso.toString())
                }
            }
    }

    private fun salvarDadosAluno(uid: String, idadeRaw: String?, alturaRaw: String?, pesoRaw: String?) {
        val idade = idadeRaw?.trim()?.toIntOrNull()
        val altura = alturaRaw?.trim()?.replace(',', '.')?.toDoubleOrNull()
        val peso = pesoRaw?.trim()?.replace(',', '.')?.toDoubleOrNull()

        if (idade == null || altura == null || peso == null || idade !in 10..100 || altura !in 100.0..250.0 || peso !in 1.0..500.0) {
            AppUiFeedback.showToast(
                requireContext(),
                "Preencha idade, altura e peso válidos.",
                Toast.LENGTH_SHORT
            )
            return
        }

        Firebase.firestore.collection("users")
            .document(uid)
            .update(mapOf("idade" to idade, "alturaCm" to altura, "pesoKg" to peso))
            .addOnSuccessListener {
                if (!isAdded) return@addOnSuccessListener
                AppUiFeedback.showToast(requireContext(), "Dados do aluno salvos.", Toast.LENGTH_SHORT)
            }
            .addOnFailureListener { e ->
                if (!isAdded) return@addOnFailureListener
                AppUiFeedback.showToast(requireContext(), "Erro ao salvar: ${e.message}", Toast.LENGTH_SHORT)
            }
    }

    private fun carregarPainelAcompanhamentoAluno(
        uid: String,
        metaInicial: Int,
        tvUltimoTreino: TextView,
        tvUltimoCardio: TextView,
        tvTreinosSemana: TextView,
        tvResumoMetaCardio: TextView,
        layoutSemanaDots: LinearLayout,
        tvResumoTreinoSemana: TextView,
        tvMetaCardioValor: TextView,
        progressCardioMeta: ProgressBar,
        tvFaltamCardio: TextView
    ) {
        val db = Firebase.firestore
        val weekStart = inicioDaSemanaAtual()

        db.collection("users").document(uid).collection("treino_registros")
            .get()
            .addOnSuccessListener { treinoSnap ->
                if (!isAdded) return@addOnSuccessListener

                val treinoDocs = treinoSnap.documents
                    .sortedByDescending { dataDocumento(it)?.time ?: 0L }
                    .take(80)
                val ultimoTreino = treinoDocs.firstOrNull { it.getBoolean("completo") ?: false }
                    ?: treinoDocs.firstOrNull()
                tvUltimoTreino.text = if (ultimoTreino == null) {
                    "Último treino\nSem registros"
                } else {
                    val nome = ultimoTreino.getString("nomeTreino") ?: "Treino"
                    val data = ultimoTreino.getString("dataHora") ?: "sem data"
                    "Último treino\n$nome • $data"
                }

                val treinoDias = treinoDocs
                    .filter { it.getBoolean("completo") ?: false }
                    .mapNotNull { diaSemanaDoDocumento(it, weekStart) }
                    .toSet()
                val treinosSemana = treinoDocs.filter { diaSemanaDoDocumento(it, weekStart) != null }
                val treinosConcluidosSemana = treinosSemana.count { it.getBoolean("completo") ?: false }
                tvTreinosSemana.text = "Treinos na semana\n$treinosConcluidosSemana / ${treinosSemana.size} concluídos"

                db.collection("users").document(uid).collection("cardio")
                    .get()
                    .addOnSuccessListener { cardioSnap ->
                        if (!isAdded) return@addOnSuccessListener

                        val cardioDocs = cardioSnap.documents
                            .sortedByDescending { dataDocumento(it)?.time ?: 0L }
                            .take(80)
                        val ultimoCardio = cardioDocs.firstOrNull()
                        tvUltimoCardio.text = if (ultimoCardio == null) {
                            "Último cardio\nSem registros"
                        } else {
                            val atividade = ultimoCardio.getString("atividade") ?: "Cardio"
                            val tempo = readInt(ultimoCardio, "tempoMin") ?: 0
                            val data = ultimoCardio.getString("dataHora") ?: "sem data"
                            "Último cardio\n$atividade • ${tempo}min • $data"
                        }

                        val cardioDias = cardioDocs.mapNotNull { diaSemanaDoDocumento(it, weekStart) }.toSet()
                        val minutosCardioSemana = cardioDocs
                            .filter { diaSemanaDoDocumento(it, weekStart) != null }
                            .sumOf { readInt(it, "tempoMin") ?: 0 }

                        carregarMetaCardio(uid, metaInicial) { meta ->
                            if (!isAdded) return@carregarMetaCardio
                            tvResumoMetaCardio.text = "Meta semanal\n$minutosCardioSemana / $meta min de cardio"
                            renderizarProgressoSemana(
                                layoutSemanaDots = layoutSemanaDots,
                                tvResumoTreinoSemana = tvResumoTreinoSemana,
                                tvMetaCardioValor = tvMetaCardioValor,
                                progressCardioMeta = progressCardioMeta,
                                tvFaltamCardio = tvFaltamCardio,
                                treinoDias = treinoDias,
                                cardioDias = cardioDias,
                                minutosCardioSemana = minutosCardioSemana,
                                metaCardio = meta
                            )
                        }
                    }
                    .addOnFailureListener {
                        if (!isAdded) return@addOnFailureListener
                        tvUltimoCardio.text = "Último cardio\nErro ao carregar"
                        tvResumoMetaCardio.text = "Meta semanal\n0 / $metaInicial min de cardio"
                        renderizarProgressoSemana(layoutSemanaDots, tvResumoTreinoSemana, tvMetaCardioValor, progressCardioMeta, tvFaltamCardio, treinoDias, emptySet(), 0, metaInicial)
                    }
            }
            .addOnFailureListener {
                if (!isAdded) return@addOnFailureListener
                tvUltimoTreino.text = "Último treino\nErro ao carregar"
                tvUltimoCardio.text = "Último cardio\nErro ao carregar"
                tvTreinosSemana.text = "Treinos na semana\n0 / 0 concluídos"
                tvResumoMetaCardio.text = "Meta semanal\n0 / $metaInicial min de cardio"
                renderizarProgressoSemana(layoutSemanaDots, tvResumoTreinoSemana, tvMetaCardioValor, progressCardioMeta, tvFaltamCardio, emptySet(), emptySet(), 0, metaInicial)
            }
    }

    private fun carregarMetaCardio(uid: String, metaInicial: Int, onMeta: (Int) -> Unit) {
        val userRef = Firebase.firestore.collection("users").document(uid)
        val rootTask = userRef.get()
        val configTask = userRef.collection("cardio_meta").document("current").get()

        Tasks.whenAllComplete(listOf(rootTask, configTask))
            .addOnSuccessListener { results ->
                val root = results.getOrNull(0)?.takeIf { it.isSuccessful }?.result as? DocumentSnapshot
                val config = results.getOrNull(1)?.takeIf { it.isSuccessful }?.result as? DocumentSnapshot
                val rootGoal = root?.let(::cardioGoalFromDocument) ?: metaInicial
                val configGoal = config?.takeIf { it.exists() }?.let(::cardioGoalFromDocument)
                val rootUpdatedAt = root?.let(::updatedAtOf) ?: 0L
                val configUpdatedAt = config?.let(::updatedAtOf) ?: 0L
                val configIsLatest = configGoal != null && (
                    (rootUpdatedAt == 0L && configUpdatedAt == 0L) ||
                        configUpdatedAt >= rootUpdatedAt ||
                        rootUpdatedAt == 0L
                    )
                val meta = if (configIsLatest) configGoal else rootGoal.takeIf { it > 0 } ?: configGoal
                onMeta(meta?.takeIf { it > 0 } ?: DEFAULT_CARDIO_GOAL)
            }
            .addOnFailureListener {
                onMeta(if (metaInicial > 0) metaInicial else DEFAULT_CARDIO_GOAL)
            }
    }

    private fun renderizarProgressoSemana(
        layoutSemanaDots: LinearLayout,
        tvResumoTreinoSemana: TextView,
        tvMetaCardioValor: TextView,
        progressCardioMeta: ProgressBar,
        tvFaltamCardio: TextView,
        treinoDias: Set<Int>,
        cardioDias: Set<Int>,
        minutosCardioSemana: Int,
        metaCardio: Int
    ) {
        val treinoConcluidos = treinoDias.size
        tvResumoTreinoSemana.text = "✓ $treinoConcluidos de 7 dias"

        val labels = listOf("Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom")
        layoutSemanaDots.removeAllViews()
        layoutSemanaDots.orientation = LinearLayout.VERTICAL
        layoutSemanaDots.setPadding(0, dp(2), 0, 0)
        layoutSemanaDots.addView(criarLinhaDias(labels))
        val neon = ContextCompat.getColor(requireContext(), R.color.green_primary)
        val teal = ContextCompat.getColor(requireContext(), R.color.ex_border_started)
        layoutSemanaDots.addView(criarLinhaIndicadores("Treino", treinoDias, neon))
        layoutSemanaDots.addView(criarLinhaIndicadores("Cardio", cardioDias, teal))

        val metaSegura = if (metaCardio > 0) metaCardio else DEFAULT_CARDIO_GOAL
        val progresso = min(100, ((minutosCardioSemana.toDouble() / metaSegura.toDouble()) * 100.0).toInt())
        val faltam = max(metaSegura - minutosCardioSemana, 0)

        tvMetaCardioValor.text = "$minutosCardioSemana de $metaSegura min"
        progressCardioMeta.progress = progresso
        tvFaltamCardio.text = if (faltam > 0) "Faltam $faltam min" else "Meta concluída"
    }

    private fun criarLinhaDias(labels: List<String>): LinearLayout {
        val ctx = requireContext()
        val linha = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        linha.addView(TextView(ctx).apply {
            layoutParams = LinearLayout.LayoutParams(dp(46), LinearLayout.LayoutParams.WRAP_CONTENT)
            text = ""
        })

        labels.forEach { label ->
            linha.addView(TextView(ctx).apply {
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                text = label
                textSize = 11f
                setTextColor(ContextCompat.getColor(ctx, R.color.text_secondary))
                typeface = Typeface.DEFAULT_BOLD
                gravity = android.view.Gravity.CENTER
                includeFontPadding = false
            })
        }

        return linha
    }

    private fun criarLinhaIndicadores(label: String, diasFeitos: Set<Int>, color: Int): LinearLayout {
        val ctx = requireContext()
        val linha = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.CENTER_VERTICAL
            setPadding(0, dp(9), 0, 0)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        linha.addView(TextView(ctx).apply {
            layoutParams = LinearLayout.LayoutParams(dp(46), LinearLayout.LayoutParams.WRAP_CONTENT)
            text = label
            textSize = 11f
            setTextColor(color)
            typeface = Typeface.DEFAULT_BOLD
            gravity = android.view.Gravity.CENTER_VERTICAL
            includeFontPadding = false
        })

        repeat(7) { index ->
            val cell = LinearLayout(ctx).apply {
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                gravity = android.view.Gravity.CENTER
            }
            cell.addView(criarDot(diasFeitos.contains(index), color))
            linha.addView(cell)
        }

        return linha
    }

    private fun criarDot(done: Boolean, color: Int): TextView {
        val bg = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(if (done) color else ContextCompat.getColor(requireContext(), R.color.surface_elevated))
            setStroke(dp(1), color)
        }
        return TextView(requireContext()).apply {
            layoutParams = LinearLayout.LayoutParams(dp(24), dp(24))
            background = bg
            gravity = android.view.Gravity.CENTER
            text = if (done) "✓" else ""
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(ContextCompat.getColor(requireContext(), R.color.background_deep))
            includeFontPadding = false
        }
    }

    private fun inicioDaSemanaAtual(): Long {
        val cal = Calendar.getInstance()
        cal.firstDayOfWeek = Calendar.MONDAY
        cal.set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }

    private fun diaSemanaDoDocumento(doc: DocumentSnapshot, weekStart: Long): Int? {
        val date = dataDocumento(doc) ?: return null
        val end = weekStart + 7L * 24L * 60L * 60L * 1000L
        if (date.time < weekStart || date.time >= end) return null
        return ((date.time - weekStart) / (24L * 60L * 60L * 1000L)).toInt().coerceIn(0, 6)
    }

    private fun dataDocumento(doc: DocumentSnapshot): Date? {
        val createdAt = doc.getLong("createdAt")
            ?: doc.getDouble("createdAt")?.toLong()
            ?: doc.getTimestamp("createdAt")?.toDate()?.time
        if (createdAt != null && createdAt > 0) return Date(createdAt)

        val dataHora = doc.getString("dataHora") ?: return null
        return TreinoRegistroUtils.parseDataHora(dataHora).takeIf { it > 0L }?.let(::Date)
    }

    private fun readInt(doc: DocumentSnapshot, field: String): Int? {
        return doc.getLong(field)?.toInt() ?: doc.getDouble(field)?.toInt()
    }

    private fun cardioGoalFromDocument(doc: DocumentSnapshot): Int {
        return readInt(doc, "cardioMetaSemanalMin")
            ?: readInt(doc, "metaSemanalCardioMin")
            ?: readInt(doc, "cardioGoalMin")
            ?: 0
    }

    private fun updatedAtOf(doc: DocumentSnapshot): Long {
        return doc.getLong("updatedAt")
            ?: doc.getDouble("updatedAt")?.toLong()
            ?: doc.getTimestamp("updatedAt")?.toDate()?.time
            ?: 0L
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }

    private fun iniciarListenerNotificacoesAluno(
        uid: String,
        tvTitulo: TextView,
        tvMensagem: TextView,
        layoutNotificacoes: LinearLayout
    ) {
        notificationsListener?.remove()

        notificationsListener = Firebase.firestore
            .collection("users")
            .document(uid)
            .collection("notifications")
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .limit(20)
            .addSnapshotListener { snap, err ->
                if (!isAdded) return@addSnapshotListener
                if (err != null) {
                    tvTitulo.text = "Atualizações do treinador"
                    tvMensagem.text = "Erro ao carregar notificações"
                    renderizarNotificacoes(layoutNotificacoes, emptyList(), "Erro ao carregar notificações")
                    return@addSnapshotListener
                }

                val docs = snap?.documents.orEmpty()
                val unreadDocs = docs.filter { (it.getBoolean("read") ?: false).not() }
                unreadNotificationIds = unreadDocs.map { it.id }
                renderizarNotificacoes(layoutNotificacoes, docs.take(3))

                if (unreadDocs.isEmpty()) {
                    tvTitulo.text = "Atualizações do treinador"
                    tvMensagem.text = "Sem novas atualizações"
                    return@addSnapshotListener
                }

                val latest = unreadDocs.first()
                val latestMsg = latest.getString("message") ?: "Seu treino foi atualizado."
                val latestTitle = tituloNotificacao(latest)
                val latestTs = latest.getLong("createdAt") ?: 0L

                tvTitulo.text = "Atualizações do treinador (${unreadDocs.size})"
                tvMensagem.text = latestMsg

                val prefs = requireContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                val lastSeenTs = prefs.getLong(KEY_LAST_NOTIFICATION_TS, 0L)

                if (latestTs > lastSeenTs) {
                    AppUiFeedback.showToast(requireContext(), latestMsg, Toast.LENGTH_LONG)
                    AppNotifier.showWorkoutUpdate(requireContext(), latestTitle, latestMsg)

                    AppUiFeedback.dialogBuilder(requireContext())
                        .setTitle(latestTitle)
                        .setMessage(latestMsg)
                        .setPositiveButton("OK", null)
                        .show()

                    prefs.edit().putLong(KEY_LAST_NOTIFICATION_TS, latestTs).apply()
                }
            }
    }

    private fun renderizarNotificacoes(
        container: LinearLayout,
        docs: List<DocumentSnapshot>,
        emptyMessage: String = "Sem novas atualizações"
    ) {
        if (!isAdded) return
        val ctx = requireContext()
        container.removeAllViews()

        if (docs.isEmpty()) {
            container.addView(TextView(ctx).apply {
                text = emptyMessage
                textSize = 13f
                setTextColor(ContextCompat.getColor(ctx, R.color.text_secondary))
                setPadding(0, dp(16), 0, dp(16))
            })
            return
        }

        docs.forEachIndexed { index, doc ->
            val isRead = doc.getBoolean("read") ?: false
            val createdAt = doc.getLong("createdAt")
                ?: doc.getTimestamp("createdAt")?.toDate()?.time
                ?: 0L

            val row = LinearLayout(ctx).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER_VERTICAL
                setPadding(0, dp(11), 0, dp(11))
            }

            val dotBackground = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(ContextCompat.getColor(ctx, if (isRead) R.color.text_secondary else R.color.green_primary))
            }
            row.addView(View(ctx).apply {
                layoutParams = LinearLayout.LayoutParams(dp(9), dp(9)).apply {
                    marginEnd = dp(11)
                }
                background = dotBackground
            })

            val copy = LinearLayout(ctx).apply {
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                orientation = LinearLayout.VERTICAL
            }
            copy.addView(TextView(ctx).apply {
                text = tituloNotificacao(doc)
                textSize = 12f
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(ContextCompat.getColor(ctx, R.color.green_primary))
            })
            copy.addView(TextView(ctx).apply {
                text = doc.getString("message") ?: "Seu treino foi atualizado."
                textSize = 13f
                setTextColor(ContextCompat.getColor(ctx, R.color.text_primary))
            })
            if (createdAt > 0) {
                copy.addView(TextView(ctx).apply {
                    text = SimpleDateFormat("dd/MM/yyyy • HH:mm", Locale.getDefault()).format(Date(createdAt))
                    textSize = 10f
                    setTextColor(ContextCompat.getColor(ctx, R.color.text_secondary))
                    setPadding(0, dp(3), 0, 0)
                })
            }
            row.addView(copy)
            container.addView(row)

            if (index < docs.lastIndex) {
                container.addView(View(ctx).apply {
                    layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
                    setBackgroundColor(ContextCompat.getColor(ctx, R.color.chart_grid))
                })
            }
        }
    }

    private fun tituloNotificacao(doc: DocumentSnapshot): String {
        return doc.getString("title") ?: when (doc.getString("type")) {
            "CARDIO_META_ATUALIZADA" -> "Meta semanal de cardio"
            "MENSAGEM_TREINADOR" -> "Mensagem do professor"
            else -> "Atualização do treino"
        }
    }

    private fun marcarNotificacoesComoLidas(uid: String, tvTitulo: TextView, tvMensagem: TextView) {
        if (unreadNotificationIds.isEmpty()) {
            AppUiFeedback.showToast(requireContext(), "Não há notificações pendentes.", Toast.LENGTH_SHORT)
            return
        }

        val db = Firebase.firestore
        val batch = db.batch()

        unreadNotificationIds.forEach { id ->
            val ref = db.collection("users")
                .document(uid)
                .collection("notifications")
                .document(id)
            batch.update(ref, "read", true)
        }

        batch.commit()
            .addOnSuccessListener {
                if (!isAdded) return@addOnSuccessListener
                tvTitulo.text = "Atualizações do treinador"
                tvMensagem.text = "Sem novas atualizações"
                AppUiFeedback.showToast(requireContext(), "Notificações marcadas como lidas.", Toast.LENGTH_SHORT)
            }
            .addOnFailureListener { e ->
                if (!isAdded) return@addOnFailureListener
                AppUiFeedback.showToast(requireContext(), "Erro ao atualizar: ${e.message}", Toast.LENGTH_SHORT)
            }
    }

    private fun abrirDialogInserirCodigo() {
        val user = Firebase.auth.currentUser ?: return

        val input = EditText(requireContext())
        input.hint = "Ex: AB12CD"
        input.hintPortugueseIme()

        AppUiFeedback.dialogBuilder(requireContext())
            .setTitle("Inserir código")
            .setMessage("Digite o código recebido:")
            .setView(input)
            .setPositiveButton("Confirmar") { _, _ ->
                val code = input.text.toString().trim().uppercase()
                if (code.isBlank()) return@setPositiveButton

                repoRedeem.resgatarCodigo(
                    code = code,
                    uid = user.uid,
                    onOk = { tipo ->
                        if (!isAdded) return@resgatarCodigo
                        AppUiFeedback.dialogBuilder(requireContext())
                            .setTitle("Sucesso!")
                            .setMessage("Conta liberada como $tipo.")
                            .setPositiveButton("OK") { _, _ ->
                                requireActivity().recreate()
                            }
                            .show()
                    },
                    onErr = { msg ->
                        if (!isAdded) return@resgatarCodigo
                        AppUiFeedback.dialogBuilder(requireContext())
                            .setTitle("Erro")
                            .setMessage(msg)
                            .setPositiveButton("OK", null)
                            .show()
                    }
                )
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun abrirDialogSolicitarCodigos() {
        val user = Firebase.auth.currentUser ?: return

        val input = EditText(requireContext())
        input.hint = "Quantidade (ex: 5)"
        input.inputType = InputType.TYPE_CLASS_NUMBER

        AppUiFeedback.dialogBuilder(requireContext())
            .setTitle("Solicitar códigos")
            .setMessage("Quantos códigos você precisa?")
            .setView(input)
            .setPositiveButton("Solicitar") { _, _ ->
                val qty = input.text.toString().trim().toIntOrNull() ?: 0

                if (qty <= 0) {
                    AppUiFeedback.dialogBuilder(requireContext())
                        .setTitle("Erro")
                        .setMessage("Quantidade inválida.")
                        .setPositiveButton("OK", null)
                        .show()
                    return@setPositiveButton
                }

                repoRequest.criarPedido(
                    trainerUid = user.uid,
                    qty = qty,
                    onOk = {
                        if (!isAdded) return@criarPedido
                        AppUiFeedback.dialogBuilder(requireContext())
                            .setTitle("Pedido enviado")
                            .setMessage("Seu pedido foi enviado para aprovação do admin.")
                            .setPositiveButton("OK", null)
                            .show()
                    },
                    onErr = { msg ->
                        if (!isAdded) return@criarPedido
                        AppUiFeedback.dialogBuilder(requireContext())
                            .setTitle("Erro")
                            .setMessage(msg)
                            .setPositiveButton("OK", null)
                            .show()
                    }
                )
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun copiarParaClipboard(texto: String) {
        val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("codigo", texto))
        AppUiFeedback.showToast(requireContext(), "Código copiado: $texto", Toast.LENGTH_SHORT)
    }

    private fun salvarAlunoSelecionado(uid: String, name: String) {
        val prefs = requireContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit()
            .putString(KEY_SELECTED_STUDENT, uid)
            .putString(KEY_SELECTED_STUDENT_NAME, name)
            .apply()
    }

    private fun limparAlunoSelecionado() {
        val prefs = requireContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit()
            .remove(KEY_SELECTED_STUDENT)
            .remove(KEY_SELECTED_STUDENT_NAME)
            .apply()
    }

    private fun atualizarBannerAlunoSelecionado(box: View, tv: TextView) {
        val prefs = requireContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val uid = prefs.getString(KEY_SELECTED_STUDENT, null)
        val name = prefs.getString(KEY_SELECTED_STUDENT_NAME, null)

        if (uid != null && name != null) {
            box.visibility = View.VISIBLE
            tv.text = "Você está acompanhando: $name"
        } else {
            box.visibility = View.GONE
        }
    }

    private fun atualizarComposerMensagem(
        card: View,
        destino: TextView,
        uid: String?,
        name: String?
    ) {
        if (uid.isNullOrBlank() || name.isNullOrBlank()) {
            card.visibility = View.GONE
            return
        }

        card.visibility = View.VISIBLE
        destino.text = "Para: $name"
    }

    private fun carregarCodigosDisponiveis(adapter: InviteCodeAdapter) {
        val user = Firebase.auth.currentUser ?: return
        val db = Firebase.firestore

        fun filtrarDisponiveis(docs: List<com.google.firebase.firestore.DocumentSnapshot>): List<String> {
            return docs
                .filter { d ->
                    val usedAt = d.get("usedAt")
                    val usedBy = (d.getString("usedByUid") ?: "").trim()
                    usedAt == null && usedBy.isEmpty()
                }
                .map { it.id }
                .distinct()
                .sorted()
        }

        db.collection("invites")
            .whereEqualTo("type", "ALUNO")
            .whereEqualTo("trainerUid", user.uid)
            .get()
            .addOnSuccessListener { snap1 ->
                if (!isAdded) return@addOnSuccessListener
                val codes1 = filtrarDisponiveis(snap1.documents)

                if (codes1.isNotEmpty()) {
                    adapter.update(codes1)
                    return@addOnSuccessListener
                }

                db.collection("invites")
                    .whereEqualTo("type", "ALUNO")
                    .whereEqualTo("trainerId", user.uid)
                    .get()
                    .addOnSuccessListener { snap2 ->
                        if (!isAdded) return@addOnSuccessListener
                        val codes2 = filtrarDisponiveis(snap2.documents)
                        adapter.update(codes2)
                    }
                    .addOnFailureListener { e ->
                        if (!isAdded) return@addOnFailureListener
                        AppUiFeedback.showToast(requireContext(), "Erro ao buscar códigos: ${e.message}", Toast.LENGTH_SHORT)
                    }
            }
            .addOnFailureListener { e ->
                if (!isAdded) return@addOnFailureListener
                AppUiFeedback.showToast(requireContext(), "Erro ao buscar códigos: ${e.message}", Toast.LENGTH_SHORT)
            }
    }

    private fun carregarMeusAlunos(adapter: TrainerStudentsAdapter) {
        val user = Firebase.auth.currentUser ?: return

        Firebase.firestore.collection("users")
            .whereEqualTo("trainerId", user.uid)
            .get()
            .addOnSuccessListener { snap ->
                if (!isAdded) return@addOnSuccessListener
                val alunos = snap.documents.map { d ->
                    TrainerStudentItem(
                        uid = d.id,
                        name = d.getString("name") ?: "Sem nome",
                        email = d.getString("email") ?: "Sem email"
                    )
                }.sortedBy { it.name.lowercase() }

                adapter.update(alunos)
            }
            .addOnFailureListener { e ->
                if (!isAdded) return@addOnFailureListener
                AppUiFeedback.showToast(
                    requireContext(),
                    "Erro ao buscar alunos: ${e.message}",
                    Toast.LENGTH_SHORT
                )
            }
    }
}
