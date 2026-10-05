package com.example.haptic_vision

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

sealed interface VisionResult {
    data class Reply(val text: String) : VisionResult
    data class Failure(val message: String) : VisionResult
}

/**
 * Posts a screenshot and the fixed system prompt to the configured endpoint.
 *
 * Raw HTTP rather than a vendor SDK on purpose: the endpoint is meant to be
 * swappable, and [ApiFlavor] is the only thing that has to change to point the
 * app at a different provider or a self-hosted proxy.
 */
class VisionClient {

    suspend fun describe(jpegBase64: String): VisionResult = withContext(Dispatchers.IO) {
        if (Config.apiKey.isBlank()) {
            return@withContext VisionResult.Failure(
                "No API key. Set visionApiKey in android/local.properties and rebuild."
            )
        }

        val url = Config.ENDPOINT.replace("{model}", Config.MODEL)
        var connection: HttpURLConnection? = null
        try {
            connection = (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                connectTimeout = Config.CONNECT_TIMEOUT_MS
                readTimeout = Config.READ_TIMEOUT_MS
                setRequestProperty("Content-Type", "application/json")
                authHeaders().forEach { (name, value) -> setRequestProperty(name, value) }
            }

            connection.outputStream.use { it.write(requestBody(jpegBase64).toByteArray()) }

            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()
                ?.use { it.readText() }
                .orEmpty()

            if (status !in 200..299) {
                Log.w(TAG, "HTTP $status from vision endpoint")
                return@withContext VisionResult.Failure("HTTP $status: ${body.take(300)}")
            }
            parseReply(body)
        } catch (e: Exception) {
            Log.w(TAG, "vision request failed", e)
            VisionResult.Failure(e.message ?: e.javaClass.simpleName)
        } finally {
            connection?.disconnect()
        }
    }

    private fun authHeaders(): Map<String, String> = when (Config.flavor) {
        ApiFlavor.GEMINI -> mapOf("x-goog-api-key" to Config.apiKey)
        ApiFlavor.ANTHROPIC -> mapOf(
            "x-api-key" to Config.apiKey,
            "anthropic-version" to "2023-06-01",
        )
        ApiFlavor.OPENAI -> mapOf("Authorization" to "Bearer ${Config.apiKey}")
    }

    private fun requestBody(jpegBase64: String): String = when (Config.flavor) {
        ApiFlavor.GEMINI -> JSONObject().apply {
            put("systemInstruction", JSONObject().put("parts", JSONArray().put(
                JSONObject().put("text", Config.SYSTEM_PROMPT)
            )))
            put("contents", JSONArray().put(JSONObject().apply {
                put("role", "user")
                put("parts", JSONArray().apply {
                    put(JSONObject().put("inlineData", JSONObject().apply {
                        put("mimeType", MIME_JPEG)
                        put("data", jpegBase64)
                    }))
                    put(JSONObject().put("text", USER_PROMPT))
                })
            }))
            put("generationConfig", JSONObject().apply {
                put("maxOutputTokens", Config.MAX_OUTPUT_TOKENS)
                put("temperature", 0)
            })
        }.toString()

        ApiFlavor.ANTHROPIC -> JSONObject().apply {
            put("model", Config.MODEL)
            put("max_tokens", Config.MAX_OUTPUT_TOKENS)
            put("system", Config.SYSTEM_PROMPT)
            put("messages", JSONArray().put(JSONObject().apply {
                put("role", "user")
                put("content", JSONArray().apply {
                    put(JSONObject().apply {
                        put("type", "image")
                        put("source", JSONObject().apply {
                            put("type", "base64")
                            put("media_type", MIME_JPEG)
                            put("data", jpegBase64)
                        })
                    })
                    put(JSONObject().apply {
                        put("type", "text")
                        put("text", USER_PROMPT)
                    })
                })
            }))
            // One short line is wanted, so keep reasoning depth at the floor.
            put("output_config", JSONObject().put("effort", "low"))
        }.toString()

        ApiFlavor.OPENAI -> JSONObject().apply {
            put("model", Config.MODEL)
            put("max_completion_tokens", Config.MAX_OUTPUT_TOKENS)
            put("messages", JSONArray().apply {
                put(JSONObject().apply {
                    put("role", "system")
                    put("content", Config.SYSTEM_PROMPT)
                })
                put(JSONObject().apply {
                    put("role", "user")
                    put("content", JSONArray().apply {
                        put(JSONObject().apply {
                            put("type", "image_url")
                            put("image_url", JSONObject().put(
                                "url", "data:$MIME_JPEG;base64,$jpegBase64"
                            ))
                        })
                        put(JSONObject().apply {
                            put("type", "text")
                            put("text", USER_PROMPT)
                        })
                    })
                })
            })
        }.toString()
    }

    private fun parseReply(body: String): VisionResult {
        val json = JSONObject(body)
        return when (Config.flavor) {
            ApiFlavor.GEMINI -> {
                json.optJSONObject("promptFeedback")
                    ?.optString("blockReason")
                    ?.takeIf { it.isNotEmpty() }
                    ?.let { return VisionResult.Failure("Blocked by the model: $it") }

                val candidate = json.optJSONArray("candidates")?.optJSONObject(0)
                    ?: return VisionResult.Failure("No candidates in the response.")
                val parts = candidate.optJSONObject("content")?.optJSONArray("parts")
                // Thinking models return thought-summary parts alongside the
                // answer; only the non-thought text parts are the reply.
                val text = parts.textParts()
                if (text.isNotBlank()) return VisionResult.Reply(text)

                val finish = candidate.optString("finishReason").ifEmpty { "unknown" }
                VisionResult.Failure("Empty reply (finishReason=$finish).")
            }

            ApiFlavor.ANTHROPIC -> {
                if (json.optString("stop_reason") == "refusal") {
                    return VisionResult.Failure("The model declined the request.")
                }
                val text = json.optJSONArray("content").textBlocks()
                if (text.isNotBlank()) VisionResult.Reply(text)
                else VisionResult.Failure("Empty reply.")
            }

            ApiFlavor.OPENAI -> {
                val text = json.optJSONArray("choices")
                    ?.optJSONObject(0)
                    ?.optJSONObject("message")
                    ?.optString("content")
                    .orEmpty()
                if (text.isNotBlank()) VisionResult.Reply(text)
                else VisionResult.Failure("Empty reply.")
            }
        }
    }

    /** Gemini: concatenate text parts, skipping thought summaries. */
    private fun JSONArray?.textParts(): String {
        val array = this ?: return ""
        return (0 until array.length())
            .mapNotNull { array.optJSONObject(it) }
            .filterNot { it.optBoolean("thought", false) }
            .map { it.optString("text") }
            .filter { it.isNotEmpty() }
            .joinToString(" ")
            .trim()
    }

    /** Anthropic: thinking blocks share the array with the answer. */
    private fun JSONArray?.textBlocks(): String {
        val array = this ?: return ""
        return (0 until array.length())
            .mapNotNull { array.optJSONObject(it) }
            .filter { it.optString("type") == "text" }
            .map { it.optString("text") }
            .filter { it.isNotEmpty() }
            .joinToString(" ")
            .trim()
    }

    private companion object {
        const val TAG = "VisionClient"
        const val MIME_JPEG = "image/jpeg"
        const val USER_PROMPT = "Screenshot attached. Reply with the VIBRATE line only."
    }
}
