package com.example.meutreino

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class TreinosSalvosAdapter(
    private var itens: List<TreinoRegistro>,
    private val onClick: (TreinoRegistro) -> Unit
) : RecyclerView.Adapter<TreinosSalvosAdapter.VH>() {

    class VH(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val tvStatus: TextView = itemView.findViewById(R.id.tvStatus)
        val tvNomeTreino: TextView = itemView.findViewById(R.id.tvNomeTreino)
        val tvDataHora: TextView = itemView.findViewById(R.id.tvDataHora)
        val tvExerciseCount: TextView = itemView.findViewById(R.id.tvExerciseCount)
        val tvCompletion: TextView = itemView.findViewById(R.id.tvCompletion)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_treino_salvo, parent, false)
        return VH(v)
    }

    override fun getItemCount(): Int = itens.size

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = itens[position]

        holder.tvStatus.text = if (item.completo) "✅ Completo" else "Em andamento"
        holder.tvNomeTreino.text = item.nomeTreino
        holder.tvDataHora.text = item.dataHora
        holder.tvExerciseCount.text = "${item.exercicios.size} exercício(s)"
        holder.tvCompletion.text = if (item.completo) "100%" else "—"
        holder.tvStatus.setTextColor(
            holder.itemView.context.getColor(
                if (item.completo) R.color.green_primary else R.color.ex_border_warning
            )
        )

        holder.itemView.setOnClickListener { onClick(item) }
    }

    fun atualizarLista(nova: List<TreinoRegistro>) {
        itens = nova
        notifyDataSetChanged()
    }
}
