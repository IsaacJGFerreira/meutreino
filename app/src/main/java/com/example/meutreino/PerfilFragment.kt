package com.example.meutreino

import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.text.InputType
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.textfield.TextInputEditText
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase

class PerfilFragment : Fragment() {

    companion object {
        private const val PREFS = "meutreino_prefs"
        private const val KEY_SELECTED_STUDENT = "selected_student_uid"
        private const val KEY_SELECTED_STUDENT_NAME = "selected_student_name"
        private const val KEY_LAST_NOTIFICATION_TS = "last_workout_notification_ts"
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

        val cardNotification = view.findViewById<View>(R.id.cardNotification)
        val tvNotificacaoTitulo = view.findViewById<TextView>(R.id.tvNotificacaoTitulo)
        val tvNotificacaoMensagem = view.findViewById<TextView>(R.id.tvNotificacaoMensagem)
        val btnMarcarNotificacaoLida = view.findViewById<Button>(R.id.btnMarcarNotificacaoLida)

        tvTitulo.text = "Perfil"

        val codeAdapter = InviteCodeAdapter(mutableListOf()) { code -> copiarParaClipboard(code) }
        rvCodigos.layoutManager = LinearLayoutManager(requireContext())
        rvCodigos.adapter = codeAdapter

        val studentsAdapter = TrainerStudentsAdapter(mutableListOf()) { aluno ->
            salvarAlunoSelecionado(aluno.uid, aluno.name)
            atualizarBannerAlunoSelecionado(boxAcompanhando, tvAcompanhando)
            Toast.makeText(requireContext(), "Agora acompanhando: ${aluno.name}", Toast.LENGTH_SHORT).show()
        }
        rvAlunos.layoutManager = LinearLayoutManager(requireContext())
        rvAlunos.adapter = studentsAdapter

        btnTrocarAluno.setOnClickListener {
            limparAlunoSelecionado()
            boxAcompanhando.visibility = View.GONE
            Toast.makeText(requireContext(), "Seleção de aluno limpa.", Toast.LENGTH_SHORT).show()
        }

        cardStudentMetrics.visibility = View.GONE
        cardStudentStatus.visibility = View.GONE
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
            btnCodigo.visibility = View.GONE
            return view
        }

        btnCodigo.setOnClickListener { abrirDialogInserirCodigo() }

        Firebase.firestore.collection("users").document(user.uid)
            .get()
            .addOnSuccessListener { doc ->

                val name = doc.getString("name") ?: "Sem nome"
                val email = doc.getString("email") ?: (user.email ?: "Sem email")
                val role = (doc.getString("role") ?: "ALUNO").trim().uppercase()
                val approved = doc.getBoolean("approved") ?: false

                tvInfo.text = """
                    Nome: $name
                    Email: $email
                    Tipo: $role
                    Status: ${if (approved) "Liberado" else "Aguardando código"}
                """.trimIndent()

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
                    cardNotification.visibility = View.VISIBLE

                    carregarDadosAluno(user.uid, etIdade, etAltura)
                    carregarResumoAluno(user.uid, tvUltimoTreino, tvUltimoPeso, tvUltimoProgresso, tvUltimoCardio)
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
                tvInfo.text = "Erro ao carregar dados do perfil."
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
            Toast.makeText(
                requireContext(),
                "Preencha idade (10-100) e altura em cm (100-250).",
                Toast.LENGTH_SHORT
            ).show()
            return
        }

