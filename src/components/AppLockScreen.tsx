import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Fingerprint, KeyRound, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  getAppLockSettings,
  verifyPin,
  verifySecurityAnswer,
  resetPinWithSecurityQuestions,
  updateLastUnlockTime,
  AppLockSettings,
} from '@/utils/appLockStorage';
import { triggerHaptic, triggerNotificationHaptic } from '@/utils/haptics';
import { Capacitor } from '@capacitor/core';

interface AppLockScreenProps {
  onUnlock: () => void;
}

type Mode = 'pin' | 'biometric' | 'forgot' | 'reset';

export const AppLockScreen = ({ onUnlock }: AppLockScreenProps) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('pin');
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(0);
  const [settings, setSettings] = useState<AppLockSettings | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [verifiedQuestions, setVerifiedQuestions] = useState(0);
  const [pinError, setPinError] = useState('');
  const [resetStep, setResetStep] = useState<'verify' | 'new-pin' | 'confirm-pin'>('verify');

  useEffect(() => {
    loadSettings();
  }, []);

  // Handle lockout countdown
  useEffect(() => {
    if (lockCountdown > 0) {
      const timer = setTimeout(() => setLockCountdown(lockCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (lockCountdown === 0 && isLocked) {
      setIsLocked(false);
      setAttempts(0);
    }
  }, [lockCountdown, isLocked]);

  const loadSettings = async () => {
    const s = await getAppLockSettings();
    setSettings(s);
    
    // Try biometric first if enabled
    if (s.biometricEnabled && Capacitor.isNativePlatform()) {
      attemptBiometric();
    }
  };

  const attemptBiometric = async () => {
    try {
      // Use native biometric authentication
      const { NativeBiometric } = await import('capacitor-native-biometric');
      
      const result = await NativeBiometric.isAvailable();
      if (!result.isAvailable) {
        return;
      }
      
      await NativeBiometric.verifyIdentity({
        reason: t('appLock.biometricReason', 'Unlock your app'),
        title: t('appLock.biometricTitle', 'Authentication Required'),
        subtitle: t('appLock.biometricSubtitle', 'Use your fingerprint to unlock'),
      });
      
      // Biometric success
      await updateLastUnlockTime();
      triggerNotificationHaptic('success');
      onUnlock();
    } catch (error) {
      console.log('Biometric auth failed or not available:', error);
      // Fall back to PIN
      setMode('pin');
    }
  };

  const handlePinChange = async (value: string) => {
    if (isLocked) return;
    
    const numericValue = value.replace(/\D/g, '').slice(0, 4);
    setPin(numericValue);
    setPinError('');

    if (numericValue.length === 4 && settings?.pinHash) {
      const isValid = await verifyPin(numericValue, settings.pinHash);
      
      if (isValid) {
        triggerNotificationHaptic('success');
        await updateLastUnlockTime();
        onUnlock();
      } else {
        triggerNotificationHaptic('error');
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        if (newAttempts >= 5) {
          // Lock for 30 seconds after 5 failed attempts
          setIsLocked(true);
          setLockCountdown(30);
          setPinError(t('appLock.tooManyAttempts', 'Too many attempts. Try again in 30 seconds.'));
        } else {
          setPinError(t('appLock.incorrectPin', 'Incorrect PIN. {{remaining}} attempts remaining.', { remaining: 5 - newAttempts }));
        }
        
        setTimeout(() => setPin(''), 300);
      }
    }
  };

  const handleSecurityAnswer = async () => {
    if (!settings) return;

    const isCorrect = await verifySecurityAnswer(currentQuestionIndex, securityAnswer);
    
    if (isCorrect) {
      triggerNotificationHaptic('success');
      const newVerified = verifiedQuestions + 1;
      setVerifiedQuestions(newVerified);
      
      if (newVerified >= 2) {
        // Both questions verified, allow PIN reset
        setMode('reset');
        setResetStep('new-pin');
        toast.success(t('appLock.questionsVerified', 'Security questions verified!'));
      } else {
        // Move to next question
        setCurrentQuestionIndex(currentQuestionIndex === 0 ? 1 : 0);
        setSecurityAnswer('');
        toast.success(t('appLock.answerCorrect', 'Correct! Please answer the next question.'));
      }
    } else {
      triggerNotificationHaptic('error');
      toast.error(t('appLock.answerIncorrect', 'Incorrect answer. Please try again.'));
      setSecurityAnswer('');
    }
  };

  const handleNewPin = (value: string) => {
    const numericValue = value.replace(/\D/g, '').slice(0, 4);
    setNewPin(numericValue);
    setPinError('');
    
    if (numericValue.length === 4) {
      triggerHaptic('light');
      setResetStep('confirm-pin');
    }
  };

  const handleConfirmNewPin = async (value: string) => {
    const numericValue = value.replace(/\D/g, '').slice(0, 4);
    setConfirmNewPin(numericValue);
    
    if (numericValue.length === 4) {
      if (numericValue === newPin) {
        try {
          await resetPinWithSecurityQuestions(newPin);
          triggerNotificationHaptic('success');
          toast.success(t('appLock.pinReset', 'PIN reset successfully!'));
          onUnlock();
        } catch (error) {
          toast.error(t('appLock.resetFailed', 'Failed to reset PIN'));
        }
      } else {
        triggerNotificationHaptic('error');
        setPinError(t('appLock.pinMismatch', 'PINs do not match'));
        setTimeout(() => setConfirmNewPin(''), 300);
      }
    }
  };

  // Render PIN dots
  const renderPinDots = (currentPin: string) => (
    <div className="flex gap-4 justify-center my-8">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            "w-4 h-4 rounded-full border-2 transition-all duration-200",
            currentPin.length > i
              ? "bg-primary border-primary scale-110"
              : "border-muted-foreground/40"
          )}
        />
      ))}
    </div>
  );

  // Render number pad
  const renderNumberPad = (currentPin: string, onChange: (value: string) => void) => {
    const handleKeyPress = (num: string) => {
      if (currentPin.length < 4 && !isLocked) {
        onChange(currentPin + num);
        triggerHaptic('light');
      }
    };

    const handleDelete = () => {
      if (currentPin.length > 0) {
        onChange(currentPin.slice(0, -1));
        triggerHaptic('light');
      }
    };

    return (
      <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => handleKeyPress(num)}
            disabled={isLocked}
            className={cn(
              "w-16 h-16 rounded-full bg-muted text-2xl font-semibold text-foreground flex items-center justify-center transition-all",
              isLocked ? "opacity-50" : "hover:bg-muted/80 active:bg-primary/20 active:scale-95"
            )}
          >
            {num}
          </button>
        ))}
        <div /> {/* Empty space */}
        <button
          type="button"
          onClick={() => handleKeyPress('0')}
          disabled={isLocked}
          className={cn(
            "w-16 h-16 rounded-full bg-muted text-2xl font-semibold text-foreground flex items-center justify-center transition-all",
            isLocked ? "opacity-50" : "hover:bg-muted/80 active:bg-primary/20 active:scale-95"
          )}
        >
          0
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isLocked}
          className={cn(
            "w-16 h-16 rounded-full bg-muted text-lg font-medium text-foreground flex items-center justify-center transition-all",
            isLocked ? "opacity-50" : "hover:bg-muted/80 active:bg-destructive/20 active:scale-95"
          )}
        >
          ⌫
        </button>
      </div>
    );
  };

  if (!settings) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-6">
      {mode === 'pin' && (
        <>
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Lock className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t('appLock.enterPin', 'Enter PIN')}</h1>
          <p className="text-muted-foreground mb-4">{t('appLock.enterPinToUnlock', 'Enter your PIN to unlock the app')}</p>
          
          {renderPinDots(pin)}
          
          {pinError && (
            <div className="flex items-center gap-2 text-destructive text-sm mb-4 animate-shake">
              <AlertCircle className="h-4 w-4" />
              {pinError}
            </div>
          )}
          
          {isLocked && (
            <div className="text-center mb-4">
              <p className="text-destructive font-medium">{t('appLock.locked', 'Locked')}</p>
              <p className="text-muted-foreground text-sm">
                {t('appLock.tryAgainIn', 'Try again in {{seconds}} seconds', { seconds: lockCountdown })}
              </p>
            </div>
          )}
          
          {renderNumberPad(pin, handlePinChange)}
          
          <div className="flex gap-4 mt-8">
            {settings.biometricEnabled && Capacitor.isNativePlatform() && (
              <Button variant="ghost" onClick={attemptBiometric} className="gap-2">
                <Fingerprint className="h-5 w-5" />
                {t('appLock.useBiometric', 'Use Fingerprint')}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setMode('forgot')} className="gap-2">
              <KeyRound className="h-5 w-5" />
              {t('appLock.forgotPin', 'Forgot PIN?')}
            </Button>
          </div>
        </>
      )}

      {mode === 'forgot' && resetStep === 'verify' && (
        <>
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <KeyRound className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t('appLock.resetPin', 'Reset PIN')}</h1>
          <p className="text-muted-foreground mb-6 text-center">
            {t('appLock.answerQuestions', 'Answer your security questions to reset your PIN')}
          </p>
          
          <div className="w-full max-w-sm space-y-4">
            <p className="font-medium">{t(settings.securityQuestions[currentQuestionIndex]?.question, settings.securityQuestions[currentQuestionIndex]?.question)}</p>
            <Input
              type="text"
              placeholder={t('appLock.yourAnswer', 'Your answer')}
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSecurityAnswer()}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode('pin')} className="flex-1">
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button onClick={handleSecurityAnswer} disabled={!securityAnswer.trim()} className="flex-1">
                {t('appLock.verify', 'Verify')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {t('appLock.verifiedCount', '{{count}} of 2 questions verified', { count: verifiedQuestions })}
            </p>
          </div>
        </>
      )}

      {mode === 'reset' && resetStep === 'new-pin' && (
        <>
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Lock className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t('appLock.newPin', 'Enter New PIN')}</h1>
          <p className="text-muted-foreground mb-4">{t('appLock.enterNewPin', 'Enter a new 4-digit PIN')}</p>
          
          {renderPinDots(newPin)}
          {renderNumberPad(newPin, handleNewPin)}
        </>
      )}

      {mode === 'reset' && resetStep === 'confirm-pin' && (
        <>
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Lock className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t('appLock.confirmNewPin', 'Confirm New PIN')}</h1>
          <p className="text-muted-foreground mb-4">{t('appLock.reenterPin', 'Re-enter your new PIN')}</p>
          
          {renderPinDots(confirmNewPin)}
          
          {pinError && (
            <div className="flex items-center gap-2 text-destructive text-sm mb-4">
              <AlertCircle className="h-4 w-4" />
              {pinError}
            </div>
          )}
          
          {renderNumberPad(confirmNewPin, handleConfirmNewPin)}
          
          <Button variant="ghost" onClick={() => { setResetStep('new-pin'); setNewPin(''); setConfirmNewPin(''); }} className="mt-4">
            {t('common.back', 'Back')}
          </Button>
        </>
      )}
    </div>
  );
};
