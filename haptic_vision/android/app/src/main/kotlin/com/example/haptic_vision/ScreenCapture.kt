package com.example.haptic_vision

import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.ByteArrayOutputStream
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume
import kotlin.math.roundToInt

/**
 * One-shot full-screen capture over an already-granted [MediaProjection].
 *
 * A fresh VirtualDisplay and ImageReader are created per capture and released
 * immediately: holding them open between taps would keep the screen-cast
 * indicator spinning and burn memory for a feature used a few times a minute.
 */
class ScreenCapture(
    private val projection: MediaProjection,
    private val width: Int,
    private val height: Int,
    private val densityDpi: Int,
) {

    suspend fun captureOnce(): Bitmap? = suspendCancellableCoroutine { continuation ->
        val handler = Handler(Looper.getMainLooper())
        val reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        val settled = AtomicBoolean(false)
        var display: VirtualDisplay? = null

        fun finish(bitmap: Bitmap?) {
            if (!settled.compareAndSet(false, true)) {
                bitmap?.recycle()
                return
            }
            display?.release()
            reader.setOnImageAvailableListener(null, null)
            reader.close()
            continuation.resume(bitmap)
        }

        reader.setOnImageAvailableListener({ source ->
            if (settled.get()) return@setOnImageAvailableListener
            val image = try {
                source.acquireLatestImage()
            } catch (e: IllegalStateException) {
                Log.w(TAG, "acquireLatestImage failed", e)
                null
            } ?: return@setOnImageAvailableListener

            val bitmap = try {
                image.toBitmap(width, height)
            } catch (e: Exception) {
                Log.w(TAG, "image conversion failed", e)
                null
            } finally {
                image.close()
            }
            finish(bitmap)
        }, handler)

        display = try {
            projection.createVirtualDisplay(
                "haptic-vision",
                width,
                height,
                densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                reader.surface,
                null,
                handler,
            )
        } catch (e: SecurityException) {
            // The projection token is single-use once stopped; the service
            // asks for consent again.
            Log.w(TAG, "createVirtualDisplay rejected", e)
            null
        }

        if (display == null) {
            finish(null)
            return@suspendCancellableCoroutine
        }

        handler.postDelayed({ finish(null) }, CAPTURE_TIMEOUT_MS)
        continuation.invokeOnCancellation { handler.post { finish(null) } }
    }

    private companion object {
        const val TAG = "ScreenCapture"
        const val CAPTURE_TIMEOUT_MS = 4_000L
    }
}

/**
 * RGBA_8888 planes are row-padded to the hardware's stride, so the buffer is
 * wider than the screen. Copy it at the padded width, then crop.
 */
private fun Image.toBitmap(width: Int, height: Int): Bitmap {
    val plane = planes[0]
    val pixelStride = plane.pixelStride
    val rowPadding = plane.rowStride - pixelStride * width
    val paddedWidth = width + rowPadding / pixelStride

    val padded = Bitmap.createBitmap(paddedWidth, height, Bitmap.Config.ARGB_8888)
    padded.copyPixelsFromBuffer(plane.buffer)
    if (rowPadding == 0) return padded

    val cropped = Bitmap.createBitmap(padded, 0, 0, width, height)
    if (cropped !== padded) padded.recycle()
    return cropped
}

/**
 * Downscale to [maxEdge] and encode as base64 JPEG. A 1440x3120 screenshot is
 * several megabytes raw; at 1280px on the long edge it is tens of kilobytes,
 * which is the difference between a snappy answer and a slow one.
 */
fun Bitmap.toJpegBase64(maxEdge: Int, quality: Int): String {
    val longest = maxOf(width, height)
    val source = if (longest <= maxEdge) {
        this
    } else {
        val scale = maxEdge.toFloat() / longest
        Bitmap.createScaledBitmap(
            this,
            (width * scale).roundToInt().coerceAtLeast(1),
            (height * scale).roundToInt().coerceAtLeast(1),
            true,
        )
    }

    val out = ByteArrayOutputStream()
    source.compress(Bitmap.CompressFormat.JPEG, quality, out)
    if (source !== this) source.recycle()
    return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
}
