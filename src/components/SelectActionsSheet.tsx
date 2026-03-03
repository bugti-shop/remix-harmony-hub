import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { FolderInput, Trash2, CheckSquare, Pin, Flag, Copy, FileText, MoreVertical, CheckCheck, Calendar, Clock, Bell, Repeat, LayoutList, Activity, Crown } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { useSubscription } from '@/contexts/SubscriptionContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export type SelectAction = 'move' | 'delete' | 'complete' | 'pin' | 'priority' | 'duplicate' | 'convert' | 'selectAll' | 'setDueDate' | 'setReminder' | 'setRepeat' | 'moveToSection' | 'setStatus';

interface SelectActionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onAction: (action: SelectAction) => void;
  totalCount?: number;
}

export const SelectActionsSheet = ({
  isOpen,
  onClose,
  selectedCount,
  onAction,
  totalCount = 0
}: SelectActionsSheetProps) => {
  const { t } = useTranslation();
  const { isPro } = useSubscription();
  
  // Hardware back button support - use 'sheet' priority to close sheet before navigation
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const handleAction = (action: SelectAction) => {
    onAction(action);
    if (action !== 'move' && action !== 'priority' && action !== 'selectAll' && action !== 'setDueDate' && action !== 'setReminder' && action !== 'setRepeat' && action !== 'moveToSection' && action !== 'setStatus') {
      onClose();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="mb-4">
          <SheetTitle>{t('actions.tasksSelected', { count: selectedCount })}</SheetTitle>
        </SheetHeader>

        <div className="grid grid-cols-4 gap-3 mb-4">
          <Button
            variant="outline"
            className="flex flex-col h-20 gap-2"
            onClick={() => handleAction('selectAll')}
          >
            <CheckCheck className="h-5 w-5 text-accent-purple" />
            <span className="text-xs">{t('actions.selectAll')}</span>
          </Button>

          <Button
            variant="outline"
            className="flex flex-col h-20 gap-2"
            onClick={() => handleAction('move')}
          >
            <FolderInput className="h-5 w-5 text-info" />
            <span className="text-xs">{t('actions.move')}</span>
          </Button>

          <Button
            variant="outline"
            className="flex flex-col h-20 gap-2"
            onClick={() => handleAction('delete')}
          >
            <Trash2 className="h-5 w-5 text-destructive" />
            <span className="text-xs">{t('common.delete')}</span>
          </Button>

          <Button
            variant="outline"
            className="flex flex-col h-20 gap-2"
            onClick={() => handleAction('complete')}
          >
            <CheckSquare className="h-5 w-5 text-success" />
            <span className="text-xs">{t('actions.complete')}</span>
          </Button>
        </div>

        {/* Second row of actions */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <Button
            variant="outline"
            className="flex flex-col h-20 gap-2"
            onClick={() => handleAction('setDueDate')}
          >
            <Calendar className="h-5 w-5 text-streak" />
            <span className="text-xs">{t('actions.dueDate')}</span>
          </Button>

          <Button
            variant="outline"
            className="flex flex-col h-20 gap-2"
            onClick={() => handleAction('setReminder')}
          >
            <Bell className="h-5 w-5 text-warning" />
            <span className="text-xs">{t('actions.reminder')}</span>
          </Button>

          <Button
            variant="outline"
            className="flex flex-col h-20 gap-2"
            onClick={() => handleAction('priority')}
          >
            <Flag className="h-5 w-5 text-destructive/70" />
            <span className="text-xs">{t('tasks.priority.title')}</span>
          </Button>

          <Button
            variant="outline"
            className="flex flex-col h-20 gap-2"
            onClick={() => handleAction('moveToSection')}
          >
            <LayoutList className="h-5 w-5 text-accent-indigo" />
            <span className="text-xs">{t('actions.section')}</span>
          </Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full">
              <MoreVertical className="h-4 w-4 mr-2" />
              {t('actions.moreActions')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-popover">
            <DropdownMenuItem onClick={() => handleAction('setStatus')}>
              <Activity className="h-4 w-4 mr-2" />
              {t('actions.setStatus')}
              {!isPro && <Crown className="h-3.5 w-3.5 ml-auto" style={{ color: '#3c78f0' }} />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAction('setRepeat')}>
              <Repeat className="h-4 w-4 mr-2" />
              {t('actions.setRepeat')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleAction('pin')}>
              <Pin className="h-4 w-4 mr-2" />
              {t('actions.pinTasks')}
              {!isPro && <Crown className="h-3.5 w-3.5 ml-auto" style={{ color: '#3c78f0' }} />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAction('duplicate')}>
              <Copy className="h-4 w-4 mr-2" />
              {t('common.duplicate')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAction('convert')}>
              <FileText className="h-4 w-4 mr-2" />
              {t('actions.convertToNote')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SheetContent>
    </Sheet>
  );
};