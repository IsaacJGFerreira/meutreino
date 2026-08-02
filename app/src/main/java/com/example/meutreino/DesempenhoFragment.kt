package com.example.meutreino

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.AutoCompleteTextView
import android.widget.GridLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
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
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

class DesempenhoFragment : Fragment() {

    private enum class Metric { LOAD, REPETITIONS, VOLUME }

    private var meuRole: String = "ALUNO"
    private lateinit var adapter: TreinosSalvosAdapter
    private var listaCompleta: List<TreinoRegistro> = emptyList()
    private var selectedWorkout = ""
    private var selectedExercise = ""
    private var selectedMetric = Metric.LOAD

    private lateinit var actWorkout: AutoCompleteTextView
    private lateinit var actExercise: AutoCompleteTextView
    private lateinit var chart: LineChart
    private lateinit var tvExercise: TextView
    private lateinit var tvEvolution: TextView
    private lateinit var tvEvolutionNote: TextView
    private lateinit var tvPerson: TextView
    private lateinit var progress: ProgressBar
    private lateinit var emptyBox: View
    private lateinit var emptyText: TextView
    private lateinit var recentRecycler: RecyclerView
    private lateinit var btnViewAll: MaterialButton
    private lateinit var btnLoad: MaterialButton
    private lateinit var btnRepetitions: MaterialButton
    private lateinit var btnVolume: MaterialButton
    private lateinit var btnPreviousMonth: MaterialButton
    private lateinit var btnNextMonth: MaterialButton
    private lateinit var btnAnnualCalendar: MaterialButton
    private lateinit var calendarGrid: GridLayout
    private lateinit var tvCalendarMonth: TextView

    private val calendarCursor = Calendar.getInstance().apply {
        set(Calendar.DAY_OF_MONTH, 1)
        clearTime()
    }
    private val numberFormat = NumberFormat.getNumberInstance(Locale("pt", "BR")).apply {
        maximumFractionDigits = 1
    }

