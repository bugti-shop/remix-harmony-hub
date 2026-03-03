import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { 
  X, 
  GripVertical, 
  Calendar as CalendarIcon,
  Flag,
  Timer,
  Tag,
  CalendarClock,
  FolderIcon,
  Image as ImageIcon,
  Repeat,
  Settings2,
  ChevronDown,
  ListTodo,
  FileText,
  MapPin,
  Paperclip,
  Hourglass
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ActionItem {
  id: string;
  name: string;
  icon: React.ElementType;
  enabled: boolean;
  color?: string;
  group: 'scheduling' | 'organization' | 'media';
}

export const getDefaultActions = (t: (key: string) => string): ActionItem[] => [
  { id: 'date', name: t('editActions.date'), icon: CalendarIcon, enabled: true, color: 'text-blue-500', group: 'scheduling' },
  { id: 'deadline', name: t('editActions.deadline'), icon: CalendarClock, enabled: true, color: 'text-rose-500', group: 'scheduling' },
  { id: 'reminder', name: t('editActions.reminders'), icon: Timer, enabled: true, color: 'text-purple-500', group: 'scheduling' },
  { id: 'repeat', name: t('editActions.repeat'), icon: Repeat, enabled: true, color: 'text-indigo-500', group: 'scheduling' },
  { id: 'priority', name: t('editActions.priority'), icon: Flag, enabled: true, color: 'text-orange-500', group: 'organization' },
  { id: 'tags', name: t('editActions.tags'), icon: Tag, enabled: true, color: 'text-teal-500', group: 'organization' },
  { id: 'folder', name: t('editActions.folder'), icon: FolderIcon, enabled: true, color: 'text-amber-500', group: 'organization' },
  { id: 'section', name: t('editActions.section'), icon: ListTodo, enabled: true, color: 'text-violet-500', group: 'organization' },
  { id: 'description', name: t('editActions.description'), icon: FileText, enabled: true, color: 'text-cyan-500', group: 'organization' },
  { id: 'location', name: t('editActions.location'), icon: MapPin, enabled: true, color: 'text-pink-500', group: 'organization' },
  { id: 'image', name: t('editActions.image'), icon: ImageIcon, enabled: true, color: 'text-emerald-500', group: 'media' },
  { id: 'attachment', name: t('editActions.files'), icon: Paperclip, enabled: true, color: 'text-sky-500', group: 'media' },
  { id: 'effort', name: t('editActions.estimate'), icon: Hourglass, enabled: true, color: 'text-primary', group: 'scheduling' },
];

export const defaultActions: ActionItem[] = [
  { id: 'date', name: 'Date', icon: CalendarIcon, enabled: true, color: 'text-blue-500', group: 'scheduling' },
  { id: 'deadline', name: 'Deadline', icon: CalendarClock, enabled: true, color: 'text-rose-500', group: 'scheduling' },
  { id: 'reminder', name: 'Reminders', icon: Timer, enabled: true, color: 'text-purple-500', group: 'scheduling' },
  { id: 'repeat', name: 'Repeat', icon: Repeat, enabled: true, color: 'text-indigo-500', group: 'scheduling' },
  { id: 'priority', name: 'Priority', icon: Flag, enabled: true, color: 'text-orange-500', group: 'organization' },
  { id: 'tags', name: 'Tags', icon: Tag, enabled: true, color: 'text-teal-500', group: 'organization' },
  { id: 'folder', name: 'Folder', icon: FolderIcon, enabled: true, color: 'text-amber-500', group: 'organization' },
  { id: 'section', name: 'Section', icon: ListTodo, enabled: true, color: 'text-violet-500', group: 'organization' },
  { id: 'description', name: 'Description', icon: FileText, enabled: true, color: 'text-cyan-500', group: 'organization' },
  { id: 'location', name: 'Location', icon: MapPin, enabled: true, color: 'text-pink-500', group: 'organization' },
  { id: 'image', name: 'Image', icon: ImageIcon, enabled: true, color: 'text-emerald-500', group: 'media' },
  { id: 'attachment', name: 'Files', icon: Paperclip, enabled: true, color: 'text-sky-500', group: 'media' },
  { id: 'effort', name: 'Estimate', icon: Hourglass, enabled: true, color: 'text-primary', group: 'scheduling' },
];

const groupInfo = {
  scheduling: { name: 'Scheduling', description: 'Date, time & reminders' },
  organization: { name: 'Organization', description: 'Priority, tags & folders' },
  media: { name: 'Media', description: 'Images & attachments' },
};

interface EditActionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  actions: ActionItem[];
  onSave: (actions: ActionItem[]) => void;
}

