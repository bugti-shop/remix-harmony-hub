# Google Drive Sync - Native Setup Guide

This guide covers setting up native Google Sign-In for the NPD app using `@capgo/capacitor-social-login` (v8.x) with Capacitor 8, enabling Google Drive sync on Android and iOS.

---

## Prerequisites

- Capacitor 8 project with `@capgo/capacitor-social-login@^8.2.17`
- Google Cloud Console project with OAuth 2.0 credentials
- Web Client ID: `52777395492-vnlk2hkr3pv15dtpgp2m51p7418vll90.apps.googleusercontent.com`

---

## Android Setup

### 1. Get SHA-1 Fingerprint

```bash
cd android
./gradlew signingReport
```

Copy the SHA-1 fingerprint from the output.

### 2. Create Android OAuth Client ID

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create Credentials → OAuth Client ID**
3. Choose **Android** as application type
4. Enter package name: `nota.npd.com`
5. Paste your SHA-1 fingerprint
6. Click **Create**

> **Note:** You do NOT use the Android Client ID in code. You always use the **Web Client ID**. The Android Client ID is only for Google's verification.

### 3. Modify `MainActivity.java`

Open `android/app/src/main/java/nota/npd/com/MainActivity.java` and replace with:

```java
package nota.npd.com;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Register the Social Login plugin with Google provider
        SocialLoginPlugin.registerPlugin(this);
        GoogleProvider.initialize(this);
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, android.content.Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        SocialLoginPlugin.onActivityResult(requestCode, resultCode, data);
    }
}
```

### 4. Google Services Plugin

The Google Services plugin is required for Google Sign-In. Add to `android/app/build.gradle`:

```gradle
apply plugin: 'com.google.gms.google-services'
```

---

## TypeScript Usage

The app uses a unified `googleAuth.ts` that auto-detects the platform:

### How It Works

```typescript
// src/utils/googleAuth.ts (simplified overview)
import { Capacitor } from '@capacitor/core';

const isNative = () => Capacitor.isNativePlatform();

// All exports auto-switch between native and web:
export const signInWithGoogle = (): Promise<GoogleUser> =>
  isNative() ? nativeSignIn() : webSignIn();

export const signOutGoogle = async (): Promise<void> => {
  if (isNative()) await nativeSignOut();
  else await webSignOut(user);
  await removeSetting('googleUser');
};

export const refreshGoogleToken = (): Promise<GoogleUser> =>
  isNative() ? nativeRefresh() : webRefresh();

export const getValidAccessToken = async (): Promise<string | null> => {
  const user = await getStoredGoogleUser();
  if (!user) return null;
  if (isTokenValid(user)) return user.accessToken;
  try {
    const refreshed = await refreshGoogleToken();
    return refreshed.accessToken;
  } catch { return null; }
};
```

### Native Sign-In (Android/iOS)

Capgo Social Login is initialized lazily on first use:

```typescript
import { SocialLogin } from '@capgo/capacitor-social-login';

let nativeInitialized = false;

const ensureNativeInit = async () => {
  if (nativeInitialized) return;
  await SocialLogin.initialize({
    google: { webClientId: CLIENT_ID },
  });
  nativeInitialized = true;
};

const nativeSignIn = async (): Promise<GoogleUser> => {
  await ensureNativeInit();
  const result = await SocialLogin.login({
    provider: 'google',
    options: {
      scopes: [
        'openid', 'email', 'profile',
        'https://www.googleapis.com/auth/drive.appdata',
        'https://www.googleapis.com/auth/drive.file',
      ],
    },
  });

  const r = result.result as any;
  const accessToken = r.accessToken?.token || r.accessToken || '';
  let email = r.profile?.email || '';
  let name = r.profile?.name || '';
  let picture = r.profile?.imageUrl || '';

  // Fallback: fetch from Google userinfo API if profile is incomplete
  if (!email && accessToken) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const info = await res.json();
      email = info.email; name = info.name; picture = info.picture;
    }
  }

  return { email, name: name || email, picture, accessToken, expiresAt: Date.now() + 3600000 };
};
```

### Web Sign-In (GIS)

Google Identity Services is used on web with retry logic for user info fetching:

```typescript
const webSignIn = (): Promise<GoogleUser> => {
  return new Promise(async (resolve, reject) => {
    await loadGoogleIdentityServices();
    initTokenClient(
      async (accessToken) => {
        // fetchUserInfo retries up to 3 times with backoff
        const info = await fetchUserInfo(accessToken);
        const user = { ...info, accessToken, expiresAt: Date.now() + 3600000 };
        await setSetting('googleUser', user);
        resolve(user);
      },
      (err) => reject(err)
    );
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
};
```

### Consuming Components

No platform checks needed in UI code — just use the unified API:

```typescript
import { useGoogleAuth } from '@/contexts/GoogleAuthContext';

const MyComponent = () => {
  const { user, signIn, signOut } = useGoogleAuth();
  // Works on both native and web automatically
};
```

---

## Google Drive Sync Architecture

The sync system uses Google Drive's `appDataFolder` (hidden app-specific storage) to store:

| File | Description |
|------|-------------|
| `npd-notes.json` | All notes with metadata |
| `npd-tasks.json` | All todo items and subtasks |
| `npd-settings.json` | Synced app settings (folders, theme, etc.) |
| `npd-sync-meta.json` | Sync metadata (device ID, change tokens, versions) |

### Sync Flow

1. **Authentication** → Get valid access token (refresh if expired)
2. **List remote files** → Check what exists in Drive `appDataFolder`
3. **Download & merge** → Merge remote data with local using last-write-wins + conflict detection
4. **Upload** → Push merged data back to Drive
5. **Update meta** → Store change token for incremental sync

### Conflict Resolution

- **Last-write-wins** for most cases (based on `updatedAt` timestamp)
- **Conflict UI** when same timestamp but different `syncVersion` or content
- Users can choose **Keep Local** or **Keep Remote** via `SyncConflictSheet`

---

## Required OAuth Scopes

| Scope | Purpose |
|-------|---------|
| `openid` | OpenID Connect authentication |
| `email` | User email address |
| `profile` | User name and profile picture |
| `drive.appdata` | Read/write to app-specific hidden folder |
| `drive.file` | Access files created by the app |

---

## Troubleshooting

### Common Issues

1. **`DEVELOPER_ERROR` on Android**
   - Verify SHA-1 fingerprint matches your keystore
   - Ensure package name is exactly `nota.npd.com`
   - Make sure you're using the **Web Client ID**, not Android Client ID

2. **Sign-in popup doesn't appear on web**
   - Add your domain to Authorized JavaScript Origins in Google Cloud Console
   - Ensure `https://accounts.google.com/gsi/client` script loads

3. **Token expired during sync**
   - The app auto-refreshes tokens via `getValidAccessToken()`
   - If silent refresh fails, user must sign in again

4. **`i.getTime is not a function`**
   - Fixed by safe date normalization in hydrate functions
   - All date fields go through `safeDate()` helper

---

## Building for Production

```bash
# Build the web app
npm run build

# Sync with native platforms
npx cap sync

# Open in Android Studio
npx cap open android

# Run on device
npx cap run android
```
