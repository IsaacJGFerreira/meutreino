package com.example.meutreino

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TreinoRegistroUtilsTest {

    @Test
    fun timeOfPrefersFirestoreCreatedAt() {
        val record = TreinoRegistro(
            id = "remote",
            dataHora = "01/01/2020 10:00",
            nomeTreino = "Treino A",
            completo = true,
            exercicios = emptyList(),
            createdAt = 2_000L
        )

        assertEquals(2_000L, TreinoRegistroUtils.timeOf(record))
    }

    @Test
    fun timeOfParsesLegacyWebDateWithComma() {
        val record = TreinoRegistro(
            id = "legacy-web",
            dataHora = "04/09/2026, 21:15",
            nomeTreino = "Treino A",
            completo = true,
            exercicios = emptyList()
        )

        assertTrue(TreinoRegistroUtils.timeOf(record) > 0L)
    }
}
