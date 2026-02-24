package com.example.meutreino

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class AdminStudentAdapter(
    private val items: MutableList<AdminStudentItem>,
    private val onRemoveVinculo: (String) -> Unit,
    private val onToggleAtivo: (String, Boolean) -> Unit
) : RecyclerView.Adapter<AdminStudentAdapter.VH>() {

    inner class VH(v: View) : RecyclerView.ViewHolder(v) {
        val tvNome: TextView = v.findViewById(R.id.tvAlunoNome)
        val tvEmail: TextView = v.findViewById(R.id.tvAlunoEmail)
        val tvStatus: TextView = v.findViewById(R.id.tvAlunoStatus)
        val btnRemover: Button = v.findViewById(R.id.btnRemoverVinculo)
        val btnAtivo: Button = v.findViewById(R.id.btnToggleAlunoAtivo)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_admin_student, parent, false)
        return VH(v)
    }

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = items[position]
        holder.tvNome.text = item.name
        holder.tvEmail.text = item.email
        holder.tvStatus.text = if (item.active) "Status: Ativo" else "Status: Inativo"

        holder.btnAtivo.text = if (item.active) "Desativar" else "Reativar"

        holder.btnRemover.setOnClickListener { onRemoveVinculo(item.uid) }
        holder.btnAtivo.setOnClickListener { onToggleAtivo(item.uid, item.active) }
    }

    fun update(newList: List<AdminStudentItem>) {
        items.clear()
        items.addAll(newList)
        notifyDataSetChanged()
    }
}
