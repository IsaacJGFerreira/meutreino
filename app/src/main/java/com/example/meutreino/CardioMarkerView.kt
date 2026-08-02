package com.example.meutreino

import android.content.Context
import android.widget.TextView
import com.github.mikephil.charting.components.MarkerView
import com.github.mikephil.charting.data.Entry
import com.github.mikephil.charting.highlight.Highlight
import com.github.mikephil.charting.utils.MPPointF

data class CardioChartPoint(
    val dateLabel: String,
    val minutes: Int
)

class CardioMarkerView(
    context: Context,
    layoutResource: Int
) : MarkerView(context, layoutResource) {

    private val date: TextView = findViewById(R.id.tvMarkerCardioDate)
    private val minutes: TextView = findViewById(R.id.tvMarkerCardioMinutes)

    override fun refreshContent(entry: Entry?, highlight: Highlight?) {
        val point = entry?.data as? CardioChartPoint
        if (point != null) {
            date.text = point.dateLabel
            minutes.text = "${point.minutes} min"
        }
        super.refreshContent(entry, highlight)
    }

    override fun getOffset(): MPPointF = MPPointF(-(width / 2f), -height.toFloat() - 12f)
}
