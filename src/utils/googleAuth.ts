// Google Sign-In — native (Capgo Social Login) on Android/iOS, GIS on web
import { Capacitor } from '@capacitor/core';
import { getSetting, setSetting, removeSetting } from './settingsStorage';

const CLIENT_ID = '52777395492-vnlk2hkr3pv15dtpgp2m51p7418vll90.apps.googleusercontent.com';
const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file';
const NATIVE_SCOPES = [
  'openid', 'email', 'profile',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file',
];

export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  accessToken: string;
  expiresAt: number;
}

const isNative = () => Capacitor.isNativePlatform();

// ── Native (Capgo Social Login) ───────────────────────────────────────────

let nativeInitialized = false;

const ensureNativeInit = async () => {
  if (nativeInitialized) return;
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  await SocialLogin.initialize({
    google: { webClientId: CLIENT_ID },
  });
  nativeInitialized = true;
};

const nativeSignIn = async (): Promise<GoogleUser> => {
  await ensureNativeInit();
  const { SocialLogin } = await import('@capgo/capacitor-social-login');

  const result = await SocialLogin.login({
    provider: 'google',
    options: { scopes: NATIVE_SCOPES },
  });

  const r = result.result as any;
  const accessToken: string = r.accessToken?.token || r.accessToken || '';

  // Try profile from result, fallback to userinfo API
  let email = r.profile?.email || r.email || '';
  let name = r.profile?.name || r.name || '';
  let picture = r.profile?.imageUrl || r.profile?.picture || '';

  if (!email && accessToken) {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const info = await res.json();
        email = info.email || email;
        name = info.name || name;
        picture = info.picture || picture;
      }
    } catch {}
  }

  if (!accessToken) throw new Error('No access token received from Google Sign-In');

  const user: GoogleUser = {
    email,
    name: name || email,
    picture,
    accessToken,
    expiresAt: Date.now() + 365 * 24 * 3600 * 1000, // 1 year — effectively never expires
  };

  await setSetting('googleUser', user);
  return user;
};

const nativeSignOut = async () => {
  try {
    const { SocialLogin } = await import('@capgo/capacitor-social-login');
    await SocialLogin.logout({ provider: 'google' });
  } catch {}
};

const nativeRefresh = async (): Promise<GoogleUser> => {
  // Capgo doesn't expose silent refresh — just extend the stored user's expiry
  // to avoid re-triggering the sign-in UI automatically
  const stored = await getStoredGoogleUser();
  if (stored) {
    const extended: GoogleUser = { ...stored, expiresAt: Date.now() + 365 * 24 * 3600 * 1000 };
    await setSetting('googleUser', extended);
    return extended;
  }
  // No stored user, must sign in fresh
  return nativeSignIn();
};

// ── Web (Google Identity Services) ────────────────────────────────────────

let tokenClient: any = null;
let gisLoaded = false;

export const loadGoogleIdentityServices = (): Promise<void> => {
  if (isNative()) return Promise.resolve();
  if (gisLoaded) return Promise.resolve();

  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) {
      gisLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => { gisLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
};

const initTokenClient = (onSuccess: (token: string) => void, onError: (err: any) => void) => {
  const google = (window as any).google;
  if (!google?.accounts?.oauth2) { onError(new Error('GIS not loaded')); return; }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (response: any) => {
      if (response.error) { onError(response); return; }
      onSuccess(response.access_token);
    },
    error_callback: (error: any) => onError(error),
  });
};

const fetchUserInfo = async (accessToken: string): Promise<{ email: string; name: string; picture: string }> => {
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt));
      res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) break;
    } catch (err) {
      if (attempt === 2) throw new Error('Network error fetching user info');
    }
  }
  if (!res || !res.ok) throw new Error('Failed to fetch user info');
  const info = await res.json();
  return { email: info.email, name: info.name || info.email, picture: info.picture || '' };
};

