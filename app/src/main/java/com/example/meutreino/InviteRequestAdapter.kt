package com.example.meutreino

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class InviteRequestAdapter(
    private val items: MutableList<InviteRequestItem>,
    private val onApprove: (InviteRequestItem) -> Unit,
    private val onReject: (InviteRequestItem) -> Unit
) : RecyclerView.Adapter<InviteRequestAdapter.VH>() {

    inner class VH(v: View) : RecyclerView.ViewHolder(v) {
        val tvTrainer: TextView = v.findViewById(R.id.tvReqTrainer)
        val tvQty: TextView = v.findViewById(R.id.tvReqQty)
        val btnAprovar: Button = v.findViewById(R.id.btnAprovarReq)
        val btnRejeitar: Button = v.findViewById(R.id.btnRejeitarReq)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_invite_request, parent, false)
        return VH(v)
    }

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = items[position]
        holder.tvTrainer.text = "Treinador: ${item.trainerName}"
        holder.tvQty.text = "Qtd solicitada: ${item.qty}"

        holder.btnAprovar.setOnClickListener { onApprove(item) }
        holder.btnRejeitar.setOnClickListener { onReject(item) }
    }

    fun update(newList: List<InviteRequestItem>) {
        items.clear()
        items.addAll(newList)
        notifyDataSetChanged()
    }
}