        Firebase.firestore.collection("users")
            .document(uid)
            .update(mapOf("idade" to idade, "alturaCm" to altura))
            .addOnSuccessListener {
                Toast.makeText(requireContext(), "Dados do aluno salvos.", Toast.LENGTH_SHORT).show()
            }
            .addOnFailureListener { e ->
                Toast.makeText(requireContext(), "Erro ao salvar: ${e.message}", Toast.LENGTH_SHORT).show()
            }
    }

    private fun carregarResumoAluno(
        uid: String,
        tvUltimoTreino: TextView,
        tvUltimoPeso: TextView,
        tvUltimoProgresso: TextView,
        tvUltimoCardio: TextView
    ) {
        val db = Firebase.firestore

        db.collection("users").document(uid).collection("treino_registros")
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .limit(1)
            .get()
            .addOnSuccessListener { snap ->
                val doc = snap.documents.firstOrNull()
                if (doc == null) {
                    tvUltimoTreino.text = "Último treino: sem registros"
                } else {
                    val nome = doc.getString("nomeTreino") ?: "Treino"
                    val data = doc.getString("dataHora") ?: "sem data"
                    tvUltimoTreino.text = "Último treino: $nome • $data"
                }
            }

        db.collection("users").document(uid).collection("progresso")
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .limit(1)
            .get()
            .addOnSuccessListener { snap ->
                val doc = snap.documents.firstOrNull()
                if (doc == null) {
                    tvUltimoPeso.text = "Último peso: sem registros"
                    tvUltimoProgresso.text = "Último progresso: sem registros"
                } else {
                    val data = doc.getString("data") ?: "sem data"
                    val peso = doc.getDouble("pesoKg") ?: doc.getLong("pesoKg")?.toDouble() ?: 0.0
                    tvUltimoPeso.text = "Último peso: ${String.format("%.1f", peso)} kg"

                    val fotos = listOf(
                        doc.getString("fotoFrenteUri"),
                        doc.getString("fotoLadoUri"),
                        doc.getString("fotoCostasUri")
                    ).count { !it.isNullOrBlank() }
                    tvUltimoProgresso.text = "Último progresso: $data • $fotos foto(s)"
                }
            }

        db.collection("users").document(uid).collection("cardio")
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .limit(1)
            .get()
            .addOnSuccessListener { snap ->
                val doc = snap.documents.firstOrNull()
                if (doc == null) {
                    tvUltimoCardio.text = "Último cardio: sem registros"
                } else {
                    val atividade = doc.getString("atividade") ?: "Cardio"
                    val tempo = (doc.getLong("tempoMin") ?: 0L).toInt()
                    val data = doc.getString("dataHora") ?: "sem data"
                    tvUltimoCardio.text = "Último cardio: $atividade • ${tempo}min • $data"
                }
            }
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
                    Toast.makeText(requireContext(), latestMsg, Toast.LENGTH_LONG).show()
                    AppNotifier.showWorkoutUpdate(requireContext(), "MeuTreino", latestMsg)

                    AlertDialog.Builder(requireContext())
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
            Toast.makeText(requireContext(), "Não há notificações pendentes.", Toast.LENGTH_SHORT).show()
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
                tvTitulo.text = "Atualizações do treinador"
                tvMensagem.text = "Sem novas atualizações"
                Toast.makeText(requireContext(), "Notificações marcadas como lidas.", Toast.LENGTH_SHORT).show()
            }
            .addOnFailureListener { e ->
                Toast.makeText(requireContext(), "Erro ao atualizar: ${e.message}", Toast.LENGTH_SHORT).show()
            }
    }

    private fun abrirDialogInserirCodigo() {
        val user = Firebase.auth.currentUser ?: return

        val input = EditText(requireContext())
        input.hint = "Ex: AB12CD"

        AlertDialog.Builder(requireContext())
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
                        AlertDialog.Builder(requireContext())
                            .setTitle("Sucesso!")
                            .setMessage("Conta liberada como $tipo.")
                            .setPositiveButton("OK") { _, _ ->
                                requireActivity().recreate()
                            }
                            .show()
                    },
                    onErr = { msg ->
                        AlertDialog.Builder(requireContext())
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

        AlertDialog.Builder(requireContext())
            .setTitle("Solicitar códigos")
            .setMessage("Quantos códigos você precisa?")
            .setView(input)
            .setPositiveButton("Solicitar") { _, _ ->
                val qty = input.text.toString().trim().toIntOrNull() ?: 0

                if (qty <= 0) {
                    AlertDialog.Builder(requireContext())
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
                        AlertDialog.Builder(requireContext())
                            .setTitle("Pedido enviado")
                            .setMessage("Seu pedido foi enviado para aprovação do admin.")
                            .setPositiveButton("OK", null)
                            .show()
                    },
                    onErr = { msg ->
                        AlertDialog.Builder(requireContext())
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
        Toast.makeText(requireContext(), "Código copiado: $texto", Toast.LENGTH_SHORT).show()
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
                        val codes2 = filtrarDisponiveis(snap2.documents)
                        adapter.update(codes2)
                    }
                    .addOnFailureListener { e ->
                        Toast.makeText(requireContext(), "Erro ao buscar códigos: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
            }
            .addOnFailureListener { e ->
                Toast.makeText(requireContext(), "Erro ao buscar códigos: ${e.message}", Toast.LENGTH_SHORT).show()
            }
    }

    private fun carregarMeusAlunos(adapter: TrainerStudentsAdapter) {
        val user = Firebase.auth.currentUser ?: return

        Firebase.firestore.collection("users")
            .whereEqualTo("trainerId", user.uid)
            .get()
            .addOnSuccessListener { snap ->
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
                Toast.makeText(
                    requireContext(),
                    "Erro ao buscar alunos: ${e.message}",
                    Toast.LENGTH_SHORT
                ).show()
            }
    }
}
