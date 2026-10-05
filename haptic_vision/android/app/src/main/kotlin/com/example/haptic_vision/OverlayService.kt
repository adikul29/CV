package com.example.haptic_vision

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.PixelFormat
import android.graphics.drawable.Icon
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.ProgressBar
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.abs

/**
 * Owns everything that happens while the app is "running": the floating
 * button, the screen capture, the vision request and the vibration.
 *
 * It all lives in the service rather than in Dart because the user is in some
 * other app when they tap the button — there is no guarantee a Flutter engine
 * is still alive at that point.
 */
class OverlayService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val client = VisionClient()
    private lateinit var haptics: Haptics
    private lateinit var windowManager: WindowManager

    private var projection: MediaProjection? = null
    private var bubble: View? = null
    private var spinner: ProgressBar? = null
    private var dot: View? = null
    private var busy = false

    private val projectionCallback = object : MediaProjection.Callback() {
        override fun onStop() {
            // The user revoked screen sharing from the system UI.
            Log.i(TAG, "projection stopped by the system")
            stopSelf()
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        haptics = Haptics(this)
        windowManager = getSystemService(WindowManager::class.java)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }

        if (!Settings.canDrawOverlays(this)) {
            Log.w(TAG, "overlay permission missing")
            stopSelf()
            return START_NOT_STICKY
        }

        // On Android 14+ the service must already be in the foreground with the
        // mediaProjection type before the projection token can be consumed.
        startForeground(
            NOTIFICATION_ID,
            buildNotification(),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION,
        )

        if (projection == null) {
            val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, 0) ?: 0
            val data = intent?.resultData()
            if (resultCode == 0 || data == null) {
                Log.w(TAG, "no projection consent in the start intent")
                stopSelf()
                return START_NOT_STICKY
            }
            projection = getSystemService(MediaProjectionManager::class.java)
                ?.getMediaProjection(resultCode, data)
            if (projection == null) {
                Log.w(TAG, "could not obtain a MediaProjection")
                stopSelf()
                return START_NOT_STICKY
            }
            // Required before createVirtualDisplay on API 34+.
            projection?.registerCallback(projectionCallback, Handler(Looper.getMainLooper()))
        }

        if (bubble == null) addBubble()
        isRunning = true
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        isRunning = false
        scope.cancel()
        bubble?.let { view ->
            runCatching { windowManager.removeView(view) }
                .onFailure { Log.w(TAG, "removeView failed", it) }
        }
        bubble = null
        projection?.unregisterCallback(projectionCallback)
        projection?.stop()
        projection = null
        super.onDestroy()
    }

    // ---------------------------------------------------------------- overlay

    private fun addBubble() {
        val view = LayoutInflater.from(this).inflate(R.layout.overlay_bubble, null)
        spinner = view.findViewById(R.id.bubble_spinner)
        dot = view.findViewById(R.id.bubble_dot)

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            val bounds = windowManager.currentWindowMetrics.bounds
            x = bounds.width() - (72 * resources.displayMetrics.density).toInt()
            y = bounds.height() / 3
        }

        view.setOnTouchListener(DragOrTapListener(params, ::onTap))
        windowManager.addView(view, params)
        bubble = view
    }

    /** Distinguishes a tap from a drag, and moves the window while dragging. */
    private inner class DragOrTapListener(
        private val params: WindowManager.LayoutParams,
        private val onTap: () -> Unit,
    ) : View.OnTouchListener {
        private val slop = ViewConfiguration.get(this@OverlayService).scaledTouchSlop
        private var downX = 0f
        private var downY = 0f
        private var startX = 0
        private var startY = 0
        private var dragging = false

        override fun onTouch(view: View, event: MotionEvent): Boolean {
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downX = event.rawX
                    downY = event.rawY
                    startX = params.x
                    startY = params.y
                    dragging = false
                    return true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - downX
                    val dy = event.rawY - downY
                    if (!dragging && (abs(dx) > slop || abs(dy) > slop)) dragging = true
                    if (dragging) {
                        params.x = startX + dx.toInt()
                        params.y = startY + dy.toInt()
                        runCatching { windowManager.updateViewLayout(view, params) }
                    }
                    return true
                }
                MotionEvent.ACTION_UP -> {
                    if (!dragging) onTap()
                    return true
                }
            }
            return false
        }
    }

    private fun setSpinning(spinning: Boolean) {
        spinner?.visibility = if (spinning) View.VISIBLE else View.GONE
        dot?.visibility = if (spinning) View.GONE else View.VISIBLE
    }

    /**
     * The bubble is part of the screen, so it would appear in its own
     * screenshot. Hiding the root view for a couple of frames keeps it out.
     */
    private fun setBubbleVisible(visible: Boolean) {
        bubble?.visibility = if (visible) View.VISIBLE else View.INVISIBLE
    }

    // --------------------------------------------------------------- pipeline

    private fun onTap() {
        if (busy) return
        busy = true
        scope.launch {
            try {
                runPipeline()
            } catch (e: Exception) {
                Log.w(TAG, "pipeline failed", e)
                haptics.playFailure()
            } finally {
                setBubbleVisible(true)
                setSpinning(false)
                busy = false
            }
        }
    }

    private suspend fun runPipeline() {
        val activeProjection = projection ?: run {
            haptics.playFailure()
            return
        }

        setBubbleVisible(false)
        delay(HIDE_FRAMES_MS)

        val metrics = windowManager.currentWindowMetrics.bounds
        val capture = ScreenCapture(
            projection = activeProjection,
            width = metrics.width(),
            height = metrics.height(),
            densityDpi = resources.displayMetrics.densityDpi,
        )
        val bitmap = capture.captureOnce()

        setBubbleVisible(true)
        setSpinning(true)

        if (bitmap == null) {
            Log.w(TAG, "capture returned no frame")
            haptics.playFailure()
            return
        }

        val encoded = withContext(Dispatchers.Default) {
            try {
                bitmap.toJpegBase64(Config.MAX_IMAGE_EDGE, Config.JPEG_QUALITY)
            } finally {
                bitmap.recycle()
            }
        }

        when (val result = client.describe(encoded)) {
            is VisionResult.Reply -> {
                val plan = VibrationPlan.parse(result.text)
                if (plan == null) {
                    Log.w(TAG, "no vibration instruction in the reply")
                    haptics.playFailure()
                } else {
                    haptics.play(plan)
                }
            }
            is VisionResult.Failure -> {
                Log.w(TAG, "vision request failed: ${result.message}")
                haptics.playFailure()
            }
        }
    }

    // ----------------------------------------------------------- notification

    private fun buildNotification(): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        if (manager?.getNotificationChannel(CHANNEL_ID) == null) {
            manager?.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    getString(R.string.notification_channel_name),
                    NotificationManager.IMPORTANCE_LOW,
                )
            )
        }

        val stop = PendingIntent.getService(
            this,
            0,
            Intent(this, OverlayService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(getString(R.string.notification_text))
            .setSmallIcon(R.drawable.ic_bubble_notification)
            .setOngoing(true)
            .addAction(
                Notification.Action.Builder(
                    Icon.createWithResource(this, R.drawable.ic_bubble_notification),
                    getString(R.string.notification_stop),
                    stop,
                ).build()
            )
            .build()
    }

    private fun Intent.resultData(): Intent? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
        } else {
            @Suppress("DEPRECATION")
            getParcelableExtra(EXTRA_RESULT_DATA) as Intent?
        }

    companion object {
        private const val TAG = "OverlayService"
        private const val CHANNEL_ID = "haptic_vision_overlay"
        private const val NOTIFICATION_ID = 1
        private const val HIDE_FRAMES_MS = 48L

        const val ACTION_START = "com.example.haptic_vision.START"
        const val ACTION_STOP = "com.example.haptic_vision.STOP"
        const val EXTRA_RESULT_CODE = "result_code"
        const val EXTRA_RESULT_DATA = "result_data"

        /** Read from Dart to decide which button to show. */
        @Volatile
        var isRunning: Boolean = false
            private set

        fun startIntent(context: Context, resultCode: Int, data: Intent): Intent =
            Intent(context, OverlayService::class.java)
                .setAction(ACTION_START)
                .putExtra(EXTRA_RESULT_CODE, resultCode)
                .putExtra(EXTRA_RESULT_DATA, data)

        fun stopIntent(context: Context): Intent =
            Intent(context, OverlayService::class.java).setAction(ACTION_STOP)
    }
}
