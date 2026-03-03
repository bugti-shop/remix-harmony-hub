import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, Lock, Shield, Check, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import {
  enableAppLock,
  SecurityQuestion,
  SECURITY_QUESTIONS,
} from '@/utils/appLockStorage';
import { triggerHaptic, triggerNotificationHaptic } from '@/utils/haptics';

interface AppLockSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

type Step = 'enter-pin' | 'confirm-pin' | 'security-questions';

export const AppLockSetup = ({ onComplete, onCancel }: AppLockSetupProps) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('enter-pin');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestion[]>([
    { question: '', answer: '' },
    { question: '', answer: '' },
  ]);
  const [showAnswers, setShowAnswers] = useState<boolean[]>([false, false]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input on step change
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  // Handle PIN input
  const handlePinChange = (value: string, isConfirm = false) => {
    const numericValue = value.replace(/\D/g, '').slice(0, 4);
    
    if (isConfirm) {
      setConfirmPin(numericValue);
      if (numericValue.length === 4) {
        // Auto-verify on complete
        if (numericValue === pin) {
          triggerNotificationHaptic('success');
          setStep('security-questions');
          setPinError('');
        } else {
          triggerNotificationHaptic('error');
          setPinError(t('appLock.pinMismatch', 'PINs do not match'));
          setTimeout(() => setConfirmPin(''), 300);
        }
      }
    } else {
      setPin(numericValue);
      setPinError('');
      if (numericValue.length === 4) {
        triggerHaptic('light');
        setStep('confirm-pin');
        setConfirmPin('');
      }
    }
  };

  const handleSecurityQuestionChange = (index: number, field: 'question' | 'answer', value: string) => {
    setSecurityQuestions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const toggleAnswerVisibility = (index: number) => {
    setShowAnswers(prev => {
      const updated = [...prev];
      updated[index] = !updated[index];
      return updated;
    });
  };

  const handleComplete = async () => {
    // Validate security questions
    const validQuestions = securityQuestions.filter(q => q.question && q.answer.trim());
    if (validQuestions.length < 2) {
      toast.error(t('appLock.needTwoQuestions', 'Please set up at least 2 security questions'));
      return;
    }

    setIsSubmitting(true);
    try {
      await enableAppLock(pin, validQuestions);
      triggerNotificationHaptic('success');
      toast.success(t('appLock.setupComplete', 'App lock enabled successfully'));
      onComplete();
    } catch (error) {
      console.error('Failed to enable app lock:', error);
      toast.error(t('appLock.setupFailed', 'Failed to enable app lock'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 'confirm-pin') {
      setStep('enter-pin');
      setConfirmPin('');
      setPinError('');
    } else if (step === 'security-questions') {
      setStep('confirm-pin');
      setConfirmPin('');
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
  const renderNumberPad = (isConfirm = false) => {
    const currentPin = isConfirm ? confirmPin : pin;
    const handleChange = (value: string) => handlePinChange(value, isConfirm);

    const handleKeyPress = (num: string) => {
      if (currentPin.length < 4) {
        handleChange(currentPin + num);
        triggerHaptic('light');
      }
    };

    const handleDelete = () => {
      if (currentPin.length > 0) {
        handleChange(currentPin.slice(0, -1));
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
            className="w-16 h-16 rounded-full bg-muted hover:bg-muted/80 active:bg-primary/20 text-2xl font-semibold text-foreground flex items-center justify-center transition-all active:scale-95"
          >
            {num}
          </button>
        ))}
        <div /> {/* Empty space */}
        <button
          type="button"
          onClick={() => handleKeyPress('0')}
          className="w-16 h-16 rounded-full bg-muted hover:bg-muted/80 active:bg-primary/20 text-2xl font-semibold text-foreground flex items-center justify-center transition-all active:scale-95"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="w-16 h-16 rounded-full bg-muted hover:bg-muted/80 active:bg-destructive/20 text-lg font-medium text-foreground flex items-center justify-center transition-all active:scale-95"
        >
          ⌫
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <button
          onClick={step === 'enter-pin' ? onCancel : handleBack}
          className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          {t('appLock.setupTitle', 'Set Up App Lock')}
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {step === 'enter-pin' && (
          <div className="w-full max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{t('appLock.enterPin', 'Enter a 4-digit PIN')}</h2>
            <p className="text-muted-foreground mb-6">
              {t('appLock.enterPinDesc', 'This PIN will be used to unlock your app')}
            </p>
            {renderPinDots(pin)}
            {renderNumberPad()}
          </div>
        )}

        {step === 'confirm-pin' && (
          <div className="w-full max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{t('appLock.confirmPin', 'Confirm your PIN')}</h2>
            <p className="text-muted-foreground mb-6">
              {t('appLock.confirmPinDesc', 'Enter the same PIN again to confirm')}
            </p>
            {renderPinDots(confirmPin)}
            {pinError && (
              <p className="text-destructive text-sm mb-4 animate-shake">{pinError}</p>
            )}
            {renderNumberPad(true)}
          </div>
        )}

        {step === 'security-questions' && (
          <div className="w-full max-w-md">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-2">
              {t('appLock.securityQuestions', 'Security Questions')}
            </h2>
            <p className="text-muted-foreground text-center mb-6">
              {t('appLock.securityQuestionsDesc', 'These will help you reset your PIN if you forget it')}
            </p>

            <div className="space-y-6">
              {securityQuestions.map((sq, index) => (
                <div key={index} className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('appLock.question', 'Question')} {index + 1}
                  </label>
                  <Select
                    value={sq.question}
                    onValueChange={(value) => handleSecurityQuestionChange(index, 'question', value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('appLock.selectQuestion', 'Select a question')} />
                    </SelectTrigger>
                    <SelectContent>
                      {SECURITY_QUESTIONS.map((q) => (
                        <SelectItem
                          key={q}
                          value={q}
                          disabled={securityQuestions.some((sq, i) => i !== index && sq.question === q)}
                        >
                          {t(q, q)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Input
                      type={showAnswers[index] ? 'text' : 'password'}
                      placeholder={t('appLock.yourAnswer', 'Your answer')}
                      value={sq.answer}
                      onChange={(e) => handleSecurityQuestionChange(index, 'answer', e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleAnswerVisibility(index)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showAnswers[index] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={handleComplete}
              disabled={isSubmitting || securityQuestions.some(q => !q.question || !q.answer.trim())}
              className="w-full mt-8"
              size="lg"
            >
              {isSubmitting ? (
                <span className="animate-spin mr-2">⏳</span>
              ) : (
                <Check className="h-5 w-5 mr-2" />
              )}
              {t('appLock.enableLock', 'Enable App Lock')}
            </Button>
          </div>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex justify-center gap-2 pb-8">
        {['enter-pin', 'confirm-pin', 'security-questions'].map((s, i) => (
          <div
            key={s}
            className={cn(
              "w-2 h-2 rounded-full transition-all",
              step === s ? "bg-primary w-6" : "bg-muted-foreground/30"
            )}
          />
        ))}
      </div>
    </div>
  );
};
