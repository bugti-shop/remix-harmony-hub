import { useState, useEffect } from 'react';

import { TodoBottomNavigation } from '@/components/TodoBottomNavigation';
import { ChevronRight, Check, ChevronDown, Crown } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { getSetting, setSetting, clearAllSettings } from '@/utils/settingsStorage';
import { toast } from 'sonner';
import { useDarkMode, themes, ThemeId } from '@/hooks/useDarkMode';
import { languages } from '@/i18n';
import { TasksSettingsSheet } from '@/components/TasksSettingsSheet';
import { NotesSettingsSheet } from '@/components/NotesSettingsSheet';
import { NoteTypeVisibilitySheet } from '@/components/NoteTypeVisibilitySheet';
import { CustomizeTodoNavigationSheet } from '@/components/CustomizeTodoNavigationSheet';
import { WidgetSettingsSheet } from '@/components/WidgetSettingsSheet';
import { ToolbarOrderManager, useToolbarOrder } from '@/components/ToolbarOrderManager';
import { AppLockSettingsSheet } from '@/components/AppLockSettingsSheet';
import { AppLockSetup } from '@/components/AppLockSetup';
import { downloadBackup, downloadData, restoreFromBackup } from '@/utils/dataBackup';
import { createNativeBackup, isNativePlatform } from '@/utils/nativeBackup';
import { BackupSuccessDialog } from '@/components/BackupSuccessDialog';

import { Capacitor } from '@capacitor/core';
import appLogo from '@/assets/app-logo.png';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { ScrollArea } from '@/components/ui/scroll-area';

