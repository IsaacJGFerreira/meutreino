package com.example.meutreino

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CardioMinutesTest {

    @Test
    fun acceptsAnyPositiveWholeMinute() {
        assertEquals(230, CardioMinutes.parse("230"))
        assertEquals(231, CardioMinutes.parse("231"))
    }

    @Test
    fun rejectsZeroDecimalAndOverflowValues() {
        assertNull(CardioMinutes.parse("0"))
        assertNull(CardioMinutes.parse("230.5"))
        assertNull(CardioMinutes.parse("2147483648"))
    }
}
