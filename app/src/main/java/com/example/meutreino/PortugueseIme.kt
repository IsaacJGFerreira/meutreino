package com.example.meutreino

import android.os.Build
import android.os.LocaleList
import android.widget.TextView

fun TextView.hintPortugueseIme() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        imeHintLocales = LocaleList.forLanguageTags("pt-BR")
    }
}
