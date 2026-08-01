package com.example.meutreino

import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.ImageButton
import android.widget.TextView

class TreinoListAdapter(
    private val context: Context,
    private var treinos: MutableList<TreinoPlan>,
    private val onMoveUp: (Int) -> Unit,
    private val onMoveDown: (Int) -> Unit,
    private val onRename: (Int) -> Unit
) : BaseAdapter() {

    private data class ViewHolder(
        val tvNome: TextView,
        val btnCima: ImageButton,
        val btnBaixo: ImageButton,
        val btnEditar: ImageButton
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
                tvNome = view.findViewById(R.id.tvNomeTreinoItem),
                btnCima = view.findViewById(R.id.btnMoverTreinoCima),
                btnBaixo = view.findViewById(R.id.btnMoverTreinoBaixo),
                btnEditar = view.findViewById(R.id.btnEditarNomeTreino)
            )
            view.tag = holder
        } else {
            view = convertView
            holder = view.tag as ViewHolder
        }

        val treino = treinos[position]
        holder.tvNome.text = treino.nome
        holder.btnCima.isEnabled = position > 0
        holder.btnBaixo.isEnabled = position < treinos.lastIndex
        holder.btnCima.alpha = if (holder.btnCima.isEnabled) 1f else 0.3f
        holder.btnBaixo.alpha = if (holder.btnBaixo.isEnabled) 1f else 0.3f

        holder.btnCima.setOnClickListener { onMoveUp(position) }
        holder.btnBaixo.setOnClickListener { onMoveDown(position) }
        holder.btnEditar.setOnClickListener { onRename(position) }

        return view
    }
}
