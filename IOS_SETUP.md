# iOS Setup Guide for Npd

This guide covers the required iOS setup for Google Sign-In, push notifications, voice recording, and location-based reminders.

## Prerequisites

1. macOS with Xcode installed
2. Apple Developer Account (for push notifications)
3. Project exported to GitHub and cloned locally
4. Run `npm install` to install dependencies
5. Run `npx cap add ios` to add iOS platform
6. Run `npx cap sync` to sync the project

## Google Sign-In Setup (Required for Cloud Sync)

### Step 1: Create iOS OAuth Client ID in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (same as Android)
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth client ID**
5. Select **iOS** as application type
6. Enter your Bundle ID: `app.lovable.c4920824037c4205bb9ed6cc0d5a0385`
7. Click **Create**
8. Copy the **Client ID** (e.g., `52777395492-xxxxx.apps.googleusercontent.com`)
9. Note the **Reversed Client ID** (e.g., `com.googleusercontent.apps.52777395492-xxxxx`)

### Step 2: Add iOS Client ID to the App

Open `src/contexts/GoogleAuthContext.tsx` and add your iOS Client ID:

```typescript
const GOOGLE_IOS_CLIENT_ID = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';
```

### Step 3: Update Info.plist with URL Scheme

Add these entries to your `ios/App/App/Info.plist` file inside the `<dict>` tag:

```xml
<!-- Google Sign-In URL Scheme -->
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <!-- Use your Reversed Client ID -->
            <string>com.googleusercontent.apps.YOUR_CLIENT_ID_HERE</string>
        </array>
    </dict>
</array>

<!-- Required for Google Sign-In -->
<key>GIDClientID</key>
<string>YOUR_IOS_CLIENT_ID.apps.googleusercontent.com</string>
```

### Step 4: Enable Required APIs in Google Cloud Console

Ensure these APIs are enabled:
- Google Drive API
- Google Calendar API
- Google People API

## Info.plist Permissions

After running `npx cap add ios`, add the following permissions to `ios/App/App/Info.plist`:

### Required Permission Descriptions

Add these entries inside the `<dict>` tag:

```xml
<!-- Voice Recording Permission -->
<key>NSMicrophoneUsageDescription</key>
<string>Npd needs access to your microphone to record voice notes.</string>

<!-- Calendar Permissions (for system calendar sync) -->
<key>NSCalendarsFullAccessUsageDescription</key>
<string>Npd needs access to your calendar to sync your tasks and events with your device calendar.</string>

<key>NSCalendarsWriteOnlyAccessUsageDescription</key>
<string>Npd needs access to add tasks and events to your device calendar.</string>

<!-- Location Permissions for Location-Based Reminders -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>Npd needs your location to remind you of tasks when you arrive at or leave specific places.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Npd needs background location access to send you reminders when you arrive at or leave your saved locations, even when the app is closed.</string>

<key>NSLocationAlwaysUsageDescription</key>
<string>Npd needs background location access to send you reminders when you arrive at or leave your saved locations.</string>

<!-- Background Modes -->
<key>UIBackgroundModes</key>
<array>
    <string>remote-notification</string>
    <string>location</string>
    <string>fetch</string>
    <string>processing</string>
</array>
```

### Full Info.plist Location Section Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- ... other entries ... -->
    
    <!-- Voice Recording -->
    <key>NSMicrophoneUsageDescription</key>
    <string>Npd needs access to your microphone to record voice notes.</string>
    
    <!-- Location Permissions -->
    <key>NSLocationWhenInUseUsageDescription</key>
    <string>Npd needs your location to remind you of tasks when you arrive at or leave specific places.</string>
    
    <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
    <string>Npd needs background location access to send you reminders when you arrive at or leave your saved locations, even when the app is closed.</string>
    
    <key>NSLocationAlwaysUsageDescription</key>
    <string>Npd needs background location access to send you reminders when you arrive at or leave your saved locations.</string>
    
    <!-- Background Modes -->
    <key>UIBackgroundModes</key>
    <array>
        <string>remote-notification</string>
        <string>location</string>
        <string>fetch</string>
        <string>processing</string>
    </array>
    
    <!-- ... other entries ... -->
