package com.example.meutreino

import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.TextView

class TreinoListAdapter(
    private val context: Context,
    private var treinos: MutableList<TreinoPlan>
) : BaseAdapter() {

    private data class ViewHolder(
        val tvNome: TextView
    )

    fun atualizar(novos: List<TreinoPlan>) {
        treinos = novos.toMutableList()
        notifyDataSetChanged()
    }

    override fun getCount(): Int = treinos.size
    override fun getItem(position: Int): Any = treinos[position]
    override fun getItemId(position: Int): Long = position.toLong()

    override fun getView(position: Int, convertView: View?, parent: ViewGroup?): View {
        val view: View
        val holder: ViewHolder

        if (convertView == null) {
            view = LayoutInflater.from(context)
                .inflate(R.layout.item_treino_montar, parent, false)
            holder = ViewHolder(
                tvNome = view.findViewById(R.id.tvNomeTreinoItem)
            )
            view.tag = holder
        } else {
            view = convertView
            holder = view.tag as ViewHolder
        }

        val treino = treinos[position]
        holder.tvNome.text = treino.nome

        return view
    }
}
