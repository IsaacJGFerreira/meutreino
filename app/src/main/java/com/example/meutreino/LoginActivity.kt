package com.example.meutreino

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.auth.ktx.auth
import com.google.firebase.ktx.Firebase

class LoginActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // ✅ Se já está logado, entra direto na Main (NÃO fecha o app)
        if (Firebase.auth.currentUser != null) {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_login)

        val etEmail = findViewById<EditText>(R.id.etEmail)
        val etSenha = findViewById<EditText>(R.id.etSenha)
        val btnEntrar = findViewById<Button>(R.id.btnEntrar)

        etEmail.hintPortugueseIme()
        etSenha.hintPortugueseIme()
        val btnCriarConta = findViewById<Button>(R.id.btnCriarConta)

        btnEntrar.setOnClickListener {
            val email = etEmail.text.toString().trim()
            val senha = etSenha.text.toString().trim()

            if (email.isBlank() || senha.isBlank()) {
                AppUiFeedback.showToast(this, "Preencha email e senha.", Toast.LENGTH_SHORT)
                return@setOnClickListener
            }

            Firebase.auth.signInWithEmailAndPassword(email, senha)
                .addOnSuccessListener {
                    // ✅ opcional: limpar cache local se você realmente precisa disso
                    // LocalDataReset.wipeAllLocal(applicationContext)

                    startActivity(Intent(this, MainActivity::class.java))
                    finish()
                }
                .addOnFailureListener {
                    AppUiFeedback.showToast(this, "Login inválido.", Toast.LENGTH_SHORT)
                }
        }

        btnCriarConta.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
        }
    }
}
