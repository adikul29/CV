package com.example.haptic_vision

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * The only screen in the app: grant the two permissions, start or stop the
 * service. Everything the app actually does happens in [OverlayService].
 */
class MainActivity : FlutterActivity() {

    private var pendingStart: MethodChannel.Result? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler(::handle)
    }

    private fun handle(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "hasOverlayPermission" -> result.success(Settings.canDrawOverlays(this))

            "requestOverlayPermission" -> {
                startActivity(
                    Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName"),
                    )
                )
                result.success(null)
            }

            "isRunning" -> result.success(OverlayService.isRunning)

            "start" -> {
                if (!Settings.canDrawOverlays(this)) {
                    result.error("no_overlay", "Display over other apps is not allowed yet.", null)
                    return
                }
                if (Config.apiKey.isBlank()) {
                    result.error(
                        "no_api_key",
                        "No API key was baked in. Set visionApiKey in android/local.properties and rebuild.",
                        null,
                    )
                    return
                }
                pendingStart = result
                ensureNotificationPermission()
                requestProjection()
            }

            "stop" -> {
                startService(OverlayService.stopIntent(this))
                result.success(null)
            }

            else -> result.notImplemented()
        }
    }

    /** Without this the foreground-service notification is silently dropped. */
    private fun ensureNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val granted = checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        if (!granted) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
        }
    }

    private fun requestProjection() {
        val manager = getSystemService(MediaProjectionManager::class.java)
        if (manager == null) {
            pendingStart?.error("no_projection", "Screen capture is unavailable.", null)
            pendingStart = null
            return
        }
        startActivityForResult(manager.createScreenCaptureIntent(), REQUEST_PROJECTION)
    }

    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_PROJECTION) return

        val result = pendingStart
        pendingStart = null

        if (resultCode != Activity.RESULT_OK || data == null) {
            result?.error("denied", "Screen sharing was not granted.", null)
            return
        }

        startForegroundService(OverlayService.startIntent(this, resultCode, data))
        result?.success(null)
    }

    private companion object {
        const val CHANNEL = "haptic_vision/control"
        const val REQUEST_PROJECTION = 1001
        const val REQUEST_NOTIFICATIONS = 1002
    }
}
