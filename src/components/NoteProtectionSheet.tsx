import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Lock, Fingerprint, Eye, EyeOff, Shield, Trash2 } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { triggerHaptic } from '@/utils/haptics';
import { toast } from 'sonner';
import {
  getNoteProtection,
  setNoteProtection,
  removeNoteProtection,
  checkBiometricAvailability,
  BiometricStatus,
} from '@/utils/noteProtection';

interface NoteProtectionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string;
  onProtectionChanged?: () => void;
}

export const NoteProtectionSheet = ({
  isOpen,
  onClose,
  noteId,
  onProtectionChanged,
}: NoteProtectionSheetProps) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [useBiometric, setUseBiometric] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus>({ isAvailable: false, biometryType: 'none' });
  const [isProtected, setIsProtected] = useState(false);

  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  useEffect(() => {
    if (isOpen) {
      checkBiometricAvailability().then(setBiometricStatus);
      getNoteProtection(noteId).then((protection) => {
        setIsProtected(protection.hasPassword || protection.useBiometric);
        setUseBiometric(protection.useBiometric);
        setUsePassword(protection.hasPassword);
      });
      setPassword('');
      setConfirmPassword('');
    }
  }, [isOpen, noteId]);

  const handleSave = async () => {
    await triggerHaptic('heavy');

    if (usePassword) {
      if (!password) {
        toast.error(t('noteProtection.pleaseEnterPassword'));
        return;
      }
      if (password !== confirmPassword) {
        toast.error(t('noteProtection.passwordsDoNotMatch'));
        return;
      }
      if (password.length < 4) {
        toast.error(t('noteProtection.passwordTooShort'));
        return;
      }
    }

    await setNoteProtection(
      noteId,
      { hasPassword: usePassword, useBiometric },
      usePassword ? password : undefined
    );

    toast.success(t('noteProtection.protectionUpdated'));
    onProtectionChanged?.();
    onClose();
  };

  const handleRemoveProtection = async () => {
    await triggerHaptic('heavy');
    removeNoteProtection(noteId);
    toast.success(t('noteProtection.protectionRemoved'));
    onProtectionChanged?.();
    onClose();
  };

  const getBiometricLabel = () => {
    switch (biometricStatus.biometryType) {
      case 'face':
        return t('noteProtection.useFaceId');
      case 'fingerprint':
        return t('noteProtection.useFingerprint');
      case 'iris':
        return t('noteProtection.useIrisScan');
      default:
        return t('noteProtection.useBiometric');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {t('noteProtection.protectNote')}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Password Protection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="use-password">{t('noteProtection.passwordProtection')}</Label>
              </div>
              <Switch
                id="use-password"
                checked={usePassword}
                onCheckedChange={setUsePassword}
              />
            </div>

            {usePassword && (
              <div className="space-y-3 pl-6">
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('noteProtection.enterPassword')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('noteProtection.confirmPassword')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Biometric Protection */}
          {biometricStatus.isAvailable && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="use-biometric">{getBiometricLabel()}</Label>
              </div>
              <Switch
                id="use-biometric"
                checked={useBiometric}
                onCheckedChange={setUseBiometric}
              />
            </div>
          )}

          {!biometricStatus.isAvailable && (
            <p className="text-xs text-muted-foreground">
              {t('noteProtection.biometricNotAvailable')}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-4">
            <Button onClick={handleSave} className="w-full">
              <Shield className="h-4 w-4 mr-2" />
              {isProtected ? t('noteProtection.updateProtection') : t('noteProtection.enableProtection')}
            </Button>

            {isProtected && (
              <Button
                variant="outline"
                onClick={handleRemoveProtection}
                className="w-full text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('noteProtection.removeProtection')}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
