package com.example.meutreino

import android.app.Dialog
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.DialogFragment
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class RegistrarProgressoDialog(
    private val onSalvou: (ProgressoRegistro) -> Unit
) : DialogFragment() {

    private enum class TipoFoto { FRENTE, COSTAS, LADO }
    private var tipoAtual: TipoFoto = TipoFoto.FRENTE

    private var uriFrente: String? = null
    private var uriCostas: String? = null
    private var uriLado: String? = null

    private lateinit var etPeso: EditText

    private val pickImage = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri == null) return@registerForActivityResult

        val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        requireContext().contentResolver.takePersistableUriPermission(uri, flags)

        when (tipoAtual) {
            TipoFoto.FRENTE -> uriFrente = uri.toString()
            TipoFoto.COSTAS -> uriCostas = uri.toString()
            TipoFoto.LADO -> uriLado = uri.toString()
        }

        AppUiFeedback.showToast(requireContext(), "Foto selecionada!", Toast.LENGTH_SHORT)
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val v = requireActivity().layoutInflater.inflate(R.layout.dialog_registrar_progresso, null)

        etPeso = v.findViewById(R.id.etPesoDialog)

        val cardFrente = v.findViewById<FrameLayout>(R.id.cardFrente)
        val cardCostas = v.findViewById<FrameLayout>(R.id.cardCostas)
        val cardLado = v.findViewById<FrameLayout>(R.id.cardLado)

        cardFrente.setOnClickListener {
            tipoAtual = TipoFoto.FRENTE
            pickImage.launch(arrayOf("image/*"))
        }
        cardCostas.setOnClickListener {
            tipoAtual = TipoFoto.COSTAS
            pickImage.launch(arrayOf("image/*"))
        }
        cardLado.setOnClickListener {
            tipoAtual = TipoFoto.LADO
            pickImage.launch(arrayOf("image/*"))
        }

        val dialog = AppUiFeedback.dialogBuilder(requireContext())
            .setView(v)
            .create()

        dialog.setOnShowListener {
            val btnSalvar = v.findViewById<com.google.android.material.button.MaterialButton>(R.id.btnSalvarDialog)

            btnSalvar.setOnClickListener {
                val peso = etPeso.text.toString().trim().toDoubleOrNull()
                if (peso == null || peso <= 0) {
                    AppUiFeedback.showToast(requireContext(), "Peso inválido.", Toast.LENGTH_SHORT)
                    return@setOnClickListener
                }

                val data = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()).format(Date())
                val registroId = System.currentTimeMillis().toString()

                ProgressoFirestoreRepository.salvarComFotos(
                    registroId = registroId,
                    data = data,
                    pesoKg = peso,
                    uriFrenteLocal = uriFrente,
                    uriLadoLocal = uriLado,
                    uriCostasLocal = uriCostas,
                    onOk = { registroComUrls ->
                        onSalvou(registroComUrls)
                        dismiss()
                    },
                    onErro = { e ->
                        AppUiFeedback.showToast(requireContext(), "Erro: ${e.message}", Toast.LENGTH_LONG)
                    }
                )
            }
        }

        return dialog
    }
}