const TodoSettings = () => {
  const { t, i18n } = useTranslation();
  const { currentTheme, setTheme } = useDarkMode();
  const { requireFeature, isPro } = useSubscription();
  const toolbarOrder = useToolbarOrder();
  
  // Dialog states
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  const [showLanguageDialog, setShowLanguageDialog] = useState(false);
  const [showTasksSettingsSheet, setShowTasksSettingsSheet] = useState(false);
  const [showNotesSettingsSheet, setShowNotesSettingsSheet] = useState(false);
  const [showNoteTypeVisibilitySheet, setShowNoteTypeVisibilitySheet] = useState(false);
  const [showCustomizeNavigationSheet, setShowCustomizeNavigationSheet] = useState(false);
  const [showWidgetSettingsSheet, setShowWidgetSettingsSheet] = useState(false);
  const [showAppLockSettingsSheet, setShowAppLockSettingsSheet] = useState(false);
  const [showAppLockSetup, setShowAppLockSetup] = useState(false);
  const [showNotificationsExpanded, setShowNotificationsExpanded] = useState(false);
  const [showQuickAddDialog, setShowQuickAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showBackupSuccessDialog, setShowBackupSuccessDialog] = useState(false);
  const [backupFilePath, setBackupFilePath] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  // Notification settings
  const [taskRemindersEnabled, setTaskRemindersEnabled] = useState(true);
  const [noteRemindersEnabled, setNoteRemindersEnabled] = useState(true);
  const [dailyDigestEnabled, setDailyDigestEnabled] = useState(false);
  const [overdueAlertsEnabled, setOverdueAlertsEnabled] = useState(true);
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false);
  const currentLanguage = languages.find(l => l.code === i18n.language) || languages[0];

  // Load settings
  useEffect(() => {
    getSetting<boolean>('taskRemindersEnabled', true).then(setTaskRemindersEnabled);
    getSetting<boolean>('noteRemindersEnabled', true).then(setNoteRemindersEnabled);
    getSetting<boolean>('dailyDigestEnabled', false).then(setDailyDigestEnabled);
    getSetting<boolean>('overdueAlertsEnabled', true).then(setOverdueAlertsEnabled);
    getSetting<boolean>('systemCalendarSyncEnabled', false).then(setCalendarSyncEnabled);
    
  }, []);

  const handleLanguageChange = async (langCode: string) => {
    i18n.changeLanguage(langCode);
    await setSetting('npd_language', langCode);
    const lang = languages.find(l => l.code === langCode);
    toast.success(t('settings.languageChanged', { language: lang?.nativeName || langCode }));
    setShowLanguageDialog(false);
  };

  const handleTaskRemindersToggle = async (enabled: boolean) => {
    setTaskRemindersEnabled(enabled);
    await setSetting('taskRemindersEnabled', enabled);
    toast.success(enabled ? t('settings.taskRemindersEnabled', 'Task reminders enabled') : t('settings.taskRemindersDisabled', 'Task reminders disabled'));
  };

  const handleNoteRemindersToggle = async (enabled: boolean) => {
    setNoteRemindersEnabled(enabled);
    await setSetting('noteRemindersEnabled', enabled);
    toast.success(enabled ? t('settings.noteRemindersEnabled', 'Note reminders enabled') : t('settings.noteRemindersDisabled', 'Note reminders disabled'));
  };

  const handleDailyDigestToggle = async (enabled: boolean) => {
    setDailyDigestEnabled(enabled);
    await setSetting('dailyDigestEnabled', enabled);
    toast.success(enabled ? t('settings.dailyDigestEnabled', 'Daily digest enabled') : t('settings.dailyDigestDisabled', 'Daily digest disabled'));
  };

  const handleOverdueAlertsToggle = async (enabled: boolean) => {
    setOverdueAlertsEnabled(enabled);
    await setSetting('overdueAlertsEnabled', enabled);
    toast.success(enabled ? t('settings.overdueAlertsEnabled', 'Overdue alerts enabled') : t('settings.overdueAlertsDisabled', 'Overdue alerts disabled'));
  };

  const handleCalendarSyncToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        const { requestCalendarPermissions, setCalendarSyncEnabled: setSync } = await import('@/utils/systemCalendarSync');
        const granted = await requestCalendarPermissions();
        if (!granted) {
          toast.error(t('settings.calendarPermissionDenied', 'Calendar permission denied. Please grant access in device settings.'));
          return;
        }
        await setSync(true);
        setCalendarSyncEnabled(true);
        toast.success(t('settings.calendarSyncEnabled', 'System calendar sync enabled'));
      } else {
        const { setCalendarSyncEnabled: setSync } = await import('@/utils/systemCalendarSync');
        await setSync(false);
        setCalendarSyncEnabled(false);
        toast.success(t('settings.calendarSyncDisabled', 'System calendar sync disabled'));
      }
    } catch (error) {
      console.error('Error toggling calendar sync:', error);
      toast.error(t('errors.calendarSyncFailed', 'Failed to toggle calendar sync'));
    }
  };


  const handleBackupData = async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    try {
      if (isNativePlatform()) {
        const result = await createNativeBackup();
        if (result.success && result.filePath) {
          setBackupFilePath(result.filePath);
          setShowBackupSuccessDialog(true);
        } else {
          toast.error(result.error || t('toasts.backupFailed'));
        }
      } else {
        await downloadBackup();
        toast.success(t('toasts.dataBackedUp'));
      }
    } catch (error) {
      console.error('Backup error:', error);
      toast.error(t('toasts.backupFailed'));
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreData = () => setShowRestoreDialog(true);

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
          toast.success(t('toasts.dataRestored'));
          setTimeout(() => window.location.reload(), 1000);
        } else {
          toast.error(result.error || t('toasts.restoreFailed'));
        }
      }
    };
    input.click();
    setShowRestoreDialog(false);
  };

  const handleDownloadData = async () => {
    try {
      await downloadData();
      toast.success(t('toasts.dataDownloaded'));
    } catch (error) {
      toast.error(t('toasts.downloadFailed'));
    }
  };

  const handleDeleteData = () => setShowDeleteDialog(true);

  const confirmDeleteData = async () => {
    await clearAllSettings();
    toast.success(t('toasts.dataDeleted'));
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
        toast.success(t('toasts.linkCopied', 'Link copied to clipboard!'));
      }).catch(() => {
        window.open(shareUrl, '_blank');
      });
    }
  };

  const handleRateAndShare = () => {
    window.open('https://play.google.com/store/apps/details?id=nota.npd.com', '_blank');
  };

  // Settings row component
  const SettingsRow = ({ label, value, onClick }: { label: React.ReactNode; value?: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-muted transition-colors"
    >
      <span className="text-foreground text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {value && <span className="text-muted-foreground text-sm">{value}</span>}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
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
            <h1 className="text-base xs:text-lg sm:text-xl font-bold truncate">{t('settings.taskSettings', 'Task Settings')}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 xs:px-3 sm:px-4 py-3 xs:py-4 sm:py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Preferences Section */}
          <div className="border border-border rounded-lg overflow-hidden">
            <SectionHeading title={t('settings.preferences', 'Preferences')} />
            <SettingsRow 
              label={t('settings.theme', 'Theme')} 
              value={themes.find(th => th.id === currentTheme)?.name}
              onClick={() => setShowThemeDialog(true)} 
            />
            <SettingsRow 
              label={t('settings.language', 'Language')} 
              value={currentLanguage.nativeName}
              onClick={() => setShowLanguageDialog(true)} 
            />
            <SettingsRow 
              label={<>{t('settings.noteTypeVisibility', 'Note Type Visibility')} {!isPro && <Crown className="h-3.5 w-3.5 inline ml-1" style={{ color: '#3c78f0' }} />}</>}
              onClick={() => { if (requireFeature('notes_type_visibility')) setShowNoteTypeVisibilitySheet(true); }} 
            />
            <SettingsRow 
              label={<>{t('settings.notesSettings', 'Notes Settings')} {!isPro && <Crown className="h-3.5 w-3.5 inline ml-1" style={{ color: '#3c78f0' }} />}</>}
              onClick={() => { if (requireFeature('notes_settings')) setShowNotesSettingsSheet(true); }} 
            />
            <SettingsRow 
              label={<>{t('settings.tasksSettings', 'Task Defaults & Display')} {!isPro && <Crown className="h-3.5 w-3.5 inline ml-1" style={{ color: '#3c78f0' }} />}</>}
              onClick={() => { if (requireFeature('tasks_settings')) setShowTasksSettingsSheet(true); }} 
            />
            <SettingsRow 
              label={<>{t('settings.customizeNavigation', 'Customize Navigation')} {!isPro && <Crown className="h-3.5 w-3.5 inline ml-1" style={{ color: '#3c78f0' }} />}</>}
              onClick={() => { if (requireFeature('customize_navigation')) setShowCustomizeNavigationSheet(true); }} 
            />
          </div>

          {/* Notifications Section */}
          <div className="border border-border rounded-lg overflow-hidden">
            <SectionHeading title={t('settings.notifications', 'Notifications')} />
            <button
              onClick={() => setShowNotificationsExpanded(!showNotificationsExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-muted transition-colors"
            >
              <span className="text-foreground text-sm">{t('settings.notificationSettings', 'Notification Settings')}</span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showNotificationsExpanded && "rotate-180")} />
            </button>
            
            {showNotificationsExpanded && (
              <div className="bg-muted/30">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                  <div className="flex-1 pr-4">
                    <span className="text-foreground text-sm block">{t('settings.taskReminders', 'Task Reminders')}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('settings.taskRemindersDesc', 'Receive notifications for task due dates')}
                    </span>
                  </div>
                  <Switch checked={taskRemindersEnabled} onCheckedChange={handleTaskRemindersToggle} />
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                  <div className="flex-1 pr-4">
                    <span className="text-foreground text-sm block">{t('settings.noteReminders', 'Note Reminders')}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('settings.noteRemindersDesc', 'Receive notifications for note reminders')}
                    </span>
                  </div>
                  <Switch checked={noteRemindersEnabled} onCheckedChange={handleNoteRemindersToggle} />
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                  <div className="flex-1 pr-4">
                    <span className="text-foreground text-sm block">{t('settings.dailyDigest', 'Daily Digest')}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('settings.dailyDigestDesc', 'Morning summary of today\'s tasks')}
                    </span>
                  </div>
                  <Switch checked={dailyDigestEnabled} onCheckedChange={handleDailyDigestToggle} />
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                  <div className="flex-1 pr-4">
                    <span className="text-foreground text-sm block">{t('settings.overdueAlerts', 'Overdue Alerts')}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('settings.overdueAlertsDesc', 'Get notified about overdue tasks')}
                    </span>
                  </div>
                  <Switch checked={overdueAlertsEnabled} onCheckedChange={handleOverdueAlertsToggle} />
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 pr-4">
                    <span className="text-foreground text-sm block">📅 {t('settings.calendarSync', 'System Calendar Sync')}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('settings.calendarSyncDesc', 'Sync tasks & events with your device calendar')}
                    </span>
                  </div>
                  <Switch checked={calendarSyncEnabled} onCheckedChange={handleCalendarSyncToggle} />
                </div>
                {calendarSyncEnabled && (
                  <div className="px-4 py-3 text-xs text-muted-foreground bg-muted/30">
                    <p>🔄 {t('settings.calendarSyncHint1', 'Tasks with due dates appear in your system calendar')}</p>
                    <p className="mt-1">📲 {t('settings.calendarSyncHint2', 'Device calendar events sync into this app')}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <SectionHeading title={t('settings.security', 'Security')} />
            <SettingsRow 
              label={<>{t('settings.appLock', 'App Lock')} {!isPro && <Crown className="h-3.5 w-3.5 inline ml-1" style={{ color: '#3c78f0' }} />}</>}
              onClick={() => { if (requireFeature('app_lock')) setShowAppLockSettingsSheet(true); }} 
            />
          </div>

          {/* Data Management Section */}
          <div className="border border-border rounded-lg overflow-hidden">
            <SectionHeading title={t('settings.dataManagement', 'Data Management')} />
            <button
              onClick={() => { if (requireFeature('backup')) handleBackupData(); }}
              disabled={isBackingUp}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-muted transition-colors disabled:opacity-50"
            >
              <span className="text-foreground text-sm flex items-center gap-1">
                {isBackingUp ? t('settings.backingUp', 'Backing up...') : t('settings.backupData')}
                {!isPro && <Crown className="h-3.5 w-3.5" style={{ color: '#3c78f0' }} />}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <SettingsRow label={t('settings.restoreData')} onClick={handleRestoreData} />
            <SettingsRow label={t('settings.downloadData')} onClick={handleDownloadData} />
            <SettingsRow label={t('settings.deleteData')} onClick={handleDeleteData} />
          </div>

          {/* About & Support Section */}
          <div className="border border-border rounded-lg overflow-hidden">
            <SectionHeading title={t('settings.aboutSupport', 'About & Support')} />
            <SettingsRow label={t('settings.shareWithFriends')} onClick={handleShareApp} />
            <SettingsRow label={t('settings.termsOfService')} onClick={() => setShowTermsDialog(true)} />
            <SettingsRow label={t('settings.helpFeedback')} onClick={() => setShowHelpDialog(true)} />
            <SettingsRow label={t('settings.privacy')} onClick={() => window.open('https://docs.google.com/document/d/1YY5k6mXOKJtiZjEb9ws6Aq7UQbStGy-I/edit?usp=drivesdk&ouid=105643538765333343845&rtpof=true&sd=true', '_blank')} />
            <SettingsRow label={t('settings.rateApp')} onClick={handleRateAndShare} />
          </div>
        </div>
      </main>

      {/* Theme Dialog */}
      <Dialog open={showThemeDialog} onOpenChange={setShowThemeDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('settings.selectTheme', 'Select Theme')}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-1">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => {
                    if (theme.id !== 'light' && !requireFeature('dark_mode')) return;
                    setTheme(theme.id);
                    setShowThemeDialog(false);
                    toast.success(t('settings.themeChanged', { theme: theme.name }));
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors",
                    currentTheme === theme.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-6 h-6 rounded-full border-2 border-border"
                      style={{ backgroundColor: theme.preview }}
                    />
                    <span className="text-sm font-medium">{theme.name}</span>
                    {theme.id !== 'light' && !isPro && <Crown className="h-3.5 w-3.5" style={{ color: '#3c78f0' }} />}
                  </div>
                  {currentTheme === theme.id && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Language Dialog */}
      <Dialog open={showLanguageDialog} onOpenChange={setShowLanguageDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('settings.selectLanguage', 'Select Language')}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-1">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors",
                    i18n.language === lang.code ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <span className="text-sm font-medium block">{lang.nativeName}</span>
                      <span className="text-xs text-muted-foreground">{lang.name}</span>
                    </div>
                  </div>
                  {i18n.language === lang.code && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>


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

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialogs.restoreTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-semibold text-orange-600">⚠️ {t('dialogs.restoreNotice')}</p>
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

      {/* Sheets */}
      <TasksSettingsSheet isOpen={showTasksSettingsSheet} onClose={() => setShowTasksSettingsSheet(false)} />
      <NotesSettingsSheet isOpen={showNotesSettingsSheet} onClose={() => setShowNotesSettingsSheet(false)} />
      <NoteTypeVisibilitySheet isOpen={showNoteTypeVisibilitySheet} onClose={() => setShowNoteTypeVisibilitySheet(false)} />
      <CustomizeTodoNavigationSheet isOpen={showCustomizeNavigationSheet} onClose={() => setShowCustomizeNavigationSheet(false)} />
      <WidgetSettingsSheet isOpen={showWidgetSettingsSheet} onClose={() => setShowWidgetSettingsSheet(false)} />

      <AppLockSettingsSheet
        open={showAppLockSettingsSheet}
        onOpenChange={setShowAppLockSettingsSheet}
        onSetupLock={() => {
          setShowAppLockSettingsSheet(false);
          setShowAppLockSetup(true);
        }}
      />

      {showAppLockSetup && (
        <AppLockSetup
          onComplete={() => setShowAppLockSetup(false)}
          onCancel={() => setShowAppLockSetup(false)}
        />
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


      <TodoBottomNavigation />
    </div>
  );
};

export default TodoSettings;
