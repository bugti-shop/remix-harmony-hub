import { useState, useEffect, useCallback } from 'react';
import { getSetting, setSetting } from '@/utils/settingsStorage';

export interface UserProfile {
  name: string;
  avatarUrl: string;
}

const PROFILE_KEY = 'npd_user_profile';

const DEFAULT_PROFILE: UserProfile = { name: '', avatarUrl: '' };

export const loadUserProfile = async (): Promise<UserProfile> => {
  return getSetting<UserProfile>(PROFILE_KEY, DEFAULT_PROFILE);
};

export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
  await setSetting(PROFILE_KEY, profile);
  window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: profile }));
};

export const useUserProfile = () => {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserProfile().then(p => { setProfile(p); setIsLoading(false); });

    const handler = (e: CustomEvent<UserProfile>) => setProfile(e.detail);
    window.addEventListener('userProfileUpdated', handler as EventListener);
    return () => window.removeEventListener('userProfileUpdated', handler as EventListener);
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    const updated = { ...profile, ...updates };
    setProfile(updated);
    await saveUserProfile(updated);
  }, [profile]);

  return { profile, isLoading, updateProfile };
};
