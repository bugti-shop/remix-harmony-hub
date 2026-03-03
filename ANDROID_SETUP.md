# Android Setup Guide for Npd

**Package Name:** `nota.npd.com`

This guide provides complete Android native code including:
- Full MainActivity.java with Google Sign-In support
- Complete AndroidManifest.xml with all permissions
- Required string resources

---

## Complete AndroidManifest.xml

**File:** `android/app/src/main/AndroidManifest.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="nota.npd.com">

    <!-- ==================== PERMISSIONS ==================== -->
    
    <!-- Internet & Network -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    
    <!-- Push & Local Notifications -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.USE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    
    
    <!-- Foreground Service (for notifications) -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    
    <!-- Microphone (for voice notes/recording) -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-feature android:name="android.hardware.microphone" android:required="false" />
    
    <!-- Camera (for scanning/photos) -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
    
    
    <!-- Biometric (for app lock) -->
    <uses-permission android:name="android.permission.USE_BIOMETRIC" />
    <uses-permission android:name="android.permission.USE_FINGERPRINT" />
    
    <!-- Calendar (for system calendar sync) -->
    <uses-permission android:name="android.permission.READ_CALENDAR" />
    <uses-permission android:name="android.permission.WRITE_CALENDAR" />
    
    <!-- Google Advertising ID for analytics & ads -->
    <uses-permission android:name="com.google.android.gms.permission.AD_ID" />

    <!-- ==================== APPLICATION ==================== -->
    
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true"
        android:networkSecurityConfig="@xml/network_security_config">
        
        <!-- ==================== MAIN ACTIVITY ==================== -->
        
        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:exported="true"
            android:launchMode="singleTask"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="nota.npd.com" />
            </intent-filter>
        </activity>
        
        <!-- ==================== NOTIFICATIONS ==================== -->
        
        <!-- Boot Receiver for rescheduling notifications -->
        <receiver 
            android:name="com.capacitorjs.plugins.localnotifications.LocalNotificationRestoreReceiver"
            android:exported="false">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>
        
        
            
    </application>

</manifest>
```

---

## Complete MainActivity.java (Google Sign-In ONLY)

**File:** `android/app/src/main/java/nota/npd/com/MainActivity.java`

> **⚠️ IMPORTANT: Notifications do NOT depend on MainActivity or AndroidManifest!**
> 
> The `@capacitor/local-notifications` plugin handles EVERYTHING automatically:
> - Permission dialog (Android 13+ system "Allow / Don't Allow")
> - Notification channels (created programmatically in JS via `ensureChannel()`)
> - Boot receiver (auto-registered by the plugin)
> - Scheduling, sounds, vibration — all handled by the plugin
>
> The ONLY reason we customize MainActivity is for **Google Sign-In** (Capgo Social Login plugin).
> If you don't use Google Sign-In, you can use the default `BridgeActivity` with zero modifications.

```java
package nota.npd.com;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;

/**
 * Main Activity for Npd App
 * 
 * ONLY handles Google Sign-In via Capgo Social Login plugin.
 * 
 * Notifications are handled ENTIRELY by @capacitor/local-notifications plugin:
 * - Permission dialog: triggered from JS via LocalNotifications.requestPermissions()
 * - Channels: created from JS via ensureChannel() in notifications.ts
 * - Boot receiver: auto-registered by the plugin
 * 
 * If you don't use Google Sign-In, you can delete this file entirely
 * and use the default BridgeActivity.
 */
public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    
    private static final String TAG = "MainActivity";
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(SocialLoginPlugin.class);
        super.onCreate(savedInstanceState);
        Log.d(TAG, "onCreate: App started with Social Login");
    }
    
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        Log.d(TAG, "onActivityResult: requestCode=" + requestCode);
        
        if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN && 
            requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
            if (pluginHandle != null) {
                SocialLoginPlugin plugin = (SocialLoginPlugin) pluginHandle.getInstance();
                if (plugin != null) {
                    plugin.handleGoogleLoginIntent(requestCode, data);
                }
            }
        }
        
        super.onActivityResult(requestCode, resultCode, data);
    }
    
    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
```

> **No notification code in MainActivity!** The `@capacitor/local-notifications` plugin 
> creates channels, handles permissions, and schedules notifications — all from JavaScript.

---

## Splash Screen Background Color

In your `android/app/src/main/res/values/styles.xml`, add the window background color to your launch theme:

