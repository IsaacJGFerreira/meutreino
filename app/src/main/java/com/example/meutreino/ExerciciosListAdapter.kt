package com.example.meutreino

import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.ImageButton
import android.widget.PopupMenu
import android.widget.TextView
import java.util.Collections

class ExerciciosListAdapter(
    private val context: Context,
    private val itens: MutableList<ExercicioPlan>,
    private val onOrdemMudou: () -> Unit // ✅ NOVO: avisa o Fragment pra salvar
) : BaseAdapter() {

    override fun getCount(): Int = itens.size
    override fun getItem(position: Int): ExercicioPlan = itens[position]
    override fun getItemId(position: Int): Long = position.toLong()

    override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
        val view = convertView ?: LayoutInflater.from(context)
            .inflate(R.layout.item_exercicio_treino, parent, false)

        val ex = getItem(position)

        val tvNome = view.findViewById<TextView>(R.id.tvNomeExercicioItem)
        val tvMetas = view.findViewById<TextView>(R.id.tvMetasExercicioItem)

        // ✅ botões novos do XML
        val btnCima = view.findViewById<ImageButton>(R.id.btnMoverCima)
        val btnBaixo = view.findViewById<ImageButton>(R.id.btnMoverBaixo)
        val btnMenu = view.findViewById<ImageButton>(R.id.btnMenuOrdem)

        tvNome.text = ex.nome
        tvMetas.text =
            "Séries: ${ex.series} | Reps: ${ex.repsMin}-${ex.repsMax} | Desc: ${ex.descanso} | RIR: ${ex.rir} | Técnica: ${ex.tecnica}"

        // ✅ desabilita quando não dá pra mover
        btnCima.isEnabled = position != 0
        btnBaixo.isEnabled = position != itens.lastIndex

        btnCima.alpha = if (btnCima.isEnabled) 1f else 0.3f
        btnBaixo.alpha = if (btnBaixo.isEnabled) 1f else 0.3f

        btnCima.setOnClickListener {
            if (position <= 0) return@setOnClickListener
            Collections.swap(itens, position, position - 1)
            notifyDataSetChanged()
            onOrdemMudou()
        }

        btnBaixo.setOnClickListener {
            if (position >= itens.lastIndex) return@setOnClickListener
            Collections.swap(itens, position, position + 1)
            notifyDataSetChanged()
            onOrdemMudou()
        }

        // Menu (Topo / Final)
        btnMenu.setOnClickListener {
            val popup = PopupMenu(context, btnMenu)
            popup.menu.add("Mover para o topo")
            popup.menu.add("Mover para o final")

            popup.setOnMenuItemClickListener { item ->
                when (item.title.toString()) {
                    "Mover para o topo" -> {
                        if (position > 0) {
                            val obj = itens.removeAt(position)
                            itens.add(0, obj)
                            notifyDataSetChanged()
                            onOrdemMudou()
                        }
                        true
                    }
                    "Mover para o final" -> {
                        if (position < itens.lastIndex) {
                            val obj = itens.removeAt(position)
                            itens.add(obj)
                            notifyDataSetChanged()
                            onOrdemMudou()
                        }
                        true
                    }
                    else -> false
                }
            }

            popup.show()
        }

        return view
    }

    fun atualizar() {
        notifyDataSetChanged()
    }
}
