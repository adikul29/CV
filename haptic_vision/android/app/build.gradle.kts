import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    id("dev.flutter.flutter-gradle-plugin")
}

// The API key is read from local.properties (gitignored) or from -PvisionApiKey
// on the command line, then baked into BuildConfig. Hard-coded from the app's
// point of view, but never committed.
val localProperties = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
val visionApiKey: String =
    (project.findProperty("visionApiKey") as String?)
        ?: localProperties.getProperty("visionApiKey")
        ?: ""

android {
    namespace = "com.example.haptic_vision"
    compileSdk = 35
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    defaultConfig {
        applicationId = "com.example.haptic_vision"
        // 30 (Android 11): WindowMetrics for the capture size, and the
        // mediaProjection foreground service type, are both available.
        minSdk = 30
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "VISION_API_KEY", "\"$visionApiKey\"")
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            // Debug signing so `flutter build apk --release` works out of the
            // box; replace with a real signing config before distributing.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    testImplementation("junit:junit:4.13.2")
}
