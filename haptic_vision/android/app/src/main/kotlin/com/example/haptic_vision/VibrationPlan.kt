package com.example.haptic_vision

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/**
 * A parsed vibration instruction: the "on" durations, in milliseconds.
 * Gaps between pulses are added at playback time.
 */
data class VibrationPlan(val pulses: List<Long>) {

    fun toWaveform(): LongArray {
        // VibrationEffect.createWaveform alternates off, on, off, on, ...
        val timings = ArrayList<Long>(pulses.size * 2)
        pulses.forEachIndexed { index, duration ->
            timings.add(if (index == 0) 0L else GAP_MS)
            timings.add(duration)
        }
        return timings.toLongArray()
    }

    companion object {
        const val GAP_MS = 120L

        private const val MIN_PULSE_MS = 20L
        private const val MAX_PULSE_MS = 1_000L
        private const val MAX_PULSES = 8

        private val NUMBER = Regex("""\d{1,5}""")
        private val DIRECTIVE = Regex("""(?i)\bvibrat\w*\s*[:=]?\s*([\d\s,;x*-]+)""")

        /**
         * Short codes the model might answer with instead of a duration list.
         * Deliberately small: the system prompt asks for one format, these are
         * the near misses worth tolerating.
         */
        private val CODES: Map<String, List<Long>> = mapOf(
            "none" to listOf(60L),
            "idle" to listOf(60L),
            "ok" to listOf(60L),
            "short" to listOf(60L),
            "text" to listOf(60L, 60L),
            "double" to listOf(60L, 60L),
            "action" to listOf(60L, 60L, 60L),
            "triple" to listOf(60L, 60L, 60L),
            "warning" to listOf(60L, 60L, 60L, 60L),
            "error" to listOf(60L, 60L, 60L, 60L),
            "long" to listOf(500L),
            "confirm" to listOf(500L),
            "v1" to listOf(60L),
            "v2" to listOf(60L, 60L),
            "v3" to listOf(60L, 60L, 60L),
            "v4" to listOf(60L, 60L, 60L, 60L),
            "v5" to listOf(500L),
        )

        /**
         * Pull a plan out of whatever the model said. Tries, in order: an
         * explicit VIBRATE: directive, a known short code, then any run of
         * numbers in the reply. Returns null when the reply has nothing
         * usable, so the caller can stay silent rather than buzz at random.
         */
        fun parse(reply: String): VibrationPlan? {
            val text = reply.trim()
            if (text.isEmpty()) return null

            DIRECTIVE.find(text)?.groupValues?.get(1)?.let { directive ->
                fromNumbers(NUMBER.findAll(directive).map { it.value })?.let { return it }
            }

            val token = text.lowercase().trim().trim('.', '!', '"', '\'', ':')
            CODES[token]?.let { return VibrationPlan(it) }

            // A code embedded in a longer sentence, e.g. "This is a warning."
            CODES.entries
                .firstOrNull { (code, _) -> Regex("""\b${Regex.escape(code)}\b""").containsMatchIn(token) }
                ?.let { return VibrationPlan(it.value) }

            return fromNumbers(NUMBER.findAll(text).map { it.value })
        }

        private fun fromNumbers(numbers: Sequence<String>): VibrationPlan? {
            val pulses = numbers
                .mapNotNull { it.toLongOrNull() }
                .filter { it > 0 }
                .map { it.coerceIn(MIN_PULSE_MS, MAX_PULSE_MS) }
                .take(MAX_PULSES)
                .toList()
            return if (pulses.isEmpty()) null else VibrationPlan(pulses)
        }
    }
}

/** Plays [VibrationPlan]s, and a distinct error buzz when the request fails. */
class Haptics(context: Context) {

    private val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager = context.getSystemService(VibratorManager::class.java)
        manager?.defaultVibrator
    } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }

    fun play(plan: VibrationPlan) {
        val v = vibrator ?: return
        if (!v.hasVibrator()) return
        v.vibrate(VibrationEffect.createWaveform(plan.toWaveform(), -1))
    }

    /** Two very short ticks: something went wrong, no answer to report. */
    fun playFailure() {
        val v = vibrator ?: return
        if (!v.hasVibrator()) return
        v.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 25, 80, 25), -1))
    }
}
