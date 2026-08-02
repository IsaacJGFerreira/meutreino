package com.example.meutreino

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton

class CardioRegistrosAdapter(
    private var registros: List<CardioRegistro>,
    private var podeApagar: Boolean,
    private val onClick: (CardioRegistro) -> Unit,
    private val onDelete: (CardioRegistro) -> Unit
) : RecyclerView.Adapter<CardioRegistrosAdapter.VH>() {

    class VH(view: View) : RecyclerView.ViewHolder(view) {
        val atividade: TextView = view.findViewById(R.id.tvCardioAtividade)
        val data: TextView = view.findViewById(R.id.tvCardioData)
        val tempo: TextView = view.findViewById(R.id.tvCardioTempo)
        val ritmo: TextView = view.findViewById(R.id.tvCardioRitmo)
        val apagar: MaterialButton = view.findViewById(R.id.btnApagarCardio)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        return VH(
            LayoutInflater.from(parent.context)
                .inflate(R.layout.item_cardio_registro, parent, false)
        )
    }

    override fun getItemCount(): Int = registros.size

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = registros[position]
        holder.atividade.text = item.atividade
        holder.data.text = item.dataHora.replace(" ", ", ")
        holder.tempo.text = "${item.tempoMin} min"
        holder.ritmo.text = "Ritmo: ${item.ritmo.ifBlank { "—" }}"
        holder.apagar.visibility = if (podeApagar) View.VISIBLE else View.GONE
        holder.itemView.setOnClickListener { onClick(item) }
        holder.apagar.setOnClickListener { onDelete(item) }
    }

    fun atualizar(novos: List<CardioRegistro>) {
        registros = novos
        notifyDataSetChanged()
    }

    fun setCanDelete(value: Boolean) {
        podeApagar = value
        notifyDataSetChanged()
    }
}