</dict>
</plist>
```

## Location-Based Reminders Setup

### Understanding iOS Location Permissions

iOS has a progressive permission model for location:

| Permission Level | When Granted | Use Case |
|-----------------|--------------|----------|
| When In Use | App is in foreground | Basic location features |
| Always | App in foreground OR background | Geofencing, background reminders |

### Background Location Capability in Xcode

1. Open the project in Xcode: `npx cap open ios`
2. Select your target (App)
3. Go to "Signing & Capabilities"
4. Click "+ Capability"
5. Add "Background Modes"
6. Check the following:
   - ✅ Location updates
   - ✅ Background fetch
   - ✅ Remote notifications

### Permission Flow

The app will request permissions in this order:
1. First, "When In Use" location permission
2. Then, if the user grants it, "Always" permission for background tracking

**Important:** Apple requires apps to first get "When In Use" permission before requesting "Always" permission.

### App Store Review Guidelines

When submitting to the App Store, you must:
1. Justify why your app needs background location
2. Include the location usage in your app's privacy policy
3. Add a note in App Store Connect explaining the background location use

## Push Notifications Setup

### Apple Push Notification Service (APNs) Setup

1. Log in to [Apple Developer Portal](https://developer.apple.com/)
2. Go to Certificates, Identifiers & Profiles
3. Create an App ID with Push Notifications capability
4. Create an APNs Key or Certificate
5. Configure your server with the APNs credentials

### Enable Push Notifications in Xcode

1. Open the project in Xcode: `npx cap open ios`
2. Select your target
3. Go to "Signing & Capabilities"
4. Click "+ Capability"
5. Add "Push Notifications"
6. Add "Background Modes" and check "Remote notifications"

## Voice Recording Setup

iOS requires permission description for microphone access. This is handled via the `NSMicrophoneUsageDescription` key in Info.plist.

The app will automatically prompt the user for microphone permission when they first try to record.

## Local Notifications Setup

Local notifications work out of the box with the Capacitor Local Notifications plugin. The user will be prompted for permission when scheduling the first notification.

## Building the App

1. Sync your project: `npx cap sync ios`
2. Open in Xcode: `npx cap open ios`
3. Select your development team in Signing & Capabilities
4. Build and run from Xcode

## Troubleshooting

### Location reminders not triggering in background

1. **Check Location Permission**: Go to Settings > Npd > Location
   - Ensure "Always" is selected (not "While Using")
   
2. **Check Background App Refresh**: Go to Settings > General > Background App Refresh
   - Ensure Npd is enabled
   
3. **Low Power Mode**: Location updates may be limited in Low Power Mode
   - Disable Low Power Mode for testing

4. **Verify Capability**: In Xcode, confirm "Location updates" is checked in Background Modes

### "Always" location permission not appearing

iOS only shows the "Always" option after you've granted "When In Use" permission and the app has demonstrated location use. The upgrade prompt may appear later.

Alternatively, users can go to Settings > Npd > Location and manually select "Always".

### Push notifications not working

- Ensure Push Notifications capability is enabled in Xcode
- Verify APNs certificate/key is configured correctly
- Check that the device is registered (simulators don't support push)

### Voice recording not working

- Ensure the NSMicrophoneUsageDescription is set in Info.plist
- Grant microphone permission when prompted

### Local notifications not appearing

- Ensure the app has notification permissions
- Check notification settings in iOS Settings app

### App rejected for background location

If Apple rejects your app for background location:
1. Ensure your usage description clearly explains why background location is needed
2. Add visible UI indicating when background location is active
3. Consider using region monitoring (geofencing) instead of continuous location updates
4. Update your privacy policy to mention location data usage
