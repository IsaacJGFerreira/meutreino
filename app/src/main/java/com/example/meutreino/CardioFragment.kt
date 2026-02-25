package com.example.meutreino

import android.app.AlertDialog
import android.content.Context
import android.os.Bundle
import androidx.fragment.app.Fragment
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import android.util.Log

class CardioFragment : Fragment() {

    private var lista: MutableList<CardioRegistro> = mutableListOf()

    private lateinit var rvSemana: RecyclerView
    private lateinit var tvSemanaAtual: TextView
    private lateinit var tvTotalSemana: TextView
    private lateinit var btnSemanaAnterior: Button
    private lateinit var btnProximaSemana: Button
    private lateinit var btnAdicionarCardio: Button

    private lateinit var adapter: DiaCardioAdapter

    private val semanaCal: Calendar = Calendar.getInstance()

    // ✅ role do usuário logado
    private var meuRole: String = "ALUNO"

    // ✅ Qual UID vamos observar?
    private fun uidAlvo(): String? {
        val user = Firebase.auth.currentUser ?: return null
        val prefs = requireContext().getSharedPreferences("meutreino_prefs", Context.MODE_PRIVATE)
        val selectedStudent = prefs.getString("selected_student_uid", null)
        return selectedStudent ?: user.uid
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        val view = inflater.inflate(R.layout.fragment_cardio, container, false)

        tvSemanaAtual = view.findViewById(R.id.tvSemanaAtual)
        tvTotalSemana = view.findViewById(R.id.tvTotalSemana)
        btnSemanaAnterior = view.findViewById(R.id.btnSemanaAnterior)
        btnProximaSemana = view.findViewById(R.id.btnProximaSemana)
        btnAdicionarCardio = view.findViewById(R.id.btnAdicionarCardio)
        rvSemana = view.findViewById(R.id.rvSemana)

        rvSemana.layoutManager = LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)

        adapter = DiaCardioAdapter(emptyList()) { dia ->
            abrirDetalhesDoDia(dia.dataChave)
        }
        rvSemana.adapter = adapter

        btnSemanaAnterior.setOnClickListener {
            semanaCal.add(Calendar.WEEK_OF_YEAR, -1)
            atualizarSemanaNaTela()
        }
        btnProximaSemana.setOnClickListener {
            semanaCal.add(Calendar.WEEK_OF_YEAR, 1)
            atualizarSemanaNaTela()
        }

        btnAdicionarCardio.setOnClickListener {
            abrirDialogAdicionarCardio()
        }

        // ✅ 1) Descobrir role antes de decidir comportamento
        carregarRoleEIniciar()

