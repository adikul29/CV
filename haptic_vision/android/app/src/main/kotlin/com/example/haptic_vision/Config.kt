package com.example.haptic_vision

/**
 * The entire configuration surface of the app. There is no settings screen:
 * change a value here (or `visionApiKey` in local.properties) and rebuild.
 */
object Config {

    /** Which request/response shape the endpoint speaks. */
    val flavor: ApiFlavor = ApiFlavor.GEMINI

    /** The model to ask. Sent as part of the URL for Gemini. */
    const val MODEL: String = "gemini-3.8-flash"

    /**
     * The vision endpoint. `{model}` is substituted with [MODEL].
     *
     * Gemini:    https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
     * Anthropic: https://api.anthropic.com/v1/messages
     * OpenAI:    https://api.openai.com/v1/chat/completions
     */
    const val ENDPOINT: String =
        "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    /** Supplied at build time from local.properties, never committed. */
    val apiKey: String = BuildConfig.VISION_API_KEY

    /** Longest edge of the uploaded JPEG, in pixels. Smaller is faster. */
    const val MAX_IMAGE_EDGE: Int = 1280

    /** JPEG quality for the uploaded screenshot. */
    const val JPEG_QUALITY: Int = 80

    /** Ceiling on the reply. The reply is one short line, so this is generous. */
    const val MAX_OUTPUT_TOKENS: Int = 256

    const val CONNECT_TIMEOUT_MS: Int = 10_000
    const val READ_TIMEOUT_MS: Int = 45_000

    /**
     * The fixed system prompt. It exists to make the reply trivially
     * parseable: one line, one format, nothing else. [VibrationPlan] still
     * copes with a chattier answer, but this is what it asks for.
     */
    val SYSTEM_PROMPT: String = """
        You are a haptic screen reader for a blind user. You receive one screenshot of a phone screen.

        Reply with exactly one line and nothing else, in this format:
        VIBRATE: <comma-separated pulse durations in milliseconds>

        Use between 1 and 6 pulses, each between 40 and 600 ms. Choose the pattern by what the screen needs from the user:
        - 60 — nothing needs attention, the screen is idle or decorative
        - 60,60 — there is text content to read
        - 60,60,60 — an action is waiting: a button, a form, an unread message
        - 60,60,60,60 — a warning, an error, or something went wrong
        - 500 — a high-stakes confirmation: a payment, a password field, or a destructive action

        Pick the single closest match. Never explain, never add any other text.
    """.trimIndent()
}

enum class ApiFlavor { GEMINI, ANTHROPIC, OPENAI }
