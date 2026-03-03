import { useState } from 'react';
import { ChevronLeft, FileText, Clock, Palette, FolderTree, Bell, Users, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const triggerHaptic = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (error) {
    console.log('Haptics not available');
  }
};

interface OnboardingQuestion {
  question: string;
  options: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
  }[];
}

const questions: OnboardingQuestion[] = [
  {
    question: "What's your primary use for notes?",
    options: [
      { icon: FileText, label: "Work and projects", value: "work" },
      { icon: Clock, label: "Personal journaling", value: "journal" },
      { icon: Users, label: "Study and learning", value: "study" },
      { icon: Palette, label: "Creative writing", value: "creative" },
    ],
  },
  {
    question: "How do you prefer to organize?",
    options: [
      { icon: FolderTree, label: "Folders and categories", value: "folders" },
      { icon: FileText, label: "Tags and labels", value: "tags" },
      { icon: Clock, label: "By date and time", value: "date" },
      { icon: Palette, label: "Color coding", value: "colors" },
    ],
  },
  {
    question: "What's your note-taking style?",
    options: [
      { icon: FileText, label: "Quick bullet points", value: "bullets" },
      { icon: Palette, label: "Detailed paragraphs", value: "detailed" },
      { icon: Clock, label: "Voice recordings", value: "voice" },
      { icon: FolderTree, label: "Tables and structured notes", value: "tables" },
    ],
  },
  {
    question: "How often do you take notes?",
    options: [
      { icon: Clock, label: "Multiple times daily", value: "daily" },
      { icon: FileText, label: "Few times a week", value: "weekly" },
      { icon: Palette, label: "Occasionally", value: "occasional" },
      { icon: FolderTree, label: "Rarely, but important", value: "rare" },
    ],
  },
  {
    question: "What features matter most?",
    options: [
      { icon: Shield, label: "Privacy and security", value: "privacy" },
      { icon: Clock, label: "Quick access speed", value: "speed" },
      { icon: Palette, label: "Rich formatting", value: "formatting" },
      { icon: Users, label: "Easy sharing", value: "sharing" },
    ],
  },
  {
    question: "What stops you from staying organized?",
    options: [
      { icon: Clock, label: "Lack of consistency", value: "consistency" },
      { icon: FileText, label: "Too many scattered notes", value: "scattered" },
      { icon: Users, label: "Lack of time", value: "time" },
      { icon: FolderTree, label: "Difficulty finding notes", value: "finding" },
    ],
  },
  {
    question: "How do you want to improve?",
    options: [
      { icon: Bell, label: "Better daily habits", value: "habits" },
      { icon: FolderTree, label: "More organization", value: "organization" },
      { icon: Clock, label: "Faster note capture", value: "capture" },
      { icon: Palette, label: "More creative expression", value: "expression" },
    ],
  },
];

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');
  const totalSteps = questions.length + 2;

  const currentQuestion = currentStep < questions.length ? questions[currentStep] : null;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const handleSelect = async (value: string) => {
    await triggerHaptic();
    setAnswers({ ...answers, [currentStep]: value });
  };

  const handleContinue = async () => {
    await triggerHaptic();
    setSlideDirection('left');
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      const { setSetting } = await import('@/utils/settingsStorage');
      await setSetting('onboardingComplete', 'true');
      await setSetting('onboardingAnswers', answers);
      onComplete();
    }
  };

  const handleSkip = async () => {
    await triggerHaptic();
    const { setSetting } = await import('@/utils/settingsStorage');
    await setSetting('onboardingComplete', 'skipped');
    onComplete();
  };

  const handleBack = async () => {
    await triggerHaptic();
    setSlideDirection('right');
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const selectedValue = currentQuestion ? answers[currentStep] : undefined;

  if (currentStep < questions.length && currentQuestion) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="px-4 pt-4 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-muted hover:bg-muted/80 transition-colors"
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            onClick={handleSkip}
            className="text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
          >
            Skip
          </button>
        </div>

        <div className="px-4 mt-4">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300 ease-out bg-primary"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex-1 px-6 pt-8 pb-6 flex flex-col overflow-hidden">
          <div
            key={currentStep}
            className="flex-1 flex flex-col animate-fade-in"
          >
            <h1 className="text-3xl font-bold mb-8">
              {currentQuestion.question}
            </h1>

            <div className="space-y-3 flex-1">
              {currentQuestion.options.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedValue === option.value;

                return (
                  <button
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "w-full p-4 rounded-2xl flex items-center gap-4 transition-all duration-200 text-left",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    )}
                  >
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                        isSelected ? "bg-primary-foreground text-primary" : "bg-background text-foreground"
                      )}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-lg font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-6">
              <Button
                onClick={handleContinue}
                disabled={!selectedValue}
                className="w-full h-14 text-lg font-semibold rounded-full disabled:opacity-50"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
