package com.example.meutreino

import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.InputType
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
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
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
        private const val DEFAULT_CARDIO_GOAL = 150
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
        val tvInfo = view.findViewById<TextView>(R.id.tvPerfilInfo)
        val btnCodigo = view.findViewById<Button>(R.id.btnInserirCodigo)
        val btnSolicitar = view.findViewById<Button>(R.id.btnSolicitarCodigos)

        val tvProfileName = view.findViewById<TextView>(R.id.tvProfileName)
        val tvProfileEmail = view.findViewById<TextView>(R.id.tvProfileEmail)
        val tvProfileRole = view.findViewById<TextView>(R.id.tvProfileRole)
        val tvProfileStatus = view.findViewById<TextView>(R.id.tvProfileStatus)

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
        val btnSalvarDadosAluno = view.findViewById<Button>(R.id.btnSalvarDadosAluno)

        val cardStudentStatus = view.findViewById<View>(R.id.cardStudentStatus)
        val tvUltimoTreino = view.findViewById<TextView>(R.id.tvUltimoTreino)
        val tvUltimoPeso = view.findViewById<TextView>(R.id.tvUltimoPeso)
        val tvUltimoProgresso = view.findViewById<TextView>(R.id.tvUltimoProgresso)
        val tvUltimoCardio = view.findViewById<TextView>(R.id.tvUltimoCardio)

        val cardWeeklyProgress = view.findViewById<View>(R.id.cardWeeklyProgress)
        val layoutSemanaDots = view.findViewById<LinearLayout>(R.id.layoutSemanaDots)
        val tvResumoTreinoSemana = view.findViewById<TextView>(R.id.tvResumoTreinoSemana)
        val tvMetaCardioValor = view.findViewById<TextView>(R.id.tvMetaCardioValor)
        val progressCardioMeta = view.findViewById<ProgressBar>(R.id.progressCardioMeta)
        val tvFaltamCardio = view.findViewById<TextView>(R.id.tvFaltamCardio)

        val cardNotification = view.findViewById<View>(R.id.cardNotification)
        val tvNotificacaoTitulo = view.findViewById<TextView>(R.id.tvNotificacaoTitulo)
        val tvNotificacaoMensagem = view.findViewById<TextView>(R.id.tvNotificacaoMensagem)
        val btnMarcarNotificacaoLida = view.findViewById<Button>(R.id.btnMarcarNotificacaoLida)

        tvTitulo.text = "Perfil"
        tvUltimoPeso.visibility = View.GONE
        tvUltimoProgresso.visibility = View.GONE

        val codeAdapter = InviteCodeAdapter(mutableListOf()) { code -> copiarParaClipboard(code) }
        rvCodigos.layoutManager = LinearLayoutManager(requireContext())
        rvCodigos.adapter = codeAdapter

        val studentsAdapter = TrainerStudentsAdapter(mutableListOf()) { aluno ->
            salvarAlunoSelecionado(aluno.uid, aluno.name)
            atualizarBannerAlunoSelecionado(boxAcompanhando, tvAcompanhando)
            AppUiFeedback.showToast(requireContext(), "Agora acompanhando: ${aluno.name}", Toast.LENGTH_SHORT)
        }
        rvAlunos.layoutManager = LinearLayoutManager(requireContext())
        rvAlunos.adapter = studentsAdapter

        btnTrocarAluno.setOnClickListener {
            limparAlunoSelecionado()
            boxAcompanhando.visibility = View.GONE
            AppUiFeedback.showToast(requireContext(), "Seleção de aluno limpa.", Toast.LENGTH_SHORT)
        }

        cardStudentMetrics.visibility = View.GONE
        cardStudentStatus.visibility = View.GONE
        cardWeeklyProgress.visibility = View.GONE
        cardNotification.visibility = View.GONE

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
                val metaInicial = readInt(doc, "cardioMetaSemanalMin")
                    ?: readInt(doc, "metaSemanalCardioMin")
                    ?: readInt(doc, "cardioGoalMin")
                    ?: DEFAULT_CARDIO_GOAL

                tvInfo.text = "Nome: $name\nEmail: $email\nTipo: $role\nStatus: ${if (approved) "Liberado" else "Aguardando código"}"
                tvProfileName.text = name
                tvProfileEmail.text = email
                tvProfileRole.text = role
                tvProfileStatus.text = if (approved) "✓ Liberado" else "Aguardando"

                btnCodigo.visibility = if (approved) View.GONE else View.VISIBLE

                if (role == "TREINADOR" && approved) {
                    tvTituloCodigos.visibility = View.VISIBLE
                    rvCodigos.visibility = View.VISIBLE
                    tvTituloAlunos.visibility = View.VISIBLE
                    rvAlunos.visibility = View.VISIBLE

                    atualizarBannerAlunoSelecionado(boxAcompanhando, tvAcompanhando)
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
                                layoutSemanaDots = layoutSemanaDots,
                                tvResumoTreinoSemana = tvResumoTreinoSemana,
                                tvMetaCardioValor = tvMetaCardioValor,
                                progressCardioMeta = progressCardioMeta,
                                tvFaltamCardio = tvFaltamCardio
                            )
                        }
                    }

                    carregarDadosAluno(user.uid, etIdade, etAltura)
                    carregarPainelAcompanhamentoAluno(
                        uid = user.uid,
                        metaInicial = metaInicial,
                        tvUltimoTreino = tvUltimoTreino,
                        tvUltimoCardio = tvUltimoCardio,
                        layoutSemanaDots = layoutSemanaDots,
                        tvResumoTreinoSemana = tvResumoTreinoSemana,
                        tvMetaCardioValor = tvMetaCardioValor,
                        progressCardioMeta = progressCardioMeta,
                        tvFaltamCardio = tvFaltamCardio
                    )
                    iniciarListenerNotificacoesAluno(user.uid, tvNotificacaoTitulo, tvNotificacaoMensagem)

                    btnSalvarDadosAluno.setOnClickListener {
                        salvarDadosAluno(user.uid, etIdade.text?.toString(), etAltura.text?.toString())
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

    private fun carregarDadosAluno(uid: String, etIdade: TextInputEditText, etAltura: TextInputEditText) {
        Firebase.firestore.collection("users").document(uid)
            .get()
            .addOnSuccessListener { doc ->
                if (!isAdded) return@addOnSuccessListener
                val idade = (doc.getLong("idade") ?: 0L).toInt()
                val altura = doc.getDouble("alturaCm") ?: doc.getLong("alturaCm")?.toDouble()

                if (idade > 0) etIdade.setText(idade.toString())
                if (altura != null && altura > 0) {
                    val isInteger = altura % 1.0 == 0.0
                    etAltura.setText(if (isInteger) altura.toInt().toString() else altura.toString())
                }
            }
    }

    private fun salvarDadosAluno(uid: String, idadeRaw: String?, alturaRaw: String?) {
        val idade = idadeRaw?.trim()?.toIntOrNull()
        val altura = alturaRaw?.trim()?.replace(',', '.')?.toDoubleOrNull()

        if (idade == null || altura == null || idade !in 10..100 || altura !in 100.0..250.0) {
            AppUiFeedback.showToast(
                requireContext(),
                "Preencha idade (10-100) e altura em cm (100-250).",
                Toast.LENGTH_SHORT
            )
            return
        }

        Firebase.firestore.collection("users")
            .document(uid)
            .update(mapOf("idade" to idade, "alturaCm" to altura))
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
        layoutSemanaDots: LinearLayout,
        tvResumoTreinoSemana: TextView,
        tvMetaCardioValor: TextView,
        progressCardioMeta: ProgressBar,
        tvFaltamCardio: TextView
    ) {
        val db = Firebase.firestore
        val weekStart = inicioDaSemanaAtual()

        db.collection("users").document(uid).collection("treino_registros")
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .limit(80)
            .get()
            .addOnSuccessListener { treinoSnap ->
                if (!isAdded) return@addOnSuccessListener

                val treinoDocs = treinoSnap.documents
                val ultimoTreino = treinoDocs.firstOrNull()
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

                db.collection("users").document(uid).collection("cardio")
                    .orderBy("createdAt", Query.Direction.DESCENDING)
                    .limit(80)
                    .get()
                    .addOnSuccessListener { cardioSnap ->
                        if (!isAdded) return@addOnSuccessListener

                        val cardioDocs = cardioSnap.documents
                        val ultimoCardio = cardioDocs.firstOrNull()
                        tvUltimoCardio.text = if (ultimoCardio == null) {
                            "Último cardio\nSem registros"
                        } else {
                            val atividade = ultimoCardio.getString("atividade") ?: "Cardio"
                            val tempo = (ultimoCardio.getLong("tempoMin") ?: 0L).toInt()
                            val data = ultimoCardio.getString("dataHora") ?: "sem data"
                            "Último cardio\n$atividade • ${tempo}min • $data"
                        }

                        val cardioDias = cardioDocs.mapNotNull { diaSemanaDoDocumento(it, weekStart) }.toSet()
                        val minutosCardioSemana = cardioDocs
                            .filter { diaSemanaDoDocumento(it, weekStart) != null }
                            .sumOf { (it.getLong("tempoMin") ?: 0L).toInt() }

                        carregarMetaCardio(uid, metaInicial) { meta ->
                            if (!isAdded) return@carregarMetaCardio
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
                        renderizarProgressoSemana(layoutSemanaDots, tvResumoTreinoSemana, tvMetaCardioValor, progressCardioMeta, tvFaltamCardio, treinoDias, emptySet(), 0, metaInicial)
                    }
            }
            .addOnFailureListener {
                if (!isAdded) return@addOnFailureListener
                tvUltimoTreino.text = "Último treino\nErro ao carregar"
                tvUltimoCardio.text = "Último cardio\nErro ao carregar"
                renderizarProgressoSemana(layoutSemanaDots, tvResumoTreinoSemana, tvMetaCardioValor, progressCardioMeta, tvFaltamCardio, emptySet(), emptySet(), 0, metaInicial)
            }
    }

    private fun carregarMetaCardio(uid: String, metaInicial: Int, onMeta: (Int) -> Unit) {
        Firebase.firestore.collection("users")
            .document(uid)
            .collection("cardio_meta")
            .document("current")
            .get()
            .addOnSuccessListener { doc ->
                val meta = readInt(doc, "cardioMetaSemanalMin")
                    ?: readInt(doc, "metaSemanalCardioMin")
                    ?: readInt(doc, "cardioGoalMin")
                    ?: metaInicial
                onMeta(if (meta > 0) meta else DEFAULT_CARDIO_GOAL)
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
        layoutSemanaDots.addView(criarLinhaIndicadores("Treino", treinoDias, Color.parseColor("#15945F")))
        layoutSemanaDots.addView(criarLinhaIndicadores("Cardio", cardioDias, Color.parseColor("#0EA8AA")))

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
                setTextColor(Color.parseColor("#2F3E3F"))
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
            setColor(if (done) color else Color.WHITE)
            setStroke(dp(1), color)
        }
        return TextView(requireContext()).apply {
            layoutParams = LinearLayout.LayoutParams(dp(24), dp(24))
            background = bg
            gravity = android.view.Gravity.CENTER
            text = if (done) "✓" else ""
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
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
        if (createdAt != null && createdAt > 0) return Date(createdAt)

        val dataHora = doc.getString("dataHora") ?: return null
        return runCatching {
            SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault()).parse(dataHora)
                ?: SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()).parse(dataHora)
        }.getOrNull()
    }

    private fun readInt(doc: DocumentSnapshot, field: String): Int? {
        return doc.getLong(field)?.toInt() ?: doc.getDouble(field)?.toInt()
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }

    private fun iniciarListenerNotificacoesAluno(
        uid: String,
        tvTitulo: TextView,
        tvMensagem: TextView
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
                    return@addSnapshotListener
                }

                val docs = snap?.documents.orEmpty()
                val unreadDocs = docs.filter { (it.getBoolean("read") ?: false).not() }
                unreadNotificationIds = unreadDocs.map { it.id }

                if (unreadDocs.isEmpty()) {
                    tvTitulo.text = "Atualizações do treinador"
                    tvMensagem.text = "Sem novas atualizações"
                    return@addSnapshotListener
                }

                val latest = unreadDocs.first()
                val latestMsg = latest.getString("message") ?: "Seu treino foi atualizado."
                val latestTs = latest.getLong("createdAt") ?: 0L

                tvTitulo.text = "Atualizações do treinador (${unreadDocs.size})"
                tvMensagem.text = latestMsg

                val prefs = requireContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                val lastSeenTs = prefs.getLong(KEY_LAST_NOTIFICATION_TS, 0L)

                if (latestTs > lastSeenTs) {
                    AppUiFeedback.showToast(requireContext(), latestMsg, Toast.LENGTH_LONG)
                    AppNotifier.showWorkoutUpdate(requireContext(), "MeuTreino", latestMsg)

                    AppUiFeedback.dialogBuilder(requireContext())
                        .setTitle("Novo treino atualizado")
                        .setMessage(latestMsg)
                        .setPositiveButton("OK", null)
                        .show()

                    prefs.edit().putLong(KEY_LAST_NOTIFICATION_TS, latestTs).apply()
                }
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
