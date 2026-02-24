package com.example.meutreino

import android.content.Context
import android.widget.TextView
import com.github.mikephil.charting.components.MarkerView
import com.github.mikephil.charting.data.Entry
import com.github.mikephil.charting.highlight.Highlight
import com.github.mikephil.charting.utils.MPPointF
import kotlin.math.roundToInt

class GraficoMarkerView(
    context: Context,
    layoutResource: Int,
    private val labels: List<String>
) : MarkerView(context, layoutResource) {

    private val tvTitulo: TextView = findViewById(R.id.tvMarkerTitulo)
    private val tvValor: TextView = findViewById(R.id.tvMarkerValor)

    override fun refreshContent(e: Entry?, highlight: Highlight?) {
        if (e != null) {
            val i = e.x.roundToInt().coerceIn(0, labels.lastIndex)
            tvTitulo.text = labels[i]
            tvValor.text = "${String.format("%.1f", e.y)} kg"
        }
        super.refreshContent(e, highlight)
    }

    override fun getOffset(): MPPointF {
        // centraliza o tooltip acima do ponto
        return MPPointF(-(width / 2f), -height.toFloat() - 12f)
    }
}