const webSignIn = (): Promise<GoogleUser> => {
  return new Promise(async (resolve, reject) => {
    try {
      await loadGoogleIdentityServices();
      initTokenClient(
        async (accessToken) => {
          try {
            const info = await fetchUserInfo(accessToken);
            const user: GoogleUser = { ...info, accessToken, expiresAt: Date.now() + 365 * 24 * 3600 * 1000 };
            await setSetting('googleUser', user);
            resolve(user);
          } catch (err) { reject(err); }
        },
        (err) => reject(err)
      );
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) { reject(err); }
  });
};

const webSignOut = async (user: GoogleUser | null) => {
  if (user?.accessToken) {
    try { (window as any).google?.accounts?.oauth2?.revoke?.(user.accessToken); } catch {}
  }
};

const webRefresh = (): Promise<GoogleUser> => {
  return new Promise(async (resolve, reject) => {
    try {
      await loadGoogleIdentityServices();
      initTokenClient(
        async (accessToken) => {
          try {
            const info = await fetchUserInfo(accessToken);
            const user: GoogleUser = { ...info, accessToken, expiresAt: Date.now() + 365 * 24 * 3600 * 1000 };
            await setSetting('googleUser', user);
            resolve(user);
          } catch (err) { reject(err); }
        },
        (err) => reject(err)
      );
      tokenClient.requestAccessToken({ prompt: '' });
    } catch (err) { reject(err); }
  });
};

// Silent web refresh — tries prompt:'' and rejects quickly if it would show UI
const silentWebRefresh = (): Promise<GoogleUser | null> => {
  return new Promise(async (resolve) => {
    // Timeout: if no silent response in 3s, give up
    const timeout = setTimeout(() => resolve(null), 3000);
    try {
      await loadGoogleIdentityServices();
      initTokenClient(
        async (accessToken) => {
          clearTimeout(timeout);
          try {
            const info = await fetchUserInfo(accessToken);
            const user: GoogleUser = { ...info, accessToken, expiresAt: Date.now() + 365 * 24 * 3600 * 1000 };
            await setSetting('googleUser', user);
            resolve(user);
          } catch { resolve(null); }
        },
        () => { clearTimeout(timeout); resolve(null); }
      );
      tokenClient.requestAccessToken({ prompt: '' });
    } catch { clearTimeout(timeout); resolve(null); }
  });
};

// ── Unified API ───────────────────────────────────────────────────────────

export const signInWithGoogle = (): Promise<GoogleUser> =>
  isNative() ? nativeSignIn() : webSignIn();

export const signOutGoogle = async (): Promise<void> => {
  const user = await getStoredGoogleUser();
  if (isNative()) {
    await nativeSignOut();
  } else {
    await webSignOut(user);
  }
  await removeSetting('googleUser');
};

export const getStoredGoogleUser = async (): Promise<GoogleUser | null> =>
  getSetting<GoogleUser | null>('googleUser', null);

export const isTokenValid = (user: GoogleUser): boolean =>
  user.expiresAt > Date.now() + 60000;

export const refreshGoogleToken = (): Promise<GoogleUser> =>
  isNative() ? nativeRefresh() : webRefresh();

export const getValidAccessToken = async (): Promise<string | null> => {
  const user = await getStoredGoogleUser();
  if (!user) return null;
  
  // If token is still valid, return it directly
  if (isTokenValid(user)) return user.accessToken;
  
  // Token expired — try silent refresh on web only (no UI popup)
  // On native, just return the existing token and let API calls handle 401
  if (!isNative()) {
    try {
      const refreshed = await silentWebRefresh();
      if (refreshed) return refreshed.accessToken;
    } catch {
      // Silent refresh failed, fall through to return existing token
    }
  }
  
  // Return existing token even if "expired" — Google tokens often remain
  // valid slightly beyond their stated expiry. If the API rejects it,
  // the caller should handle the error and prompt the user to re-sign-in.
  return user.accessToken;
};
