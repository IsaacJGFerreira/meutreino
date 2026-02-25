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

    private data class ViewHolder(
        val tvNome: TextView,
        val tvMetas: TextView,
        val btnCima: ImageButton,
        val btnBaixo: ImageButton,
        val btnMenu: ImageButton
    )

    override fun getCount(): Int = itens.size
    override fun getItem(position: Int): ExercicioPlan = itens[position]
    override fun getItemId(position: Int): Long = position.toLong()

    override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
        val view: View
        val holder: ViewHolder

        if (convertView == null) {
            view = LayoutInflater.from(context)
                .inflate(R.layout.item_exercicio_treino, parent, false)
            holder = ViewHolder(
                tvNome = view.findViewById(R.id.tvNomeExercicioItem),
                tvMetas = view.findViewById(R.id.tvMetasExercicioItem),
                btnCima = view.findViewById(R.id.btnMoverCima),
                btnBaixo = view.findViewById(R.id.btnMoverBaixo),
                btnMenu = view.findViewById(R.id.btnMenuOrdem)
            )
            view.tag = holder
        } else {
            view = convertView
            holder = view.tag as ViewHolder
        }

        val ex = getItem(position)

        holder.tvNome.text = ex.nome
        holder.tvMetas.text =
            "Séries: ${ex.series} | Reps: ${ex.repsMin}-${ex.repsMax} | Desc: ${ex.descanso} | RIR: ${ex.rir} | Técnica: ${ex.tecnica}"

        // ✅ desabilita quando não dá pra mover
        holder.btnCima.isEnabled = position != 0
        holder.btnBaixo.isEnabled = position != itens.lastIndex

        holder.btnCima.alpha = if (holder.btnCima.isEnabled) 1f else 0.3f
        holder.btnBaixo.alpha = if (holder.btnBaixo.isEnabled) 1f else 0.3f

        holder.btnCima.setOnClickListener {
            if (position <= 0) return@setOnClickListener
            Collections.swap(itens, position, position - 1)
            notifyDataSetChanged()
            onOrdemMudou()
        }

        holder.btnBaixo.setOnClickListener {
            if (position >= itens.lastIndex) return@setOnClickListener
            Collections.swap(itens, position, position + 1)
            notifyDataSetChanged()
            onOrdemMudou()
        }

        // Menu (Topo / Final)
        holder.btnMenu.setOnClickListener {
            val popup = PopupMenu(context, holder.btnMenu)
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