    private val prefsName = "meutreino_prefs"
    private val selectedStudentKey = "selected_student_uid"
    private val selectedStudentNameKey = "selected_student_name"

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        val root = inflater.inflate(R.layout.fragment_desempenho, container, false)
        bindViews(root)
        configureDashboard()
        loadTargetRecords()
        return root
    }

    private fun bindViews(root: View) {
        actWorkout = root.findViewById(R.id.actFiltroTreino)
        actExercise = root.findViewById(R.id.actFiltroExercicio)
        chart = root.findViewById(R.id.chartDesempenho)
        tvExercise = root.findViewById(R.id.tvExercicioSelecionado)
        tvEvolution = root.findViewById(R.id.tvUltimaEvolucao)
        tvEvolutionNote = root.findViewById(R.id.tvUltimaEvolucaoNota)
        tvPerson = root.findViewById(R.id.tvPerformancePerson)
        progress = root.findViewById(R.id.progressDesempenho)
        emptyBox = root.findViewById(R.id.boxVazioDesempenho)
        emptyText = root.findViewById(R.id.tvVazioDesempenho)
        recentRecycler = root.findViewById(R.id.rvTreinosSalvos)
        btnViewAll = root.findViewById(R.id.btnVerTodosTreinos)
        btnLoad = root.findViewById(R.id.btnMetricaCarga)
        btnRepetitions = root.findViewById(R.id.btnMetricaRepeticoes)
        btnVolume = root.findViewById(R.id.btnMetricaVolume)
        btnPreviousMonth = root.findViewById(R.id.btnMesAnterior)
        btnNextMonth = root.findViewById(R.id.btnProximoMes)
        btnAnnualCalendar = root.findViewById(R.id.btnVerCalendarioAnual)
        calendarGrid = root.findViewById(R.id.gridCalendario)
        tvCalendarMonth = root.findViewById(R.id.tvMesCalendario)
    }

    private fun configureDashboard() {
        recentRecycler.layoutManager = LinearLayoutManager(requireContext())
        recentRecycler.isNestedScrollingEnabled = false
        adapter = TreinosSalvosAdapter(emptyList(), ::showWorkoutDetails)
        recentRecycler.adapter = adapter

        actWorkout.setOnClickListener { if (actWorkout.isEnabled) actWorkout.showDropDown() }
        actExercise.setOnClickListener { if (actExercise.isEnabled) actExercise.showDropDown() }
        actWorkout.setOnItemClickListener { parent, _, position, _ ->
            selectedWorkout = parent.getItemAtPosition(position).toString()
            selectedExercise = ""
            updateExerciseOptions()
        }
        actExercise.setOnItemClickListener { parent, _, position, _ ->
            selectedExercise = parent.getItemAtPosition(position).toString()
            updateAnalysis()
        }

        btnLoad.setOnClickListener { selectMetric(Metric.LOAD) }
        btnRepetitions.setOnClickListener { selectMetric(Metric.REPETITIONS) }
        btnVolume.setOnClickListener { selectMetric(Metric.VOLUME) }
        updateMetricButtons()

        btnViewAll.setOnClickListener { showWorkoutHistory() }
        btnPreviousMonth.setOnClickListener {
            calendarCursor.add(Calendar.MONTH, -1)
            renderCalendar()
        }
        btnNextMonth.setOnClickListener {
            calendarCursor.add(Calendar.MONTH, 1)
            renderCalendar()
        }
        btnAnnualCalendar.setOnClickListener { showAnnualCalendar() }

        configureChartBase()
        renderCalendar()
        setLoading(true)
    }

    private fun loadTargetRecords() {
        val user = Firebase.auth.currentUser
        if (user == null) {
            setLoading(false)
            showEmpty("Usuário não logado.")
            return
        }

        Firebase.firestore.collection("users").document(user.uid).get()
            .addOnSuccessListener { document ->
                if (!isAdded || view == null) return@addOnSuccessListener
                meuRole = (document.getString("role") ?: "ALUNO").trim().uppercase(Locale.ROOT)

                if (meuRole == "TREINADOR" || meuRole == "ADMIN") {
                    val prefs = requireContext().getSharedPreferences(prefsName, Context.MODE_PRIVATE)
                    val studentUid = prefs.getString(selectedStudentKey, null)
                    val studentName = prefs.getString(selectedStudentNameKey, null)
                    tvPerson.text = (studentName ?: "ALUNO SELECIONADO").uppercase(Locale.getDefault())

                    if (studentUid.isNullOrBlank()) {
                        setLoading(false)
                        setRecords(emptyList())
                        showEmpty("Selecione um aluno no Perfil para visualizar o desempenho.")
                        return@addOnSuccessListener
                    }
                    loadFromCloud(studentUid)
                } else {
                    tvPerson.text = (document.getString("name") ?: "ALUNO").uppercase(Locale.getDefault())
                    loadStudentCache()
                    loadFromCloud(user.uid)
                }
            }
            .addOnFailureListener {
                if (!isAdded || view == null) return@addOnFailureListener
                meuRole = "ALUNO"
                tvPerson.text = "ALUNO"
                loadStudentCache()
                loadFromCloud(user.uid)
            }
    }

    private fun loadStudentCache() {
        val local = RegistroTreinoRepository.carregarTreinos(requireContext())
            .sortedByDescending(::recordTime)
        if (local.isNotEmpty()) {
            setLoading(false)
            setRecords(local)
        }
    }

    private fun loadFromCloud(targetUid: String) {
        RegistroTreinoFirestoreRepository.listarTreinos(
            uidAlvo = targetUid,
            onOk = { cloudRecords ->
                if (!isAdded || view == null) return@listarTreinos
                val sorted = cloudRecords.sortedByDescending(::recordTime)
                setLoading(false)
                setRecords(sorted)

                if (meuRole == "ALUNO" && Firebase.auth.currentUser?.uid == targetUid) {
                    sorted.forEach { RegistroTreinoRepository.salvarOuAtualizar(requireContext(), it) }
                }
            },
            onErro = { error ->
                if (!isAdded || view == null) return@listarTreinos
                setLoading(false)
                if (listaCompleta.isEmpty()) showEmpty("Não foi possível carregar os registros agora.")
                AppUiFeedback.showToast(
                    requireContext(),
                    "Sem acesso/erro nuvem: ${error.message}",
                    Toast.LENGTH_SHORT
                )
            }
        )
    }

    private fun setRecords(records: List<TreinoRegistro>) {
        listaCompleta = records.sortedByDescending(::recordTime)
        adapter.atualizarLista(listaCompleta.take(3))
        btnViewAll.isEnabled = listaCompleta.isNotEmpty()
        updateWorkoutOptions()
        renderCalendar()
        if (listaCompleta.isEmpty()) showEmpty("Nenhum treino registrado ainda.") else hideEmpty()
    }

    private fun updateWorkoutOptions() {
        val names = listaCompleta
            .distinctBy { normalize(it.nomeTreino) }
            .map { it.nomeTreino }

        if (names.none { sameName(it, selectedWorkout) }) selectedWorkout = names.firstOrNull().orEmpty()
        actWorkout.setAdapter(dropdownAdapter(names))
        actWorkout.setText(selectedWorkout, false)
        actWorkout.isEnabled = names.isNotEmpty()
        updateExerciseOptions()
    }

    private fun updateExerciseOptions() {
        val names = listaCompleta
            .filter { sameName(it.nomeTreino, selectedWorkout) }
            .flatMap { it.exercicios }
            .distinctBy { normalize(it.nomeExercicio) }
            .map { it.nomeExercicio }
            .sortedWith(String.CASE_INSENSITIVE_ORDER)

        if (names.none { sameName(it, selectedExercise) }) selectedExercise = names.firstOrNull().orEmpty()
        actExercise.setAdapter(dropdownAdapter(names))
        actExercise.setText(selectedExercise, false)
        actExercise.isEnabled = names.isNotEmpty()
        updateAnalysis()
    }

    private fun dropdownAdapter(values: List<String>): ArrayAdapter<String> =
        ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, values)

    private fun selectMetric(metric: Metric) {
        selectedMetric = metric
        chart.highlightValue(null)
        updateMetricButtons()
        updateAnalysis()
    }

    private fun updateMetricButtons() {
        styleMetricButton(btnLoad, selectedMetric == Metric.LOAD)
        styleMetricButton(btnRepetitions, selectedMetric == Metric.REPETITIONS)
        styleMetricButton(btnVolume, selectedMetric == Metric.VOLUME)
    }

    private fun styleMetricButton(button: MaterialButton, selected: Boolean) {
        val background = if (selected) R.color.green_primary else R.color.surface_elevated
        val foreground = if (selected) R.color.background_deep else R.color.text_secondary
        button.backgroundTintList = ColorStateList.valueOf(ContextCompat.getColor(requireContext(), background))
        button.setTextColor(ContextCompat.getColor(requireContext(), foreground))
        button.strokeWidth = if (selected) 0 else dp(1)
        button.strokeColor = ColorStateList.valueOf(ContextCompat.getColor(requireContext(), R.color.neon_outline))
    }

    private fun updateAnalysis() {
        tvExercise.text = selectedExercise.ifBlank { "Exercício" }
        val points = buildPerformancePoints()
        updateChart(points)
        updateEvolution(points)
    }

    private fun buildPerformancePoints(): List<PerformanceChartPoint> {
        return listaCompleta
            .filter { sameName(it.nomeTreino, selectedWorkout) }
            .sortedBy(::recordTime)
            .mapNotNull { record ->
                val exercise = record.exercicios.firstOrNull { sameName(it.nomeExercicio, selectedExercise) }
                    ?: return@mapNotNull null
                if (exercise.series.isEmpty()) return@mapNotNull null

                val referenceSeries = exercise.series.maxWithOrNull(
                    compareBy<SerieRegistro> { it.kg }.thenBy { it.reps }
                ) ?: return@mapNotNull null
                val load = referenceSeries.kg.toFloat()
                val repetitions = referenceSeries.reps.toFloat()
                val volume = exercise.series.sumOf { it.kg * it.reps }.toFloat()
                PerformanceChartPoint(
                    dateLabel = shortDate(record),
                    workoutName = record.nomeTreino,
                    load = load,
                    repetitions = repetitions,
                    volume = volume
                )
            }
    }

    private fun configureChartBase() {
        chart.setBackgroundColor(Color.TRANSPARENT)
        chart.description.isEnabled = false
        chart.legend.isEnabled = false
        chart.setDrawBorders(false)
        chart.setNoDataText("Sem registros para este exercício")
        chart.setNoDataTextColor(ContextCompat.getColor(requireContext(), R.color.text_secondary))
        chart.setTouchEnabled(true)
        chart.isDragEnabled = true
        chart.setScaleEnabled(false)
        chart.isHighlightPerTapEnabled = true
        chart.setExtraOffsets(4f, 58f, 8f, 8f)

        chart.xAxis.position = XAxis.XAxisPosition.BOTTOM
        chart.xAxis.granularity = 1f
        chart.xAxis.textColor = ContextCompat.getColor(requireContext(), R.color.chart_label)
        chart.xAxis.textSize = 9f
        chart.xAxis.setDrawAxisLine(false)
        chart.xAxis.setDrawGridLines(true)
        chart.xAxis.gridColor = ContextCompat.getColor(requireContext(), R.color.chart_grid)
        chart.xAxis.setAvoidFirstLastClipping(true)

        chart.axisRight.isEnabled = false
        chart.axisLeft.axisMinimum = 0f
        chart.axisLeft.textColor = ContextCompat.getColor(requireContext(), R.color.chart_label)
        chart.axisLeft.textSize = 9f
        chart.axisLeft.setDrawAxisLine(false)
        chart.axisLeft.setDrawGridLines(true)
        chart.axisLeft.gridColor = ContextCompat.getColor(requireContext(), R.color.chart_grid)
    }

    private fun updateChart(points: List<PerformanceChartPoint>) {
        if (points.isEmpty()) {
            chart.clear()
            chart.invalidate()
            return
        }

        val entries = points.mapIndexed { index, point ->
            Entry(index.toFloat(), metricValue(point), point)
        }
        val green = ContextCompat.getColor(requireContext(), R.color.green_primary)
        val dataSet = LineDataSet(entries, metricName()).apply {
            color = green
            lineWidth = 3f
            setDrawValues(false)
            setDrawCircles(true)
            setCircleColor(green)
            circleRadius = 5f
            circleHoleRadius = 2.2f
            circleHoleColor = ContextCompat.getColor(requireContext(), R.color.surface)
            setDrawFilled(true)
            fillColor = green
            fillAlpha = 38
            highLightColor = green
            highlightLineWidth = 1.5f
            setDrawHorizontalHighlightIndicator(false)
        }

        chart.data = LineData(dataSet)
        chart.xAxis.valueFormatter = IndexAxisValueFormatter(points.map { it.dateLabel })
        chart.xAxis.labelCount = minOf(points.size, 6)
        chart.axisLeft.valueFormatter = object : ValueFormatter() {
            override fun getFormattedValue(value: Float): String {
                return when (selectedMetric) {
                    Metric.LOAD -> "${compactNumber(value)} kg"
                    Metric.REPETITIONS -> compactNumber(value)
                    Metric.VOLUME -> compactNumber(value)
                }
            }
        }
        chart.marker = PerformanceMarkerView(requireContext(), R.layout.marker_desempenho)
        chart.setVisibleXRangeMaximum(7f)
        chart.notifyDataSetChanged()
        chart.invalidate()
        if (points.size > 7) chart.moveViewToX((points.lastIndex).toFloat())
    }

    private fun updateEvolution(points: List<PerformanceChartPoint>) {
        if (points.isEmpty()) {
            tvEvolution.text = "—"
            tvEvolutionNote.text = "Sem registros para comparar"
            tvEvolution.setTextColor(ContextCompat.getColor(requireContext(), R.color.text_secondary))
            return
        }

        val current = metricValue(points.last())
        if (points.size == 1) {
            tvEvolution.text = formatMetric(current)
            tvEvolutionNote.text = "Primeiro registro deste exercício"
            tvEvolution.setTextColor(ContextCompat.getColor(requireContext(), R.color.text_primary))
            return
        }

        val difference = current - metricValue(points[points.lastIndex - 1])
        val prefix = when {
            difference > 0f -> "+"
            difference < 0f -> "−"
            else -> ""
        }
        tvEvolution.text = "$prefix${formatMetric(kotlin.math.abs(difference))}"
        tvEvolutionNote.text = "em relação ao registro anterior"
        val color = when {
            difference > 0f -> R.color.green_primary
            difference < 0f -> R.color.ex_input_low_text
            else -> R.color.text_primary
        }
        tvEvolution.setTextColor(ContextCompat.getColor(requireContext(), color))
    }

    private fun metricValue(point: PerformanceChartPoint): Float = when (selectedMetric) {
        Metric.LOAD -> point.load
        Metric.REPETITIONS -> point.repetitions
        Metric.VOLUME -> point.volume
    }

    private fun metricName(): String = when (selectedMetric) {
        Metric.LOAD -> "Carga"
        Metric.REPETITIONS -> "Repetições"
        Metric.VOLUME -> "Volume"
    }

    private fun formatMetric(value: Float): String = when (selectedMetric) {
        Metric.LOAD -> "${numberFormat.format(value)} kg"
        Metric.REPETITIONS -> "${numberFormat.format(value)} reps"
        Metric.VOLUME -> "${numberFormat.format(value)} kg·rep"
    }

    private fun compactNumber(value: Float): String {
        if (value < 1000f) return numberFormat.format(value)
        return "${numberFormat.format(value / 1000f)}k"
    }

    private fun showWorkoutDetails(record: TreinoRegistro) {
        val details = buildString {
            append("Data: ${record.dataHora}\n")
            append("Status: ${if (record.completo) "Completo" else "Incompleto"}\n\n")
            record.exercicios.forEach { exercise ->
                append("• ${exercise.nomeExercicio}\n")
                exercise.series.forEach { series ->
                    append("   Série ${series.serieNumero}: ${numberFormat.format(series.kg)} kg × ${series.reps} repetições\n")
                }
                append("\n")
            }
        }

        AppUiFeedback.dialogBuilder(requireContext())
            .setTitle(record.nomeTreino)
            .setMessage(details)
            .setPositiveButton("Fechar", null)
            .show()
    }

    private fun showWorkoutHistory(dayKey: String? = null) {
        val items = if (dayKey == null) {
            listaCompleta
        } else {
            listaCompleta.filter { recordDayKey(it) == dayKey }
        }
        if (items.isEmpty()) {
            AppUiFeedback.showToast(requireContext(), "Nenhum treino encontrado.", Toast.LENGTH_SHORT)
            return
        }

        val recycler = RecyclerView(requireContext()).apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = TreinosSalvosAdapter(items, ::showWorkoutDetails)
            setPadding(dp(12), dp(8), dp(12), dp(8))
            minimumHeight = dp(300)
        }
        val title = if (dayKey == null) "Todos os treinos" else "Treinos de ${formatDayKey(dayKey)}"
        AppUiFeedback.dialogBuilder(requireContext())
            .setTitle(title)
            .setView(recycler)
            .setNegativeButton("Fechar", null)
            .show()
    }

    private fun renderCalendar() {
        if (!::calendarGrid.isInitialized) return
        tvCalendarMonth.text = capitalizeMonth(
            SimpleDateFormat("MMMM yyyy", Locale("pt", "BR")).format(calendarCursor.time)
        )
        calendarGrid.removeAllViews()
        val weekdays = listOf("SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM")
        weekdays.forEachIndexed { column, day ->
            calendarGrid.addView(calendarLabel(day, column, 0, header = true))
        }

        val trainedDays = listaCompleta.mapNotNull(::recordDayKey).toSet()
        val todayKey = dateKey(Calendar.getInstance().time)
        val first = calendarCursor.clone() as Calendar
        first.set(Calendar.DAY_OF_MONTH, 1)
        val offset = (first.get(Calendar.DAY_OF_WEEK) + 5) % 7
        val gridStart = first.clone() as Calendar
        gridStart.add(Calendar.DAY_OF_MONTH, -offset)

        repeat(42) { index ->
            val day = gridStart.clone() as Calendar
            day.add(Calendar.DAY_OF_MONTH, index)
            val key = dateKey(day.time)
            val trained = key in trainedDays
            val outside = day.get(Calendar.MONTH) != calendarCursor.get(Calendar.MONTH)
            val label = calendarLabel(day.get(Calendar.DAY_OF_MONTH).toString(), index % 7, index / 7 + 1, header = false)
            label.setTextColor(
                ContextCompat.getColor(
                    requireContext(),
                    when {
                        trained -> R.color.text_primary
                        key == todayKey -> R.color.green_primary
                        outside -> R.color.text_muted
                        else -> R.color.text_secondary
                    }
                )
            )
            label.alpha = if (outside && !trained) 0.55f else 1f
            if (trained) {
                label.setBackgroundResource(R.drawable.bg_calendar_trained)
                label.contentDescription = "${formatDate(day.time)} — treino realizado"
                label.isClickable = true
                label.isFocusable = true
                label.setOnClickListener { showWorkoutHistory(key) }
            }
            calendarGrid.addView(label)
        }
    }

    private fun calendarLabel(text: String, column: Int, row: Int, header: Boolean): TextView {
        return TextView(requireContext()).apply {
            this.text = text
            gravity = Gravity.CENTER
            textSize = if (header) 9f else 12f
            if (header) setTextColor(ContextCompat.getColor(requireContext(), R.color.text_muted))
            layoutParams = GridLayout.LayoutParams().apply {
                width = 0
                height = dp(if (header) 30 else 40)
                columnSpec = GridLayout.spec(column, 1f)
                rowSpec = GridLayout.spec(row)
                setMargins(dp(1), dp(1), dp(1), dp(1))
            }
        }
    }

    private fun showAnnualCalendar() {
        var visibleYear = calendarCursor.get(Calendar.YEAR)
        val content = LinearLayout(requireContext()).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(10), dp(4), dp(10), dp(12))
        }
        val navigation = LinearLayout(requireContext()).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val previous = compactNavigationButton("‹")
        val yearLabel = TextView(requireContext()).apply {
            gravity = Gravity.CENTER
            setTextColor(ContextCompat.getColor(requireContext(), R.color.text_primary))
            textSize = 19f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(0, dp(48), 1f)
        }
        val next = compactNavigationButton("›")
        navigation.addView(previous)
        navigation.addView(yearLabel)
        navigation.addView(next)
        content.addView(navigation)

        val yearGrid = GridLayout(requireContext()).apply {
            columnCount = 2
            orientation = GridLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }
        content.addView(yearGrid)
        val scroll = ScrollView(requireContext()).apply { addView(content) }

        var closeDialog: (() -> Unit)? = null
        fun rebuildYear() {
            yearLabel.text = visibleYear.toString()
            yearGrid.removeAllViews()
            repeat(12) { month ->
                yearGrid.addView(buildMiniMonth(visibleYear, month) {
                    calendarCursor.set(Calendar.YEAR, visibleYear)
                    calendarCursor.set(Calendar.MONTH, month)
                    calendarCursor.set(Calendar.DAY_OF_MONTH, 1)
                    renderCalendar()
                    closeDialog?.invoke()
                })
            }
        }
        previous.setOnClickListener { visibleYear -= 1; rebuildYear() }
        next.setOnClickListener { visibleYear += 1; rebuildYear() }
        rebuildYear()

        val dialog = AppUiFeedback.dialogBuilder(requireContext())
            .setTitle("Calendário anual")
            .setView(scroll)
            .setNegativeButton("Fechar", null)
            .create()
        closeDialog = { dialog.dismiss() }
        dialog.show()
    }

    private fun buildMiniMonth(year: Int, month: Int, onClick: () -> Unit): View {
        val container = LinearLayout(requireContext()).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(7), dp(8), dp(7), dp(9))
            setBackgroundResource(R.drawable.bg_neon_card)
            isClickable = true
            isFocusable = true
            setOnClickListener { onClick() }
            layoutParams = GridLayout.LayoutParams().apply {
                width = 0
                height = ViewGroup.LayoutParams.WRAP_CONTENT
                columnSpec = GridLayout.spec(month % 2, 1f)
                rowSpec = GridLayout.spec(month / 2)
                setMargins(dp(4), dp(4), dp(4), dp(4))
            }
        }
        val cursor = Calendar.getInstance().apply {
            set(year, month, 1, 0, 0, 0)
            set(Calendar.MILLISECOND, 0)
        }
        container.addView(TextView(requireContext()).apply {
            text = capitalizeMonth(SimpleDateFormat("MMMM", Locale("pt", "BR")).format(cursor.time))
            gravity = Gravity.CENTER
            setTextColor(ContextCompat.getColor(requireContext(), R.color.text_primary))
            textSize = 12f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(28))
        })

        val miniGrid = GridLayout(requireContext()).apply {
            columnCount = 7
            orientation = GridLayout.HORIZONTAL
        }
        val trained = listaCompleta.mapNotNull(::recordDayKey).toSet()
        val offset = (cursor.get(Calendar.DAY_OF_WEEK) + 5) % 7
        val days = cursor.getActualMaximum(Calendar.DAY_OF_MONTH)
        repeat(offset + days) { index ->
            val day = index - offset + 1
            miniGrid.addView(TextView(requireContext()).apply {
                text = if (day > 0) day.toString() else ""
                gravity = Gravity.CENTER
                textSize = 8f
                setTextColor(ContextCompat.getColor(requireContext(), R.color.text_muted))
                if (day > 0) {
                    cursor.set(Calendar.DAY_OF_MONTH, day)
                    if (dateKey(cursor.time) in trained) {
                        setBackgroundResource(R.drawable.bg_calendar_trained)
                        setTextColor(ContextCompat.getColor(requireContext(), R.color.text_primary))
                    }
                }
                layoutParams = GridLayout.LayoutParams().apply {
                    width = 0
                    height = dp(22)
                    columnSpec = GridLayout.spec(index % 7, 1f)
                    rowSpec = GridLayout.spec(index / 7)
                }
            })
        }
        container.addView(miniGrid)
        return container
    }

    private fun compactNavigationButton(label: String): MaterialButton {
        return MaterialButton(requireContext()).apply {
            text = label
            textSize = 22f
            setTextColor(ContextCompat.getColor(requireContext(), R.color.green_primary))
            backgroundTintList = ColorStateList.valueOf(ContextCompat.getColor(requireContext(), R.color.surface_elevated))
            cornerRadius = dp(22)
            insetTop = 0
            insetBottom = 0
            layoutParams = LinearLayout.LayoutParams(dp(44), dp(44))
        }
    }

    private fun setLoading(loading: Boolean) {
        progress.visibility = if (loading) View.VISIBLE else View.GONE
        if (loading) emptyBox.visibility = View.GONE
    }

    private fun showEmpty(message: String) {
        emptyText.text = message
        emptyBox.visibility = View.VISIBLE
    }

    private fun hideEmpty() {
        emptyBox.visibility = View.GONE
    }

    private fun recordTime(record: TreinoRegistro): Long = parseDate(record.dataHora)?.time ?: 0L

    private fun parseDate(value: String): Date? {
        val formats = listOf("dd/MM/yyyy HH:mm", "dd/MM/yyyy")
        return formats.firstNotNullOfOrNull { pattern ->
            runCatching {
                SimpleDateFormat(pattern, Locale("pt", "BR")).apply { isLenient = false }.parse(value)
            }.getOrNull()
        }
    }

    private fun shortDate(record: TreinoRegistro): String {
        val date = parseDate(record.dataHora) ?: return record.dataHora.take(8)
        return SimpleDateFormat("dd/MM/yy", Locale("pt", "BR")).format(date)
    }

    private fun recordDayKey(record: TreinoRegistro): String? = parseDate(record.dataHora)?.let(::dateKey)

    private fun dateKey(date: Date): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(date)

    private fun formatDate(date: Date): String = SimpleDateFormat("dd/MM/yyyy", Locale("pt", "BR")).format(date)

    private fun formatDayKey(key: String): String {
        val date = runCatching { SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(key) }.getOrNull()
        return if (date == null) key else formatDate(date)
    }

    private fun capitalizeMonth(value: String): String {
        if (value.isBlank()) return value
        return value.substring(0, 1).uppercase(Locale("pt", "BR")) + value.substring(1)
    }

    private fun normalize(value: String): String = value.trim().lowercase(Locale.getDefault())

    private fun sameName(first: String, second: String): Boolean = normalize(first) == normalize(second)

    private fun Calendar.clearTime() {
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).roundToInt()
}
