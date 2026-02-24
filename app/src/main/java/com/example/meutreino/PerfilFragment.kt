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
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase

class PerfilFragment : Fragment() {

    companion object {
        private const val PREFS = "meutreino_prefs"
        private const val KEY_SELECTED_STUDENT = "selected_student_uid"
        private const val KEY_SELECTED_STUDENT_NAME = "selected_student_name"
    }

    private val repoRedeem = InviteRedeemRepository()
    private val repoRequest = InviteRequestRepository()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {

        val view = inflater.inflate(R.layout.fragment_perfil, container, false)

        // --- views base ---
        val tvTitulo = view.findViewById<TextView>(R.id.tvPerfilTitulo)
        val tvInfo = view.findViewById<TextView>(R.id.tvPerfilInfo)
        val btnCodigo = view.findViewById<Button>(R.id.btnInserirCodigo)
        val btnSolicitar = view.findViewById<Button>(R.id.btnSolicitarCodigos)

        // --- seção treinador (códigos + alunos) ---
        val tvTituloCodigos = view.findViewById<TextView>(R.id.tvTituloCodigos)
        val rvCodigos = view.findViewById<RecyclerView>(R.id.rvCodigosDisponiveis)
        val tvTituloAlunos = view.findViewById<TextView>(R.id.tvTituloAlunos)
        val rvAlunos = view.findViewById<RecyclerView>(R.id.rvMeusAlunos)

        // --- banner acompanhando ---
        val boxAcompanhando = view.findViewById<View>(R.id.boxAcompanhando)
        val tvAcompanhando = view.findViewById<TextView>(R.id.tvAcompanhando)
        val btnTrocarAluno = view.findViewById<Button>(R.id.btnTrocarAluno)

        tvTitulo.text = "Perfil"

        // adapters
        val codeAdapter = InviteCodeAdapter(mutableListOf()) { code ->
            copiarParaClipboard(code)
        }
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

        // por padrão escondemos coisas do treinador até confirmar role
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

        // botão inserir código sempre abre dialog (a visibilidade decidimos depois)
        btnCodigo.setOnClickListener { abrirDialogInserirCodigo() }

        // carrega doc do usuário no Firestore
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

                // Botão inserir código: aparece só se não estiver aprovado (admin geralmente não usa isso)
                btnCodigo.visibility = if (approved) View.GONE else View.VISIBLE

                // Se for TREINADOR aprovado: mostra seções + botão solicitar
                if (role == "TREINADOR" && approved) {

                    // mostrar seção códigos + alunos
                    tvTituloCodigos.visibility = View.VISIBLE
                    rvCodigos.visibility = View.VISIBLE
                    tvTituloAlunos.visibility = View.VISIBLE
                    rvAlunos.visibility = View.VISIBLE

                    // banner aluno selecionado (se tiver)
                    atualizarBannerAlunoSelecionado(boxAcompanhando, tvAcompanhando)

                    // carregar dados
                    carregarCodigosDisponiveis(codeAdapter)
                    carregarMeusAlunos(studentsAdapter)

                    // solicitar códigos
                    btnSolicitar.visibility = View.VISIBLE
                    btnSolicitar.setOnClickListener { abrirDialogSolicitarCodigos() }
                } else {
                    tvTituloCodigos.visibility = View.GONE
                    rvCodigos.visibility = View.GONE
                    tvTituloAlunos.visibility = View.GONE
                    rvAlunos.visibility = View.GONE
                    boxAcompanhando.visibility = View.GONE
                }
            }
            .addOnFailureListener {
                tvInfo.text = "Erro ao carregar dados do perfil."
                btnCodigo.visibility = View.GONE
                btnSolicitar.visibility = View.GONE
            }

        return view
    }
    // ---------- Dialog: inserir código ----------
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

    // ---------- Dialog: solicitar códigos ----------
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

    // ---------- Clipboard ----------
    private fun copiarParaClipboard(texto: String) {
        val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("codigo", texto))
        Toast.makeText(requireContext(), "Código copiado: $texto", Toast.LENGTH_SHORT).show()
    }

    // ---------- seleção do aluno ----------
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

    // ---------- carregar códigos disponíveis ----------
    // ---------- carregar códigos disponíveis ----------
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

        fun logDocs(tag: String, docs: List<com.google.firebase.firestore.DocumentSnapshot>) {
            android.util.Log.d("INVITES_UI", "---- $tag | docs=${docs.size} | trainerUid=${user.uid}")
            docs.forEach { d ->
                android.util.Log.d(
                    "INVITES_UI",
                    "DOC ${d.id} | type=${d.getString("type")} | trainerUid=${d.getString("trainerUid")} | trainerId=${d.getString("trainerId")} | usedAt=${d.get("usedAt")} | usedByUid=${d.get("usedByUid")}"
                )
            }
        }

        // 1) Query padrão (trainerUid)
        db.collection("invites")
            .whereEqualTo("type", "ALUNO")
            .whereEqualTo("trainerUid", user.uid)
            .get()
            .addOnSuccessListener { snap1 ->
                val docs1 = snap1.documents
                logDocs("QUERY trainerUid", docs1)

                val codes1 = filtrarDisponiveis(docs1)

                // Se achou algo, atualiza e pronto
                if (codes1.isNotEmpty()) {
                    android.util.Log.d("INVITES_UI", "🎫 codes disponiveis (trainerUid): $codes1")
                    adapter.update(codes1)
                    return@addOnSuccessListener
                }

                // 2) Fallback: alguns projetos antigos salvavam trainerId ao invés de trainerUid
                db.collection("invites")
                    .whereEqualTo("type", "ALUNO")
                    .whereEqualTo("trainerId", user.uid)
                    .get()
                    .addOnSuccessListener { snap2 ->
                        val docs2 = snap2.documents
                        logDocs("QUERY trainerId (fallback)", docs2)

                        val codes2 = filtrarDisponiveis(docs2)

                        android.util.Log.d("INVITES_UI", "🎫 codes disponiveis (fallback): $codes2")
                        adapter.update(codes2)

                        // debug opcional pra não ficar no escuro:
                        Toast.makeText(
                            requireContext(),
                            "Códigos disponíveis: ${codes2.size}",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                    .addOnFailureListener { e ->
                        android.util.Log.e("INVITES_UI", "❌ erro query fallback trainerId", e)
                        Toast.makeText(requireContext(), "Erro ao buscar códigos: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
            }
            .addOnFailureListener { e ->
                android.util.Log.e("INVITES_UI", "❌ erro query trainerUid", e)
                Toast.makeText(requireContext(), "Erro ao buscar códigos: ${e.message}", Toast.LENGTH_SHORT).show()
            }
    }

    // ---------- carregar alunos vinculados ----------
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
                Toast.makeText(requireContext(),
                    "Erro ao buscar alunos: ${e.message}",
                    Toast.LENGTH_SHORT
                ).show()
            }
    }

}