package com.example.meutreino

import android.content.Context
import android.widget.TextView
import com.github.mikephil.charting.components.MarkerView
import com.github.mikephil.charting.data.Entry
import com.github.mikephil.charting.highlight.Highlight
import com.github.mikephil.charting.utils.MPPointF

class PesoMarkerView(
    context: Context,
    layoutResource: Int,
    private val labelsX: List<String> // datas formatadas
) : MarkerView(context, layoutResource) {

    private val tvPeso: TextView = findViewById(R.id.tvMarkerPeso)
    private val tvData: TextView = findViewById(R.id.tvMarkerData)

    override fun refreshContent(e: Entry?, highlight: Highlight?) {
        if (e != null) {
            val peso = e.y
            tvPeso.text = "${formatPeso(peso)} kg"
            tvData.text = labelsX.safeLabelAt(e.x.toInt())
        }
        super.refreshContent(e, highlight)
    }

    override fun getOffset(): MPPointF {
        // centraliza o marker acima do ponto
        return MPPointF(-(width / 2f), -height.toFloat() - 10f)
    }

    private fun formatPeso(p: Float): String {
        return if (p % 1f == 0f) p.toInt().toString() else String.format("%.1f", p)
    }

    private fun List<String>.safeLabelAt(index: Int): String {
        if (isEmpty()) return "Sem data"
        return this[index.coerceIn(0, lastIndex)]
    }
}
