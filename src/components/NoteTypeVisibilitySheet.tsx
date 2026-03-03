import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { FileText, PenLine, StickyNote, Code, AlertCircle, Type, LayoutTemplate, Pen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NoteType } from '@/types/note';
import { 
  ALL_NOTE_TYPES, 
  getVisibleNoteTypes, 
  toggleNoteTypeVisibility,
  getNoteTypeDisplayName,
  getVisibleFeatures,
  toggleFeatureVisibility,
  ToggleableFeature,
} from '@/utils/noteTypeVisibility';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface NoteTypeVisibilitySheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const noteTypeIcons: Partial<Record<NoteType, React.ReactNode>> = {
  regular: <FileText className="h-5 w-5" />,
  lined: <PenLine className="h-5 w-5" />,
  sticky: <StickyNote className="h-5 w-5" />,
  code: <Code className="h-5 w-5" />,
  sketch: <Pen className="h-5 w-5" />,
  linkedin: <Type className="h-5 w-5" />,
};

const noteTypeColors: Partial<Record<NoteType, string>> = {
  regular: 'text-blue-500',
  lined: 'text-purple-500',
  sticky: 'text-yellow-500',
  code: 'text-green-500',
  sketch: 'text-teal-500',
  linkedin: 'text-sky-500',
};

const featureIcons: Record<ToggleableFeature, React.ReactNode> = {
  noteTemplates: <LayoutTemplate className="h-5 w-5" />,
};

const featureColors: Record<ToggleableFeature, string> = {
  noteTemplates: 'text-primary',
};

const getFeatureTranslationKey = (feature: ToggleableFeature): string => {
  const keys: Record<ToggleableFeature, string> = {
    noteTemplates: 'settings.noteTemplates',
  };
  return keys[feature];
};

export const NoteTypeVisibilitySheet = ({ isOpen, onClose }: NoteTypeVisibilitySheetProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [visibleTypes, setVisibleTypes] = useState<NoteType[]>([]);
  const [visibleFeatures, setVisibleFeatures] = useState<ToggleableFeature[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadAll();
    }
  }, [isOpen]);

  const loadAll = async () => {
    setIsLoading(true);
    const [types, features] = await Promise.all([
      getVisibleNoteTypes(),
      getVisibleFeatures(),
    ]);
    setVisibleTypes(types);
    setVisibleFeatures(features);
    setIsLoading(false);
  };

  const handleToggle = async (type: NoteType) => {
    const result = await toggleNoteTypeVisibility(type);
    
    if (!result.success) {
      toast({
        title: t('settings.cannotHideLastType', 'Cannot hide last note type'),
        description: t('settings.atLeastOneRequired', 'At least one note type must remain visible'),
        variant: 'destructive',
      });
      return;
    }
    
    setVisibleTypes(result.visible);
    
    const isNowVisible = result.visible.includes(type);
    toast({
      title: isNowVisible 
        ? t('settings.noteTypeShown', '{{type}} is now visible', { type: getNoteTypeDisplayName(type) })
        : t('settings.noteTypeHidden', '{{type}} is now hidden', { type: getNoteTypeDisplayName(type) }),
    });
  };

  const handleFeatureToggle = async (feature: ToggleableFeature) => {
    const newVisible = await toggleFeatureVisibility(feature);
    setVisibleFeatures(newVisible);
    
    const isNowVisible = newVisible.includes(feature);
    const featureName = t(getFeatureTranslationKey(feature));
    toast({
      title: isNowVisible
        ? t('settings.featureShown', '{{feature}} is now visible', { feature: featureName })
        : t('settings.featureHidden', '{{feature}} is now hidden', { feature: featureName }),
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh]">
        <SheetHeader className="pb-4">
          <SheetTitle>{t('settings.noteTypeVisibility', 'Note Type Visibility')}</SheetTitle>
        </SheetHeader>
        
        <div className="space-y-1">
          <div className="flex items-center gap-2 px-2 py-2 bg-muted/50 rounded-lg mb-4">
            <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">
              {t('settings.noteTypeVisibilityHint', 'At least one note type must remain visible')}
            </span>
          </div>
          
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              {t('common.loading', 'Loading...')}
            </div>
          ) : (
            <>
              {ALL_NOTE_TYPES.map((type) => {
                const isVisible = visibleTypes.includes(type);
                const isLastVisible = visibleTypes.length === 1 && isVisible;
                
                return (
                  <div 
                    key={type}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 rounded-lg transition-colors",
                      isVisible ? "bg-card" : "bg-muted/30"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={noteTypeColors[type]}>
                        {noteTypeIcons[type]}
                      </div>
                      <span className={cn(
                        "font-medium",
                        !isVisible && "text-muted-foreground"
                      )}>
                        {t(`notes.noteTypes.${type}`, getNoteTypeDisplayName(type))}
                      </span>
                    </div>
                    <Switch
                      checked={isVisible}
                      onCheckedChange={() => handleToggle(type)}
                      disabled={isLastVisible}
                    />
                  </div>
                );
              })}
              
              <Separator className="my-3" />
              <p className="text-xs text-muted-foreground px-4 pb-1 font-semibold">{t('settings.features', 'Features')}</p>
              
              {(['noteTemplates'] as ToggleableFeature[]).map((feature) => {
                const isVisible = visibleFeatures.includes(feature);
                return (
                  <div 
                    key={feature}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 rounded-lg transition-colors",
                      isVisible ? "bg-card" : "bg-muted/30"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={featureColors[feature]}>
                        {featureIcons[feature]}
                      </div>
                      <span className={cn(
                        "font-medium",
                        !isVisible && "text-muted-foreground"
                      )}>
                        {t(getFeatureTranslationKey(feature))}
                      </span>
                    </div>
                    <Switch
                      checked={isVisible}
                      onCheckedChange={() => handleFeatureToggle(feature)}
                    />
                  </div>
                );
              })}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};