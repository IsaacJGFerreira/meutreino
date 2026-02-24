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

    fun atualizar(novos: List<TreinoPlan>) {
        treinos = novos.toMutableList()
        notifyDataSetChanged()
    }

    override fun getCount(): Int = treinos.size
    override fun getItem(position: Int): Any = treinos[position]
    override fun getItemId(position: Int): Long = position.toLong()

    override fun getView(position: Int, convertView: View?, parent: ViewGroup?): View {
        val view = convertView ?: LayoutInflater.from(context)
            .inflate(R.layout.item_treino_montar, parent, false)

        val tvNome = view.findViewById<TextView>(R.id.tvNomeTreinoItem)

        val treino = treinos[position]
        tvNome.text = treino.nome

        return view
    }
}
