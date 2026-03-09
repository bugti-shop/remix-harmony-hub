# Android Setup Guide for Npd

---

## Complete AndroidManifest.xml

**File:** `android/app/src/main/AndroidManifest.xml`

```xml
 
    
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
    
     
```

---

## Complete MainActivity.java (Google Sign-In + Optimized Splash Screen)

**File:** `android/app/src/main/java/nota/npd/com/MainActivity.java`

```java
package nota.npd.com;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;

/**
 * Main Activity for Npd App
 * 
 * Handles:
 * 1. Google Sign-In via Capgo Social Login plugin
 * 2. Android 12+ SplashScreen API for instant startup (WhatsApp-style)
 *    - Splash shows only during cold start, not on every resume
 *    - Dismisses as fast as possible (~200ms)
 * 
 * Notifications are handled ENTIRELY by @capacitor/local-notifications plugin.
 */
public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    
    private static final String TAG = "MainActivity";
    
    
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


## Splash Screen Setup (Android 12+ API)

### styles.xml

**File:** `android/app/src/main/res/values/styles.xml`

Add the splash screen theme to your launch theme:

```xml
<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
    <!-- Splash background color -->
    <item name="windowSplashScreenBackground">#3a6cc9</item>
</style>
```

---

## Billing & Splash Screen Dependencies

Add these to your `android/app/build.gradle`:

```gradle

    // Google Play Billing
    implementation "com.android.billingclient:billing:7.1.1"
    
    // Android 12+ SplashScreen API (backward compatible to API 21)
    implementation "androidx.core:core-splashscreen:1.0.1"

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
