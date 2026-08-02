package com.example.meutreino

import android.content.Context
import android.widget.TextView
import com.github.mikephil.charting.components.MarkerView
import com.github.mikephil.charting.data.Entry
import com.github.mikephil.charting.highlight.Highlight
import com.github.mikephil.charting.utils.MPPointF
import java.text.NumberFormat
import java.util.Locale

class PerformanceMarkerView(
    context: Context,
    layoutResource: Int
) : MarkerView(context, layoutResource) {

    private val tvDate: TextView = findViewById(R.id.tvMarkerPerformanceDate)
    private val tvWorkout: TextView = findViewById(R.id.tvMarkerPerformanceWorkout)
    private val tvLoad: TextView = findViewById(R.id.tvMarkerPerformanceLoad)
    private val tvRepetitions: TextView = findViewById(R.id.tvMarkerPerformanceRepetitions)
    private val tvVolume: TextView = findViewById(R.id.tvMarkerPerformanceVolume)
    private val numberFormat = NumberFormat.getNumberInstance(Locale("pt", "BR")).apply {
        maximumFractionDigits = 1
    }

    override fun refreshContent(entry: Entry?, highlight: Highlight?) {
        val point = entry?.data as? PerformanceChartPoint
        if (point != null) {
            tvDate.text = point.dateLabel
            tvWorkout.text = point.workoutName
            tvLoad.text = "Carga: ${numberFormat.format(point.load)} kg"
            tvRepetitions.text = "Repetições: ${numberFormat.format(point.repetitions)}"
            tvVolume.text = "Volume: ${numberFormat.format(point.volume)} kg·rep"
        }
        super.refreshContent(entry, highlight)
    }

    override fun getOffset(): MPPointF = MPPointF(-(width / 2f), -height.toFloat() - 12f)
}
