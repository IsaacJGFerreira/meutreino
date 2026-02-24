package com.example.meutreino

import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
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
    private val getAnterior: (String, Int) -> String, // (exercicioNome, serieNumero) -> "30kg x 11"
    private val draftVM: TreinoDraftViewModel,        // ✅ salva rascunho para não perder ao trocar de aba
    private val onSalvarTreino: (TreinoPlan, Map<String, Pair<String, String>>, Boolean) -> Unit
) : RecyclerView.Adapter<TreinoDiaAdapter.TreinoVH>() {

    // 🔹 Guarda quais treinos estão expandidos
    private val treinosExpandidos = mutableSetOf<String>()

    // 🔹 Guarda quais exercícios estão expandidos (chave = treino|exercicio)
    private val exerciciosExpandidos = mutableSetOf<String>()

    inner class TreinoVH(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val headerTreino: LinearLayout = itemView.findViewById(R.id.headerTreino)
        val tvNomeTreino: TextView = itemView.findViewById(R.id.tvNomeTreino)
        val tvSetaTreino: TextView = itemView.findViewById(R.id.tvSetaTreino)
        val containerExercicios: LinearLayout = itemView.findViewById(R.id.containerExercicios)
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

        // Botão salvar treino aparece quando o treino está aberto
        holder.btnSalvarTreino.visibility = if (treinoAberto) View.VISIBLE else View.GONE

        holder.btnSalvarTreino.setOnClickListener {
            val completo = treinoCompleto(treino)

            // pega os dados do treino direto do draftVM (rascunho)
            val doTreino = pegarPreenchimentoDoTreino(treino)

            val avisosMsg = montarAvisosDoTreino(treino, doTreino)

            fun salvarAgora(completoFlag: Boolean) {
                onSalvarTreino(treino, doTreino, completoFlag)
                Toast.makeText(
                    holder.itemView.context,
                    if (completoFlag) "Treino salvo!" else "Treino salvo (incompleto).",
                    Toast.LENGTH_SHORT
                ).show()
            }

            fun mostrarAvisosEContinuar(completoFlag: Boolean) {
                if (avisosMsg.isNullOrBlank()) {
                    salvarAgora(completoFlag)
                    return
                }

                android.app.AlertDialog.Builder(holder.itemView.context)
                    .setTitle("Avisos do treino")
                    .setMessage(avisosMsg)
                    .setPositiveButton("OK, entendi") { _, _ ->
                        salvarAgora(completoFlag)
                    }
                    .show()
            }

            if (!completo) {
                android.app.AlertDialog.Builder(holder.itemView.context)
                    .setTitle("Treino incompleto")
                    .setMessage("Ainda faltam séries para preencher.\n\nDeseja salvar mesmo assim?")
                    .setPositiveButton("Salvar mesmo assim") { _, _ ->
                        mostrarAvisosEContinuar(false)
                    }
                    .setNegativeButton("Cancelar", null)
                    .show()
            } else {
                mostrarAvisosEContinuar(true)
            }
        }
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
            val concluido = exercicioCompleto(treino.nome, ex)
            val cor = if (concluido) R.color.ex_border_done else R.color.ex_border_pending
            cardExercicio.strokeColor = ContextCompat.getColor(ctx, cor)
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
                        serieNumero = i,
                        onMudou = { atualizarBorda() }
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
        serieNumero: Int,
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
        tvAnterior.text = getAnterior(exercicioNome, serieNumero)
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

        linha.addView(tvSerie)
        linha.addView(tvAnterior)
        linha.addView(etKg)
        linha.addView(etRep)

        // 🔹 carrega do draftVM
        val draft = draftVM.get(treinoNome, exercicioNome, serieNumero)
        etKg.setText(draft.kg)
        etRep.setText(draft.reps)

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
            override fun afterTextChanged(s: Editable?) { salvarEstado() }
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
}
