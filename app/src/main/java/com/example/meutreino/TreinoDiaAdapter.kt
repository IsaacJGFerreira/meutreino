package com.example.meutreino

import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.content.DialogInterface
import android.content.res.ColorStateList
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.card.MaterialCardView
import kotlin.math.abs

class TreinoDiaAdapter(
    private val treinos: List<TreinoPlan>,
    private val contarRealizacoes: (String) -> Int,
    private val getAnterior: (String, String, Int) -> String, // (treinoNome, exercicioNome, serieNumero) -> "30kg x 11"
    private val draftVM: TreinoDraftViewModel,        // ✅ salva rascunho para não perder ao trocar de aba
    private val onSalvarTreino: (TreinoPlan, Map<String, Pair<String, String>>, Boolean) -> Unit
) : RecyclerView.Adapter<TreinoDiaAdapter.TreinoVH>() {

    private enum class ExercicioStatusCard {
        NEUTRO,
        INICIADO,
        EM_ANDAMENTO,
        CONCLUIDO,
        PENDENTE_SALVAR
    }

    // 🔹 Guarda quais treinos estão expandidos
    private val treinosExpandidos = mutableSetOf<String>()

    // 🔹 Guarda quais exercícios estão expandidos (chave = treino|exercicio)
    private val exerciciosExpandidos = mutableSetOf<String>()

    // 🔹 Feedback visual por card, aplicado após o usuário salvar
    private val statusCards = mutableMapOf<String, ExercicioStatusCard>()

    // 🔹 Apenas um treino pode estar ativo por vez
    private var treinoAtivo: String? = null

    inner class TreinoVH(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val cardTreino: MaterialCardView = itemView.findViewById(R.id.cardTreino)
        val headerTreino: LinearLayout = itemView.findViewById(R.id.headerTreino)
        val tvNomeTreino: TextView = itemView.findViewById(R.id.tvNomeTreino)
        val tvSetaTreino: TextView = itemView.findViewById(R.id.tvSetaTreino)
        val containerExercicios: LinearLayout = itemView.findViewById(R.id.containerExercicios)
        val btnIniciarTreino: Button = itemView.findViewById(R.id.btnIniciarTreino)
        val btnSalvarTreino: Button = itemView.findViewById(R.id.btnSalvarTreino)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TreinoVH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_treino_card, parent, false)
        return TreinoVH(v)
    }

    override fun getItemCount(): Int = treinos.size

    override fun onBindViewHolder(holder: TreinoVH, position: Int) {
        val treino = treinos[position]
        holder.tvNomeTreino.text = treino.nome

        val treinoAberto = treinosExpandidos.contains(treino.nome)
        holder.containerExercicios.visibility = if (treinoAberto) View.VISIBLE else View.GONE
        holder.tvSetaTreino.text = if (treinoAberto) "⌃" else "⌄"

        // Clique no header do treino: expandir/recolher
        holder.headerTreino.setOnClickListener {
            if (treinoAberto) treinosExpandidos.remove(treino.nome) else treinosExpandidos.add(treino.nome)
            notifyItemChanged(position)
        }

        // Renderiza exercícios quando o treino está aberto
        holder.containerExercicios.removeAllViews()
        if (treinoAberto) {
            treino.exercicios.forEach { ex ->
                val exView = criarViewExercicio(holder.itemView, treino, ex)
                holder.containerExercicios.addView(exView)
            }
        }

        val esteTreinoAtivo = treinoAtivo == treino.nome
        val outroTreinoAtivo = treinoAtivo != null && !esteTreinoAtivo

        aplicarDestaqueCardTreino(holder, esteTreinoAtivo)

        // Só permite começar quando não existe outro treino ativo
        holder.btnIniciarTreino.visibility = if (treinoAberto && !esteTreinoAtivo) View.VISIBLE else View.GONE
        holder.btnIniciarTreino.isEnabled = treinoAberto && !outroTreinoAtivo
        holder.btnIniciarTreino.alpha = if (holder.btnIniciarTreino.isEnabled) 1f else 0.5f

        holder.btnIniciarTreino.setOnClickListener {
            if (treinoAtivo == null || treinoAtivo == treino.nome) {
                treinoAtivo = treino.nome
                notifyDataSetChanged()
                AppUiFeedback.showToast(
                    holder.itemView.context,
                    "Treino ${treino.nome} iniciado.",
                    Toast.LENGTH_SHORT
                )
            } else {
                AppUiFeedback.showToast(
                    holder.itemView.context,
                    "Finalize o treino ${treinoAtivo} para iniciar outro.",
                    Toast.LENGTH_SHORT
                )
            }
        }

        // Botão salvar só aparece quando este treino estiver iniciado
        holder.btnSalvarTreino.visibility = if (treinoAberto && esteTreinoAtivo) View.VISIBLE else View.GONE

        holder.btnSalvarTreino.setOnClickListener {
            if (treinoAtivo != treino.nome) {
                AppUiFeedback.showToast(holder.itemView.context, "Inicie o treino para registrar séries.", Toast.LENGTH_SHORT)
                return@setOnClickListener
            }

            val completo = treinoCompleto(treino)

            // pega os dados do treino direto do draftVM (rascunho)
            val doTreino = pegarPreenchimentoDoTreino(treino)

            val avisosMsg = montarAvisosDoTreino(treino, doTreino)

            fun salvarAgora(completoFlag: Boolean) {
                atualizarStatusCardsDepoisSalvar(treino, completoFlag)
                onSalvarTreino(treino, doTreino, completoFlag)
                draftVM.limparTreino(treino.nome)
                treinoAtivo = null
                notifyDataSetChanged()
                AppUiFeedback.showToast(
                    holder.itemView.context,
                    if (completoFlag) "Treino salvo!" else "Treino salvo (incompleto).",
                    Toast.LENGTH_SHORT
                )
            }

            fun mostrarAvisosEContinuar(completoFlag: Boolean) {
                if (avisosMsg.isNullOrBlank()) {
                    salvarAgora(completoFlag)
                    return
                }

                val avisosDialog = AppUiFeedback.dialogBuilder(holder.itemView.context)
                avisosDialog.setTitle("Avisos do treino")
                avisosDialog.setMessage(avisosMsg)
                avisosDialog.setPositiveButton("OK, entendi") { _: DialogInterface, _: Int ->
                    salvarAgora(completoFlag)
                }
                avisosDialog.show()
            }

            if (!completo) {
                val incompletoDialog = AppUiFeedback.dialogBuilder(holder.itemView.context)
                incompletoDialog.setTitle("Treino incompleto")
                incompletoDialog.setMessage("Ainda faltam séries para preencher.\n\nDeseja salvar mesmo assim?")
                incompletoDialog.setPositiveButton("Salvar mesmo assim") { _: DialogInterface, _: Int ->
                    mostrarAvisosEContinuar(false)
                }
                incompletoDialog.setNegativeButton("Voltar") { _: DialogInterface, _: Int ->
                    marcarIncompletosComoPendentes(treino)
                    notifyDataSetChanged()
                }
                incompletoDialog.show()
            } else {
                mostrarAvisosEContinuar(true)
            }
        }
    }

    private fun aplicarDestaqueCardTreino(holder: TreinoVH, ativo: Boolean) {
        val ctx = holder.itemView.context
        val bgColor = if (ativo) R.color.treino_card_active_bg else R.color.treino_card_default_bg
        val strokeColor = if (ativo) R.color.treino_card_active_stroke else android.R.color.transparent

        holder.cardTreino.setCardBackgroundColor(ContextCompat.getColor(ctx, bgColor))
        holder.cardTreino.strokeWidth = if (ativo) dp(ctx, 2) else 0
        holder.cardTreino.strokeColor = ContextCompat.getColor(ctx, strokeColor)
    }

    private fun criarViewExercicio(root: View, treino: TreinoPlan, ex: ExercicioPlan): View {
        val ctx = root.context
        val v = LayoutInflater.from(ctx).inflate(R.layout.item_exercicio_expand, null, false)

        val cardExercicio = v.findViewById<MaterialCardView>(R.id.cardExercicio)

        val header = v.findViewById<LinearLayout>(R.id.headerExercicio)
        val tvNome = v.findViewById<TextView>(R.id.tvNomeExercicio)
        val tvSeta = v.findViewById<TextView>(R.id.tvSetaExercicio)
        val tvRealiz = v.findViewById<TextView>(R.id.tvRealizacoes)
        val containerSeries = v.findViewById<LinearLayout>(R.id.containerSeries)

        // compatibilidade (invisível no XML)
        val tvMetas = v.findViewById<TextView>(R.id.tvMetasExercicio)

        // novos campos UI
        val tvMetodo = v.findViewById<TextView>(R.id.tvMetodo)
        val tvSeriesInfo = v.findViewById<TextView>(R.id.tvSeries)
        val tvRepsInfo = v.findViewById<TextView>(R.id.tvReps)
        val tvRirInfo = v.findViewById<TextView>(R.id.tvRir)
        val tvDescInfo = v.findViewById<TextView>(R.id.tvDescanso)

        tvNome.text = ex.nome
        tvRealiz.text = "Treinos realizados: ${contarRealizacoes(ex.nome)}"

        // mantém metas antigas só por compatibilidade
        tvMetas.text = "Séries: ${ex.series} | Reps: ${ex.repsMin}-${ex.repsMax} | Desc: ${ex.descanso} | RIR: ${ex.rir} | Técnica: ${ex.tecnica}"

        // preenche UI nova
        tvMetodo.text = if (ex.tecnica.isBlank() || ex.tecnica == "—") "—" else ex.tecnica
        tvSeriesInfo.text = ex.series.toString()
        tvRepsInfo.text = "${ex.repsMin}-${ex.repsMax}"
        tvRirInfo.text = ex.rir
        tvDescInfo.text = ex.descanso

        val chaveEx = "${treino.nome}|${ex.nome}"
        val aberto = exerciciosExpandidos.contains(chaveEx)

        containerSeries.visibility = if (aberto) View.VISIBLE else View.GONE
        tvSeta.text = if (aberto) "⌃" else "⌄"

        fun atualizarBorda() {
            val key = "${treino.nome}|${ex.nome}"
            val status = statusCards[key] ?: statusExercicioAtual(treino, ex)

            val (bgColor, strokeColor) = when (status) {
                ExercicioStatusCard.INICIADO -> Pair(R.color.ex_card_bg_started, R.color.ex_border_started)
                ExercicioStatusCard.EM_ANDAMENTO -> Pair(R.color.ex_card_bg_warning, R.color.ex_border_warning)
                ExercicioStatusCard.CONCLUIDO -> Pair(R.color.ex_card_bg_done, R.color.ex_border_done)
                ExercicioStatusCard.PENDENTE_SALVAR -> Pair(R.color.ex_card_bg_error, R.color.ex_border_error)
                ExercicioStatusCard.NEUTRO -> Pair(R.color.ex_card_bg_neutral, R.color.ex_border_pending)
            }

            cardExercicio.setCardBackgroundColor(ContextCompat.getColor(ctx, bgColor))
            cardExercicio.strokeColor = ContextCompat.getColor(ctx, strokeColor)
        }

        atualizarBorda()

        header.setOnClickListener {
            if (aberto) exerciciosExpandidos.remove(chaveEx) else exerciciosExpandidos.add(chaveEx)
            notifyDataSetChanged()
        }

        containerSeries.removeAllViews()
        if (aberto) {
            for (i in 1..ex.series) {
                containerSeries.addView(
                    criarLinhaSerie(
                        ctx = ctx,
                        treinoNome = treino.nome,
                        exercicioNome = ex.nome,
                        repsMin = ex.repsMin,
                        repsMax = ex.repsMax,
                        serieNumero = i,
                        podeEditar = treinoAtivo == treino.nome,
                        onMudou = {
                            statusCards[chaveEx] = statusExercicioAtual(treino, ex)
                            atualizarBorda()
                        }
                    )
                )
            }
        }

        return v
    }

    // ✅ Exercício completo: TODAS as séries preenchidas (KG e REP) no draftVM
    private fun exercicioCompleto(treinoNome: String, ex: ExercicioPlan): Boolean {
        for (i in 1..ex.series) {
            val d = draftVM.get(treinoNome, ex.nome, i)
            if (d.kg.isBlank() || d.reps.isBlank()) return false
        }
        return true
    }

    private fun criarLinhaSerie(
        ctx: android.content.Context,
        treinoNome: String,
        exercicioNome: String,
        repsMin: Int,
        repsMax: Int,
        serieNumero: Int,
        podeEditar: Boolean,
        onMudou: () -> Unit
    ): View {

        val linha = LinearLayout(ctx)
        linha.orientation = LinearLayout.HORIZONTAL
        linha.gravity = android.view.Gravity.CENTER_VERTICAL
        linha.setPadding(0, dp(ctx, 6), 0, dp(ctx, 6))

        // Série
        val tvSerie = TextView(ctx)
        tvSerie.text = "S$serieNumero"
        tvSerie.setTextColor(android.graphics.Color.BLACK)
        tvSerie.gravity = android.view.Gravity.CENTER_VERTICAL
        tvSerie.layoutParams = LinearLayout.LayoutParams(
            dp(ctx, 44),
            LinearLayout.LayoutParams.WRAP_CONTENT
        )

        // Anterior
        val tvAnterior = TextView(ctx)
        tvAnterior.text = getAnterior(treinoNome, exercicioNome, serieNumero)
        tvAnterior.setTextColor(android.graphics.Color.parseColor("#6B6B6B"))
        tvAnterior.maxLines = 1
        tvAnterior.ellipsize = android.text.TextUtils.TruncateAt.END
        tvAnterior.gravity = android.view.Gravity.CENTER_VERTICAL
        tvAnterior.layoutParams = LinearLayout.LayoutParams(
            0,
            LinearLayout.LayoutParams.WRAP_CONTENT,
            1f
        ).apply {
            marginEnd = dp(ctx, 10)
        }

        // KG
        val etKg = EditText(ctx)
        etKg.hint = "KG"
        etKg.inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
        etKg.layoutParams = LinearLayout.LayoutParams(
            dp(ctx, 70),
            dp(ctx, 48)
        ).apply { marginEnd = dp(ctx, 8) }

        // REP
        val etRep = EditText(ctx)
        etRep.hint = "REP"
        etRep.inputType = InputType.TYPE_CLASS_NUMBER
        etRep.layoutParams = LinearLayout.LayoutParams(
            dp(ctx, 70),
            dp(ctx, 48)
        )

        // Estilo inputs
        etKg.setTextColor(android.graphics.Color.BLACK)
        etRep.setTextColor(android.graphics.Color.BLACK)
        etKg.setHintTextColor(android.graphics.Color.parseColor("#99000000"))
        etRep.setHintTextColor(android.graphics.Color.parseColor("#99000000"))
        etKg.setBackgroundResource(R.drawable.bg_input_rounded)
        etRep.setBackgroundResource(R.drawable.bg_input_rounded)
        etKg.gravity = android.view.Gravity.CENTER
        etRep.gravity = android.view.Gravity.CENTER
        etKg.isEnabled = podeEditar
        etRep.isEnabled = podeEditar
        etKg.alpha = if (podeEditar) 1f else 0.6f
        etRep.alpha = if (podeEditar) 1f else 0.6f

        linha.addView(tvSerie)
        linha.addView(tvAnterior)
        linha.addView(etKg)
        linha.addView(etRep)

        // 🔹 carrega do draftVM
        val draft = draftVM.get(treinoNome, exercicioNome, serieNumero)
        etKg.setText(draft.kg)
        etRep.setText(draft.reps)
        aplicarFeedbackReps(etRep, repsMin, repsMax)

        fun salvarEstado() {
            val kg = etKg.text.toString().trim()
            val rep = etRep.text.toString().trim()
            draftVM.setKg(treinoNome, exercicioNome, serieNumero, kg)
            draftVM.setReps(treinoNome, exercicioNome, serieNumero, rep)
            onMudou()
        }

        etKg.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) { salvarEstado() }
        })

        etRep.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                aplicarFeedbackReps(etRep, repsMin, repsMax)
                salvarEstado()
            }
        })

        return linha
    }

    // ✅ treino completo: todos exercícios, todas séries preenchidas (KG e REP) no draftVM
    private fun treinoCompleto(treino: TreinoPlan): Boolean {
        treino.exercicios.forEach { ex ->
            for (i in 1..ex.series) {
                val d = draftVM.get(treino.nome, ex.nome, i)
                if (d.kg.isBlank() || d.reps.isBlank()) return false
            }
        }
        return true
    }

    // ✅ pega todos os valores do treino direto do draftVM
    private fun pegarPreenchimentoDoTreino(treino: TreinoPlan): Map<String, Pair<String, String>> {
        val map = mutableMapOf<String, Pair<String, String>>()
        treino.exercicios.forEach { ex ->
            for (i in 1..ex.series) {
                val d = draftVM.get(treino.nome, ex.nome, i)
                map["${treino.nome}|${ex.nome}|$i"] = Pair(d.kg, d.reps)
            }
        }
        return map
    }

    private fun montarAvisosDoTreino(
        treino: TreinoPlan,
        preenchimentoDoTreino: Map<String, Pair<String, String>>
    ): String? {

        val avisos = mutableListOf<String>()

        treino.exercicios.forEach { ex ->
            val seriesPreenchidas = mutableListOf<Pair<Double, Int>>()

            for (i in 1..ex.series) {
                val key = "${treino.nome}|${ex.nome}|$i"
                val v = preenchimentoDoTreino[key] ?: continue

                val kgStr = v.first.trim()
                val repsStr = v.second.trim()

                if (kgStr.isBlank() || repsStr.isBlank()) continue

                val kg = kgStr.toDoubleOrNull()
                val reps = repsStr.toIntOrNull()
                if (kg != null && reps != null) {
                    seriesPreenchidas.add(Pair(kg, reps))
                }
            }

            if (seriesPreenchidas.isEmpty()) return@forEach

            val repsList = seriesPreenchidas.map { it.second }
            val todasAcima = repsList.all { it > ex.repsMax }
            val todasAbaixo = repsList.all { it < ex.repsMin }

            val pesos = seriesPreenchidas.map { it.first }
            val primeiro = pesos.first()
            val pesoVariando = pesos.size >= 2 && pesos.any { abs(it - primeiro) >= 0.5 }

            val msgs = mutableListOf<String>()

            if (todasAcima) {
                msgs.add("✅ ${ex.nome}: todas as séries ficaram ACIMA do máximo (${ex.repsMax}). Próxima vez: pode AUMENTAR o peso.")
            }
            if (todasAbaixo) {
                msgs.add("⚠️ ${ex.nome}: todas as séries ficaram ABAIXO do mínimo (${ex.repsMin}). Próxima vez: pode DIMINUIR o peso.")
            }
            if (pesoVariando) {
                msgs.add("⚠️ ${ex.nome}: você mudou o peso entre as séries. Não é o ideal para acompanhar evolução.")
            }

            if (msgs.isNotEmpty()) {
                avisos.add(msgs.joinToString("\n"))
            }
        }

        return if (avisos.isEmpty()) null else avisos.joinToString("\n\n")
    }

    private fun dp(ctx: android.content.Context, value: Int): Int {
        return (value * ctx.resources.displayMetrics.density).toInt()
    }

    private fun atualizarStatusCardsDepoisSalvar(treino: TreinoPlan, completoFlag: Boolean) {
        treino.exercicios.forEach { ex ->
            val key = "${treino.nome}|${ex.nome}"
            statusCards[key] = when {
                completoFlag -> ExercicioStatusCard.CONCLUIDO
                exercicioCompleto(treino.nome, ex) -> ExercicioStatusCard.CONCLUIDO
                else -> ExercicioStatusCard.PENDENTE_SALVAR
            }
        }
    }

    private fun statusExercicioAtual(treino: TreinoPlan, ex: ExercicioPlan): ExercicioStatusCard {
        return when {
            exercicioCompleto(treino.nome, ex) -> ExercicioStatusCard.CONCLUIDO
            exercicioTemPreenchimento(treino.nome, ex) -> ExercicioStatusCard.EM_ANDAMENTO
            treinoAtivo == treino.nome -> ExercicioStatusCard.INICIADO
            else -> ExercicioStatusCard.NEUTRO
        }
    }

    private fun exercicioTemPreenchimento(treinoNome: String, ex: ExercicioPlan): Boolean {
        for (i in 1..ex.series) {
            val d = draftVM.get(treinoNome, ex.nome, i)
            if (d.kg.isNotBlank() || d.reps.isNotBlank()) return true
        }
        return false
    }

    private fun marcarIncompletosComoPendentes(treino: TreinoPlan) {
        treino.exercicios.forEach { ex ->
            val key = "${treino.nome}|${ex.nome}"
            statusCards[key] = if (exercicioCompleto(treino.nome, ex)) {
                ExercicioStatusCard.CONCLUIDO
            } else {
                ExercicioStatusCard.PENDENTE_SALVAR
            }
        }
    }

    private fun aplicarFeedbackReps(etRep: EditText, repsMin: Int, repsMax: Int) {
        val reps = etRep.text.toString().trim().toIntOrNull()
        val colorRes = when {
            reps == null -> R.color.ex_input_neutral
            reps > repsMax -> R.color.ex_input_good
            reps < repsMin -> R.color.ex_input_bad
            else -> R.color.ex_input_neutral
        }

        val color = ContextCompat.getColor(etRep.context, colorRes)
        etRep.backgroundTintList = ColorStateList.valueOf(color)
    }
}
