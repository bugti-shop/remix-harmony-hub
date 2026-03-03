import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Fingerprint, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { triggerHaptic } from '@/utils/haptics';
import { toast } from 'sonner';
import {
  getNoteProtection,
  verifyNotePassword,
  authenticateWithBiometric,
  checkBiometricAvailability,
  BiometricStatus,
} from '@/utils/noteProtection';

interface NoteUnlockSheetProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string;
  onUnlocked: () => void;
}

export const NoteUnlockSheet = ({
  isOpen,
  onClose,
  noteId,
  onUnlocked,
}: NoteUnlockSheetProps) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus>({ isAvailable: false, biometryType: 'none' });
  const [protection, setProtection] = useState({ hasPassword: false, useBiometric: false });
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  useEffect(() => {
    if (isOpen) {
      checkBiometricAvailability().then(setBiometricStatus);
      getNoteProtection(noteId).then(setProtection);
      setPassword('');
      setIsAuthenticating(false);
    }
  }, [isOpen, noteId]);

  const handleBiometricAuth = async () => {
    await triggerHaptic('heavy');
    setIsAuthenticating(true);
    
    const success = await authenticateWithBiometric(t('noteUnlock.protectedNote'));
    
    if (success) {
      await triggerHaptic('heavy');
      toast.success(t('noteUnlock.unlockedSuccess'));
      onUnlocked();
      onClose();
    } else {
      await triggerHaptic('heavy');
      toast.error(t('noteUnlock.authFailed'));
    }
    
    setIsAuthenticating(false);
  };

  const handlePasswordAuth = async () => {
    await triggerHaptic('heavy');
    
    if (!password) {
      toast.error(t('noteUnlock.pleaseEnterPassword'));
      return;
    }

    const success = verifyNotePassword(noteId, password);
    
    if (success) {
      await triggerHaptic('heavy');
      toast.success(t('noteUnlock.unlockedSuccess'));
      onUnlocked();
      onClose();
    } else {
      await triggerHaptic('heavy');
      toast.error(t('noteUnlock.incorrectPassword'));
    }
  };

  const getBiometricLabel = () => {
    switch (biometricStatus.biometryType) {
      case 'face':
        return t('noteUnlock.unlockFaceId');
      case 'fingerprint':
        return t('noteUnlock.unlockFingerprint');
      case 'iris':
        return t('noteUnlock.unlockIris');
      default:
        return t('noteUnlock.unlockBiometric');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            {t('noteUnlock.protectedNote')}
          </SheetTitle>
          <p className="text-sm text-muted-foreground mt-2">
            {t('noteUnlock.authenticateMsg')}
          </p>
        </SheetHeader>

        <div className="space-y-4">
          {protection.useBiometric && biometricStatus.isAvailable && (
            <Button
              onClick={handleBiometricAuth}
              className="w-full h-14"
              disabled={isAuthenticating}
            >
              <Fingerprint className="h-5 w-5 mr-2" />
              {getBiometricLabel()}
            </Button>
          )}

          {protection.hasPassword && (
            <div className="space-y-3">
              {protection.useBiometric && biometricStatus.isAvailable && (
                <div className="flex items-center gap-4 py-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{t('noteUnlock.or')}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('noteUnlock.enterPassword')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePasswordAuth()}
                  className="pr-10 h-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <Button onClick={handlePasswordAuth} variant="outline" className="w-full">
                <KeyRound className="h-4 w-4 mr-2" />
                {t('noteUnlock.unlockWithPassword')}
              </Button>
            </div>
          )}

          <Button variant="ghost" onClick={onClose} className="w-full text-muted-foreground">
            {t('common.cancel')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
