import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock, Fingerprint, Clock, Shield, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import {
  getAppLockSettings,
  setBiometricEnabled,
  setLockTiming,
  disableAppLock,
  AppLockSettings,
  LockTiming,
  LOCK_TIMING_OPTIONS,
} from '@/utils/appLockStorage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AppLockSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetupLock: () => void;
}

export const AppLockSettingsSheet = ({ open, onOpenChange, onSetupLock }: AppLockSettingsSheetProps) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AppLockSettings | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);

  useEffect(() => {
    if (open) {
      loadSettings();
      checkBiometric();
    }
  }, [open]);

  const loadSettings = async () => {
    const s = await getAppLockSettings();
    setSettings(s);
  };

  const checkBiometric = async () => {
    if (!Capacitor.isNativePlatform()) {
      setBiometricAvailable(false);
      return;
    }

    try {
      const { NativeBiometric } = await import('capacitor-native-biometric');
      const result = await NativeBiometric.isAvailable();
      setBiometricAvailable(result.isAvailable);
    } catch {
      setBiometricAvailable(false);
    }
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    if (enabled && biometricAvailable) {
      try {
        const { NativeBiometric } = await import('capacitor-native-biometric');
        await NativeBiometric.verifyIdentity({
          reason: t('appLock.enableBiometric', 'Enable fingerprint unlock'),
          title: t('appLock.biometricTitle', 'Confirm Fingerprint'),
        });
      } catch {
        toast.error(t('appLock.biometricFailed', 'Fingerprint verification failed'));
        return;
      }
    }

    await setBiometricEnabled(enabled);
    await loadSettings();
    toast.success(enabled 
      ? t('appLock.biometricEnabled', 'Fingerprint unlock enabled') 
      : t('appLock.biometricDisabled', 'Fingerprint unlock disabled')
    );
  };

  const handleTimingChange = async (timing: LockTiming) => {
    await setLockTiming(timing);
    await loadSettings();
    toast.success(t('appLock.timingUpdated', 'Lock timing updated'));
  };

  const handleDisableLock = async () => {
    await disableAppLock();
    setShowDisableDialog(false);
    await loadSettings();
    toast.success(t('appLock.lockDisabled', 'App lock disabled'));
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-[20px]">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              {t('appLock.settings', 'App Lock Settings')}
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-6 pb-8">
            {!settings?.isEnabled ? (
              // Lock not enabled - show setup option
              <div className="text-center py-8">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {t('appLock.notEnabled', 'App Lock Not Enabled')}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {t('appLock.notEnabledDesc', 'Protect your app with a PIN code to keep your data private')}
                </p>
                <Button onClick={onSetupLock} size="lg" className="gap-2">
                  <Lock className="h-5 w-5" />
                  {t('appLock.setupLock', 'Set Up App Lock')}
                </Button>
              </div>
            ) : (
              // Lock enabled - show settings
              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-primary">{t('appLock.enabled', 'App Lock Enabled')}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('appLock.pinProtected', 'Your app is protected with a PIN')}
                    </p>
                  </div>
                </div>

                {/* Biometric */}
                {(biometricAvailable || !Capacitor.isNativePlatform()) && (
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Fingerprint className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{t('appLock.fingerprint', 'Fingerprint Unlock')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('appLock.fingerprintDesc', 'Use your fingerprint to unlock')}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.biometricEnabled}
                      onCheckedChange={handleBiometricToggle}
                      disabled={!biometricAvailable && Capacitor.isNativePlatform()}
                    />
                  </div>
                )}

                {/* Lock Timing */}
                <div className="p-4 bg-muted/50 rounded-xl space-y-3">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{t('appLock.lockTiming', 'Auto-Lock Timing')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('appLock.lockTimingDesc', 'When should the app lock after closing?')}
                      </p>
                    </div>
                  </div>
                  <Select value={settings.lockTiming} onValueChange={handleTimingChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCK_TIMING_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.label, option.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Security Questions Info */}
                <div className="p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{t('appLock.securityQuestions', 'Security Questions')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('appLock.securityQuestionsSet', '{{count}} security questions set for PIN recovery', { count: settings.securityQuestions.length })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Disable Lock */}
                <Button
                  variant="outline"
                  className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setShowDisableDialog(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('appLock.disableLock', 'Disable App Lock')}
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Disable Confirmation Dialog */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('appLock.disableTitle', 'Disable App Lock?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('appLock.disableDesc', 'This will remove PIN protection from your app. Anyone with access to your device will be able to open the app.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisableLock} className="bg-destructive hover:bg-destructive/90">
              {t('appLock.disableLock', 'Disable Lock')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
