package com.example.meutreino

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Context
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.GridLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.github.mikephil.charting.charts.LineChart
import com.github.mikephil.charting.charts.PieChart
import com.github.mikephil.charting.components.XAxis
import com.github.mikephil.charting.data.Entry
import com.github.mikephil.charting.data.LineData
import com.github.mikephil.charting.data.LineDataSet
import com.github.mikephil.charting.data.PieData
import com.github.mikephil.charting.data.PieDataSet
import com.github.mikephil.charting.data.PieEntry
import com.github.mikephil.charting.formatter.IndexAxisValueFormatter
import com.google.android.material.button.MaterialButton
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.UUID
import kotlin.math.max
import kotlin.math.min

class CardioFragment : Fragment() {

    companion object {
        private const val DEFAULT_CARDIO_GOAL = 180
        private const val PREFS_NAME = "meutreino_prefs"
        private const val SELECTED_STUDENT_UID = "selected_student_uid"
        private const val SELECTED_STUDENT_NAME = "selected_student_name"
    }

    private var registros: MutableList<CardioRegistro> = mutableListOf()
    private var meuRole = "ALUNO"
    private var targetUid: String? = null
    private var userGoal = DEFAULT_CARDIO_GOAL
    private var metaGoal: Int? = null
    private var userGoalUpdatedAt = 0L
    private var metaGoalUpdatedAt = 0L

    private var cardioListener: ListenerRegistration? = null
    private var userGoalListener: ListenerRegistration? = null
    private var metaGoalListener: ListenerRegistration? = null

    private val weekCursor = Calendar.getInstance().apply { normalizeStartOfDay() }
    private val recordCalendar = Calendar.getInstance()

