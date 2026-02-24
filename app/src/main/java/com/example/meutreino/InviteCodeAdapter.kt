package com.example.meutreino

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class InviteCodeAdapter(
    private val items: MutableList<String>,
    private val onCopy: (String) -> Unit
) : RecyclerView.Adapter<InviteCodeAdapter.VH>() {

    inner class VH(v: View) : RecyclerView.ViewHolder(v) {
        val tvCode: TextView = v.findViewById(R.id.tvCode)
        val btnCopiar: Button = v.findViewById(R.id.btnCopiar)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_invite_code, parent, false)
        return VH(v)
    }

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: VH, position: Int) {
        val code = items[position]
        holder.tvCode.text = code
        holder.btnCopiar.setOnClickListener { onCopy(code) }
    }

    fun update(newList: List<String>) {
        items.clear()
        items.addAll(newList)
        notifyDataSetChanged()
    }
}