```xml
<item name="android:windowBackground">#3a6cc9</item>
```

---

## Billing Dependency

Add the Google Play Billing library to your `android/app/build.gradle`:

```gradle
dependencies {
    implementation "com.android.billingclient:billing:7.1.1"
}
```

---

## strings.xml

**File:** `android/app/src/main/res/values/strings.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Npd</string>
    <string name="title_activity_main">Npd</string>
    <string name="package_name">nota.npd.com</string>
    <string name="custom_url_scheme">nota.npd.com</string>
    
    <!-- Google Sign-In Web Client ID -->
    <string name="server_client_id">52777395492-vnlk2hkr3pv15dtpgp2m51p7418vll90.apps.googleusercontent.com</string>
</resources>
```

---

## Network Security Config

**File:** `android/app/src/main/res/xml/network_security_config.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
    </domain-config>
</network-security-config>
```

---

## ProGuard Rules (Release Builds)

**File:** `android/app/proguard-rules.pro`

Copy this complete ProGuard configuration to prevent code stripping issues in release builds:

```proguard
# ================================================================================
# PROGUARD RULES FOR NPD APP - RELEASE BUILD
# ================================================================================
# This file contains all necessary rules for Google Sign-In, Capacitor plugins,
# and third-party libraries to work correctly in release/production builds.
# ================================================================================

# ==================== GENERAL OPTIMIZATION SETTINGS ====================
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-verbose

# Keep attributes needed for reflection and serialization
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes SourceFile,LineNumberTable
-keepattributes InnerClasses
-keepattributes EnclosingMethod
-keepattributes Exceptions

# ==================== SUPPRESS COMMON WARNINGS ====================
# These warnings are safe to ignore
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
-dontwarn sun.misc.**
-dontwarn java.lang.invoke.**
-dontwarn kotlin.**
-dontwarn kotlinx.**
-dontwarn okhttp3.internal.platform.**
-dontwarn org.codehaus.mojo.animal_sniffer.**

# ==================== CAPGO SOCIAL LOGIN (CRITICAL) ====================
# Keep ALL Social Login plugin classes - required for Google Sign-In
-keep class ee.forgr.capacitor.social.login.** { *; }
-keepclassmembers class ee.forgr.capacitor.social.login.** { *; }
-keep interface ee.forgr.capacitor.social.login.** { *; }

# Keep GoogleProvider constants for onActivityResult request code matching
-keepclassmembers class ee.forgr.capacitor.social.login.GoogleProvider {
    public static final int REQUEST_AUTHORIZE_GOOGLE_MIN;
    public static final int REQUEST_AUTHORIZE_GOOGLE_MAX;
    public static final int REQUEST_CODE_GOOGLE;
    <fields>;
    <methods>;
}

# Keep AppleProvider if using Apple Sign-In
-keep class ee.forgr.capacitor.social.login.AppleProvider { *; }
-keep class ee.forgr.capacitor.social.login.FacebookProvider { *; }

# Keep ModifiedMainActivityForSocialLoginPlugin interface
-keep interface ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin { *; }
-keep class * implements ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin { *; }

# ==================== GOOGLE SIGN-IN & IDENTITY SERVICES ====================
# Google Play Services Auth
-keep class com.google.android.gms.auth.** { *; }
-keep class com.google.android.gms.auth.api.** { *; }
-keep class com.google.android.gms.auth.api.signin.** { *; }
-keep class com.google.android.gms.auth.api.credentials.** { *; }

# Google Common & Base
-keep class com.google.android.gms.common.** { *; }
-keep class com.google.android.gms.common.api.** { *; }
-keep class com.google.android.gms.tasks.** { *; }

# Google Identity (One Tap)
-keep class com.google.android.gms.identity.** { *; }

# Credential Manager (Android 14+)
-keep class androidx.credentials.** { *; }
-keep class androidx.credentials.provider.** { *; }
-keep class com.google.android.libraries.identity.googleid.** { *; }

# Keep GoogleSignInAccount and related classes
-keep class com.google.android.gms.auth.api.signin.GoogleSignInAccount { *; }
-keep class com.google.android.gms.auth.api.signin.GoogleSignInOptions { *; }
-keep class com.google.android.gms.auth.api.signin.GoogleSignInClient { *; }
-keep class com.google.android.gms.auth.api.signin.GoogleSignInResult { *; }

# ==================== CAPACITOR CORE ====================
# Keep all Capacitor bridge classes
-keep class com.getcapacitor.** { *; }
-keepclassmembers class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }

# Keep BridgeActivity and its methods
-keep class com.getcapacitor.BridgeActivity { *; }
-keep class * extends com.getcapacitor.BridgeActivity { *; }

# Keep Plugin classes and annotations
-keep class com.getcapacitor.Plugin { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep @com.getcapacitor.PluginMethod class * { *; }

# Keep PluginHandle for plugin access
-keep class com.getcapacitor.PluginHandle { *; }
-keep class com.getcapacitor.PluginCall { *; }
-keep class com.getcapacitor.JSObject { *; }
-keep class com.getcapacitor.JSArray { *; }

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# ==================== CAPACITOR PLUGINS ====================
# All Capacitor plugins
-keep class com.capacitorjs.plugins.** { *; }
-keep class capacitor.** { *; }

# App plugin
-keep class com.capacitorjs.plugins.app.** { *; }

# Browser plugin
-keep class com.capacitorjs.plugins.browser.** { *; }

# Filesystem plugin
-keep class com.capacitorjs.plugins.filesystem.** { *; }

# Haptics plugin
-keep class com.capacitorjs.plugins.haptics.** { *; }

# Keyboard plugin
-keep class com.capacitorjs.plugins.keyboard.** { *; }

# Local Notifications plugin
-keep class com.capacitorjs.plugins.localnotifications.** { *; }
-keep class com.capacitorjs.plugins.localnotifications.LocalNotificationRestoreReceiver { *; }

# Preferences plugin
-keep class com.capacitorjs.plugins.preferences.** { *; }

# Push Notifications plugin
-keep class com.capacitorjs.plugins.pushnotifications.** { *; }

# Share plugin
-keep class com.capacitorjs.plugins.share.** { *; }

# Status Bar plugin
-keep class com.capacitorjs.plugins.statusbar.** { *; }

# Native Biometric plugin
-keep class capacitor.native.biometric.** { *; }
-keep class com.anthropic.nativebiometric.** { *; }

# Calendar plugin
-keep class de.nicovince.capacitor.calendar.** { *; }
-keep class com.ebarooni.capacitorcalendar.** { *; }


# ==================== REVENUECAT ====================
-keep class com.revenuecat.** { *; }
-keepclassmembers class com.revenuecat.** { *; }
-keep class com.revenuecat.purchases.** { *; }
-keep class com.revenuecat.purchases.ui.** { *; }

# ==================== KOTLIN COROUTINES ====================
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.coroutines.** {
    volatile <fields>;
}
-keep class kotlinx.coroutines.** { *; }

# ==================== OKHTTP & NETWORKING ====================
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# ==================== JSON PARSING ====================
# Gson
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer
-keepclassmembers,allowobfuscation class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# JSON objects used by Capacitor
-keep class org.json.** { *; }

# ==================== WEBVIEW & JAVASCRIPT INTERFACE ====================
# Keep JavaScript interface methods for WebView bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep WebView classes
-keep class android.webkit.** { *; }

# ==================== ANDROID COMPONENTS ====================
# Keep Activities, Services, Receivers
-keep class * extends android.app.Activity { *; }
-keep class * extends android.app.Service { *; }
-keep class * extends android.content.BroadcastReceiver { *; }
-keep class * extends android.content.ContentProvider { *; }

# Keep Parcelable implementations
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep Serializable classes
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ==================== ENUMS ====================
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ==================== R CLASS ====================
-keepclassmembers class **.R$* {
    public static <fields>;
}

# ==================== DEBUGGING & CRASH REPORTING ====================
# Keep line numbers for better stack traces
-renamesourcefileattribute SourceFile
-keepattributes SourceFile,LineNumberTable

# ==================== APP SPECIFIC ====================
# Keep MainActivity and all its methods
-keep class nota.npd.com.MainActivity { *; }
-keep class nota.npd.com.** { *; }
```

