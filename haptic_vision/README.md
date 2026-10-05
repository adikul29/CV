# Haptic Vision

A floating button that sits on top of every app. Tap it: it screenshots the
screen, sends the image and a fixed system prompt to a vision model, and
answers you in vibrations.

No history, no settings screen, no second screen. The only UI while the app is
in use is a 56dp circle.

## What happens on a tap

1. The bubble hides itself for ~48ms so it stays out of its own screenshot.
2. `MediaProjection` captures one frame of the whole screen.
3. The frame is scaled to 1280px on its long edge and JPEG-encoded (a raw
   1440×3120 screenshot is several MB; this is tens of KB, which is most of the
   round-trip time).
4. The base64 image plus the fixed system prompt go to the configured endpoint.
   The bubble shows a spinner while the request is in flight.
5. The reply is parsed for a vibration instruction and played on the device
   vibrator. A failure plays two short ticks instead, so a tap is never silent.

The default system prompt asks the model for one line and one format:

```
VIBRATE: 60,60,60
```

…where each number is a pulse length in milliseconds, chosen by what the screen
needs from the user — one pulse for idle, two for text to read, three for a
waiting action, four for a warning, one long 500ms pulse for a payment or
password screen. Change the mapping in `Config.SYSTEM_PROMPT`.

The parser (`VibrationPlan.parse`) is deliberately more forgiving than the
prompt: it accepts a `VIBRATE:` directive, a short code (`V3`, `warning`,
`double`, …), or any bare run of numbers, clamps each pulse to 20–1000ms, caps
the pattern at 8 pulses, and returns nothing at all when the reply has nothing
usable in it. Its tests are in
`android/app/src/test/kotlin/.../VibrationPlanTest.kt`.

## iOS

**This works on Android only, and that is not a shortcut.** iOS has no public
API for a window that floats above other apps, and no way to capture the whole
screen from the background — `ReplayKit` records only with a system-initiated
prompt and cannot be triggered from a floating control in another app. The
feature as specified cannot be built on iOS without private APIs.

The project is a Flutter project, so the codebase and the one-screen control UI
are cross-platform, and `bootstrap.sh` scaffolds the iOS runner so the project
builds. On iOS the app shows a screen explaining the above and nothing else.

## Where the logic lives

Everything in the pipeline is Kotlin, in a foreground service:

| File | Role |
| --- | --- |
| `android/.../Config.kt` | The whole configuration surface: endpoint, model, prompt, image size |
| `android/.../OverlayService.kt` | The floating button, the drag/tap handling, and the pipeline |
| `android/.../ScreenCapture.kt` | One-shot `MediaProjection` capture, row-stride handling, JPEG encoding |
| `android/.../VisionClient.kt` | The HTTP call and reply parsing, per API flavor |
| `android/.../VibrationPlan.kt` | Reply → vibration pattern, and playback |
| `lib/main.dart` | The one screen: grant permissions, start, stop |

Dart holds no part of the pipeline on purpose. When you tap the button you are
in some other app, and there is no guarantee a Flutter engine is still alive —
a background Dart isolate would add a moving part for no gain.

Raw `HttpURLConnection` rather than a vendor SDK, for the same kind of reason:
the endpoint is meant to be swappable, so the request shape has to be ours.

## Setup

```bash
./bootstrap.sh                      # Gradle wrapper, icons, iOS runner, pub get
$EDITOR android/local.properties    # set visionApiKey=...
flutter run
```

Then, in the app: allow "display over other apps", tap **Start**, and choose
**Entire screen** in Android's screen-sharing prompt.

`minSdk` is 30 (Android 11). `TYPE_APPLICATION_OVERLAY`, the `mediaProjection`
foreground-service type and `WindowMetrics` are all available there.

## Configuration

Everything is in `Config.kt`, except the key.

```kotlin
val flavor = ApiFlavor.GEMINI      // GEMINI | ANTHROPIC | OPENAI
const val MODEL = "gemini-3.8-flash"
const val ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
```

`{model}` in the endpoint is substituted with `MODEL`. The three flavors cover
the request/response shape and the auth header; point `ENDPOINT` at a
self-hosted proxy that speaks one of them and nothing else has to change.

The **API key is not in the source tree**. It is read at build time from
`visionApiKey` in `android/local.properties` (gitignored, one line: `visionApiKey=...`) — or
from `-PvisionApiKey=...` — and baked into `BuildConfig.VISION_API_KEY`. From the
app's point of view it is hard-coded, as asked; it just never reaches the
repository.

That still means the key ships inside the APK, where anyone with the file can
extract it. It is fine for a personal build on your own device. For anything
you hand to someone else, put a thin proxy in front of the model, keep the key
there, and point `ENDPOINT` at the proxy.

## What the app can see

While it runs, the service holds a screen-capture grant: every tap sends a
picture of whatever is on screen — messages, banking apps, passwords in plain
view — to the configured endpoint. Android makes this visible (a consent dialog
per session, a persistent notification, the screen-cast indicator), and the
service stops the moment you revoke sharing from the system UI or tap **Stop**.
Worth knowing before you leave it running.

## Status

Written but not compiled: this was built in a container with no Flutter SDK and
no Android SDK, so nothing here has been through a compiler, a device, or a
real endpoint. Expect to fix small things on the first build. The pieces most
worth checking first are the `MediaProjection` sequence on Android 14+ (the
service must be foregrounded before the token is consumed, and the callback
registered before `createVirtualDisplay`) and the exact Gemini model id.
