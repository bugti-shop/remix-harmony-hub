import { useState, useEffect, useCallback, useRef } from 'react';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { ArrowLeft, HardDrive, User, LogOut, Cloud, RefreshCw, Loader2, CheckCircle2, AlertCircle, Camera, Pencil, Trash2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BottomNavigation } from '@/components/BottomNavigation';
import { StreakSocietyBadge } from '@/components/StreakSocietyBadge';

import { TodoBottomNavigation } from '@/components/TodoBottomNavigation';
import { getSetting } from '@/utils/settingsStorage';
import { createBackup } from '@/utils/dataBackup';
import { useGoogleAuth } from '@/contexts/GoogleAuthContext';
import { performSync, getLastSyncInfo, SyncMeta, SyncResult, SyncState, addSyncListener } from '@/utils/driveSyncManager';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/hooks/useUserProfile';
import { ProfileImageCropper } from '@/components/ProfileImageCropper';

export default function Profile() {
  const { t } = useTranslation();
  const location = useLocation();
  const { toast } = useToast();
  const { restorePurchases, initialize: initRevenueCat } = useRevenueCat();
  const { user, isLoading: authLoading, isSigningIn, signIn, signOut } = useGoogleAuth();
  const [lastDashboard, setLastDashboard] = useState<'notes' | 'todo'>('notes');
  const [backupSize, setBackupSize] = useState<string>('');
  const [isCalculatingSize, setIsCalculatingSize] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSync, setLastSync] = useState<SyncMeta | null>(null);
  const { profile, updateProfile } = useUserProfile();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  // Load last sync info
  useEffect(() => {
    getLastSyncInfo().then(setLastSync);
    const unsub = addSyncListener(setSyncState);
    return unsub;
  }, []);

  // Calculate backup size
  const calculateBackupSize = async () => {
    setIsCalculatingSize(true);
    try {
      const backup = await createBackup();
      const jsonString = JSON.stringify(backup);
      const sizeBytes = new Blob([jsonString]).size;
      
      if (sizeBytes < 1024) {
        setBackupSize(`${sizeBytes} B`);
      } else if (sizeBytes < 1024 * 1024) {
        setBackupSize(`${(sizeBytes / 1024).toFixed(1)} KB`);
      } else {
        setBackupSize(`${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`);
      }
    } catch (error) {
      console.error('Error calculating backup size:', error);
      setBackupSize('--');
    } finally {
      setIsCalculatingSize(false);
    }
  };

  useEffect(() => { calculateBackupSize(); }, []);

  useEffect(() => {
    const checkLastDashboard = async () => {
      const fromState = (location.state as any)?.from;
      if (fromState?.startsWith('/todo')) {
        setLastDashboard('todo');
      } else {
        const stored = await getSetting<string>('lastDashboard', 'notes');
        setLastDashboard(stored === 'todo' ? 'todo' : 'notes');
      }
    };
    checkLastDashboard();
  }, [location.state]);

  const handleSignIn = async () => {
    try {
      const googleUser = await signIn();
      
      // Log in to RevenueCat with Google user ID so subscription follows the account
      try {
        await initRevenueCat(googleUser?.email || undefined);
        // Restore any existing purchases for this Google account
        await restorePurchases();
      } catch (rcErr) {
        console.warn('RevenueCat login with Google ID failed:', rcErr);
      }
      
      toast({ title: t('profile.signInSuccess', 'Signed in successfully'), description: t('profile.signInSuccessGDrive', 'Your Google account is connected for Drive sync.') });
    } catch (err: any) {
      console.error('Sign-in error:', err);
      toast({ title: t('profile.signInFailed', 'Sign-in failed'), description: err?.message || t('common.retry', 'Please try again.'), variant: 'destructive' });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setLastSync(null);
    toast({ title: t('profile.signedOut', 'Signed out'), description: t('profile.signedOutDesc2', 'Google account disconnected.') });
  };

  const handleSync = useCallback(async () => {
    if (syncState === 'syncing') return;

    const result: SyncResult = await performSync();
    
    if (result.success) {
      const info = await getLastSyncInfo();
      setLastSync(info);
      toast({
        title: t('profile.syncSuccess', 'Sync complete'),
        description: result.stats
          ? `${t('profile.syncStatsDesc', 'Notes: {{notes}} synced. Tasks: {{tasks}} synced.', { notes: result.stats.notesUploaded, tasks: result.stats.tasksUploaded })}${result.stats.conflicts ? ` ${t('profile.syncStatsConflicts', '{{conflicts}} conflict(s).', { conflicts: result.stats.conflicts })}` : ''}`
          : t('profile.syncAllData', 'All data synced to Google Drive.'),
      });
    } else {
      toast({ title: t('profile.syncFailed', 'Sync failed'), description: result.error || t('common.retry', 'Please try again.'), variant: 'destructive' });
    }
  }, [syncState, toast]);

  const formatLastSync = (meta: SyncMeta | null): string => {
    if (!meta?.lastSyncAt) return t('profile.neverSynced', 'Never');
    const date = new Date(meta.lastSyncAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return t('profile.justNow', 'Just now');
    if (diffMins < 60) return t('profile.minutesShort', '{{count}}m ago', { count: diffMins });
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t('profile.hoursShort', '{{count}}h ago', { count: diffHours });
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-muted/30" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center justify-between px-4 h-14">
          <Link to={lastDashboard === 'todo' ? '/todo/today' : '/'} className="p-2 -ml-2 hover:bg-muted/50 rounded-lg">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </Link>
          <h1 className="text-lg font-semibold text-foreground">{t('profile.title')}</h1>
          <div className="w-9" />
        </div>
      </header>

      <div className="flex flex-col items-center px-6 pt-12">
        <div className="flex flex-col items-center w-full max-w-sm space-y-4">
          {/* Profile avatar */}
          <div className="relative mb-4">
            <div className="absolute -inset-12 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute top-0 left-0 w-6 h-6 bg-primary/10 rounded-full -translate-x-10 -translate-y-6" />
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-primary/10 rounded-full translate-x-14 translate-y-4" />
            
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.name || 'Profile'}
                className="relative w-28 h-28 rounded-full object-cover ring-4 ring-primary/20"
              />
            ) : user?.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="relative w-28 h-28 rounded-full object-cover ring-4 ring-primary/20"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="relative w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-14 h-14 text-primary" />
              </div>
            )}
            {/* Camera button to change avatar */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg border-2 border-background z-10"
            >
              <Camera className="h-4 w-4" />
            </button>
            {/* Remove photo button */}
            {profile.avatarUrl && (
              <button
                onClick={async () => {
                  await updateProfile({ avatarUrl: '' });
                  toast({ title: t('profile.photoRemoved', 'Profile photo removed') });
                }}
                className="absolute bottom-0 left-0 w-9 h-9 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg border-2 border-background z-10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const dataUrl = ev.target?.result as string;
                  setCropImageSrc(dataUrl);
                };
                reader.readAsDataURL(file);
                e.target.value = '';
              }}
            />
          </div>

          {/* Streak Society Badge */}
          <StreakSocietyBadge />

          {/* Editable name */}
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    await updateProfile({ name: nameInput.trim() });
                    setIsEditingName(false);
                  } else if (e.key === 'Escape') {
                    setIsEditingName(false);
                  }
                }}
                onBlur={async () => {
                  await updateProfile({ name: nameInput.trim() });
                  setIsEditingName(false);
                }}
                className="text-xl font-semibold text-foreground text-center bg-transparent border-b-2 border-primary outline-none w-48"
                placeholder={t('profile.enterName', 'Enter your name')}
              />
            </div>
          ) : (
            <button
              onClick={() => { setNameInput(profile.name || user?.name || ''); setIsEditingName(true); }}
              className="flex items-center gap-2 group"
            >
              <h2 className="text-xl font-semibold text-foreground text-center">
                {profile.name || user?.name || t('profile.guest', 'Guest User')}
              </h2>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
          {user && (
            <p className="text-sm text-muted-foreground text-center">{user.email}</p>
          )}
          <p className="text-muted-foreground text-sm text-center max-w-xs">
            {user
              ? t('profile.syncEnabled', 'Connected to Google Drive for sync.')
              : t('profile.localOnly', 'Your data is stored locally on this device.')}
          </p>

          {/* Google Sign-In / Account Section */}
          {authLoading ? (
            <div className="w-full p-4 bg-secondary/30 rounded-2xl flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : user ? (
            <>
              {/* Sync Card */}
              <div className="w-full p-4 bg-secondary/30 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      {syncState === 'syncing' ? (
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      ) : syncState === 'success' ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : syncState === 'error' ? (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      ) : (
                        <Cloud className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {syncState === 'syncing' ? t('profile.syncing', 'Syncing...') : t('profile.googleDriveSync', 'Google Drive Sync')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('profile.lastSyncLabel', 'Last sync: {{time}}', { time: formatLastSync(lastSync) })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sync Button */}
                <Button
                  variant="outline"
                  className="w-full rounded-xl h-11"
                  onClick={handleSync}
                  disabled={syncState === 'syncing'}
                >
                  {syncState === 'syncing' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {syncState === 'syncing' ? t('profile.syncing', 'Syncing...') : t('profile.syncNow', 'Sync Now')}
                </Button>
              </div>

              {/* Sign out */}
              <Button
                variant="outline"
                className="w-full rounded-2xl h-12 text-destructive border-destructive/20 hover:bg-destructive/10"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                {t('profile.signOut', 'Sign Out')}
              </Button>
            </>
          ) : (
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-background border border-border rounded-2xl shadow-sm hover:shadow-md transition-all disabled:opacity-50"
            >
              {isSigningIn ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="text-sm font-medium text-foreground">
                    {t('profile.signInGoogle', 'Sign in with Google')}
                  </span>
                </>
              )}
            </button>
          )}

          {/* Backup Size Card */}
          <div className="w-full p-4 bg-secondary/30 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <HardDrive className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t('profile.backupSize', 'Data Size')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('profile.backupSizeDesc', 'Total local data')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {isCalculatingSize ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                ) : (
                  <span className="text-lg font-semibold text-foreground">{backupSize}</span>
                )}
              </div>
          </div>

        </div>
      </div>
      </div>

      {lastDashboard === 'todo' ? <TodoBottomNavigation /> : <BottomNavigation />}

      {/* Image Cropper Modal */}
      {cropImageSrc && (
        <ProfileImageCropper
          imageSrc={cropImageSrc}
          onCropComplete={async (croppedUrl) => {
            await updateProfile({ avatarUrl: croppedUrl });
            setCropImageSrc(null);
            toast({ title: t('profile.photoUpdated', 'Profile photo updated') });
          }}
          onCancel={() => setCropImageSrc(null)}
        />
      )}
    </div>
  );
}