        return view
    }

    private fun carregarRoleEIniciar() {
        val user = Firebase.auth.currentUser
        if (user == null) {
            AppUiFeedback.showToast(requireContext(), "Usuário não logado.", Toast.LENGTH_SHORT)
            return
        }

        Firebase.firestore.collection("users").document(user.uid)
            .get()
            .addOnSuccessListener { doc ->

                meuRole = (doc.getString("role") ?: "ALUNO").trim().uppercase()

                // ✅ regra: TREINADOR não registra cardio
                btnAdicionarCardio.visibility = if (meuRole == "ALUNO") View.VISIBLE else View.GONE

                val uidAlvo = uidAlvo() ?: return@addOnSuccessListener

                // ✅ se for treinador e não selecionou aluno, não carrega nada
                val prefs = requireContext().getSharedPreferences("meutreino_prefs", Context.MODE_PRIVATE)
                val selectedStudent = prefs.getString("selected_student_uid", null)

                if (meuRole == "TREINADOR" && selectedStudent == null) {
                    lista = mutableListOf()
                    atualizarSemanaNaTela()
                    AppUiFeedback.showToast(requireContext(), "Selecione um aluno no Perfil.", Toast.LENGTH_SHORT)
                    return@addOnSuccessListener
                }

                // ✅ 2) ALUNO: carrega local primeiro (offline)
                if (meuRole == "ALUNO") {
                    lista = CardioRepository.carregar(requireContext()).toMutableList()
                    atualizarSemanaNaTela()
                } else {
                    // TREINADOR: começa vazio e vai esperar nuvem
                    lista = mutableListOf()
                    atualizarSemanaNaTela()
                }

                // ✅ 3) NUVEM manda (com uidAlvo correto)
                carregarDaNuvem(uidAlvo)
            }
            .addOnFailureListener { e ->
                AppUiFeedback.showToast(requireContext(), "Erro ao carregar perfil: ${e.message}", Toast.LENGTH_SHORT)
            }
    }

    private fun carregarDaNuvem(uidAlvo: String) {
        CardioFirestoreRepository.carregar(
            uidAlvo = uidAlvo,
            onOk = { nuvem ->

                lista = nuvem.toMutableList()
                atualizarSemanaNaTela()

                // ✅ só aluno salva cache local (e somente no próprio uid)
                val userUid = Firebase.auth.currentUser?.uid
                if (meuRole == "ALUNO" && userUid == uidAlvo) {
                    CardioRepository.salvar(requireContext(), lista)
                }
            },
            onErro = { e ->
                Log.e("CARDIO_FS", "❌ Erro ao carregar do Firestore", e)
                AppUiFeedback.showToast(requireContext(), "Sem internet ou sem permissão.", Toast.LENGTH_SHORT)
            }
        )
    }

    // =========================
    // ✅ Atualiza calendário + total
    // =========================
    private fun atualizarSemanaNaTela() {
        val (inicio, fim) = obterInicioEFimDaSemana(semanaCal)

        val sdf = SimpleDateFormat("dd/MM", Locale.getDefault())
        tvSemanaAtual.text = "Semana: ${sdf.format(inicio)} - ${sdf.format(fim)}"

        val diasUI = montarDiasDaSemana(inicio)
        adapter.atualizar(diasUI)

        val totalMinSemana = diasUI.sumOf { it.totalMin }
        tvTotalSemana.text = "Total da semana: ${formatarMinutos(totalMinSemana)}"
    }

    private fun montarDiasDaSemana(inicioSemana: Date): List<DiaCardioUI> {
        val cal = Calendar.getInstance()
        cal.time = inicioSemana

        val sdfChave = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
        val sdfLabel = SimpleDateFormat("EEE dd/MM", Locale("pt", "BR"))

        val dias = mutableListOf<DiaCardioUI>()

        val mapaPorDia: Map<String, List<CardioRegistro>> =
            lista.groupBy { chaveDia(it.dataHora) }

        repeat(7) {
            val data = cal.time
            val chave = sdfChave.format(data)
            val label = sdfLabel.format(data).uppercase()

            val regsDoDia = mapaPorDia[chave].orEmpty()

            val totalMin = regsDoDia.sumOf { it.tempoMin }
            val qtd = regsDoDia.size

            val tipos = regsDoDia.map { it.atividade }.distinct()
            val tiposResumo = when {
                tipos.isEmpty() -> "—"
                tipos.size == 1 -> tipos[0]
                tipos.size == 2 -> "${tipos[0]} + ${tipos[1]}"
                else -> "${tipos[0]} + ${tipos[1]} +${tipos.size - 2}"
            }

            val ritmoMedio = calcularRitmoMedio(regsDoDia) ?: "—"

            dias.add(
                DiaCardioUI(
                    dataLabel = label,
                    dataChave = chave,
                    totalMin = totalMin,
                    qtd = qtd,
                    tiposResumo = tiposResumo,
                    ritmoMedio = ritmoMedio
                )
            )

            cal.add(Calendar.DAY_OF_MONTH, 1)
        }

        return dias
    }

    // =========================
    // ✅ Dialog para adicionar cardio (SÓ ALUNO)
    // =========================
    private fun abrirDialogAdicionarCardio() {
        if (meuRole != "ALUNO") {
            AppUiFeedback.showToast(requireContext(), "Somente aluno pode registrar cardio.", Toast.LENGTH_SHORT)
            return
        }

        val layout = android.widget.LinearLayout(requireContext())
        layout.orientation = android.widget.LinearLayout.VERTICAL
        layout.setPadding(40, 20, 40, 10)

        val etAtividade = android.widget.EditText(requireContext())
        etAtividade.hint = "Atividade (ex: Corrida, Bike)"
        layout.addView(etAtividade)

        val etTempoMin = android.widget.EditText(requireContext())
        etTempoMin.hint = "Tempo (min)"
        etTempoMin.inputType = android.text.InputType.TYPE_CLASS_NUMBER
        layout.addView(etTempoMin)

        val etRitmo = android.widget.EditText(requireContext())
        etRitmo.hint = "Ritmo (opcional: mm:ss/km)"
        layout.addView(etRitmo)

        AppUiFeedback.dialogBuilder(requireContext())
            .setTitle("Adicionar Cardio (hoje)")
            .setView(layout)
            .setPositiveButton("Salvar") { _, _ ->

                val atividade = etAtividade.text.toString().trim()
                val tempoStr = etTempoMin.text.toString().trim()
                val ritmo = etRitmo.text.toString().trim()

                if (atividade.isBlank() || tempoStr.isBlank()) {
                    AppUiFeedback.showToast(requireContext(), "Preencha atividade e tempo.", Toast.LENGTH_SHORT)
                    return@setPositiveButton
                }

                val tempoMin = tempoStr.toIntOrNull()
                if (tempoMin == null || tempoMin <= 0) {
                    AppUiFeedback.showToast(requireContext(), "Tempo inválido.", Toast.LENGTH_SHORT)
                    return@setPositiveButton
                }

                val dataHora = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault()).format(Date())
                val idSeguro = System.currentTimeMillis().toString()

                val item = CardioRegistro(
                    id = idSeguro,
                    dataHora = dataHora,
                    atividade = atividade,
                    tempoMin = tempoMin,
                    ritmo = if (ritmo.isBlank()) "—" else ritmo
                )

                // ✅ local (offline)
                lista.add(0, item)
                CardioRepository.salvar(requireContext(), lista)

                // ✅ nuvem (uid do próprio aluno)
                val uid = Firebase.auth.currentUser?.uid ?: return@setPositiveButton
                CardioFirestoreRepository.salvar(uidAlvo = uid, registro = item)

                atualizarSemanaNaTela()
                AppUiFeedback.showToast(requireContext(), "Cardio salvo!", Toast.LENGTH_SHORT)
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun abrirMenuApagarRegistro(regs: List<CardioRegistro>) {
        if (meuRole != "ALUNO") {
            AppUiFeedback.showToast(requireContext(), "Treinador não pode apagar cardio.", Toast.LENGTH_SHORT)
            return
        }

        val itens = regs.mapIndexed { idx, r ->
            "${idx + 1}) ${r.atividade} | ${r.tempoMin} min | ${r.dataHora}"
        }.toTypedArray()

        AppUiFeedback.dialogBuilder(requireContext())
            .setTitle("Apagar qual?")
            .setItems(itens) { _, which ->
                val alvo = regs[which]

                // ✅ Apaga local
                lista.removeAll { it.id == alvo.id }
                CardioRepository.salvar(requireContext(), lista)
                atualizarSemanaNaTela()

                // ✅ Apaga na nuvem
                val uid = Firebase.auth.currentUser?.uid ?: return@setItems
                CardioFirestoreRepository.apagar(uidAlvo = uid, id = alvo.id)

                AppUiFeedback.showToast(requireContext(), "Apagado.", Toast.LENGTH_SHORT)
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun abrirDetalhesDoDia(dataChave: String) {
        val regs = lista.filter { chaveDia(it.dataHora) == dataChave }
            .sortedByDescending { it.dataHora }

        if (regs.isEmpty()) {
            AppUiFeedback.showToast(requireContext(), "Sem cardio em $dataChave.", Toast.LENGTH_SHORT)
            return
        }

        val itens = regs.map {
            "🏃 ${it.atividade} | ${it.tempoMin} min | Ritmo: ${it.ritmo}\n📅 ${it.dataHora}"
        }.toTypedArray()

        val builder = AppUiFeedback.dialogBuilder(requireContext())
            .setTitle("Cardios em $dataChave")
            .setItems(itens, null)
            .setPositiveButton("OK", null)

        // ✅ só aluno pode apagar
        if (meuRole == "ALUNO") {
            builder.setNeutralButton("Apagar um...") { _, _ ->
                abrirMenuApagarRegistro(regs)
            }
        }

        builder.show()
    }

    // =========================
    // Helpers
    // =========================
    private fun obterInicioEFimDaSemana(base: Calendar): Pair<Date, Date> {
        val cal = base.clone() as Calendar
        cal.firstDayOfWeek = Calendar.MONDAY
        cal.set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
        val inicio = cal.time
        cal.add(Calendar.DAY_OF_MONTH, 6)
        val fim = cal.time
        return Pair(inicio, fim)
    }

    private fun chaveDia(dataHora: String): String {
        return dataHora.trim().split(" ").firstOrNull() ?: dataHora
    }

    private fun calcularRitmoMedio(regs: List<CardioRegistro>): String? {
        val segs = regs.mapNotNull { parseRitmoParaSegundos(it.ritmo) }
        if (segs.isEmpty()) return null
        val media = segs.average().toInt()
        return formatarSegundosComoRitmo(media)
    }

    private fun parseRitmoParaSegundos(ritmo: String): Int? {
        val s = ritmo.trim()
        if (!s.contains(":")) return null
        val parte = s.split("/")[0]
        val p = parte.split(":")
        if (p.size != 2) return null
        val min = p[0].toIntOrNull() ?: return null
        val seg = p[1].toIntOrNull() ?: return null
        if (seg !in 0..59) return null
        return min * 60 + seg
    }

    private fun formatarSegundosComoRitmo(totalSeg: Int): String {
        val m = totalSeg / 60
        val s = totalSeg % 60
        return String.format(Locale.getDefault(), "%d:%02d/km", m, s)
    }

    private fun formatarMinutos(totalMin: Int): String {
        val h = totalMin / 60
        val m = totalMin % 60
        return if (h > 0) "${h}h ${m}min" else "${m} min"
    }
}
