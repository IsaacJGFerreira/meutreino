package com.example.meutreino

import android.net.Uri
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import coil.load
import java.util.Locale

class ProgressoAdapter(
    private val lista: MutableList<ProgressoRegistro>,
    private val onClick: (pos: Int) -> Unit,
    private val onLongClick: (pos: Int) -> Unit
) : RecyclerView.Adapter<ProgressoAdapter.VH>() {

    inner class VH(v: View) : RecyclerView.ViewHolder(v) {
        val tvDataPeso: TextView = v.findViewById(R.id.tvDataPeso)

        // ✅ novo container das fotos (pra esconder quando não tiver)
        val rowFotos: LinearLayout = v.findViewById(R.id.rowFotos)

        val imgFrente: ImageView = v.findViewById(R.id.imgFrente)
        val imgLado: ImageView = v.findViewById(R.id.imgLado)
        val imgCostas: ImageView = v.findViewById(R.id.imgCostas)

        // ✅ opcional (só se você mantiver no XML)
        val tvBadge: TextView? = v.findViewById(R.id.tvBadge)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_progresso, parent, false)
        return VH(v)
    }

    override fun getItemCount(): Int = lista.size

    override fun onBindViewHolder(holder: VH, position: Int) {
        val p = lista[position]

        holder.tvDataPeso.text =
            "${p.data}  |  ⚖ ${String.format(Locale.getDefault(), "%.1f", p.pesoKg)} kg"

        val temFrente = !p.fotoFrenteUri.isNullOrBlank()
        val temLado = !p.fotoLadoUri.isNullOrBlank()
        val temCostas = !p.fotoCostasUri.isNullOrBlank()
        val temAlgumaFoto = temFrente || temLado || temCostas

        // ✅ Mostra/Esconde a linha de fotos (isso deixa MUITO mais bonito)
        holder.rowFotos.visibility = if (temAlgumaFoto) View.VISIBLE else View.GONE

        // ✅ Carrega imagens com placeholder bonitinho
        setImg(holder.imgFrente, p.fotoFrenteUri)
        setImg(holder.imgLado, p.fotoLadoUri)
        setImg(holder.imgCostas, p.fotoCostasUri)

        // ✅ opcional: badge
        holder.tvBadge?.visibility = View.GONE // deixa desligado por padrão

        holder.itemView.setOnClickListener { onClick(position) }
        holder.itemView.setOnLongClickListener { onLongClick(position); true }
    }

    private fun setImg(img: ImageView, uriStr: String?) {
        // Se não tem imagem: coloca placeholder (em vez de null feio)
        if (uriStr.isNullOrBlank()) {
            img.setImageResource(R.drawable.ic_photo_placeholder)
            return
        }

        // ✅ Se vier da nuvem (Storage), é URL https -> usa Coil
        if (uriStr.startsWith("http", ignoreCase = true)) {
            img.load(uriStr) {
                crossfade(true)
                placeholder(R.drawable.ic_photo_placeholder)
                error(R.drawable.ic_photo_placeholder)
            }
            return
        }

        // ✅ Se for local (content:// ou file://)
        try {
            val uri = Uri.parse(uriStr)
            img.load(uri) {
                crossfade(true)
                placeholder(R.drawable.ic_photo_placeholder)
                error(R.drawable.ic_photo_placeholder)
            }
        } catch (e: Exception) {
            img.setImageResource(R.drawable.ic_photo_placeholder)
        }
    }
}