    private lateinit var tvPerson: TextView
    private lateinit var tvWeek: TextView
    private lateinit var tvWeekTotal: TextView
    private lateinit var tvSessionTotal: TextView
    private lateinit var tvGoalValue: TextView
    private lateinit var tvGoalRemaining: TextView
    private lateinit var tvEmpty: TextView
    private lateinit var previousWeek: MaterialButton
    private lateinit var nextWeek: MaterialButton
    private lateinit var openCalendar: MaterialButton
    private lateinit var openHistory: MaterialButton
    private lateinit var saveCardio: MaterialButton
    private lateinit var form: View
    private lateinit var readOnlyBox: View
    private lateinit var activityInput: EditText
    private lateinit var durationInput: EditText
    private lateinit var paceInput: EditText
    private lateinit var dateInput: EditText
    private lateinit var weekRecycler: RecyclerView
    private lateinit var historyRecycler: RecyclerView
    private lateinit var weekAdapter: DiaCardioAdapter
    private lateinit var historyAdapter: CardioRegistrosAdapter
    private lateinit var evolutionChart: LineChart
    private lateinit var goalChart: PieChart
    private lateinit var goalProgress: ProgressBar

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        val root = inflater.inflate(R.layout.fragment_cardio, container, false)
        bindViews(root)
        configureLists()
        configureCharts()
        configureActions()
        updateRecordDateInput()
        loadRoleAndTarget()
        return root
    }

    private fun bindViews(root: View) {
        tvPerson = root.findViewById(R.id.tvCardioPerson)
        tvWeek = root.findViewById(R.id.tvSemanaAtual)
        tvWeekTotal = root.findViewById(R.id.tvTotalSemana)
        tvSessionTotal = root.findViewById(R.id.tvTotalSessoes)
        tvGoalValue = root.findViewById(R.id.tvMetaCardioValor)
        tvGoalRemaining = root.findViewById(R.id.tvMetaCardioRestante)
        tvEmpty = root.findViewById(R.id.tvCardioVazio)
        previousWeek = root.findViewById(R.id.btnSemanaAnterior)
        nextWeek = root.findViewById(R.id.btnProximaSemana)
        openCalendar = root.findViewById(R.id.btnVerCalendarioCardio)
        openHistory = root.findViewById(R.id.btnVerTodosCardio)
        saveCardio = root.findViewById(R.id.btnSalvarCardio)
        form = root.findViewById(R.id.formRegistrarCardio)
        readOnlyBox = root.findViewById(R.id.boxCardioSomenteLeitura)
        activityInput = root.findViewById(R.id.etAtividadeCardio)
        durationInput = root.findViewById(R.id.etTempoCardio)
        paceInput = root.findViewById(R.id.etRitmoCardio)
        dateInput = root.findViewById(R.id.etDataCardio)
        weekRecycler = root.findViewById(R.id.rvSemana)
        historyRecycler = root.findViewById(R.id.rvRegistrosCardio)
        evolutionChart = root.findViewById(R.id.chartEvolucaoCardio)
        goalChart = root.findViewById(R.id.chartMetaCardio)
        goalProgress = root.findViewById(R.id.progressMetaCardio)
    }

    private fun configureLists() {
        weekAdapter = DiaCardioAdapter(emptyList()) { day -> showDayDetails(day.dataChave) }
        weekRecycler.layoutManager = LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
        weekRecycler.adapter = weekAdapter

        historyAdapter = CardioRegistrosAdapter(
            registros = emptyList(),
            podeApagar = false,
            onClick = ::showRecordDetails,
            onDelete = ::confirmDelete
        )
        historyRecycler.layoutManager = LinearLayoutManager(requireContext())
        historyRecycler.isNestedScrollingEnabled = false
        historyRecycler.adapter = historyAdapter
    }

    private fun configureActions() {
        previousWeek.setOnClickListener {
            weekCursor.add(Calendar.DAY_OF_MONTH, -7)
            renderAll()
        }
        nextWeek.setOnClickListener {
            val next = startOfWeek(weekCursor).apply { add(Calendar.DAY_OF_MONTH, 7) }
            if (!next.after(startOfWeek(Calendar.getInstance()))) {
                weekCursor.add(Calendar.DAY_OF_MONTH, 7)
                renderAll()
            }
        }
        openCalendar.setOnClickListener { showFullCalendar() }
        openHistory.setOnClickListener { showFullHistory() }
        dateInput.setOnClickListener { chooseRecordDateAndTime() }
        saveCardio.setOnClickListener { saveRecord() }
    }

    private fun configureCharts() {
        goalChart.description.isEnabled = false
        goalChart.legend.isEnabled = false
        goalChart.setDrawEntryLabels(false)
        goalChart.setTouchEnabled(false)
        goalChart.setUsePercentValues(false)
        goalChart.holeRadius = 76f
        goalChart.transparentCircleRadius = 0f
        goalChart.setHoleColor(Color.TRANSPARENT)
        goalChart.rotationAngle = 270f
        goalChart.isRotationEnabled = false
        goalChart.setCenterTextColor(ContextCompat.getColor(requireContext(), R.color.text_primary))
        goalChart.setCenterTextSize(14f)

        evolutionChart.setBackgroundColor(Color.TRANSPARENT)
        evolutionChart.description.isEnabled = false
        evolutionChart.legend.isEnabled = false
        evolutionChart.setDrawBorders(false)
        evolutionChart.setNoDataText("Sem cardio nos últimos 7 dias")
        evolutionChart.setNoDataTextColor(ContextCompat.getColor(requireContext(), R.color.text_secondary))
        evolutionChart.setTouchEnabled(true)
        evolutionChart.isDragEnabled = false
        evolutionChart.setScaleEnabled(false)
        evolutionChart.isHighlightPerTapEnabled = true
        evolutionChart.setExtraOffsets(5f, 48f, 10f, 4f)

        evolutionChart.xAxis.position = XAxis.XAxisPosition.BOTTOM
        evolutionChart.xAxis.granularity = 1f
        evolutionChart.xAxis.textColor = ContextCompat.getColor(requireContext(), R.color.chart_label)
        evolutionChart.xAxis.textSize = 9f
        evolutionChart.xAxis.setDrawAxisLine(false)
        evolutionChart.xAxis.setDrawGridLines(true)
        evolutionChart.xAxis.gridColor = ContextCompat.getColor(requireContext(), R.color.chart_grid)

        evolutionChart.axisRight.isEnabled = false
        evolutionChart.axisLeft.axisMinimum = 0f
        evolutionChart.axisLeft.textColor = ContextCompat.getColor(requireContext(), R.color.chart_label)
        evolutionChart.axisLeft.textSize = 9f
        evolutionChart.axisLeft.setDrawAxisLine(false)
        evolutionChart.axisLeft.setDrawGridLines(true)
        evolutionChart.axisLeft.gridColor = ContextCompat.getColor(requireContext(), R.color.chart_grid)
        evolutionChart.marker = CardioMarkerView(requireContext(), R.layout.marker_cardio)
    }

    private fun loadRoleAndTarget() {
        val currentUser = Firebase.auth.currentUser
        if (currentUser == null) {
            showToast("Usuário não logado.")
            renderEmptyTarget()
            return
        }

        Firebase.firestore.collection("users").document(currentUser.uid).get()
            .addOnSuccessListener { document ->
                if (!isViewReady()) return@addOnSuccessListener
                meuRole = (document.getString("role") ?: "ALUNO").trim().uppercase(Locale.ROOT)
                val isStudent = meuRole == "ALUNO"
                form.visibility = if (isStudent) View.VISIBLE else View.GONE
                readOnlyBox.visibility = if (isStudent) View.GONE else View.VISIBLE
                historyAdapter.setCanDelete(isStudent)

                if (isStudent) {
                    targetUid = currentUser.uid
                    tvPerson.text = (document.getString("name") ?: "ALUNO").uppercase(Locale.getDefault())
                    registros = CardioRepository.carregar(requireContext())
                        .sortedByDescending(::recordTime)
                        .toMutableList()
                    renderAll()
                    observeTarget(currentUser.uid)
                } else {
                    val prefs = requireContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    val studentUid = prefs.getString(SELECTED_STUDENT_UID, null)
                    val studentName = prefs.getString(SELECTED_STUDENT_NAME, null)
                    tvPerson.text = (studentName ?: "ALUNO SELECIONADO").uppercase(Locale.getDefault())
                    if (studentUid.isNullOrBlank()) {
                        targetUid = null
                        renderEmptyTarget()
                        showToast("Selecione um aluno no Perfil.")
                    } else {
                        targetUid = studentUid
                        registros.clear()
                        renderAll()
                        observeTarget(studentUid)
                    }
                }
            }
            .addOnFailureListener { error ->
                if (!isViewReady()) return@addOnFailureListener
                Log.e("CARDIO", "Erro ao carregar perfil", error)
                showToast("Não foi possível carregar o perfil agora.")
                renderEmptyTarget()
            }
    }

    private fun observeTarget(uid: String) {
        cardioListener?.remove()
        userGoalListener?.remove()
        metaGoalListener?.remove()

        cardioListener = CardioFirestoreRepository.observar(
            uidAlvo = uid,
            onOk = { cloud ->
                if (!isViewReady() || targetUid != uid) return@observar
                registros = cloud.sortedByDescending(::recordTime).toMutableList()
                renderAll()
                if (meuRole == "ALUNO" && Firebase.auth.currentUser?.uid == uid) {
                    CardioRepository.salvar(requireContext(), registros)
                }
            },
            onErro = { error ->
                if (!isViewReady()) return@observar
                Log.e("CARDIO", "Erro ao observar registros", error)
                showToast("Sem acesso aos registros de cardio agora.")
            }
        )

        userGoal = DEFAULT_CARDIO_GOAL
        metaGoal = null
        userGoalUpdatedAt = 0L
        metaGoalUpdatedAt = 0L
        userGoalListener = Firebase.firestore.collection("users").document(uid)
            .addSnapshotListener { document, error ->
                if (!isViewReady() || targetUid != uid) return@addSnapshotListener
                if (error == null && document != null) {
                    userGoal = readGoal(document) ?: DEFAULT_CARDIO_GOAL
                    userGoalUpdatedAt = readUpdatedAt(document)
                    renderGoal()
                }
            }
        metaGoalListener = Firebase.firestore.collection("users").document(uid)
            .collection("cardio_meta").document("current")
            .addSnapshotListener { document, error ->
                if (!isViewReady() || targetUid != uid) return@addSnapshotListener
                metaGoal = if (error == null && document != null && document.exists()) readGoal(document) else null
                metaGoalUpdatedAt = if (error == null && document != null && document.exists()) readUpdatedAt(document) else 0L
                renderGoal()
            }
    }

    private fun saveRecord() {
        if (meuRole != "ALUNO") {
            showToast("Somente o aluno pode registrar cardio.")
            return
        }
        val uid = Firebase.auth.currentUser?.uid ?: return
        val activity = activityInput.text.toString().trim()
        val duration = durationInput.text.toString().trim().toIntOrNull()
        val pace = paceInput.text.toString().trim().ifBlank { "—" }

        if (activity.isBlank()) {
            activityInput.error = "Informe a atividade"
            return
        }
        if (duration == null || duration <= 0) {
            durationInput.error = "Informe um tempo válido"
            return
        }

        val createdAt = recordCalendar.timeInMillis
        val item = CardioRegistro(
            id = UUID.randomUUID().toString(),
            dataHora = dateTimeFormat().format(Date(createdAt)),
            atividade = activity,
            tempoMin = duration,
            ritmo = pace,
            createdAt = createdAt
        )

        registros.add(item)
        registros.sortByDescending(::recordTime)
        CardioRepository.salvar(requireContext(), registros)
        renderAll()

        CardioFirestoreRepository.salvar(
            uidAlvo = uid,
            registro = item,
            onOk = { if (isViewReady()) showToast("Cardio salvo!") },
            onErro = { error ->
                if (!isViewReady()) return@salvar
                Log.e("CARDIO", "Erro ao salvar", error)
                showToast("Não foi possível sincronizar o cardio.")
            }
        )

        activityInput.text?.clear()
        durationInput.text?.clear()
        paceInput.text?.clear()
        recordCalendar.timeInMillis = System.currentTimeMillis()
        updateRecordDateInput()
    }

    private fun chooseRecordDateAndTime() {
        val context = context ?: return
        DatePickerDialog(
            context,
            { _, year, month, day ->
                recordCalendar.set(Calendar.YEAR, year)
                recordCalendar.set(Calendar.MONTH, month)
                recordCalendar.set(Calendar.DAY_OF_MONTH, day)
                TimePickerDialog(
                    context,
                    { _, hour, minute ->
                        recordCalendar.set(Calendar.HOUR_OF_DAY, hour)
                        recordCalendar.set(Calendar.MINUTE, minute)
                        recordCalendar.set(Calendar.SECOND, 0)
                        recordCalendar.set(Calendar.MILLISECOND, 0)
                        updateRecordDateInput()
                    },
                    recordCalendar.get(Calendar.HOUR_OF_DAY),
                    recordCalendar.get(Calendar.MINUTE),
                    true
                ).show()
            },
            recordCalendar.get(Calendar.YEAR),
            recordCalendar.get(Calendar.MONTH),
            recordCalendar.get(Calendar.DAY_OF_MONTH)
        ).apply { datePicker.maxDate = System.currentTimeMillis() }.show()
    }

    private fun updateRecordDateInput() {
        dateInput.setText(dateTimeFormat().format(recordCalendar.time))
    }

    private fun renderAll() {
        if (!isViewReady()) return
        renderWeek()
        renderChart()
        renderHistory()
    }

    private fun renderWeek() {
        val start = startOfWeek(weekCursor)
        val end = start.clone() as Calendar
        end.add(Calendar.DAY_OF_MONTH, 6)
        tvWeek.text = "Semana ${shortMonthFormat().format(start.time)} – ${shortMonthFormat().format(end.time)}"

        val byDay = registros.groupBy(::recordDateKey)
        val days = mutableListOf<DiaCardioUI>()
        val cursor = start.clone() as Calendar
        repeat(7) {
            val key = dateKeyFormat().format(cursor.time)
            val dayRecords = byDay[key].orEmpty()
            days += DiaCardioUI(
                diaLabel = dayNameFormat().format(cursor.time).replace(".", "").uppercase(Locale.getDefault()),
                dataLabel = shortDateFormat().format(cursor.time),
                dataChave = key,
                totalMin = dayRecords.sumOf { it.tempoMin },
                qtd = dayRecords.size,
                tiposResumo = dayRecords.map { it.atividade }.distinct().joinToString(", ").ifBlank { "—" },
                ritmoMedio = averagePace(dayRecords) ?: "—"
            )
            cursor.add(Calendar.DAY_OF_MONTH, 1)
        }
        weekAdapter.atualizar(days)

        val minutes = days.sumOf { it.totalMin }
        val sessions = days.sumOf { it.qtd }
        tvWeekTotal.text = "Total da semana\n${formatMinutes(minutes)}"
        tvSessionTotal.text = "Total de sessões\n$sessions ${if (sessions == 1) "sessão" else "sessões"}"
        val currentStart = startOfWeek(Calendar.getInstance())
        nextWeek.isEnabled = start.before(currentStart)
        nextWeek.alpha = if (nextWeek.isEnabled) 1f else 0.35f
        renderGoal(minutes)
    }

    private fun renderGoal(minutesOverride: Int? = null) {
        if (!isViewReady()) return
        val goal = resolvedGoal()
        val minutes = minutesOverride ?: minutesForWeek(startOfWeek(weekCursor))
        val remaining = max(0, goal - minutes)
        val percent = if (goal > 0) ((minutes * 100f) / goal).toInt() else 0

        tvGoalValue.text = "$minutes de $goal min"
        tvGoalRemaining.text = if (remaining > 0) "Faltam $remaining min" else "Meta semanal alcançada"
        goalProgress.max = goal
        goalProgress.progress = min(minutes, goal)

        val completed = min(minutes, goal).toFloat()
        val pending = max(goal - minutes, 0).toFloat()
        val dataSet = PieDataSet(
            listOf(PieEntry(completed), PieEntry(pending)),
            "Meta semanal"
        ).apply {
            colors = listOf(
                ContextCompat.getColor(requireContext(), R.color.green_primary),
                ContextCompat.getColor(requireContext(), R.color.divider_dark)
            )
            setDrawValues(false)
            sliceSpace = 2f
        }
        goalChart.centerText = "${min(percent, 999)}%\nda meta"
        goalChart.data = PieData(dataSet)
        goalChart.notifyDataSetChanged()
        goalChart.invalidate()
    }

    private fun renderChart() {
        val start = Calendar.getInstance().apply {
            normalizeStartOfDay()
            add(Calendar.DAY_OF_MONTH, -6)
        }
        val byDay = registros.groupBy(::recordDateKey)
        val points = mutableListOf<CardioChartPoint>()
        val entries = mutableListOf<Entry>()
        val labels = mutableListOf<String>()

        repeat(7) { index ->
            val key = dateKeyFormat().format(start.time)
            val minutes = byDay[key].orEmpty().sumOf { it.tempoMin }
            val point = CardioChartPoint(shortDateFormat().format(start.time), minutes)
            points += point
            entries += Entry(index.toFloat(), minutes.toFloat(), point)
            labels += chartDateFormat().format(start.time).replace(".", "")
            start.add(Calendar.DAY_OF_MONTH, 1)
        }

        val green = ContextCompat.getColor(requireContext(), R.color.green_primary)
        val dataSet = LineDataSet(entries, "Minutos").apply {
            color = green
            lineWidth = 2.5f
            setDrawValues(false)
            setDrawCircles(true)
            setCircleColor(green)
            circleRadius = 4f
            circleHoleRadius = 1.8f
            circleHoleColor = ContextCompat.getColor(requireContext(), R.color.surface)
            setDrawFilled(true)
            fillColor = green
            fillAlpha = 45
            highLightColor = green
            highlightLineWidth = 1.2f
            setDrawHorizontalHighlightIndicator(false)
        }
        evolutionChart.data = LineData(dataSet)
        evolutionChart.xAxis.valueFormatter = IndexAxisValueFormatter(labels)
        evolutionChart.xAxis.labelCount = 7
        evolutionChart.notifyDataSetChanged()
        evolutionChart.invalidate()
    }

    private fun renderHistory() {
        val recent = registros.sortedByDescending(::recordTime).take(4)
        historyAdapter.atualizar(recent)
        tvEmpty.visibility = if (recent.isEmpty()) View.VISIBLE else View.GONE
        historyRecycler.visibility = if (recent.isEmpty()) View.GONE else View.VISIBLE
        openHistory.isEnabled = registros.isNotEmpty()
        openHistory.alpha = if (registros.isNotEmpty()) 1f else 0.4f
    }

    private fun renderEmptyTarget() {
        registros.clear()
        renderAll()
        tvEmpty.text = if (meuRole == "ALUNO") {
            "Nenhum cardio registrado ainda."
        } else {
            "Selecione um aluno no Perfil para visualizar o cardio."
        }
    }

    private fun showRecordDetails(record: CardioRegistro) {
        val context = context ?: return
        AppUiFeedback.dialogBuilder(context)
            .setTitle(record.atividade)
            .setMessage("Data: ${record.dataHora}\nTempo: ${record.tempoMin} min\nRitmo: ${record.ritmo}")
            .setPositiveButton("Fechar", null)
            .show()
    }

    private fun showDayDetails(dateKey: String) {
        val context = context ?: return
        val items = registros.filter { recordDateKey(it) == dateKey }
            .sortedByDescending(::recordTime)
        if (items.isEmpty()) {
            showToast("Sem cardio em $dateKey.")
            return
        }
        val labels = items.map {
            "${it.atividade} · ${it.tempoMin} min · ${it.ritmo}"
        }.toTypedArray()
        AppUiFeedback.dialogBuilder(context)
            .setTitle("Cardio em $dateKey")
            .setItems(labels) { _, position -> showRecordDetails(items[position]) }
            .setNegativeButton("Fechar", null)
            .show()
    }

    private fun confirmDelete(record: CardioRegistro) {
        confirmDelete(record, null)
    }

    private fun confirmDelete(record: CardioRegistro, afterDelete: (() -> Unit)?) {
        val context = context ?: return
        if (meuRole != "ALUNO") return
        AppUiFeedback.dialogBuilder(context)
            .setTitle("Apagar registro?")
            .setMessage("${record.atividade} · ${record.tempoMin} min · ${record.dataHora}")
            .setPositiveButton("Apagar") { _, _ ->
                deleteRecord(record)
                afterDelete?.invoke()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun deleteRecord(record: CardioRegistro) {
        val uid = Firebase.auth.currentUser?.uid ?: return
        registros.removeAll { it.id == record.id }
        CardioRepository.salvar(requireContext(), registros)
        renderAll()
        CardioFirestoreRepository.apagar(
            uidAlvo = uid,
            id = record.id,
            onOk = { if (isViewReady()) showToast("Registro apagado.") },
            onErro = { error ->
                if (!isViewReady()) return@apagar
                Log.e("CARDIO", "Erro ao apagar", error)
                showToast("Não foi possível apagar o registro.")
            }
        )
    }

    private fun showFullHistory() {
        val context = context ?: return
        if (registros.isEmpty()) return
        val recycler = RecyclerView(context).apply {
            layoutManager = LinearLayoutManager(context)
            setPadding(dp(14), dp(8), dp(14), dp(8))
        }
        lateinit var dialogAdapter: CardioRegistrosAdapter
        dialogAdapter = CardioRegistrosAdapter(
            registros = registros.sortedByDescending(::recordTime),
            podeApagar = meuRole == "ALUNO",
            onClick = ::showRecordDetails,
            onDelete = { record ->
                confirmDelete(record) {
                    dialogAdapter.atualizar(registros.sortedByDescending(::recordTime))
                }
            }
        )
        recycler.adapter = dialogAdapter
        AppUiFeedback.dialogBuilder(context)
            .setTitle("Todos os registros")
            .setView(recycler)
            .setNegativeButton("Fechar", null)
            .show()
    }

    private fun showFullCalendar() {
        val context = context ?: return
        val cursor = Calendar.getInstance().apply {
            set(Calendar.DAY_OF_MONTH, 1)
            normalizeStartOfDay()
        }
        val container = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), dp(4), dp(12), dp(8))
        }
        val header = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val previous = MaterialButton(context).apply {
            text = "‹"
            textSize = 24f
            setTextColor(ContextCompat.getColor(context, R.color.green_primary))
            layoutParams = LinearLayout.LayoutParams(dp(48), dp(48))
        }
        val title = TextView(context).apply {
            gravity = Gravity.CENTER
            setTextColor(ContextCompat.getColor(context, R.color.text_primary))
            textSize = 16f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        val next = MaterialButton(context).apply {
            text = "›"
            textSize = 24f
            setTextColor(ContextCompat.getColor(context, R.color.green_primary))
            layoutParams = LinearLayout.LayoutParams(dp(48), dp(48))
        }
        header.addView(previous)
        header.addView(title)
        header.addView(next)
        container.addView(header)

        val grid = GridLayout(context).apply {
            columnCount = 7
            alignmentMode = GridLayout.ALIGN_BOUNDS
            useDefaultMargins = false
        }
        container.addView(grid, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        fun renderMonth() {
            title.text = monthFormat().format(cursor.time).replaceFirstChar { it.uppercase() }
            grid.removeAllViews()
            listOf("SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM").forEach { label ->
                grid.addView(calendarCell(label, active = false, header = true, onClick = null))
            }
            val firstWeekDay = ((cursor.get(Calendar.DAY_OF_WEEK) - Calendar.MONDAY) + 7) % 7
            repeat(firstWeekDay) { grid.addView(calendarCell("", false, false, null)) }
            val maxDay = cursor.getActualMaximum(Calendar.DAY_OF_MONTH)
            val month = cursor.get(Calendar.MONTH)
            val year = cursor.get(Calendar.YEAR)
            repeat(maxDay) { index ->
                val day = index + 1
                val date = Calendar.getInstance().apply {
                    set(year, month, day, 0, 0, 0)
                    set(Calendar.MILLISECOND, 0)
                }
                val key = dateKeyFormat().format(date.time)
                val dayRecords = registros.filter { recordDateKey(it) == key }
                val total = dayRecords.sumOf { it.tempoMin }
                val label = if (total > 0) "$day\n$total min" else day.toString()
                grid.addView(calendarCell(label, total > 0, false) { showDayDetails(key) })
            }
        }

        previous.setOnClickListener {
            cursor.add(Calendar.MONTH, -1)
            renderMonth()
        }
        next.setOnClickListener {
            cursor.add(Calendar.MONTH, 1)
            renderMonth()
        }
        renderMonth()

        AppUiFeedback.dialogBuilder(context)
            .setTitle("Calendário de cardio")
            .setView(container)
            .setNegativeButton("Fechar", null)
            .show()
    }

    private fun calendarCell(
        label: String,
        active: Boolean,
        header: Boolean,
        onClick: (() -> Unit)?
    ): TextView {
        return TextView(requireContext()).apply {
            text = label
            gravity = Gravity.CENTER
            setTextColor(
                ContextCompat.getColor(
                    requireContext(),
                    when {
                        active -> R.color.green_primary
                        header -> R.color.text_secondary
                        else -> R.color.text_primary
                    }
                )
            )
            textSize = if (header) 10f else 11f
            if (header) setTypeface(typeface, android.graphics.Typeface.BOLD)
            if (active) setBackgroundResource(R.drawable.bg_calendar_trained)
            val params = GridLayout.LayoutParams().apply {
                width = 0
                height = dp(if (header) 34 else 56)
                columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
                setMargins(dp(2), dp(2), dp(2), dp(2))
            }
            layoutParams = params
            isClickable = onClick != null
            setOnClickListener { onClick?.invoke() }
        }
    }

    private fun readGoal(document: DocumentSnapshot): Int? {
        return listOf("cardioMetaSemanalMin", "metaSemanalCardioMin", "cardioGoalMin")
            .firstNotNullOfOrNull { key ->
                when (val value = document.get(key)) {
                    is Number -> value.toInt()
                    is String -> value.toIntOrNull()
                    else -> null
                }
            }
            ?.takeIf { it > 0 }
    }

    private fun readUpdatedAt(document: DocumentSnapshot): Long {
        return document.getLong("updatedAt")
            ?: document.getDouble("updatedAt")?.toLong()
            ?: document.getTimestamp("updatedAt")?.toDate()?.time
            ?: 0L
    }

    private fun resolvedGoal(): Int {
        val configGoal = metaGoal?.takeIf { it > 0 }
        if (configGoal != null) {
            val configIsLatest = (metaGoalUpdatedAt == 0L && userGoalUpdatedAt == 0L) ||
                metaGoalUpdatedAt >= userGoalUpdatedAt ||
                userGoalUpdatedAt == 0L
            if (configIsLatest) return configGoal
        }
        return userGoal.takeIf { it > 0 } ?: configGoal ?: DEFAULT_CARDIO_GOAL
    }

    private fun minutesForWeek(start: Calendar): Int {
        val end = start.clone() as Calendar
        end.add(Calendar.DAY_OF_MONTH, 7)
        return registros.filter {
            val time = recordTime(it)
            time >= start.timeInMillis && time < end.timeInMillis
        }.sumOf { it.tempoMin }
    }

    private fun startOfWeek(base: Calendar): Calendar {
        return (base.clone() as Calendar).apply {
            firstDayOfWeek = Calendar.MONDAY
            set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
            normalizeStartOfDay()
        }
    }

    private fun recordDateKey(record: CardioRegistro): String {
        val parsed = recordTime(record)
        return if (parsed > 0L) dateKeyFormat().format(Date(parsed))
        else record.dataHora.trim().substringBefore(" ")
    }

    private fun recordTime(record: CardioRegistro): Long {
        if (record.createdAt > 0L) return record.createdAt
        return runCatching { dateTimeFormat().parse(record.dataHora)?.time ?: 0L }.getOrDefault(0L)
    }

    private fun averagePace(items: List<CardioRegistro>): String? {
        val seconds = items.mapNotNull { paceToSeconds(it.ritmo) }
        if (seconds.isEmpty()) return null
        val average = seconds.average().toInt()
        return String.format(Locale.getDefault(), "%d:%02d/km", average / 60, average % 60)
    }

    private fun paceToSeconds(pace: String): Int? {
        val parts = pace.substringBefore("/").trim().split(":")
        if (parts.size != 2) return null
        val minutes = parts[0].toIntOrNull() ?: return null
        val seconds = parts[1].toIntOrNull() ?: return null
        if (seconds !in 0..59) return null
        return minutes * 60 + seconds
    }

    private fun formatMinutes(minutes: Int): String {
        val hours = minutes / 60
        val remaining = minutes % 60
        return if (hours > 0) "${hours}h ${remaining}min" else "$minutes min"
    }

    private fun dateTimeFormat() = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale("pt", "BR"))
    private fun dateKeyFormat() = SimpleDateFormat("dd/MM/yyyy", Locale("pt", "BR"))
    private fun shortDateFormat() = SimpleDateFormat("dd/MM", Locale("pt", "BR"))
    private fun shortMonthFormat() = SimpleDateFormat("dd MMM", Locale("pt", "BR"))
    private fun dayNameFormat() = SimpleDateFormat("EEE", Locale("pt", "BR"))
    private fun chartDateFormat() = SimpleDateFormat("EEE dd/MM", Locale("pt", "BR"))
    private fun monthFormat() = SimpleDateFormat("MMMM yyyy", Locale("pt", "BR"))

    private fun Calendar.normalizeStartOfDay() {
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }

    private fun isViewReady(): Boolean = isAdded && view != null && this::weekAdapter.isInitialized

    private fun showToast(message: String) {
        context?.let { AppUiFeedback.showToast(it, message, Toast.LENGTH_SHORT) }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    override fun onDestroyView() {
        cardioListener?.remove()
        userGoalListener?.remove()
        metaGoalListener?.remove()
        cardioListener = null
        userGoalListener = null
        metaGoalListener = null
        super.onDestroyView()
    }
}
