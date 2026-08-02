package com.example.meutreino

data class PerformanceChartPoint(
    val dateLabel: String,
    val workoutName: String,
    val load: Float,
    val repetitions: Float,
    val volume: Float
)
