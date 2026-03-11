package com.example.meutreino

import android.widget.TextView
import androidx.core.os.LocaleListCompat
import androidx.core.widget.TextViewCompat

fun TextView.hintPortugueseIme() {
    TextViewCompat.setImeHintLocales(this, LocaleListCompat.forLanguageTags("pt-BR"))
}
