package com.example.meutreino

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.RadioGroup
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.textfield.TextInputEditText
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase

class RegisterActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_register)

        supportActionBar?.hide()

        val edtNome = findViewById<TextInputEditText>(R.id.edtNome)
        val edtEmail = findViewById<TextInputEditText>(R.id.edtEmail)
        val edtSenha = findViewById<TextInputEditText>(R.id.edtSenha)
        val rgRole = findViewById<RadioGroup>(R.id.rgRole)
        val btnCriar = findViewById<Button>(R.id.btnCriarConta)

        edtNome.hintPortugueseIme()
        edtEmail.hintPortugueseIme()
        edtSenha.hintPortugueseIme()

        btnCriar.setOnClickListener {
            val nome = edtNome.text?.toString()?.trim().orEmpty()
            val email = edtEmail.text?.toString()?.trim().orEmpty()
            val senha = edtSenha.text?.toString()?.trim().orEmpty()

            val role = when (rgRole.checkedRadioButtonId) {
                R.id.rbAluno -> "ALUNO"
                R.id.rbTreinador -> "TREINADOR"
                else -> ""
            }

            if (nome.isBlank() || email.isBlank() || senha.isBlank() || role.isBlank()) {
                AppUiFeedback.showToast(this, "Preencha tudo e selecione Aluno/Treinador.", Toast.LENGTH_SHORT)
                return@setOnClickListener
            }

            criarConta(nome, email, senha, role)
        }
    }

    private fun criarConta(nome: String, email: String, senha: String, role: String) {
        Firebase.auth.createUserWithEmailAndPassword(email, senha)
            .addOnSuccessListener { result ->
                val uid = result.user?.uid ?: return@addOnSuccessListener

                val data = hashMapOf(
                    "name" to nome,
                    "email" to email,
                    "role" to role,
                    "active" to true,
                    "approved" to false,
                    "trainerId" to null,
                    "createdAt" to System.currentTimeMillis()
                )

                Firebase.firestore.collection("users").document(uid)
                    .set(data)
                    .addOnSuccessListener {
                        AppUiFeedback.showToast(this, "Conta criada! Agora insira o código para liberar.", Toast.LENGTH_SHORT)
                        startActivity(Intent(this, MainActivity::class.java))
                        finish()
                    }
                    .addOnFailureListener { e ->
                        AppUiFeedback.showToast(this, "Erro ao salvar perfil: ${e.message}", Toast.LENGTH_LONG)
                    }
            }
            .addOnFailureListener { e ->
                AppUiFeedback.showToast(this, "Erro ao criar conta: ${e.message}", Toast.LENGTH_LONG)
            }
    }
}
