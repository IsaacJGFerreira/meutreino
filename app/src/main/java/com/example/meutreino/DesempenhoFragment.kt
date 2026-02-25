package com.example.meutreino

import android.app.AlertDialog
import android.content.Context
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.AutoCompleteTextView
import android.widget.EditText
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.github.mikephil.charting.charts.LineChart
import com.github.mikephil.charting.components.XAxis
import com.github.mikephil.charting.data.Entry
import com.github.mikephil.charting.data.LineData
import com.github.mikephil.charting.data.LineDataSet
import com.github.mikephil.charting.formatter.IndexAxisValueFormatter
import com.github.mikephil.charting.formatter.ValueFormatter
import com.google.android.material.button.MaterialButton
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import java.text.SimpleDateFormat
import java.util.Locale

class DesempenhoFragment : Fragment() {
    private var meuRole: String = "ALUNO"

    private lateinit var adapter: TreinosSalvosAdapter
    private var listaCompleta: List<TreinoRegistro> = emptyList()

    private val PREFS = "meutreino_prefs"
    private val KEY_SELECTED_STUDENT = "selected_student_uid"

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {

        val view = inflater.inflate(R.layout.fragment_desempenho, container, false)

        val rv = view.findViewById<RecyclerView>(R.id.rvTreinosSalvos)
        rv.layoutManager = LinearLayoutManager(requireContext())

        val etBuscar = view.findViewById<EditText>(R.id.etBuscarExercicio)
        val btnGrafico = view.findViewById<MaterialButton>(R.id.btnGrafico)

        adapter = TreinosSalvosAdapter(listaCompleta) { treino ->
            val termo = etBuscar.text.toString().trim()
            mostrarDetalhesTreino(treino, termo)
        }
        rv.adapter = adapter

        // filtro
        etBuscar.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                filtrarLista(s?.toString()?.trim().orEmpty())
            }
        })

        btnGrafico.setOnClickListener { escolherExercicioEExibirGrafico() }

        // ----------------------------
        // LÓGICA PRINCIPAL (ALUNO vs TREINADOR)
        // ----------------------------
        val user = Firebase.auth.currentUser
        if (user == null) {
            Toast.makeText(requireContext(), "Usuário não logado.", Toast.LENGTH_SHORT).show()
            return view
        }

        Firebase.firestore.collection("users").document(user.uid).get()
            .addOnSuccessListener { doc ->
                val role = (doc.getString("role") ?: "ALUNO").trim().uppercase()
                meuRole = role

                if (role == "TREINADOR" || role == "ADMIN") {

                    // treinador: precisa de aluno selecionado
                    val prefs = requireContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    val alunoUid = prefs.getString(KEY_SELECTED_STUDENT, null)

                    if (alunoUid.isNullOrBlank()) {
                        Toast.makeText(requireContext(), "Selecione um aluno no Perfil.", Toast.LENGTH_SHORT).show()
                        setLista(emptyList())
                        return@addOnSuccessListener
                    }

                    // treinador: SÓ NUVEM
                    carregarDaNuvem(uidAlvo = alunoUid)

                } else {
                    // aluno: LOCAL primeiro
                    carregarLocalAluno()

                    // depois nuvem (sincroniza a lista)
                    carregarDaNuvem(uidAlvo = user.uid)
                }
            }
            .addOnFailureListener {
                // fallback: assume aluno
                carregarLocalAluno()
                carregarDaNuvem(uidAlvo = user.uid)
            }

        return view
    }

    // ----------------------------
    // ALUNO: local offline
    // ----------------------------
    private fun carregarLocalAluno() {
        // seu repositório local existente
        listaCompleta = RegistroTreinoRepository.carregarTreinos(requireContext()).reversed()
        setLista(listaCompleta)
    }

    // ----------------------------
    // NUVEM
    // ----------------------------
    private fun carregarDaNuvem(uidAlvo: String) {
        RegistroTreinoFirestoreRepository.listarTreinos(
            uidAlvo = uidAlvo,
            onOk = { nuvem ->
                // mais recentes primeiro
                listaCompleta = nuvem.sortedByDescending { it.dataHora }
                setLista(listaCompleta)

// ✅ Se for ALUNO (e estiver carregando o próprio UID), salva cache local (offline)
                val userUid = Firebase.auth.currentUser?.uid
                if (meuRole == "ALUNO" && userUid == uidAlvo) {
                    // grava/atualiza cada treino no local
                    listaCompleta.forEach { treino ->
                        RegistroTreinoRepository.salvarOuAtualizar(requireContext(), treino)
                    }
                }

                // ⚠️ IMPORTANTE:
                // aqui a gente NÃO salva local ainda pra evitar quebrar compile
                // (vamos fazer no refinamento, quando você me mandar o RegistroTreinoRepository completo)
            },
            onErro = { e ->
                Toast.makeText(requireContext(), "Sem acesso/erro nuvem: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        )
    }

    private fun setLista(nova: List<TreinoRegistro>) {
        adapter.atualizarLista(nova)
    }

    private fun filtrarLista(termo: String) {
        if (termo.isBlank()) {
            adapter.atualizarLista(listaCompleta)
            return
        }

        val filtrada = listaCompleta.filter { treino ->
            treino.nomeTreino.contains(termo, ignoreCase = true) ||
                    treino.exercicios.any { it.nomeExercicio.contains(termo, ignoreCase = true) }
        }

        adapter.atualizarLista(filtrada)
    }

    private fun mostrarDetalhesTreino(treino: TreinoRegistro, termo: String) {
        val status = if (treino.completo) "✅ Completo" else "⚠️ Incompleto"

        val detalhes = StringBuilder()
        detalhes.append("Treino: ${treino.nomeTreino}\n")
        detalhes.append("Data: ${treino.dataHora}\n")
        detalhes.append("Status: $status\n\n")

        val termoAtivo = termo.isNotBlank()

        treino.exercicios.forEach { ex ->
            if (termoAtivo && !ex.nomeExercicio.contains(termo, ignoreCase = true)) return@forEach

            detalhes.append("• ${ex.nomeExercicio}\n")
            ex.series.forEach { s ->
                detalhes.append("   Série ${s.serieNumero}: ${s.kg} kg x ${s.reps} reps\n")
            }
            detalhes.append("\n")
        }

        AlertDialog.Builder(requireContext())
            .setTitle("Detalhes do treino")
            .setMessage(detalhes.toString())
            .setPositiveButton("OK", null)
            .show()
    }

    // =========================
    // GRÁFICO
    // =========================
    private fun escolherExercicioEExibirGrafico() {
        val nomes = listaCompleta
            .flatMap { it.exercicios.map { ex -> ex.nomeExercicio } }
            .distinct()
            .sorted()

        if (nomes.isEmpty()) {
            Toast.makeText(requireContext(), "Nenhum treino ainda.", Toast.LENGTH_SHORT).show()
            return
        }

        val input = AutoCompleteTextView(requireContext())
        input.hint = "Digite ou escolha o exercício"
        val ad = android.widget.ArrayAdapter(requireContext(), android.R.layout.simple_list_item_1, nomes)
        input.setAdapter(ad)
        input.threshold = 0
        input.setOnClickListener { input.showDropDown() }
        input.setOnFocusChangeListener { _, hasFocus -> if (hasFocus) input.showDropDown() }

        AlertDialog.Builder(requireContext())
            .setTitle("Escolha o exercício")
            .setView(input)
            .setPositiveButton("Ver gráfico") { _, _ ->
                val nome = input.text.toString().trim()
                if (nome.isBlank()) {
                    Toast.makeText(requireContext(), "Escolha um exercício.", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                mostrarGraficoExercicio(nome)
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private data class SerieGrafico(val entries: List<Entry>, val labels: List<String>)

    private fun montarSerieMaiorPesoPorTreino(nomeExercicio: String): SerieGrafico {
        val fmtIn = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
        val fmtDia = SimpleDateFormat("dd/MM/yy", Locale.getDefault())

        val treinosComEx = listaCompleta
            .filter { t -> t.exercicios.any { it.nomeExercicio.equals(nomeExercicio, true) } }
            .sortedBy { t ->
                runCatching { fmtIn.parse(t.dataHora)?.time ?: Long.MAX_VALUE }.getOrDefault(Long.MAX_VALUE)
            }

        val labels = mutableListOf<String>()
        val entries = mutableListOf<Entry>()
        val contadorPorDia = mutableMapOf<String, Int>()

        treinosComEx.forEachIndexed { index, treino ->
            val ex = treino.exercicios.first { it.nomeExercicio.equals(nomeExercicio, true) }
            val maiorPeso = ex.series.maxOfOrNull { it.kg } ?: return@forEachIndexed

            val data = runCatching { fmtIn.parse(treino.dataHora) }.getOrNull()
            val diaStr = if (data != null) fmtDia.format(data) else treino.dataHora.take(8)

            val num = (contadorPorDia[diaStr] ?: 0) + 1
            contadorPorDia[diaStr] = num

            labels.add("$diaStr - ${num}º treino")
            entries.add(Entry(index.toFloat(), maiorPeso.toFloat()))
        }

        return SerieGrafico(entries, labels)
    }

    private fun mostrarGraficoExercicio(nomeExercicio: String) {
        val pontos = montarSerieMaiorPesoPorTreino(nomeExercicio)

        if (pontos.entries.isEmpty()) {
            Toast.makeText(requireContext(), "Sem dados para \"$nomeExercicio\".", Toast.LENGTH_SHORT).show()
            return
        }

        val graficoView = layoutInflater.inflate(R.layout.dialog_grafico, null)
        val chart = graficoView.findViewById<LineChart>(R.id.lineChart)
        val tvResumo = graficoView.findViewById<android.widget.TextView>(R.id.tvResumoGrafico)

        val tvTitulo = graficoView.findViewById<android.widget.TextView?>(R.id.tvTituloGrafico)
        tvTitulo?.text = "Evolução: $nomeExercicio"

        val pesos = pontos.entries.map { it.y }
        val ultimoPeso = pesos.last()
        val melhorPeso = pesos.maxOrNull() ?: ultimoPeso

        tvResumo.setTextColor(android.graphics.Color.BLACK)
        tvResumo.alpha = 0.85f
        tvResumo.text = """
Exercício: $nomeExercicio
Último: ${String.format("%.1f", ultimoPeso)} kg
Melhor: ${String.format("%.1f", melhorPeso)} kg
""".trimIndent()

        val dataSet = LineDataSet(pontos.entries, null)
        val verde = ContextCompat.getColor(requireContext(), R.color.green_primary)
        dataSet.color = verde
        dataSet.lineWidth = 3f
        dataSet.setDrawValues(false)
        dataSet.setDrawCircles(true)
        dataSet.setCircleColor(verde)
        dataSet.circleRadius = 5f
        dataSet.setDrawCircleHole(false)
        dataSet.setDrawFilled(true)
        dataSet.fillColor = verde
        dataSet.fillAlpha = 60

        chart.data = LineData(dataSet)

        chart.setBackgroundColor(ContextCompat.getColor(requireContext(), R.color.surface))
        chart.setDrawBorders(false)
        chart.description.isEnabled = false
        chart.legend.isEnabled = false

        chart.setTouchEnabled(true)
        chart.isDragEnabled = true
        chart.setScaleEnabled(false)

        chart.xAxis.position = XAxis.XAxisPosition.BOTTOM
        chart.xAxis.granularity = 1f
        chart.xAxis.valueFormatter = IndexAxisValueFormatter(pontos.labels)
        chart.xAxis.textColor = android.graphics.Color.DKGRAY
        chart.xAxis.textSize = 10f
        chart.xAxis.setDrawAxisLine(false)
        chart.xAxis.setDrawGridLines(true)
        chart.xAxis.gridColor = ContextCompat.getColor(requireContext(), R.color.chart_grid)
        chart.xAxis.labelRotationAngle = -35f
        chart.xAxis.setAvoidFirstLastClipping(true)

        chart.axisRight.isEnabled = false
        chart.axisLeft.textColor = android.graphics.Color.DKGRAY
        chart.axisLeft.textSize = 10f
        chart.axisLeft.setDrawAxisLine(false)
        chart.axisLeft.setDrawGridLines(true)
        chart.axisLeft.gridColor = ContextCompat.getColor(requireContext(), R.color.chart_grid)
        chart.axisLeft.valueFormatter = object : ValueFormatter() {
            override fun getFormattedValue(value: Float): String = "${String.format("%.0f", value)} kg"
        }

        chart.animateX(400)
        chart.invalidate()

        val dialog = AlertDialog.Builder(requireContext())
            .setView(graficoView)
            .setPositiveButton("OK", null)
            .create()

        dialog.setOnShowListener {
            dialog.window?.setBackgroundDrawable(
                android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT)
            )
        }

        dialog.show()
    }
}
