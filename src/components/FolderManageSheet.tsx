import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Folder as FolderType } from '@/types/note';
import { Trash2, Edit2, Check, X, FolderPlus, GripVertical, Star } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const FOLDER_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

interface FolderManageSheetProps {
  isOpen: boolean;
  onClose: () => void;
  folders: FolderType[];
  onCreateFolder: (name: string, color: string) => void;
  onEditFolder: (folderId: string, name: string, color: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onReorderFolders?: (folders: FolderType[]) => void;
  onToggleFavorite?: (folderId: string) => void;
}

export const FolderManageSheet = ({
  isOpen,
  onClose,
  folders,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  onReorderFolders,
  onToggleFavorite,
}: FolderManageSheetProps) => {
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<FolderType | null>(null);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !onReorderFolders) return;
    
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    
    if (sourceIndex === destIndex) return;
    
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    
    const reordered = Array.from(folders);
    const [removed] = reordered.splice(sourceIndex, 1);
    reordered.splice(destIndex, 0, removed);
    
    onReorderFolders(reordered);
  };

  // Hardware back button support - use 'sheet' priority to close sheet before navigation
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const handleCreate = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), newFolderColor);
      setNewFolderName('');
      setNewFolderColor(FOLDER_COLORS[0]);
      setIsCreating(false);
    }
  };

  const startEdit = (folder: FolderType) => {
    setEditingFolderId(folder.id);
    setEditName(folder.name);
    setEditColor(folder.color || FOLDER_COLORS[0]);
  };

  const handleEdit = () => {
    if (editingFolderId && editName.trim()) {
      onEditFolder(editingFolderId, editName.trim(), editColor);
      setEditingFolderId(null);
    }
  };

  const confirmDelete = () => {
    if (folderToDelete) {
      onDeleteFolder(folderToDelete.id);
      setFolderToDelete(null);
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh]">
          <SheetHeader className="mb-4">
            <SheetTitle>{t('folders.manageFolders')}</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 overflow-y-auto max-h-[60vh]">
            {/* Create new folder */}
            {isCreating ? (
              <div className="p-3 border rounded-lg space-y-3">
              <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder={t('folders.folderName')}
                  autoFocus
                />
                <div className="flex gap-2">
                  {FOLDER_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewFolderColor(color)}
                      className="w-8 h-8 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: color,
                        borderColor: newFolderColor === color ? 'white' : 'transparent',
                        boxShadow: newFolderColor === color ? `0 0 0 2px ${color}` : 'none'
                      }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreate} disabled={!newFolderName.trim()}>
                    <Check className="h-4 w-4 mr-1" /> {t('common.create')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>
                    <X className="h-4 w-4 mr-1" /> {t('common.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => setIsCreating(true)}>
                <FolderPlus className="h-4 w-4 mr-2" /> {t('folders.createNewFolder')}
              </Button>
            )}

            {/* Existing folders with drag-and-drop */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="folders-list">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2"
                  >
                    {folders.map((folder, index) => (
                      <Draggable key={folder.id} draggableId={folder.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={cn(
                              "p-3 border rounded-lg bg-card",
                              snapshot.isDragging && "shadow-lg ring-2 ring-primary/20"
                            )}
                          >
                            {editingFolderId === folder.id ? (
                              <div className="space-y-3">
                                <Input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  {FOLDER_COLORS.map((color) => (
                                    <button
                                      key={color}
                                      onClick={() => setEditColor(color)}
                                      className="w-8 h-8 rounded-full border-2 transition-all"
                                      style={{
                                        backgroundColor: color,
                                        borderColor: editColor === color ? 'white' : 'transparent',
                                        boxShadow: editColor === color ? `0 0 0 2px ${color}` : 'none'
                                      }}
                                    />
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={handleEdit}>
                                    <Check className="h-4 w-4 mr-1" /> {t('common.save')}
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingFolderId(null)}>
                                    <X className="h-4 w-4 mr-1" /> {t('common.cancel')}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div
                                    {...provided.dragHandleProps}
                                    className="cursor-grab active:cursor-grabbing touch-none"
                                  >
                                    <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                                  </div>
                                  <div
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: folder.color || FOLDER_COLORS[0] }}
                                  />
                                  <span className="font-medium">{folder.name}</span>
                                </div>
                                <div className="flex gap-1">
                                  {onToggleFavorite && (
                                    <Button size="icon" variant="ghost" onClick={() => onToggleFavorite(folder.id)}>
                                      <Star className={cn("h-4 w-4", folder.isFavorite ? "fill-warning text-warning" : "text-muted-foreground")} />
                                    </Button>
                                  )}
                                  <Button size="icon" variant="ghost" onClick={() => startEdit(folder)}>
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => setFolderToDelete(folder)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            {folders.length === 0 && !isCreating && (
              <p className="text-center text-muted-foreground py-8">{t('common.noFoldersYet')}</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!folderToDelete} onOpenChange={(open) => !open && setFolderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('folders.deleteFolder')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('folders.deleteFolderDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
