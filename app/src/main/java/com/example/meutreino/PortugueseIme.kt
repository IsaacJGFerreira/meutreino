package com.example.meutreino

import android.widget.TextView
import java.util.Locale

fun TextView.hintPortugueseIme() {
    // Fallback compatível com SDK/AndroidX antigos (sem imeHintLocales).
    textLocale = Locale("pt", "BR")
}
