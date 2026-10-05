package com.example.haptic_vision

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** The parser is the one piece with real branching, so it gets real tests. */
class VibrationPlanTest {

    @Test
    fun `parses the format the system prompt asks for`() {
        assertEquals(listOf(60L, 60L, 60L), VibrationPlan.parse("VIBRATE: 60,60,60")?.pulses)
    }

    @Test
    fun `tolerates case, spacing and trailing prose`() {
        assertEquals(listOf(100L, 200L), VibrationPlan.parse("vibrate = 100 ; 200")?.pulses)
        assertEquals(listOf(500L), VibrationPlan.parse("Vibrate: 500\nThis is a payment screen.")?.pulses)
    }

    @Test
    fun `falls back to short codes`() {
        assertEquals(listOf(60L, 60L, 60L), VibrationPlan.parse("V3")?.pulses)
        assertEquals(listOf(60L, 60L, 60L, 60L), VibrationPlan.parse("warning")?.pulses)
    }

    @Test
    fun `falls back to bare numbers`() {
        assertEquals(listOf(80L, 80L), VibrationPlan.parse("80, 80")?.pulses)
    }

    @Test
    fun `clamps out-of-range durations and caps the count`() {
        assertEquals(listOf(1000L), VibrationPlan.parse("VIBRATE: 99999")?.pulses)
        assertEquals(listOf(20L), VibrationPlan.parse("VIBRATE: 1")?.pulses)
        assertEquals(8, VibrationPlan.parse("VIBRATE: 50,50,50,50,50,50,50,50,50,50")?.pulses?.size)
    }

    @Test
    fun `returns null when there is nothing to act on`() {
        assertNull(VibrationPlan.parse(""))
        assertNull(VibrationPlan.parse("I cannot help with that."))
    }

    @Test
    fun `waveform alternates gaps and pulses starting with no delay`() {
        val waveform = VibrationPlan(listOf(60L, 90L)).toWaveform()
        assertEquals(
            listOf(0L, 60L, VibrationPlan.GAP_MS, 90L),
            waveform.toList(),
        )
    }
}
