package com.example.meutreino

import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import androidx.fragment.app.Fragment
import com.google.firebase.auth.ktx.auth
import com.google.firebase.ktx.Firebase

class ContaBloqueadaFragment : Fragment() {

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        val view = inflater.inflate(R.layout.fragment_conta_bloqueada, container, false)

        val btnInserir = view.findViewById<Button>(R.id.btnInserirCodigoBloqueio)
        val btnSair = view.findViewById<Button>(R.id.btnSairBloqueio)

        btnInserir.setOnClickListener { abrirDialogCodigo() }

        btnSair.setOnClickListener {
            Firebase.auth.signOut()
            startActivity(Intent(requireContext(), LoginActivity::class.java))
            requireActivity().finish()
        }

        return view
    }

    private fun abrirDialogCodigo() {
        val user = Firebase.auth.currentUser ?: return
        val input = EditText(requireContext())
        input.hint = "Ex: AB12CD"

        AppUiFeedback.dialogBuilder(requireContext())
            .setTitle("Inserir código")
            .setMessage("Digite o código recebido:")
            .setView(input)
            .setPositiveButton("Aplicar") { _, _ ->
                val code = input.text.toString().trim().uppercase()
                val repo = InviteRedeemRepository()

                repo.resgatarCodigo(
                    code = code,
                    uid = user.uid,
                    onOk = {
                        AppUiFeedback.dialogBuilder(requireContext())
                            .setTitle("Liberado!")
                            .setMessage("Conta liberada com sucesso.")
                            .setPositiveButton("OK") { _, _ ->
                                // Reabre a Main pra ela reler role/approved e cair no lugar certo
                                startActivity(Intent(requireContext(), MainActivity::class.java))
                                requireActivity().finish()
                            }
                            .show()
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
            .setNegativeButton("Cancelar", null)
            .show()
    }
}
