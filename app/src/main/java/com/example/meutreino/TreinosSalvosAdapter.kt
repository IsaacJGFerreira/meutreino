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
        holder.tvExerciseCount.text = buildString {
            append("${item.exercicios.size} exercício(s)")
            if (item.duracaoSegundos > 0L) append(" • ${formatarDuracao(item.duracaoSegundos)}")
        }
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

    private fun formatarDuracao(totalSegundos: Long): String {
        val horas = totalSegundos / 3600L
        val minutos = (totalSegundos % 3600L) / 60L
        val segundos = totalSegundos % 60L
        return when {
            horas > 0L -> "${horas}h ${minutos}min ${segundos}s"
            minutos > 0L -> "${minutos}min ${segundos}s"
            else -> "${segundos}s"
        }
    }
}