---

### Enable ProGuard in build.gradle

**File:** `android/app/build.gradle`

Update your release build type configuration:

```gradle
android {
    // ... other config ...
    
    buildTypes {
        debug {
            minifyEnabled false
            debuggable true
        }
        release {
            minifyEnabled true
            shrinkResources true
            debuggable false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            
            // Optional: Sign with release key
            // signingConfig signingConfigs.release
        }
    }
    
    // Prevent R8 from removing unused code too aggressively
    packagingOptions {
        resources {
            excludes += ['META-INF/DEPENDENCIES', 'META-INF/LICENSE', 'META-INF/LICENSE.txt', 'META-INF/NOTICE', 'META-INF/NOTICE.txt']
        }
    }
}
```

---

### Verify Release Build

Run these commands to test your release build:

```bash
# 1. Clean previous builds
cd android
./gradlew clean

# 2. Build release APK
./gradlew assembleRelease

# 3. Check for ProGuard issues in the build output
# Look for warnings in: android/app/build/outputs/mapping/release/

# 4. Install and test on device
adb install -r app/build/outputs/apk/release/app-release.apk
```

### Common Release Build Errors & Fixes

| Error | Solution |
|-------|----------|
| `ClassNotFoundException` for plugin | Add `-keep class <package>.** { *; }` rule |
| `NoSuchMethodError` at runtime | Add `-keepclassmembers` for the affected class |
| Google Sign-In shows blank/crashes | Verify SHA-1 fingerprint matches release keystore |
| `NullPointerException` in onActivityResult | Ensure `REQUEST_AUTHORIZE_GOOGLE_*` constants are kept |
| RevenueCat not working | Add `-keep class com.revenuecat.** { *; }` |

