import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HelpCircle, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { triggerHaptic } from '@/utils/haptics';
import { toast } from 'sonner';
import {
  getSecurityQuestion,
  verifySecurityAnswer,
  setHiddenNotesPassword,
} from '@/utils/noteProtection';

interface ForgotPasswordSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onPasswordReset: () => void;
}

const SECURITY_QUESTIONS = [
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your favorite movie?",
  "What was the name of your elementary school?",
  "What is your favorite food?",
];

export const ForgotPasswordSheet = ({
  isOpen,
  onClose,
  onPasswordReset,
}: ForgotPasswordSheetProps) => {
  const [step, setStep] = useState<'verify' | 'reset'>('verify');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [storedQuestion, setStoredQuestion] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  useEffect(() => {
    if (isOpen) {
      const question = getSecurityQuestion();
      setStoredQuestion(question);
      setStep('verify');
      setSecurityAnswer('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [isOpen]);

  const handleVerifyAnswer = async () => {
    await triggerHaptic('heavy');

    if (!securityAnswer.trim()) {
      toast.error('Please enter your answer');
      return;
    }

    const isValid = await verifySecurityAnswer(securityAnswer);
    if (isValid) {
      setStep('reset');
      toast.success('Answer verified!');
    } else {
      toast.error('Incorrect answer. Please try again.');
    }
  };

  const handleResetPassword = async () => {
    await triggerHaptic('heavy');

    if (!newPassword) {
      toast.error('Please enter a new password');
      return;
    }
    if (newPassword.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    await setHiddenNotesPassword(newPassword);
    toast.success('Password reset successfully!');
    onPasswordReset();
    onClose();
  };

  if (!storedQuestion) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Password Recovery
            </SheetTitle>
          </SheetHeader>

          <div className="text-center py-8">
            <ShieldCheck className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">
              No security question has been set up for password recovery.
            </p>
            <p className="text-sm text-muted-foreground">
              You can set up a security question in the Hidden Notes settings after unlocking.
            </p>
          </div>

          <Button variant="outline" onClick={onClose} className="w-full mt-4">
            Close
          </Button>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            {step === 'verify' ? (
              <>
                <HelpCircle className="h-5 w-5 text-primary" />
                Verify Your Identity
              </>
            ) : (
              <>
                <KeyRound className="h-5 w-5 text-primary" />
                Reset Password
              </>
            )}
          </SheetTitle>
        </SheetHeader>

        {step === 'verify' ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Security Question</Label>
              <p className="font-medium">{storedQuestion}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="security-answer">Your Answer</Label>
              <Input
                id="security-answer"
                type="text"
                placeholder="Enter your answer"
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyAnswer()}
                className="h-12"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={handleVerifyAnswer} className="w-full">
                Verify Answer
              </Button>
              <Button variant="ghost" onClick={onClose} className="w-full text-muted-foreground">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Enter your new password below.
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                  className="h-12"
                />
              </div>
            </div>

            <Button onClick={handleResetPassword} className="w-full">
              <KeyRound className="h-4 w-4 mr-2" />
              Reset Password
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

// Export security questions for use in setup
export { SECURITY_QUESTIONS };
