package com.example.meutreino

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat

class MeuTreinoApp : Application() {
    override fun onCreate() {
        super.onCreate()
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags("pt-BR"))
    }
}
