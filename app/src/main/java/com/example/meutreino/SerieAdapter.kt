package com.example.meutreino

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

/**
 * Adapter: pega uma lista de textos e mostra no RecyclerView
 * Cada texto vira um item (um "card") na lista
 */
class SerieAdapter(
    listaInicial: List<String>,
    private val onDataClick: (String) -> Unit
) : RecyclerView.Adapter<SerieAdapter.SerieViewHolder>() {

    // 🔹 Lista interna do adapter (mutável)
    // Isso permite atualizar os itens sem recriar o adapter toda hora
    private val listaSeries = listaInicial.toMutableList()

    // 🔹 ViewHolder representa 1 item visual da lista (1 linha do histórico)
    class SerieViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val tvSerie: TextView = itemView.findViewById(R.id.tvSerie)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): SerieViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_serie, parent, false)
        return SerieViewHolder(view)
    }

    override fun onBindViewHolder(holder: SerieViewHolder, position: Int) {
        val texto = listaSeries[position]
        holder.tvSerie.text = texto

        // 🔹 Se começar com "📆", consideramos que é um cabeçalho de data
        if (texto.startsWith("📆")) {
            holder.tvSerie.textSize = 18f
            holder.tvSerie.setTypeface(null, android.graphics.Typeface.BOLD)
            holder.tvSerie.setBackgroundColor(android.graphics.Color.LTGRAY)
            holder.tvSerie.setPadding(16, 16, 16, 16)

            // 🔹 Torna a data clicável
            holder.tvSerie.setOnClickListener {
                onDataClick(texto)
            }
        } else {
            holder.tvSerie.setOnClickListener(null)
        }
    }

    override fun getItemCount(): Int {
        return listaSeries.size
    }

    /**
     * 🔹 Atualiza a lista exibida no RecyclerView
     * Usamos quando salvamos uma nova série e queremos "re-desenhar" a lista.
     */
    fun atualizarLista(novaLista: List<String>) {
        listaSeries.clear()
        listaSeries.addAll(novaLista)
        notifyDataSetChanged()
    }
}