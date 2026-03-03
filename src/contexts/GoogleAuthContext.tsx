import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  GoogleUser,
  signInWithGoogle,
  signOutGoogle,
  getStoredGoogleUser,
  loadGoogleIdentityServices,
} from '@/utils/googleAuth';

interface GoogleAuthContextType {
  user: GoogleUser | null;
  isLoading: boolean;
  isSigningIn: boolean;
  signIn: () => Promise<GoogleUser>;
  signOut: () => Promise<void>;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Load stored user on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await getStoredGoogleUser();
        if (stored) setUser(stored);
        // Pre-load GIS script (no-op on native)
        loadGoogleIdentityServices().catch(() => {});
      } catch (err) {
        console.error('Failed to load Google user:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  const signIn = useCallback(async (): Promise<GoogleUser> => {
    setIsSigningIn(true);
    try {
      const googleUser = await signInWithGoogle();
      setUser(googleUser);
      return googleUser;
    } catch (err) {
      console.error('Google sign-in failed:', err);
      throw err;
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await signOutGoogle();
    setUser(null);
  }, []);

  return (
    <GoogleAuthContext.Provider value={{ user, isLoading, isSigningIn, signIn, signOut }}>
      {children}
    </GoogleAuthContext.Provider>
  );
}

export function useGoogleAuth() {
  const context = useContext(GoogleAuthContext);
  if (!context) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }
  return context;
}
