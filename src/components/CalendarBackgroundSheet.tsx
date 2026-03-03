import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Check, Image, Sparkles, Waves, Mountain, Sun, Moon, Trees, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setSetting } from '@/utils/settingsStorage';
import { useTranslation } from 'react-i18next';

interface CalendarBackgroundSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentBackground: string;
  onBackgroundChange: (background: string) => void;
}

const BACKGROUND_OPTIONS = [
  { id: 'none', name: 'None', icon: null, gradient: null },
  { id: 'sunset', name: 'Sunset', icon: Sun, gradient: 'linear-gradient(135deg, hsl(25, 95%, 75%) 0%, hsl(350, 85%, 70%) 50%, hsl(280, 75%, 65%) 100%)' },
  { id: 'ocean', name: 'Ocean', icon: Waves, gradient: 'linear-gradient(135deg, hsl(200, 85%, 70%) 0%, hsl(210, 90%, 55%) 50%, hsl(220, 85%, 45%) 100%)' },
  { id: 'forest', name: 'Forest', icon: Trees, gradient: 'linear-gradient(135deg, hsl(140, 65%, 65%) 0%, hsl(150, 60%, 45%) 50%, hsl(160, 55%, 35%) 100%)' },
  { id: 'night', name: 'Night Sky', icon: Moon, gradient: 'linear-gradient(135deg, hsl(240, 50%, 25%) 0%, hsl(260, 60%, 20%) 50%, hsl(280, 55%, 15%) 100%)' },
  { id: 'aurora', name: 'Aurora', icon: Sparkles, gradient: 'linear-gradient(135deg, hsl(180, 70%, 50%) 0%, hsl(280, 80%, 60%) 50%, hsl(320, 75%, 55%) 100%)' },
  { id: 'mountain', name: 'Mountain', icon: Mountain, gradient: 'linear-gradient(135deg, hsl(220, 40%, 70%) 0%, hsl(210, 50%, 50%) 50%, hsl(200, 45%, 35%) 100%)' },
  { id: 'cloudy', name: 'Cloudy', icon: Cloud, gradient: 'linear-gradient(135deg, hsl(210, 30%, 85%) 0%, hsl(220, 35%, 75%) 50%, hsl(230, 40%, 65%) 100%)' },
  { id: 'lavender', name: 'Lavender', icon: Sparkles, gradient: 'linear-gradient(135deg, hsl(270, 60%, 80%) 0%, hsl(280, 55%, 70%) 50%, hsl(290, 50%, 60%) 100%)' },
  { id: 'mint', name: 'Mint Fresh', icon: Trees, gradient: 'linear-gradient(135deg, hsl(160, 50%, 80%) 0%, hsl(170, 55%, 65%) 50%, hsl(180, 60%, 50%) 100%)' },
  { id: 'coral', name: 'Coral Reef', icon: Waves, gradient: 'linear-gradient(135deg, hsl(15, 85%, 75%) 0%, hsl(5, 80%, 65%) 50%, hsl(355, 75%, 55%) 100%)' },
  { id: 'golden', name: 'Golden Hour', icon: Sun, gradient: 'linear-gradient(135deg, hsl(45, 90%, 75%) 0%, hsl(35, 85%, 60%) 50%, hsl(25, 80%, 50%) 100%)' },
];

export const CalendarBackgroundSheet = ({
  isOpen,
  onClose,
  currentBackground,
  onBackgroundChange,
}: CalendarBackgroundSheetProps) => {
  const { t } = useTranslation();

  const handleSelect = async (backgroundId: string) => {
    onBackgroundChange(backgroundId);
    await setSetting('calendarBackground', backgroundId);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            {t('calendar.backgroundSettings', 'Calendar Background')}
          </SheetTitle>
        </SheetHeader>
        
        <div className="grid grid-cols-3 gap-3 overflow-y-auto pb-8">
          {BACKGROUND_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = currentBackground === option.id;
            
            return (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className={cn(
                  "relative flex flex-col items-center justify-center p-4 rounded-xl transition-all",
                  "border-2",
                  isSelected 
                    ? "border-primary ring-2 ring-primary/20" 
                    : "border-border/50 hover:border-border"
                )}
                style={{
                  background: option.gradient || 'hsl(var(--card))',
                }}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
                
                <div 
                  className={cn(
                    "h-12 w-12 rounded-full flex items-center justify-center mb-2",
                    option.gradient ? "bg-white/20 backdrop-blur-sm" : "bg-muted"
                  )}
                >
                  {Icon ? (
                    <Icon className={cn(
                      "h-6 w-6",
                      option.gradient ? "text-white" : "text-muted-foreground"
                    )} />
                  ) : (
                    <div className="h-6 w-6 border-2 border-dashed border-muted-foreground/50 rounded-full" />
                  )}
                </div>
                
                <span className={cn(
                  "text-sm font-medium",
                  option.gradient ? "text-white drop-shadow-sm" : "text-foreground"
                )}>
                  {option.name}
                </span>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};