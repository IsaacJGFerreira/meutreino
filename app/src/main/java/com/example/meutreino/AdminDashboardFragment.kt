package com.example.meutreino

import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase

class AdminDashboardFragment : Fragment() {

    private lateinit var tvQtdTreinadores: TextView
    private lateinit var tvQtdAlunos: TextView

    private lateinit var rvPedidos: RecyclerView
    private lateinit var reqAdapter: InviteRequestAdapter
    private val reqRepo = InviteRequestRepository()

    private lateinit var rvTreinadores: RecyclerView
    private lateinit var trainerAdapter: AdminTrainerAdapter

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        val view = inflater.inflate(R.layout.fragment_admin_dashboard, container, false)

        // Views
        tvQtdTreinadores = view.findViewById(R.id.tvQtdTreinadores)
        tvQtdAlunos = view.findViewById(R.id.tvQtdAlunos)

        val btnSair = view.findViewById<Button>(R.id.btnAdminSair)
        val btnGerarCodigoTreinador = view.findViewById<Button>(R.id.btnGerarCodigoTreinador)

        rvPedidos = view.findViewById(R.id.rvPedidosPendentes)
        rvTreinadores = view.findViewById(R.id.rvTreinadores)

        // 1) Sair
        btnSair.setOnClickListener {
            Firebase.auth.signOut()
            startActivity(Intent(requireContext(), LoginActivity::class.java))
            requireActivity().finish()
        }

        // 2) Gerar código de treinador (1 uso)
        val inviteRepo = InviteRepository()
        btnGerarCodigoTreinador.setOnClickListener {
            val admin = Firebase.auth.currentUser ?: return@setOnClickListener

            inviteRepo.criarConviteTreinador(
                adminUid = admin.uid,
                onOk = { code ->
                    AppUiFeedback.dialogBuilder(requireContext())
                        .setTitle("Código de Treinador")
                        .setMessage("Código: $code\n\n(Use 1 vez. Depois expira.)")
                        .setPositiveButton("OK", null)
                        .show()
                },
                onErr = {
                    AppUiFeedback.dialogBuilder(requireContext())
                        .setTitle("Erro")
                        .setMessage("Não foi possível gerar o código.")
                        .setPositiveButton("OK", null)
                        .show()
                }
            )
        }

        // 3) Lista de pedidos pendentes
        reqAdapter = InviteRequestAdapter(
            mutableListOf(),
            onApprove = { req -> confirmarAprovar(req) },
            onReject = { req -> confirmarRejeitar(req) }
        )
        rvPedidos.layoutManager = LinearLayoutManager(requireContext())
        rvPedidos.adapter = reqAdapter

        // 4) Lista de treinadores
        trainerAdapter = AdminTrainerAdapter(mutableListOf()) { trainer ->
            (activity as? MainActivity)?.navegarPara(
                AdminTrainerDetailFragment.newInstance(trainer.uid)
            )
        }
        rvTreinadores.layoutManager = LinearLayoutManager(requireContext())
        rvTreinadores.adapter = trainerAdapter

        // Carrega tudo
        carregarResumoELista()
        carregarPedidosPendentes()

        return view
    }

    // -----------------------
    // Resumo + Lista Treinadores
    // -----------------------
    private fun carregarResumoELista() {
        val db = Firebase.firestore

        // Treinadores
        db.collection("users")
            .whereEqualTo("role", "TREINADOR")
            .get()
            .addOnSuccessListener { snap ->
                tvQtdTreinadores.text = snap.size().toString()

                val trainers = snap.documents.map { doc ->
                    AdminTrainerItem(
                        uid = doc.id,
                        name = doc.getString("name") ?: "Sem nome",
                        email = doc.getString("email") ?: "Sem email",
                        active = doc.getBoolean("active") ?: true
                    )
                }.sortedBy { it.name.lowercase() }

                trainerAdapter.update(trainers)
            }

        // Alunos
        db.collection("users")
            .whereEqualTo("role", "ALUNO")
            .get()
            .addOnSuccessListener { snap ->
                tvQtdAlunos.text = snap.size().toString()
            }
    }

    // -----------------------
    // Pedidos Pendentes
    // -----------------------
    private fun carregarPedidosPendentes() {
        reqRepo.listarPendentes(
            onOk = { list -> reqAdapter.update(list) },
            onErr = { msg ->
                // Se quiser, pode mostrar dialog. Por enquanto fica silencioso.
                // AppUiFeedback.dialogBuilder(requireContext()).setTitle("Erro").setMessage(msg).setPositiveButton("OK", null).show()
            }
        )
    }

    private fun confirmarAprovar(req: InviteRequestItem) {
        AppUiFeedback.dialogBuilder(requireContext())
            .setTitle("Aprovar pedido")
            .setMessage("Gerar ${req.qty} códigos para ${req.trainerName}?")
            .setPositiveButton("Aprovar") { _, _ -> aprovar(req) }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun aprovar(req: InviteRequestItem) {
        val admin = Firebase.auth.currentUser ?: return

        reqRepo.aprovarPedido(
            requestId = req.id,
            trainerUid = req.trainerUid,
            qty = req.qty,
            adminUid = admin.uid,
            onOk = { codes ->
                val texto = codes.joinToString("\n")

                AppUiFeedback.dialogBuilder(requireContext())
                    .setTitle("Códigos gerados")
                    .setMessage(texto)
                    .setPositiveButton("OK", null)
                    .show()

                carregarPedidosPendentes()
            },
            onErr = { msg ->
                AppUiFeedback.dialogBuilder(requireContext())
                    .setTitle("Erro")
                    .setMessage(msg)
                    .setPositiveButton("OK", null)
                    .show()
            }
        )
    }

    private fun confirmarRejeitar(req: InviteRequestItem) {
        AppUiFeedback.dialogBuilder(requireContext())
            .setTitle("Rejeitar pedido")
            .setMessage("Rejeitar pedido de ${req.trainerName}?")
            .setPositiveButton("Rejeitar") { _, _ -> rejeitar(req) }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun rejeitar(req: InviteRequestItem) {
        val admin = Firebase.auth.currentUser ?: return

        reqRepo.rejeitarPedido(
            requestId = req.id,
            adminUid = admin.uid,
            onOk = { carregarPedidosPendentes() },
            onErr = { msg ->
                AppUiFeedback.dialogBuilder(requireContext())
                    .setTitle("Erro")
                    .setMessage(msg)
                    .setPositiveButton("OK", null)
                    .show()
            }
        )
    }
}