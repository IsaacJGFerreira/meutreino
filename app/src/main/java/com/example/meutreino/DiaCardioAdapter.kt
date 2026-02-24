package com.example.meutreino

import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

data class DiaCardioUI(
    val dataLabel: String,        // "SEG 04/02"
    val dataChave: String,        // "04/02/2026"
    val totalMin: Int,
    val qtd: Int,
    val tiposResumo: String,      // "Corrida + Bike"
    val ritmoMedio: String        // "5:30/km" ou "—"
)

class DiaCardioAdapter(
    private var dias: List<DiaCardioUI>,
    private val onClick: (DiaCardioUI) -> Unit
) : RecyclerView.Adapter<DiaCardioAdapter.VH>() {

    inner class VH(v: View) : RecyclerView.ViewHolder(v) {
        // ✅ não trava mais o tipo (pode ser LinearLayout, MaterialCardView, ConstraintLayout...)
        val card: View = v.findViewById(R.id.cardDia)

        val tvTitulo: TextView = v.findViewById(R.id.tvDiaTitulo)
        val tvResumo: TextView = v.findViewById(R.id.tvDiaResumo)
        val tvTipos: TextView = v.findViewById(R.id.tvDiaTipos)
        val tvRitmo: TextView = v.findViewById(R.id.tvDiaRitmo)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_dia_cardio, parent, false)
        return VH(v)
    }

    override fun getItemCount(): Int = dias.size

    override fun onBindViewHolder(h: VH, position: Int) {
        val d = dias[position]

        h.tvTitulo.text = d.dataLabel
        h.tvResumo.text = "${d.qtd} cardio(s) • ${d.totalMin} min"
        h.tvTipos.text = d.tiposResumo
        h.tvRitmo.text = "Ritmo: ${d.ritmoMedio}"

        // ✅ Verde se teve cardio, cinza se não teve
        val cor = if (d.qtd > 0) "#C8E6C9" else "#E0E0E0"
        h.card.setBackgroundColor(Color.parseColor(cor))

        h.itemView.setOnClickListener { onClick(d) }
    }

    fun atualizar(novos: List<DiaCardioUI>) {
        dias = novos
        notifyDataSetChanged()
    }
}