const actionNameMap: Record<string, string> = {
  date: 'editActions.date',
  deadline: 'editActions.deadline',
  reminder: 'editActions.reminders',
  repeat: 'editActions.repeat',
  effort: 'editActions.estimate',
  priority: 'editActions.priority',
  tags: 'editActions.tags',
  folder: 'editActions.folder',
  section: 'editActions.section',
  description: 'editActions.description',
  location: 'editActions.location',
  image: 'editActions.image',
  attachment: 'editActions.files',
};

export const EditActionsSheet = ({ isOpen, onClose, actions, onSave }: EditActionsSheetProps) => {
  const { t } = useTranslation();
  const [localActions, setLocalActions] = useState<ActionItem[]>(actions);
  const getActionName = (action: ActionItem) => actionNameMap[action.id] ? t(actionNameMap[action.id]) : action.name;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    scheduling: true,
    organization: true,
    media: true,
  });

  // Hardware back button support - use 'sheet' priority to close sheet before navigation
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  useEffect(() => {
    // Ensure all actions have a group
    const updatedActions = actions.map(action => ({
      ...action,
      group: action.group || defaultActions.find(d => d.id === action.id)?.group || 'organization'
    }));
    setLocalActions(updatedActions as ActionItem[]);
  }, [actions]);

  const triggerHaptic = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
  };

  const handleDragStart = () => {
    triggerHaptic();
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    await triggerHaptic();
    
    const sourceGroup = result.source.droppableId as ActionItem['group'];
    const destGroup = result.destination.droppableId as ActionItem['group'];
    
    // Get items for source group
    const sourceItems = localActions.filter(a => a.group === sourceGroup);
    const otherItems = localActions.filter(a => a.group !== sourceGroup);
    
    // Remove from source
    const [movedItem] = sourceItems.splice(result.source.index, 1);
    
    if (sourceGroup === destGroup) {
      // Reorder within same group
      sourceItems.splice(result.destination.index, 0, movedItem);
      
      // Rebuild full array maintaining group order
      const newActions = [
        ...localActions.filter(a => a.group === 'scheduling' && a.id !== movedItem.id),
        ...localActions.filter(a => a.group === 'organization' && a.id !== movedItem.id),
        ...localActions.filter(a => a.group === 'media' && a.id !== movedItem.id),
      ];
      
      // Insert moved item at correct position in its group
      const groupStartIndex = newActions.filter(a => {
        if (sourceGroup === 'scheduling') return false;
        if (sourceGroup === 'organization') return a.group === 'scheduling';
        return a.group === 'scheduling' || a.group === 'organization';
      }).length;
      
      newActions.splice(groupStartIndex + result.destination.index, 0, { ...movedItem, group: sourceGroup });
      setLocalActions(newActions);
    } else {
      // Move to different group
      const updatedItem = { ...movedItem, group: destGroup };
      const destItems = localActions.filter(a => a.group === destGroup);
      destItems.splice(result.destination.index, 0, updatedItem);
      
      // Rebuild maintaining order
      const scheduling = destGroup === 'scheduling' ? destItems : 
                        sourceGroup === 'scheduling' ? sourceItems :
                        localActions.filter(a => a.group === 'scheduling');
      const organization = destGroup === 'organization' ? destItems :
                          sourceGroup === 'organization' ? sourceItems :
                          localActions.filter(a => a.group === 'organization');
      const media = destGroup === 'media' ? destItems :
                   sourceGroup === 'media' ? sourceItems :
                   localActions.filter(a => a.group === 'media');
      
      setLocalActions([...scheduling, ...organization, ...media]);
    }
  };

  const handleToggle = async (id: string) => {
    await triggerHaptic();
    setLocalActions(prev => 
      prev.map(action => 
        action.id === id ? { ...action, enabled: !action.enabled } : action
      )
    );
  };

  const handleSave = async () => {
    await triggerHaptic();
    onSave(localActions);
    onClose();
  };

  const handleReset = async () => {
    await triggerHaptic();
    setLocalActions(defaultActions);
  };

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const getGroupInfo = (group: string) => ({
    scheduling: { name: t('editActions.scheduling'), description: t('editActions.schedulingDesc') },
    organization: { name: t('editActions.organization'), description: t('editActions.organizationDesc') },
    media: { name: t('editActions.media'), description: t('editActions.mediaDesc') },
  }[group] || { name: group, description: '' });

  const getGroupActions = (group: ActionItem['group']) => 
    localActions.filter(a => a.group === group);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background z-[80] flex flex-col animate-in slide-in-from-bottom duration-300" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-muted rounded-lg">
            <X className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold">{t('editActions.title')}</h2>
            <p className="text-xs text-muted-foreground">{t('editActions.subtitle')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset}>{t('common.reset')}</Button>
          <Button size="sm" onClick={handleSave}>{t('common.save')}</Button>
        </div>
      </div>

      {/* Actions List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-lg mx-auto">
          <p className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            {t('common.dragToReorder')}
          </p>

          <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="space-y-4">
              {(['scheduling', 'organization', 'media'] as const).map((group) => {
                const groupData = getGroupInfo(group);
                return (
                <Collapsible
                  key={group}
                  open={openGroups[group]}
                  onOpenChange={() => toggleGroup(group)}
                >
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex flex-col items-start">
                      <span className="font-medium text-sm">{groupData.name}</span>
                      <span className="text-xs text-muted-foreground">{groupData.description}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full">
                        {getGroupActions(group).filter(a => a.enabled).length}/{getGroupActions(group).length}
                      </span>
                      <ChevronDown className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        openGroups[group] && "rotate-180"
                      )} />
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <Droppable droppableId={group}>
                      {(provided) => (
                        <div
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className="space-y-2 pt-2"
                        >
                          {getGroupActions(group).map((action, index) => {
                            const Icon = action.icon;
                            return (
                              <Draggable key={action.id} draggableId={action.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={cn(
                                      "flex items-center gap-3 p-4 rounded-xl border transition-all",
                                      action.enabled 
                                        ? "bg-card border-border" 
                                        : "bg-muted/30 border-border/50 opacity-60",
                                      snapshot.isDragging && "shadow-lg ring-2 ring-primary/20"
                                    )}
                                  >
                                    <div
                                      {...provided.dragHandleProps}
                                      className="touch-none"
                                    >
                                      <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0 cursor-grab active:cursor-grabbing" />
                                    </div>
                                    
                                    <div className={cn("p-2 rounded-lg", action.enabled ? "bg-muted" : "bg-muted/50")}>
                                      <Icon className={cn("h-5 w-5", action.enabled ? action.color : "text-muted-foreground")} />
                                    </div>

                                    <span className={cn(
                                      "flex-1 font-medium",
                                      !action.enabled && "text-muted-foreground"
                                    )}>
                                      {getActionName(action)}
                                    </span>

                                    <Switch 
                                      checked={action.enabled} 
                                      onCheckedChange={() => handleToggle(action.id)}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </CollapsibleContent>
                </Collapsible>
              );
              })}
            </div>
          </DragDropContext>
        </div>
      </div>

      {/* Preview */}
      <div className="p-4 border-t border-border bg-muted/30">
        <p className="text-xs text-muted-foreground mb-3 text-center">{t('common.preview')}</p>
        <div className="flex items-center gap-2 flex-wrap justify-center max-w-lg mx-auto">
          {localActions.filter(a => a.enabled).map((action) => {
            const Icon = action.icon;
            return (
              <div 
                key={action.id}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border bg-card"
              >
                <Icon className={cn("h-4 w-4", action.color)} />
                <span className="text-sm text-muted-foreground">{getActionName(action)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
