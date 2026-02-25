package com.example.meutreino

import android.app.AlertDialog
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
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
import com.google.firebase.auth.ktx.auth
import com.google.firebase.ktx.Firebase
import java.text.SimpleDateFormat
import java.util.Locale
import com.google.firebase.firestore.ktx.firestore


class ProgressoFragment : Fragment() {

    private lateinit var lista: MutableList<ProgressoRegistro>
    private lateinit var progressoAdapter: ProgressoAdapter
    private lateinit var chartPeso: LineChart

    private var meuRole: String = "ALUNO"

    private fun prefs() =
        requireContext().getSharedPreferences("meutreino_prefs", Context.MODE_PRIVATE)

    private fun uidSelecionado(): String? =
        prefs().getString("selected_student_uid", null)

    private fun nomeSelecionado(): String? =
        prefs().getString("selected_student_name", null)

    private fun isTreinador(): Boolean = meuRole == "TREINADOR"

    private fun uidAlvo(): String? {
        val user = Firebase.auth.currentUser ?: return null
        return if (isTreinador()) uidSelecionado() else user.uid
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {

        val view = inflater.inflate(R.layout.fragment_progresso, container, false)

        chartPeso = view.findViewById(R.id.chartPeso)
        val btnRegistrar = view.findViewById<Button>(R.id.btnAbrirRegistroProgresso)
        val rv = view.findViewById<RecyclerView>(R.id.rvProgresso)

        rv.layoutManager = LinearLayoutManager(requireContext())
        lista = mutableListOf()

        progressoAdapter = ProgressoAdapter(
            lista,
            onClick = { pos -> abrirComparacao(pos) },
            onLongClick = { pos ->
                if (isTreinador()) {
                    AppUiFeedback.showToast(requireContext(), "Treinador só pode visualizar.", Toast.LENGTH_SHORT)
                } else {
                    confirmarApagar(pos)
                }
            }
        )
        rv.adapter = progressoAdapter

        val user = Firebase.auth.currentUser
        if (user == null) {
            AppUiFeedback.showToast(requireContext(), "Faça login novamente.", Toast.LENGTH_SHORT)
            return view
        }

        // 1) Descobre role primeiro (isso resolve o “botão sumiu”)
        Firebase.firestore.collection("users").document(user.uid).get()
            .addOnSuccessListener { doc ->

                meuRole = (doc.getString("role") ?: "ALUNO").trim().uppercase()

                // 2) TREINADOR: exige aluno selecionado
                if (isTreinador()) {
                    btnRegistrar.visibility = View.GONE

                    val alvo = uidSelecionado()
                    if (alvo.isNullOrBlank()) {
                        lista.clear()
                        progressoAdapter.notifyDataSetChanged()
                        atualizarGrafico(lista)
                        AppUiFeedback.showToast(requireContext(), "Selecione um aluno no Perfil.", Toast.LENGTH_SHORT)
                        return@addOnSuccessListener
                    }

                    val nome = nomeSelecionado()
                    val msg = if (nome != null) "Carregando progresso de $nome..." else "Carregando progresso..."
                    AppUiFeedback.showToast(requireContext(), msg, Toast.LENGTH_SHORT)

                    carregarNuvem(uidAlvo = alvo, salvarCacheLocal = false)
                    return@addOnSuccessListener
                }

                // 3) ALUNO: local primeiro (offline)
                btnRegistrar.visibility = View.VISIBLE

                carregarLocalAluno()
                atualizarGrafico(lista)

                // depois nuvem pra atualizar + salvar cache
                carregarNuvem(uidAlvo = user.uid, salvarCacheLocal = true)

                btnRegistrar.setOnClickListener {
                    RegistrarProgressoDialog { registro ->
                        // esse callback só acontece quando salvou na nuvem (seu Dialog atual)
                        lista.add(0, registro)
                        progressoAdapter.notifyDataSetChanged()
                        atualizarGrafico(lista)

                        salvarLocalAluno()

                        AppUiFeedback.showToast(requireContext(), "✅ Progresso salvo!", Toast.LENGTH_SHORT)
                    }.show(parentFragmentManager, "RegistrarProgressoDialog")
                }
            }
            .addOnFailureListener {
                // fallback: assume aluno
                meuRole = "ALUNO"
                btnRegistrar.visibility = View.VISIBLE
                carregarLocalAluno()
                atualizarGrafico(lista)
                carregarNuvem(uidAlvo = user.uid, salvarCacheLocal = true)
            }

        return view
    }

    // ---------------------
    // LOCAL (ALUNO)
    // ---------------------
    private fun carregarLocalAluno() {
        val local = ProgressoRepository.carregar(requireContext())
        lista.clear()
        lista.addAll(local) // já deve estar na ordem que você salvou (mais recente em cima)
        progressoAdapter.notifyDataSetChanged()
    }

    private fun salvarLocalAluno() {
        ProgressoRepository.salvar(requireContext(), lista)
    }

    // ---------------------
    // NUVEM
    // ---------------------
    private fun carregarNuvem(uidAlvo: String, salvarCacheLocal: Boolean) {
        ProgressoFirestoreRepository.carregar(
            uidAlvo = uidAlvo,
            onOk = { nuvem ->
                lista.clear()
                lista.addAll(nuvem)
                progressoAdapter.notifyDataSetChanged()
                atualizarGrafico(lista)

                if (salvarCacheLocal) salvarLocalAluno()
            },
            onErro = { e ->
                AppUiFeedback.showToast(requireContext(), "Erro ao carregar progresso: ${e.message}", Toast.LENGTH_LONG)
            }
        )
    }

    // ✅ GRÁFICO
    private fun atualizarGrafico(registros: List<ProgressoRegistro>) {

        chartPeso.setBackgroundColor(android.graphics.Color.TRANSPARENT)
        chartPeso.setDrawGridBackground(false)
        chartPeso.setTouchEnabled(true)
        chartPeso.isDragEnabled = true
        chartPeso.setScaleEnabled(false)

        chartPeso.description.isEnabled = false
        chartPeso.legend.isEnabled = false

        chartPeso.axisRight.isEnabled = false
        chartPeso.axisLeft.textColor = ContextCompat.getColor(requireContext(), R.color.chart_label)
        chartPeso.axisLeft.gridColor = ContextCompat.getColor(requireContext(), R.color.chart_grid)
        chartPeso.axisLeft.axisLineColor = ContextCompat.getColor(requireContext(), R.color.chart_axis)

        val xAxis = chartPeso.xAxis
        xAxis.position = XAxis.XAxisPosition.BOTTOM
        xAxis.textColor = ContextCompat.getColor(requireContext(), R.color.chart_label)
        xAxis.axisLineColor = ContextCompat.getColor(requireContext(), R.color.chart_axis)
        xAxis.gridColor = android.graphics.Color.TRANSPARENT
        xAxis.granularity = 1f
        xAxis.setDrawGridLines(false)

        if (registros.isEmpty()) {
            chartPeso.clear()
            chartPeso.setNoDataText("Sem dados de peso ainda")
            chartPeso.invalidate()
            return
        }

        val sdf = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())

        val ordenados = registros.sortedBy { r ->
            try { sdf.parse(r.data)?.time ?: 0L } catch (e: Exception) { 0L }
        }

        val labels = ordenados.map { it.data }
        val entries = ordenados.mapIndexed { idx, r ->
            Entry(idx.toFloat(), r.pesoKg.toFloat())
        }

        val verdeApp = ContextCompat.getColor(requireContext(), R.color.green_primary)
        val dataSet = LineDataSet(entries, "Evolução do peso")

        dataSet.color = verdeApp
        dataSet.setCircleColor(verdeApp)
        dataSet.circleHoleColor = android.graphics.Color.WHITE
        dataSet.circleRadius = 4.5f
        dataSet.lineWidth = 2.5f
        dataSet.mode = LineDataSet.Mode.CUBIC_BEZIER
        dataSet.setDrawValues(false)

        dataSet.setDrawFilled(true)
        dataSet.fillColor = verdeApp
        dataSet.fillAlpha = 60

        dataSet.isHighlightEnabled = true
        dataSet.setDrawHighlightIndicators(false)

        chartPeso.data = LineData(dataSet)
        xAxis.valueFormatter = IndexAxisValueFormatter(labels)

        val marker = PesoMarkerView(requireContext(), R.layout.marker_peso, labels)
        marker.chartView = chartPeso
        chartPeso.marker = marker

        chartPeso.animateX(650)
        chartPeso.invalidate()
    }

