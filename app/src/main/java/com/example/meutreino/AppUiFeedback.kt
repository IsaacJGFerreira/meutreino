package com.example.meutreino

import android.content.Context
import android.view.Gravity
import android.widget.TextView
import android.widget.Toast
import androidx.annotation.StringRes
import com.google.android.material.dialog.MaterialAlertDialogBuilder

object AppUiFeedback {

    fun showToast(context: Context, message: CharSequence, duration: Int = Toast.LENGTH_SHORT) {
        val toast = Toast.makeText(context.applicationContext, message, duration)
        val textView = TextView(context).apply {
            text = message
            setTextColor(context.getColor(R.color.white))
            textSize = 14f
            setPadding(32, 20, 32, 20)
            background = context.getDrawable(R.drawable.bg_toast_app)
        }
        toast.view = textView
        toast.setGravity(Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL, 0, 120)
        toast.show()
    }

    fun showToast(context: Context, @StringRes messageRes: Int, duration: Int = Toast.LENGTH_SHORT) {
        showToast(context, context.getString(messageRes), duration)
    }

    fun dialogBuilder(context: Context): MaterialAlertDialogBuilder {
        return MaterialAlertDialogBuilder(context, R.style.ThemeOverlay_MeuTreino_AlertDialog)
    }
}
