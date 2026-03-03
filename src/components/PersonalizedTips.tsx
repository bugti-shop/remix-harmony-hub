import { useState, useEffect } from 'react';
import { Lightbulb, X } from 'lucide-react';
import { getPersonalizedRecommendations } from '@/utils/personalization';
import { getSetting, setSetting } from '@/utils/settingsStorage';

export const PersonalizedTips = () => {
  const [tips, setTips] = useState<string[]>([]);
  const [currentTip, setCurrentTip] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const loadTips = async () => {
      const answers = await getSetting<Record<number, string> | null>('onboardingAnswers', null);
      const dismissed = await getSetting<boolean>('tipsDismissed', false);

      if (answers && !dismissed) {
        const recommendations = getPersonalizedRecommendations(answers);
        if (recommendations.length > 0) {
          setTips(recommendations);
          setIsVisible(true);
        }
      }
    };
    loadTips();
  }, []);

  const handleNext = () => {
    if (currentTip < tips.length - 1) {
      setCurrentTip(currentTip + 1);
    } else {
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setSetting('tipsDismissed', true);
  };

  if (!isVisible || tips.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-4 mb-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
          <Lightbulb className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold mb-1 text-foreground">Personalized Tip</h3>
          <p className="text-sm text-muted-foreground mb-3">{tips[currentTip]}</p>
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {tips.map((_, index) => (
                <div
                  key={index}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: index === currentTip ? '24px' : '6px',
                    backgroundColor: index === currentTip ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    opacity: index === currentTip ? 1 : 0.3,
                  }}
                />
              ))}
            </div>
            <button
              onClick={handleNext}
              className="text-sm font-medium text-primary hover:text-primary/80"
            >
              {currentTip < tips.length - 1 ? 'Next' : 'Got it'}
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
