import { BottomNavigation } from '@/components/BottomNavigation';

import { ChevronRight, Check, Crown, Palette } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import appLogo from '@/assets/app-logo.png';
import { Capacitor } from '@capacitor/core';
import { useDarkMode, themes, ThemeId } from '@/hooks/useDarkMode';
import { differenceInDays, differenceInHours, differenceInMinutes, addDays } from 'date-fns';
import { Note } from '@/types/note';
import { useTranslation } from 'react-i18next';
import { languages } from '@/i18n';
import { loadNotesFromDB } from '@/utils/noteStorage';
import { downloadBackup, downloadData, restoreFromBackup } from '@/utils/dataBackup';
import { createNativeBackup, isNativePlatform } from '@/utils/nativeBackup';
import { BackupSuccessDialog } from '@/components/BackupSuccessDialog';
import { getSetting, setSetting, getAllSettings, clearAllSettings } from '@/utils/settingsStorage';
import { CustomThemeSheet } from '@/components/CustomThemeSheet';
import { CustomTheme, getCustomThemes, getActiveCustomThemeId, setActiveCustomThemeId, applyCustomTheme, clearCustomThemeStyles } from '@/utils/customThemeStorage';


import { Switch } from '@/components/ui/switch';
import { NoteTypeVisibilitySheet } from '@/components/NoteTypeVisibilitySheet';
import { NotesSettingsSheet } from '@/components/NotesSettingsSheet';
import { TasksSettingsSheet } from '@/components/TasksSettingsSheet';
import { CustomizeNavigationSheet } from '@/components/CustomizeNavigationSheet';
import { AppLockSettingsSheet } from '@/components/AppLockSettingsSheet';
import { AppLockSetup } from '@/components/AppLockSetup';
import { WidgetSettingsSheet } from '@/components/WidgetSettingsSheet';
import { ToolbarOrderManager, useToolbarOrder } from '@/components/ToolbarOrderManager';
import { ImportDataSheet } from '@/components/ImportDataSheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const Settings = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isPro, isPro: isProSub, customerInfo, presentPaywall, presentCustomerCenter, restorePurchases, isInitialized, requireFeature } = useSubscription();
  const { currentTheme, setTheme } = useDarkMode();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState('');
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  
  const [showLanguageDialog, setShowLanguageDialog] = useState(false);
  const [showNoteTypeVisibilitySheet, setShowNoteTypeVisibilitySheet] = useState(false);
  const [showQuickAddDialog, setShowQuickAddDialog] = useState(false);
  const [showNotesSettingsSheet, setShowNotesSettingsSheet] = useState(false);
  const [showTasksSettingsSheet, setShowTasksSettingsSheet] = useState(false);
  const [showCustomizeNavigationSheet, setShowCustomizeNavigationSheet] = useState(false);
  const [showWidgetSettingsSheet, setShowWidgetSettingsSheet] = useState(false);
  const [showAppLockSettingsSheet, setShowAppLockSettingsSheet] = useState(false);
  const [showAppLockSetup, setShowAppLockSetup] = useState(false);
  const [showBackupSuccessDialog, setShowBackupSuccessDialog] = useState(false);
  const [backupFilePath, setBackupFilePath] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [showImportSheet, setShowImportSheet] = useState(false);
  const [showCustomThemeSheet, setShowCustomThemeSheet] = useState(false);
  const [activeCustomThemeId, setActiveCustomThemeIdState] = useState<string | null>(null);
  const toolbarOrder = useToolbarOrder();
  
  const [hapticIntensity, setHapticIntensity] = useState<'off' | 'light' | 'medium' | 'heavy'>('medium');
  const [isRestoring, setIsRestoring] = useState(false);

  // Load settings from IndexedDB
  useEffect(() => {
    getSetting<'off' | 'light' | 'medium' | 'heavy'>('haptic_intensity', 'medium').then(setHapticIntensity);
    getActiveCustomThemeId().then(async (id) => {
      setActiveCustomThemeIdState(id);
      if (id) {
        const themes = await getCustomThemes();
        const active = themes.find(t => t.id === id);
        if (active) applyCustomTheme(active);
      }
    });
  }, []);

  const currentLanguage = languages.find(l => l.code === i18n.language) || languages[0];

  const handleLanguageChange = async (langCode: string) => {
    i18n.changeLanguage(langCode);
    await setSetting('npd_language', langCode);
    const lang = languages.find(l => l.code === langCode);
    toast({ title: t('settings.languageChanged', { language: lang?.nativeName || langCode }) });
    setShowLanguageDialog(false);
  };


  const [notes, setNotes] = useState<Note[]>([]);

  // Load notes for hidden notes section
  useEffect(() => {
    const loadNotes = async () => {
      try {
        const loadedNotes = await loadNotesFromDB();
        setNotes(loadedNotes);
      } catch (error) {
        console.error('Error loading notes:', error);
      }
    };
    loadNotes();
  }, []);

  // Check for admin bypass (using state to avoid sync access)
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  
  useEffect(() => {
    getSetting<boolean>('npd_admin_bypass', false).then(setHasAdminAccess);
  }, []);
  
  const isProUser = isPro || hasAdminAccess;

  // Trial countdown calculation
  const [trialRemaining, setTrialRemaining] = useState<{ days: number; hours: number; minutes: number } | null>(null);
  const [hasShownTrialWarning, setHasShownTrialWarning] = useState(false);
  
  useEffect(() => {
    const loadTrialData = async () => {
      const trialStartStr = await getSetting<string | null>('npd_trial_start', null);
      if (trialStartStr && isProUser && !hasAdminAccess) {
        const trialStart = new Date(trialStartStr);
        const trialEnd = addDays(trialStart, 3); // 3-day trial
        
        const updateCountdown = () => {
          const now = new Date();
          if (now < trialEnd) {
            const totalMinutesRemaining = differenceInMinutes(trialEnd, now);
            const days = Math.floor(totalMinutesRemaining / (24 * 60));
            const hours = Math.floor((totalMinutesRemaining % (24 * 60)) / 60);
            const minutes = totalMinutesRemaining % 60;
            setTrialRemaining({ days, hours, minutes });
            
            // Show warning toast when less than 24 hours remaining (once per session)
            const sessionWarningShown = sessionStorage.getItem('npd_trial_warning_shown');
            if (days === 0 && !sessionWarningShown && !hasShownTrialWarning) {
              toast({
                title: `⏰ ${t('trial.endingSoon')}`,
                description: t('trial.expiresIn', { hours, minutes }),
                duration: 10000,
              });
              sessionStorage.setItem('npd_trial_warning_shown', 'true');
              setHasShownTrialWarning(true);
            }
          } else {
            setTrialRemaining(null); // Trial ended
          }
        };
        
        updateCountdown();
        const interval = setInterval(updateCountdown, 60000); // Update every minute
        return () => clearInterval(interval);
      }
    };
    loadTrialData();
  }, [isProUser, hasAdminAccess, hasShownTrialWarning, toast, t]);

  const handleBackupData = async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    
    try {
      // Use native backup on Android/iOS
      if (isNativePlatform()) {
        const result = await createNativeBackup();
        if (result.success && result.filePath) {
          setBackupFilePath(result.filePath);
          setShowBackupSuccessDialog(true);
        } else {
          toast({ 
            title: t('toasts.backupFailed'), 
            description: result.error,
            variant: "destructive" 
          });
        }
      } else {
        // Web fallback - download as file
        await downloadBackup();
        toast({ title: t('toasts.dataBackedUp') });
      }
    } catch (error) {
      console.error('Backup error:', error);
      toast({ title: t('toasts.backupFailed'), variant: "destructive" });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreData = () => {
    setShowRestoreDialog(true);
  };

  const confirmRestoreData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const result = await restoreFromBackup(file);
        if (result.success) {
          const stats = result.stats;
          toast({ 
            title: t('toasts.dataRestored'),
            description: stats ? t('toasts.restoredStats', 'Restored {{notes}} notes, {{tasks}} tasks, {{folders}} folders', { notes: stats.notes, tasks: stats.tasks, folders: stats.folders }) : undefined
          });
          setTimeout(() => window.location.reload(), 1000);
        } else {
          toast({ 
            title: t('toasts.restoreFailed'), 
            description: result.error,
            variant: "destructive" 
          });
        }
      }
    };
    input.click();
    setShowRestoreDialog(false);
  };

  const handleDownloadData = async () => {
    try {
      await downloadData();
      toast({ title: t('toasts.dataDownloaded') });
    } catch (error) {
      console.error('Download error:', error);
      toast({ title: t('toasts.downloadFailed'), variant: "destructive" });
    }
  };

  const handleDeleteData = () => {
    setShowDeleteDialog(true);
  };

  const confirmDeleteData = async () => {
    // Clear IndexedDB settings
    await clearAllSettings();
    toast({ title: t('toasts.dataDeleted') });
    setShowDeleteDialog(false);
    setTimeout(() => window.location.href = '/', 1000);
  };

  const handleShareApp = () => {
    const shareUrl = 'https://play.google.com/store/apps/details?id=nota.npd.com';
    if (navigator.share) {
      navigator.share({
        title: t('share.appTitle'),
        text: t('share.appDescription'),
        url: shareUrl
      });
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        toast({ title: t('toasts.linkCopied', 'Link copied to clipboard!') });
      }).catch(() => {
        window.open(shareUrl, '_blank');
      });
    }
  };

  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    try {
      await restorePurchases();
      toast({ title: t('toasts.purchasesRestored') });
    } catch (error) {
      toast({ title: t('toasts.purchasesFailed'), variant: "destructive" });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleManageSubscription = async () => {
    if (Capacitor.isNativePlatform()) {
      await presentCustomerCenter();
    } else {
      window.open('https://play.google.com/store/account/subscriptions', '_blank');
    }
  };

  const handleRateAndShare = () => {
    window.open('https://play.google.com/store/apps/details?id=nota.npd.com', '_blank');
  };

  // Unified row style component
  const SettingsRow = ({ label, onClick }: { label: React.ReactNode; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-muted transition-colors"
    >
      <span className="text-foreground text-sm">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );

  // Section heading component
  const SectionHeading = ({ title }: { title: string }) => (
    <div className="px-4 py-2 bg-muted/50">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
    </div>
  );

  return (
    <div className="min-h-screen min-h-screen-dynamic bg-background pb-16 sm:pb-20">
      <header className="border-b sticky top-0 bg-card z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="container mx-auto px-2 xs:px-3 sm:px-4 py-2 xs:py-3 sm:py-4">
          <div className="flex items-center gap-1.5 xs:gap-2 min-w-0">
            <img src={appLogo} alt="Npd" className="h-6 w-6 xs:h-7 xs:w-7 sm:h-8 sm:w-8 flex-shrink-0" />
            <h1 className="text-base xs:text-lg sm:text-xl font-bold truncate">{t('settings.title')}</h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-2 xs:px-3 sm:px-4 py-3 xs:py-4 sm:py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Preferences Section */}
          <div className="border border-border rounded-lg overflow-hidden" data-tour="settings-preferences">
            <SectionHeading title={t('settings.preferences', 'Preferences')} />
            <SettingsRow label={t('settings.appearance')} onClick={() => setShowThemeDialog(true)} />
            <SettingsRow label={t('settings.language')} onClick={() => setShowLanguageDialog(true)} />
            
            <SettingsRow label={<>{t('settings.noteTypeVisibility', 'Note Type Visibility')} {!isProSub && <Crown className="h-3.5 w-3.5 inline ml-1" style={{ color: '#3c78f0' }} />}</>} onClick={() => { if (requireFeature('notes_type_visibility')) setShowNoteTypeVisibilitySheet(true); }} />
            <SettingsRow label={<>{t('settings.notesSettings', 'Notes Settings')} {!isProSub && <Crown className="h-3.5 w-3.5 inline ml-1" style={{ color: '#3c78f0' }} />}</>} onClick={() => { if (requireFeature('notes_settings')) setShowNotesSettingsSheet(true); }} />
            <SettingsRow label={<>{t('settings.tasksSettings', 'Tasks Settings')} {!isProSub && <Crown className="h-3.5 w-3.5 inline ml-1" style={{ color: '#3c78f0' }} />}</>} onClick={() => { if (requireFeature('tasks_settings')) setShowTasksSettingsSheet(true); }} />
            <SettingsRow label={<>{t('settings.customizeNavigation', 'Customize Navigation')} {!isProSub && <Crown className="h-3.5 w-3.5 inline ml-1" style={{ color: '#3c78f0' }} />}</>} onClick={() => { if (requireFeature('customize_navigation')) setShowCustomizeNavigationSheet(true); }} />
          </div>


          {/* Security Section */}
          <div className="border border-border rounded-lg overflow-hidden" data-tour="settings-security">
            <SectionHeading title={t('settings.security', 'Security')} />
            <SettingsRow label={<>{t('settings.appLock', 'App Lock')} {!isProSub && <Crown className="h-3.5 w-3.5 inline ml-1" style={{ color: '#3c78f0' }} />}</>} onClick={() => { if (requireFeature('app_lock')) setShowAppLockSettingsSheet(true); }} />
          </div>

          {/* Data Management Section */}
          <div className="border border-border rounded-lg overflow-hidden" data-tour="settings-data">
            <SectionHeading title={t('settings.dataManagement', 'Data Management')} />
            <button
              onClick={() => { if (requireFeature('backup')) handleBackupData(); }}
              disabled={isBackingUp}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-muted transition-colors disabled:opacity-50"
            >
              <span className="text-foreground text-sm flex items-center gap-1">
                {isBackingUp ? t('settings.backingUp', 'Backing up...') : t('settings.backupData')}
                {!isProSub && <Crown className="h-3.5 w-3.5" style={{ color: '#3c78f0' }} />}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            
            <SettingsRow label={t('settings.restoreData')} onClick={handleRestoreData} />
            <SettingsRow label={t('settings.downloadData')} onClick={handleDownloadData} />
            <div className="border-b-0">
              <SettingsRow label={t('settings.deleteData')} onClick={handleDeleteData} />
            </div>
          </div>

          {/* Account Section */}
          <div className="border border-border rounded-lg overflow-hidden">
            <SectionHeading title={t('settings.account', 'Account')} />
            <button
              onClick={() => { setDeleteAccountConfirmText(''); setShowDeleteAccountDialog(true); }}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-destructive/10 transition-colors"
            >
              <span className="text-destructive text-sm font-medium">{t('settings.deleteAccount', 'Delete Account')}</span>
              <ChevronRight className="h-4 w-4 text-destructive/60" />
            </button>
          </div>

          {/* About & Support Section */}
          <div className="border border-border rounded-lg overflow-hidden">
            <SectionHeading title={t('settings.aboutSupport', 'About & Support')} />
            <SettingsRow label={t('settings.shareWithFriends')} onClick={handleShareApp} />
            <SettingsRow label={t('settings.termsOfService')} onClick={() => setShowTermsDialog(true)} />
            <SettingsRow label={t('settings.helpFeedback')} onClick={() => setShowHelpDialog(true)} />
            <SettingsRow label={t('settings.privacy')} onClick={() => window.open('https://docs.google.com/document/d/1YY5k6mXOKJtiZjEb9ws6Aq7UQbStGy-I/edit?usp=drivesdk&ouid=105643538765333343845&rtpof=true&sd=true', '_blank')} />
            <SettingsRow label={t('settings.rateApp')} onClick={handleRateAndShare} />
            <SettingsRow label={t('settings.whatsNew', "What's New")} onClick={() => window.dispatchEvent(new CustomEvent('showWhatsNew'))} />
            <div className="border-b-0">
              <SettingsRow label={t('settings.featureTour', 'Feature Tour')} onClick={() => {
                window.dispatchEvent(new CustomEvent('replayFeatureTour'));
                navigate('/');
              }} />
            </div>
          </div>
        </div>
      </main>

      <BottomNavigation />


      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialogs.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-semibold text-destructive">⚠️ {t('dialogs.deleteWarning')}</p>
              <p>{t('dialogs.deleteDesc')}</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{t('dialogs.deleteNotes')}</li>
                <li>{t('dialogs.deleteSettings')}</li>
                <li>{t('dialogs.deleteLocal')}</li>
              </ul>
              <p className="font-medium mt-2">{t('dialogs.deleteConfirm')}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteData} className="bg-destructive hover:bg-destructive/90">
              {t('dialogs.deleteEverything')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteAccountDialog} onOpenChange={setShowDeleteAccountDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              {t('dialogs.deleteAccountTitle', 'Delete Your Account')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="font-semibold text-destructive">
                ⚠️ {t('dialogs.deleteAccountWarning', 'This action is permanent and cannot be undone.')}
              </p>
              <p>{t('dialogs.deleteAccountDesc', 'Deleting your account will:')}</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{t('dialogs.deleteAccountNotes', 'Remove all your notes, tasks, and folders')}</li>
                <li>{t('dialogs.deleteAccountSettings', 'Erase all app settings and preferences')}</li>
                <li>{t('dialogs.deleteAccountSync', 'Disconnect Google Drive sync')}</li>
                <li>{t('dialogs.deleteAccountSub', 'Your subscription (if any) will NOT be automatically cancelled — manage it via Google Play')}</li>
              </ul>
              <div className="pt-2">
                <p className="text-sm font-medium mb-2">
                  {t('dialogs.deleteAccountTypeConfirm', 'Type DELETE to confirm:')}
                </p>
                <input
                  type="text"
                  value={deleteAccountConfirmText}
                  onChange={(e) => setDeleteAccountConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteAccountConfirmText !== 'DELETE'}
              onClick={async () => {
                try {
                  // Sign out of Google if connected
                  const { signOut: googleSignOut } = await import('@/contexts/GoogleAuthContext').then(m => ({ signOut: null }));
                  // Clear all local data
                  await clearAllSettings();
                  // Clear IndexedDB databases
                  const dbs = await window.indexedDB.databases?.() || [];
                  for (const db of dbs) {
                    if (db.name) window.indexedDB.deleteDatabase(db.name);
                  }
                  // Clear localStorage
                  localStorage.clear();
                  sessionStorage.clear();
                  toast({ title: t('toasts.accountDeleted', 'Account deleted successfully') });
                  setShowDeleteAccountDialog(false);
                  setTimeout(() => { window.location.href = '/'; }, 1000);
                } catch (error) {
                  console.error('Account deletion error:', error);
                  toast({ title: t('toasts.accountDeleteFailed', 'Failed to delete account'), variant: 'destructive' });
                }
              }}
              className="bg-destructive hover:bg-destructive/90 disabled:opacity-50 disabled:pointer-events-none"
            >
              {t('dialogs.deleteAccountButton', 'Delete Account')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialogs.restoreTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-semibold text-warning">⚠️ {t('dialogs.restoreNotice')}</p>
              <p>{t('dialogs.restoreDesc')}</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{t('dialogs.restoreReplace')}</li>
                <li>{t('dialogs.restoreOverwrite')}</li>
                <li>{t('dialogs.restoreReload')}</li>
              </ul>
              <p className="font-medium mt-2">{t('dialogs.restoreBackup')}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestoreData}>
              {t('dialogs.continueRestore')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Terms of Service Dialog */}
      <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('terms.title')}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4 text-sm">
              <section>
                <h3 className="font-semibold mb-2">1. {t('terms.acceptance')}</h3>
                <p className="text-muted-foreground">{t('terms.acceptanceDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">2. {t('terms.license')}</h3>
                <p className="text-muted-foreground">{t('terms.licenseDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">3. {t('terms.userData')}</h3>
                <p className="text-muted-foreground">{t('terms.userDataDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">4. {t('terms.disclaimer')}</h3>
                <p className="text-muted-foreground">{t('terms.disclaimerDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">5. {t('terms.limitations')}</h3>
                <p className="text-muted-foreground">{t('terms.limitationsDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">6. {t('terms.modifications')}</h3>
                <p className="text-muted-foreground">{t('terms.modificationsDesc')}</p>
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Privacy Policy Dialog */}
      <Dialog open={showPrivacyDialog} onOpenChange={setShowPrivacyDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('privacy.title')}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4 text-sm">
              <section>
                <h3 className="font-semibold mb-2">1. {t('privacy.infoCollect')}</h3>
                <p className="text-muted-foreground">{t('privacy.infoCollectDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">2. {t('privacy.localStorage')}</h3>
                <p className="text-muted-foreground">{t('privacy.localStorageDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">3. {t('privacy.dataSecurity')}</h3>
                <p className="text-muted-foreground">{t('privacy.dataSecurityDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">4. {t('privacy.thirdParty')}</h3>
                <p className="text-muted-foreground">{t('privacy.thirdPartyDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">5. {t('privacy.dataBackup')}</h3>
                <p className="text-muted-foreground">{t('privacy.dataBackupDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">6. {t('privacy.changes')}</h3>
                <p className="text-muted-foreground">{t('privacy.changesDesc')}</p>
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Help and Feedback Dialog */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('help.title')}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4 text-sm">
              <section>
                <h3 className="font-semibold mb-2">{t('help.gettingStarted')}</h3>
                <p className="text-muted-foreground">{t('help.gettingStartedDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">{t('help.organizing')}</h3>
                <p className="text-muted-foreground">{t('help.organizingDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">{t('help.backupRestore')}</h3>
                <p className="text-muted-foreground">{t('help.backupRestoreDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">{t('help.commonIssues')}</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>{t('help.issueNotSaving')}</li>
                  <li>{t('help.issueSlow')}</li>
                  <li>{t('help.issueLostData')}</li>
                </ul>
              </section>
              <section>
                <h3 className="font-semibold mb-2">{t('help.contactSupport')}</h3>
                <p className="text-muted-foreground">{t('help.contactSupportDesc')}</p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">{t('help.feedback')}</h3>
                <p className="text-muted-foreground">{t('help.feedbackDesc')}</p>
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Theme Switcher Dialog */}
      <Dialog open={showThemeDialog} onOpenChange={setShowThemeDialog}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('settings.chooseTheme')}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="grid grid-cols-2 gap-3">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => {
                    if (theme.id !== 'light' && !requireFeature('dark_mode')) return;
                    setTheme(theme.id);
                    toast({ title: t('settings.themeChanged', { theme: theme.name }) });
                  }}
                  className={cn(
                    "relative rounded-xl p-3 border-2 transition-all",
                    currentTheme === theme.id
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <div className={cn(
                    "w-full h-16 rounded-lg mb-2",
                    theme.preview
                  )} />
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-foreground">{t(`settings.themeNames.${theme.id}`, theme.name)}</span>
                    {theme.id !== 'light' && !isProSub && <Crown className="h-3.5 w-3.5" style={{ color: '#3c78f0' }} />}
                  </div>
                  {currentTheme === theme.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Custom Themes Button */}
            <div className="mt-4 pt-4 border-t border-border">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  setShowThemeDialog(false);
                  setShowCustomThemeSheet(true);
                }}
              >
                <Palette className="h-4 w-4" />
                Custom Themes
              </Button>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>


      {/* Language Dialog */}
      <Dialog open={showLanguageDialog} onOpenChange={setShowLanguageDialog}>
        <DialogContent className="max-w-md max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{t('settings.chooseLanguage')}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-2">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all",
                    i18n.language === lang.code
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-foreground">{lang.nativeName}</span>
                    <span className="text-xs text-muted-foreground">{lang.name}</span>
                  </div>
                  {i18n.language === lang.code && (
                    <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>


      {/* Note Type Visibility Sheet */}
      <NoteTypeVisibilitySheet
        isOpen={showNoteTypeVisibilitySheet}
        onClose={() => setShowNoteTypeVisibilitySheet(false)}
      />

      <NotesSettingsSheet
        isOpen={showNotesSettingsSheet}
        onClose={() => setShowNotesSettingsSheet(false)}
      />

      <TasksSettingsSheet
        isOpen={showTasksSettingsSheet}
        onClose={() => setShowTasksSettingsSheet(false)}
      />

      <CustomizeNavigationSheet
        isOpen={showCustomizeNavigationSheet}
        onClose={() => setShowCustomizeNavigationSheet(false)}
      />

      <WidgetSettingsSheet
        isOpen={showWidgetSettingsSheet}
        onClose={() => setShowWidgetSettingsSheet(false)}
      />

      <AppLockSettingsSheet
        open={showAppLockSettingsSheet}
        onOpenChange={setShowAppLockSettingsSheet}
        onSetupLock={() => {
          setShowAppLockSettingsSheet(false);
          setShowAppLockSetup(true);
        }}
      />

      {showAppLockSetup && (
        <div className="fixed inset-0 z-50 bg-background">
          <AppLockSetup
            onComplete={() => setShowAppLockSetup(false)}
            onCancel={() => setShowAppLockSetup(false)}
          />
        </div>
      )}

      <ToolbarOrderManager
        isOpen={toolbarOrder.isManagerOpen}
        onOpenChange={toolbarOrder.setIsManagerOpen}
        onOrderChange={toolbarOrder.updateOrder}
        onVisibilityChange={toolbarOrder.updateVisibility}
        currentOrder={toolbarOrder.order}
        currentVisibility={toolbarOrder.visibility}
      />

      <BackupSuccessDialog
        isOpen={showBackupSuccessDialog}
        onClose={() => setShowBackupSuccessDialog(false)}
        filePath={backupFilePath}
      />

      <ImportDataSheet
        isOpen={showImportSheet}
        onClose={() => setShowImportSheet(false)}
      />

      <CustomThemeSheet
        isOpen={showCustomThemeSheet}
        onClose={() => setShowCustomThemeSheet(false)}
        activeCustomThemeId={activeCustomThemeId}
        onThemeSelect={async (theme) => {
          // Clear built-in theme classes
          const allClasses = ['dark', 'ocean', 'forest', 'sunset', 'rose', 'midnight', 'minimal', 'nebula', 'obsidian', 'graphite', 'onyx', 'charcoal'];
          allClasses.forEach(cls => document.documentElement.classList.remove(cls));
          // Apply custom theme
          applyCustomTheme(theme);
          await setActiveCustomThemeId(theme.id);
          await setSetting('theme', 'custom');
          setActiveCustomThemeIdState(theme.id);
          setShowCustomThemeSheet(false);
          toast({ title: `Theme "${theme.name}" applied!` });
        }}
      />
    </div>
  );
};

export default Settings;