---

## Google Cloud Console Setup

You need **TWO** OAuth client IDs:

### 1. Web Client ID (already have)
- `52777395492-vnlk2hkr3pv15dtpgp2m51p7418vll90.apps.googleusercontent.com`
- Type: Web application
- Used in: `capacitor.config.ts` and `strings.xml`

### 2. Android Client ID (create this)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services → Credentials
3. Click "Create Credentials" → "OAuth client ID"
4. Application type: **Android**
5. Package name: `nota.npd.com`
6. SHA-1 certificate fingerprint:

```bash
# For debug keystore
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Or use Gradle
cd android
./gradlew signingReport
```

---

## Build Steps

```bash
# 1. Install dependencies
npm install

# 2. Add Android platform (if not already)
npx cap add android

# 3. Sync project
npx cap sync android

# 4. Open in Android Studio
npx cap open android

# Or run directly
npx cap run android
```

---

## Permissions Explained

| Permission | Purpose |
|------------|---------|
| `INTERNET` | Network access for syncing & API calls |
| `ACCESS_NETWORK_STATE` | Check network connectivity |
| `ACCESS_WIFI_STATE` | Check WiFi connectivity |
| `POST_NOTIFICATIONS` | Show notifications (Android 13+) |
| `VIBRATE` | Haptic feedback & notification vibration |
| `RECEIVE_BOOT_COMPLETED` | Reschedule notifications after device restart |
| `SCHEDULE_EXACT_ALARM` | Precise notification timing |
| `USE_EXACT_ALARM` | Exact alarm scheduling (Android 12+) |
| `WAKE_LOCK` | Keep device awake for background tasks |
| `ACCESS_FINE_LOCATION` | GPS for location-based reminders |
| `ACCESS_COARSE_LOCATION` | Approximate location |
| `ACCESS_BACKGROUND_LOCATION` | Location tracking when app is in background |
| `FOREGROUND_SERVICE` | Run foreground services |
| `FOREGROUND_SERVICE_LOCATION` | Location service in foreground |
| `RECORD_AUDIO` | Voice notes & voice recording |
| `MODIFY_AUDIO_SETTINGS` | Audio settings for recording |
| `CAMERA` | Photo capture & scanning |
| `USE_BIOMETRIC` | Fingerprint/face unlock for app lock |
| `USE_FINGERPRINT` | Fingerprint authentication (legacy) |
| `AD_ID` | Google Advertising ID for analytics & ads |

---

## Troubleshooting

### Google Sign-In shows browser instead of native picker
- Ensure `MainActivity.java` implements `ModifiedMainActivityForSocialLoginPlugin`
- Verify both Web and Android OAuth client IDs exist in Google Cloud Console
- Check SHA-1 fingerprint matches your signing key

### Notifications not showing
- Grant `POST_NOTIFICATIONS` permission in Settings
- Disable battery optimization for the app
- Check notification channel settings

### Location not working in background
- Grant "Allow all the time" location permission
- Disable battery saver or add app to exceptions
- Check manufacturer-specific restrictions (Xiaomi, Huawei, Samsung)
