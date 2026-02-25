package com.example.meutreino

import android.content.Context
import androidx.annotation.StringRes
import com.google.android.material.dialog.MaterialAlertDialogBuilder

/**
 * Compat shim for a historical typo (`AppUiFeedbac`).
 *
 * Keep this object delegating to [AppUiFeedback] so older references compile.
 */
@Deprecated("Use AppUiFeedback")
object AppUiFeedbac {

    fun showToast(context: Context, message: CharSequence, duration: Int) {
        AppUiFeedback.showToast(context, message, duration)
    }

    fun showToast(context: Context, @StringRes messageRes: Int, duration: Int) {
        AppUiFeedback.showToast(context, messageRes, duration)
    }

    fun dialogBuilder(context: Context): MaterialAlertDialogBuilder {
        return AppUiFeedback.dialogBuilder(context)
    }
}
