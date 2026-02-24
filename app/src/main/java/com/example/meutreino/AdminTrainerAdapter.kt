package com.example.meutreino

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class AdminTrainerAdapter(
    private val items: MutableList<AdminTrainerItem>,
    private val onClick: (AdminTrainerItem) -> Unit
) : RecyclerView.Adapter<AdminTrainerAdapter.VH>() {

    inner class VH(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val tvNome: TextView = itemView.findViewById(R.id.tvNome)
        val tvEmail: TextView = itemView.findViewById(R.id.tvEmail)
        val tvStatus: TextView = itemView.findViewById(R.id.tvStatus)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_admin_trainer, parent, false)
        return VH(v)
    }

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = items[position]
        holder.tvNome.text = item.name
        holder.tvEmail.text = item.email
        holder.tvStatus.text = if (item.active) "Ativo" else "Inativo"

        holder.itemView.setOnClickListener { onClick(item) }
    }

    fun update(newList: List<AdminTrainerItem>) {
        items.clear()
        items.addAll(newList)
        notifyDataSetChanged()
    }
}
