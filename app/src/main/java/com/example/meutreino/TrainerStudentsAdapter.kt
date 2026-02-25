package com.example.meutreino

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

data class TrainerStudentItem(
    val uid: String,
    val name: String,
    val email: String
)

class TrainerStudentsAdapter(
    private val items: MutableList<TrainerStudentItem>,
    private val onClick: (TrainerStudentItem) -> Unit
) : RecyclerView.Adapter<TrainerStudentsAdapter.VH>() {

    inner class VH(v: View) : RecyclerView.ViewHolder(v) {
        val tvNome: TextView = v.findViewById(R.id.tvNome)
        val tvEmail: TextView = v.findViewById(R.id.tvEmail)
        val tvStatus: TextView = v.findViewById(R.id.tvStatus)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_admin_trainer, parent, false)
        // Reaproveitando o item_admin_trainer (nome+email). Se quiser, criamos item próprio depois.
        return VH(v)
    }

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = items[position]
        holder.tvNome.text = item.name
        holder.tvEmail.text = item.email
        holder.tvStatus.text = "Toque para acompanhar este aluno"
        holder.itemView.setOnClickListener { onClick(item) }
    }

    fun update(newList: List<TrainerStudentItem>) {
        items.clear()
        items.addAll(newList)
        notifyDataSetChanged()
    }
}
