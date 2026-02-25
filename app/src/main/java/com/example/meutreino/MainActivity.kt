package com.example.meutreino

import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentManager
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.card.MaterialCardView
import com.google.android.material.floatingactionbutton.FloatingActionButton
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase

class MainActivity : AppCompatActivity() {

    companion object {
        private const val PREFS = "meutreino_prefs"
        private const val KEY_LAST_UID = "last_uid"

        // ✅ aluno selecionado (modo treinador)
        private const val KEY_SELECTED_STUDENT = "selected_student_uid"
        private const val KEY_SELECTED_STUDENT_NAME = "selected_student_name"
        private const val KEY_LAST_NOTIFICATION_TS = "last_workout_notification_ts"

        const val EXTRA_SYNC_OK = "sync_ok"
    }

    private var userRole: String = ""   // fica vazio até carregar
    private lateinit var fabMenu: FloatingActionButton

    // badge aluno selecionado
    private lateinit var prefs: SharedPreferences
    private var prefsListener: SharedPreferences.OnSharedPreferenceChangeListener? = null
    private var workoutNotificationsListener: ListenerRegistration? = null

    private val requestNotificationsPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (!granted) {
            Toast.makeText(this, "Permita notificações para receber atualizações de treino.", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        supportActionBar?.hide()

        prefs = getSharedPreferences(PREFS, MODE_PRIVATE)

        fabMenu = findViewById(R.id.fabMenu)
        fabMenu.setOnClickListener { abrirMenuBottomSheet() }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                tratarBotaoVoltar()
            }
        })

        // ✅ Bloqueia acesso sem login
        val user = Firebase.auth.currentUser
        if (user == null) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        // ✅ Se acabou de voltar da sincronização, não precisa checar de novo
        val syncOk = intent.getBooleanExtra(EXTRA_SYNC_OK, false)

        if (!syncOk && precisaSincronizar(user.uid)) {
            startActivity(Intent(this, LoadingActivity::class.java))
            finish()
            return
        }

        // ✅ Carrega role/approved/active e inicia UI
        carregarRoleEIniciar(user.uid, savedInstanceState)
    }

    override fun onStart() {
        super.onStart()

        // Atualiza badge ao voltar pra activity
        atualizarBadgeAluno()

        // Listener pra atualizar badge quando Perfil trocar aluno
        prefsListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
            if (key == KEY_SELECTED_STUDENT || key == KEY_SELECTED_STUDENT_NAME) {
                atualizarBadgeAluno()
            }
        }
        prefs.registerOnSharedPreferenceChangeListener(prefsListener)
    }

    override fun onStop() {
        super.onStop()
        prefsListener?.let { prefs.unregisterOnSharedPreferenceChangeListener(it) }
        prefsListener = null

        pararListenerNotificacoesTreino()
    }

    override fun onDestroy() {
        super.onDestroy()
        pararListenerNotificacoesTreino()
    }

    private fun precisaSincronizar(uidAtual: String): Boolean {
        val uidAnterior = prefs.getString(KEY_LAST_UID, null)
        return uidAnterior == null || uidAnterior != uidAtual
    }

    private fun carregarRoleEIniciar(uid: String, savedInstanceState: Bundle?) {
        Firebase.firestore.collection("users").document(uid).get()
            .addOnSuccessListener { doc ->

                // Se doc não existe, bloqueia
                if (!doc.exists()) {
                    userRole = "ALUNO"
                    fabMenu.visibility = View.GONE
                    esconderBadgeAluno()
                    trocarTela(ContaBloqueadaFragment(), limparBackStack = true)
                    return@addOnSuccessListener
                }

                val roleLido = doc.getString("role")
                val active = doc.getBoolean("active") ?: true
                val approved = doc.getBoolean("approved") ?: false

                userRole = (roleLido ?: "ALUNO").trim().uppercase()

                // Conta desativada: expulsa
                if (!active) {
                    Firebase.auth.signOut()
                    startActivity(Intent(this, LoginActivity::class.java))
                    finish()
                    return@addOnSuccessListener
                }

                // Conta não aprovada (exceto admin): bloqueia
                if (!approved && userRole != "ADMIN") {
                    fabMenu.visibility = View.GONE
                    esconderBadgeAluno()
                    pararListenerNotificacoesTreino()
                    trocarTela(ContaBloqueadaFragment(), limparBackStack = true)
                    return@addOnSuccessListener
                }

                // Tela inicial
                if (savedInstanceState == null) {
                    when (userRole) {
                        "ADMIN" -> trocarTela(AdminDashboardFragment(), limparBackStack = true)
                        else -> trocarTela(PerfilFragment(), limparBackStack = true)
                    }
                }

                // Admin não tem menu do app
                fabMenu.visibility = if (userRole == "ADMIN") View.GONE else View.VISIBLE

                if (userRole == "ALUNO") {
                    solicitarPermissaoNotificacoesSeNecessario()
                    iniciarListenerNotificacoesTreino(uid)
                } else {
                    pararListenerNotificacoesTreino()
                }

                // Badge aluno selecionado
                configurarCliqueBadge()
                atualizarBadgeAluno()
            }
            .addOnFailureListener {
                // Se der erro, joga pro login (melhor do que ficar travado)
                Firebase.auth.signOut()
                startActivity(Intent(this, LoginActivity::class.java))
                finish()
            }
    }

    private fun abrirMenuBottomSheet() {
        // Se por algum motivo ainda não sabemos role, não abre
        if (userRole.isBlank()) return

        val dialog = BottomSheetDialog(this)
        val view = LayoutInflater.from(this).inflate(R.layout.bottomsheet_menu_layout, null)

        val navView = view.findViewById<com.google.android.material.navigation.NavigationView>(R.id.navViewBottomSheet)
        val menu = navView.menu

        val isTreinador = (userRole == "TREINADOR")
        val isAluno = (userRole == "ALUNO")

        // ✅ Regras de visibilidade
        menu.findItem(R.id.menu_treino)?.isVisible = isAluno
        menu.findItem(R.id.menu_montar_treino)?.isVisible = isTreinador

        // (Opcional) se quiser esconder Cardio/Progresso pra treinador quando não tiver aluno selecionado:
        // val hasSelectedStudent = prefs.getString(KEY_SELECTED_STUDENT, null) != null
        // if (isTreinador) {
        //     menu.findItem(R.id.menu_cardio)?.isEnabled = hasSelectedStudent
        //     menu.findItem(R.id.menu_progresso)?.isEnabled = hasSelectedStudent
        //     menu.findItem(R.id.menu_desempenho)?.isEnabled = hasSelectedStudent
        // }

        navView.setNavigationItemSelectedListener { item ->
            when (item.itemId) {
                R.id.menu_treino -> trocarTela(TreinoFragment(), limparBackStack = true)
                R.id.menu_desempenho -> trocarTela(DesempenhoFragment(), limparBackStack = true)
                R.id.menu_montar_treino -> trocarTela(MontarTreinoFragment(), limparBackStack = true)
                R.id.menu_cardio -> trocarTela(CardioFragment(), limparBackStack = true)
                R.id.menu_progresso -> trocarTela(ProgressoFragment(), limparBackStack = true)
                R.id.menu_perfil -> trocarTela(PerfilFragment(), limparBackStack = true)

                R.id.menu_sair -> {
                    Firebase.auth.signOut()
                    startActivity(Intent(this, LoginActivity::class.java))
                    finish()
                }
            }
            dialog.dismiss()
            true
        }

        dialog.setContentView(view)
        dialog.show()
    }

    private fun trocarTela(fragment: Fragment, limparBackStack: Boolean) {
        if (limparBackStack) {
            supportFragmentManager.popBackStack(null, FragmentManager.POP_BACK_STACK_INCLUSIVE)
        }
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragmentContainer, fragment)
            .commit()
    }

    fun navegarPara(fragment: Fragment) {
        trocarTela(fragment, limparBackStack = true)
    }

    private fun tratarBotaoVoltar() {
        if (supportFragmentManager.backStackEntryCount > 0) {
            supportFragmentManager.popBackStack()
            return
        }

        val atual = supportFragmentManager.findFragmentById(R.id.fragmentContainer)
        val inicial = fragmentoInicialPorRole()

        if (atual == null || atual::class != inicial::class) {
            trocarTela(inicial, limparBackStack = true)
            return
        }

        // Não fecha o app; só manda para background.
        moveTaskToBack(true)
    }

    private fun fragmentoInicialPorRole(): Fragment {
        return when (userRole) {
            "ADMIN" -> AdminDashboardFragment()
            else -> PerfilFragment()
        }
    }

    private fun solicitarPermissaoNotificacoesSeNecessario() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return

        val permission = android.Manifest.permission.POST_NOTIFICATIONS
        if (ContextCompat.checkSelfPermission(this, permission) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
            return
        }

        requestNotificationsPermission.launch(permission)
    }

    private fun iniciarListenerNotificacoesTreino(uid: String) {
        pararListenerNotificacoesTreino()

        workoutNotificationsListener = Firebase.firestore
            .collection("users")
            .document(uid)
            .collection("notifications")
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .limit(1)
            .addSnapshotListener { snap, err ->
                if (err != null) return@addSnapshotListener

                val latest = snap?.documents?.firstOrNull() ?: return@addSnapshotListener
                val isRead = latest.getBoolean("read") ?: false
                if (isRead) return@addSnapshotListener

                val latestTs = latest.getLong("createdAt") ?: 0L
                val latestMsg = latest.getString("message") ?: "Seu treino foi atualizado."

                val lastSeenTs = prefs.getLong(KEY_LAST_NOTIFICATION_TS, 0L)
                if (latestTs <= lastSeenTs) return@addSnapshotListener

                AppNotifier.showWorkoutUpdate(this, "MeuTreino", latestMsg)
                prefs.edit().putLong(KEY_LAST_NOTIFICATION_TS, latestTs).apply()
            }
    }

    private fun pararListenerNotificacoesTreino() {
        workoutNotificationsListener?.remove()
        workoutNotificationsListener = null
    }

    // ==========================
    // ✅ BADGE DO ALUNO (TREINADOR)
    // ==========================
    private fun esconderBadgeAluno() {
        val card = findViewById<MaterialCardView?>(R.id.cardAlunoSelecionado)
        card?.visibility = View.GONE
    }

    private fun atualizarBadgeAluno() {
        val card = findViewById<MaterialCardView?>(R.id.cardAlunoSelecionado) ?: return
        val tv = findViewById<TextView?>(R.id.tvAlunoSelecionado) ?: return

        // Só treinador vê
        if (userRole != "TREINADOR") {
            card.visibility = View.GONE
            return
        }

        val selectedUid = prefs.getString(KEY_SELECTED_STUDENT, null)
        val selectedName = prefs.getString(KEY_SELECTED_STUDENT_NAME, null)

        if (selectedUid.isNullOrBlank() || selectedName.isNullOrBlank()) {
            card.visibility = View.GONE
        } else {
            card.visibility = View.VISIBLE
            tv.text = "Aluno: $selectedName"
        }
    }

    private fun configurarCliqueBadge() {
        val card = findViewById<MaterialCardView?>(R.id.cardAlunoSelecionado) ?: return
        val btnTrocar = findViewById<TextView?>(R.id.btnTrocarAlunoBadge) ?: return

        // tocar no badge -> abre Perfil (onde escolhe aluno)
        card.setOnClickListener {
            trocarTela(PerfilFragment(), limparBackStack = false)
        }

        // tocar em "trocar" -> limpa seleção
        btnTrocar.setOnClickListener {
            prefs.edit()
                .remove(KEY_SELECTED_STUDENT)
                .remove(KEY_SELECTED_STUDENT_NAME)
                .apply()
            atualizarBadgeAluno()
        }
    }
}
