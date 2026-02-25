package com.example.meutreino

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

data class DiaCardioUI(
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

    private var maxMinSemana: Int = 0

    inner class VH(v: View) : RecyclerView.ViewHolder(v) {
        val tvTitulo: TextView = v.findViewById(R.id.tvDiaTitulo)
        val tvMinutos: TextView = v.findViewById(R.id.tvDiaMinutos)
        val barFill: View = v.findViewById(R.id.viewBarFill)
        val barRemainder: View = v.findViewById(R.id.viewBarRemainder)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_dia_cardio, parent, false)
        return VH(v)
    }

    override fun getItemCount(): Int = dias.size

    override fun onBindViewHolder(h: VH, position: Int) {
        val d = dias[position]

        h.tvTitulo.text = d.dataLabel
        h.tvMinutos.text = if (d.totalMin > 0) "${d.totalMin} min" else "Sem cardio"

        val proporcao = if (maxMinSemana <= 0 || d.totalMin <= 0) {
            0f
        } else {
            d.totalMin.toFloat() / maxMinSemana.toFloat()
        }

        val fill = h.barFill.layoutParams as LinearLayout.LayoutParams
        val rest = h.barRemainder.layoutParams as LinearLayout.LayoutParams

        if (d.totalMin > 0) {
            val pesoFill = proporcao.coerceAtLeast(0.08f)
            fill.weight = pesoFill
            rest.weight = (1f - pesoFill).coerceAtLeast(0f)
            h.barFill.visibility = View.VISIBLE
        } else {
            fill.weight = 0f
            rest.weight = 1f
            h.barFill.visibility = View.INVISIBLE
        }

        h.barFill.layoutParams = fill
        h.barRemainder.layoutParams = rest

        h.itemView.setOnClickListener { onClick(d) }
    }

    fun atualizar(novos: List<DiaCardioUI>) {
        dias = novos
        maxMinSemana = dias.maxOfOrNull { it.totalMin } ?: 0
        notifyDataSetChanged()
    }
}