    private fun confirmarApagar(pos: Int) {
        AppUiFeedback.dialogBuilder(requireContext())
            .setTitle("Apagar progresso")
            .setMessage("Apagar registro de ${lista[pos].data}?")
            .setPositiveButton("Apagar") { _, _ ->
                val id = lista[pos].id
                lista.removeAt(pos)

                progressoAdapter.notifyDataSetChanged()
                atualizarGrafico(lista)

                salvarLocalAluno()

                ProgressoFirestoreRepository.apagar(
                    registroId = id,
                    onOk = {},
                    onErro = { e ->
                        AppUiFeedback.showToast(requireContext(), "Erro ao apagar: ${e.message}", Toast.LENGTH_SHORT)
                    }
                )
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun abrirComparacao(pos: Int) {
        val atual = lista[pos]
        val anterior = if (pos + 1 < lista.size) lista[pos + 1] else null

        val msg = if (anterior == null) {
            "Esse é o primeiro registro.\n\nPeso: ${atual.pesoKg} kg"
        } else {
            val dif = atual.pesoKg - anterior.pesoKg
            val sinal = if (dif >= 0) "+" else ""
            """
Atual: ${atual.data} — ${atual.pesoKg} kg
Anterior: ${anterior.data} — ${anterior.pesoKg} kg

Diferença: $sinal${String.format(Locale.getDefault(), "%.1f", dif)} kg
""".trimIndent()
        }

        AppUiFeedback.dialogBuilder(requireContext())
            .setTitle("Comparação semanal")
            .setMessage(msg)
            .setPositiveButton("OK", null)
            .show()
    }
}
