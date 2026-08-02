package com.example.meutreino

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView

data class DiaCardioUI(
    val diaLabel: String,
    val dataLabel: String,
    val dataChave: String,
    val totalMin: Int,
    val qtd: Int,
    val tiposResumo: String,
    val ritmoMedio: String
)

class DiaCardioAdapter(
    private var dias: List<DiaCardioUI>,
    private val onClick: (DiaCardioUI) -> Unit
) : RecyclerView.Adapter<DiaCardioAdapter.VH>() {

    inner class VH(v: View) : RecyclerView.ViewHolder(v) {
        val tvTitulo: TextView = v.findViewById(R.id.tvDiaTitulo)
        val tvData: TextView = v.findViewById(R.id.tvDiaData)
        val tvMinutos: TextView = v.findViewById(R.id.tvDiaMinutos)
        val tvCheck: TextView = v.findViewById(R.id.tvDiaCheck)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_dia_cardio, parent, false)
        return VH(v)
    }

    override fun getItemCount(): Int = dias.size

    override fun onBindViewHolder(h: VH, position: Int) {
        val d = dias[position]

        h.tvTitulo.text = d.diaLabel
        h.tvData.text = d.dataLabel
        h.tvMinutos.text = if (d.totalMin > 0) "${d.totalMin}\nmin" else "—\nmin"
        h.tvMinutos.setBackgroundResource(
            if (d.totalMin > 0) R.drawable.bg_cardio_day_circle_active else R.drawable.bg_cardio_day_circle_inactive
        )
        h.tvMinutos.setTextColor(
            ContextCompat.getColor(
                h.itemView.context,
                if (d.totalMin > 0) R.color.green_primary else R.color.text_muted
            )
        )
        h.tvCheck.text = if (d.totalMin > 0) "✓" else ""

        h.itemView.setOnClickListener { onClick(d) }
    }

    fun atualizar(novos: List<DiaCardioUI>) {
        dias = novos
        notifyDataSetChanged()
    }
}
