import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder as FolderIcon, Plus, Edit2, Trash2, FolderOpen, FolderPlus, FolderMinus, MoreVertical, Star, ArrowUpDown, Clock, FileText, StickyNote, CheckSquare, Filter, Code, Palette, Receipt, Archive, LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Folder, Note, NoteType } from '@/types/note';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface FolderManagerProps {
  folders: Folder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string, color: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onEditFolder: (folderId: string, name: string) => void;
  onDropOnFolder?: (e: React.DragEvent, folderId: string | null) => void;
  notes?: Note[];
  onAddNotesToFolder?: (noteIds: string[], folderId: string) => void;
  onRemoveNoteFromFolder?: (noteId: string) => void;
  // New props for options menu
  showFavoritesOnly?: boolean;
  onToggleFavoritesOnly?: () => void;
  sortBy?: 'date' | 'title' | 'type';
  onSortByChange?: (sortBy: 'date' | 'title' | 'type') => void;
  // Note type filter
  filterByType?: NoteType | null;
  onFilterByTypeChange?: (type: NoteType | null) => void;
  // Bulk selection mode
  onEnterSelectionMode?: () => void;
  // View mode (notes, trash, archive)
  viewMode?: 'notes' | 'trash' | 'archive';
  onViewModeChange?: (mode: 'notes' | 'trash' | 'archive') => void;
  trashedNotesCount?: number;
  archivedNotesCount?: number;
  // Grid view toggle
  isGridView?: boolean;
  onToggleGridView?: () => void;
}

const folderColors = [
  '#3c78f0', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'
];

const CLICKS_TO_SHOW_ACTIONS = 3;

export const FolderManager = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onEditFolder,
  onDropOnFolder,
  notes = [],
  onAddNotesToFolder,
  onRemoveNoteFromFolder,
  showFavoritesOnly = false,
  onToggleFavoritesOnly,
  sortBy = 'date',
  onSortByChange,
  filterByType = null,
  onFilterByTypeChange,
  onEnterSelectionMode,
  viewMode = 'notes',
  onViewModeChange,
  trashedNotesCount = 0,
  archivedNotesCount = 0,
  isGridView = false,
  onToggleGridView,
}: FolderManagerProps) => {
  const { t } = useTranslation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAddNotesOpen, setIsAddNotesOpen] = useState(false);
  const [isRemoveNotesOpen, setIsRemoveNotesOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedColor, setSelectedColor] = useState(folderColors[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [folderClickCounts, setFolderClickCounts] = useState<Record<string, number>>({});
  const [showActionsForFolder, setShowActionsForFolder] = useState<string | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [selectedRemoveNoteIds, setSelectedRemoveNoteIds] = useState<string[]>([]);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const availableNotes = notes.filter(note => note.folderId !== selectedFolderId);
  const folderNotes = notes.filter(note => note.folderId === selectedFolderId);

  const handleCreate = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), selectedColor);
      setNewFolderName('');
      setSelectedColor(folderColors[0]);
      setIsCreateOpen(false);
    }
  };

  const handleEdit = (folderId: string) => {
    if (editName.trim()) {
      onEditFolder(folderId, editName.trim());
      setEditingId(null);
      setEditName('');
      setShowActionsForFolder(null);
      setFolderClickCounts(prev => ({ ...prev, [folderId]: 0 }));
    }
  };

  const handleDelete = (folderId: string) => {
    onDeleteFolder(folderId);
    setShowActionsForFolder(null);
    setFolderClickCounts(prev => ({ ...prev, [folderId]: 0 }));
  };

  const handleFolderClick = (folderId: string) => {
    // Immediate folder selection - no delay for instant response
    onSelectFolder(folderId);
  };

  // Long press to show actions (separate from click)
  const handleFolderLongPress = (folderId: string) => {
    setShowActionsForFolder(folderId);
    // Auto-hide after 3 seconds
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = setTimeout(() => {
      setShowActionsForFolder(null);
    }, 3000);
  };

  const handleSelectAllNotes = () => {
    onSelectFolder(null);
    setShowActionsForFolder(null);
    setFolderClickCounts({});
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDropOnFolder) {
      onDropOnFolder(e, folderId);
    }
  };

  const handleToggleNoteSelection = (noteId: string) => {
    setSelectedNoteIds(prev =>
      prev.includes(noteId)
        ? prev.filter(id => id !== noteId)
        : [...prev, noteId]
    );
  };

  const handleAddSelectedNotes = () => {
    if (selectedFolderId && onAddNotesToFolder && selectedNoteIds.length > 0) {
      onAddNotesToFolder(selectedNoteIds, selectedFolderId);
      setSelectedNoteIds([]);
      setIsAddNotesOpen(false);
    }
  };

  const handleToggleRemoveNoteSelection = (noteId: string) => {
    setSelectedRemoveNoteIds(prev =>
      prev.includes(noteId)
        ? prev.filter(id => id !== noteId)
        : [...prev, noteId]
    );
  };

  const handleRemoveSelectedNotes = () => {
    if (onRemoveNoteFromFolder && selectedRemoveNoteIds.length > 0) {
      selectedRemoveNoteIds.forEach(noteId => {
        onRemoveNoteFromFolder(noteId);
      });
      setSelectedRemoveNoteIds([]);
      setIsRemoveNotesOpen(false);
    }
  };

  const selectedFolder = folders.find(f => f.id === selectedFolderId);
  const isCustomFolder = selectedFolder && !selectedFolder.isDefault;

  return (
    <div className="mb-2 xs:mb-3" data-tour="folders-section">
      <div className="flex items-center justify-between mb-1.5 xs:mb-2">
        <h2 className="text-base xs:text-lg font-semibold flex items-center gap-1.5 xs:gap-2">
          <FolderIcon className="w-4 h-4 xs:w-5 xs:h-5" />
          {t('notesMenu.folders')}
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-52 bg-card z-50 max-h-[70vh] overflow-y-auto overscroll-contain"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {/* Grid View Toggle - REMOVED per user request */}
            
            {/* Bulk Selection Mode */}
            {onEnterSelectionMode && (
              <DropdownMenuItem onClick={onEnterSelectionMode}>
                <CheckSquare className="h-4 w-4 mr-2" />
                {t('notesMenu.selectNotes')}
              </DropdownMenuItem>
            )}
            
            {/* Favorites Toggle */}
            {onToggleFavoritesOnly && (
              <DropdownMenuItem onClick={onToggleFavoritesOnly}>
                <Star className={cn("h-4 w-4 mr-2", showFavoritesOnly && "fill-current text-yellow-500")} />
                {showFavoritesOnly ? t('notesMenu.allNotes') : t('notesMenu.showFavoritesOnly')}
              </DropdownMenuItem>
            )}
            
            {/* Note Type Filter */}
            {onFilterByTypeChange && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  <Filter className="h-3 w-3 inline mr-1" />
                  {t('notesMenu.filterByType')}
                </div>
                <DropdownMenuItem 
                  onClick={() => onFilterByTypeChange(null)}
                  className={cn(filterByType === null && "bg-accent")}
                >
                  {t('notesMenu.allTypes')}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onFilterByTypeChange('sticky')}
                  className={cn(filterByType === 'sticky' && "bg-accent")}
                >
                  <StickyNote className="h-4 w-4 mr-2" />
                  {t('notesMenu.stickyNotes')}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onFilterByTypeChange('lined')}
                  className={cn(filterByType === 'lined' && "bg-accent")}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {t('notesMenu.linedNotes')}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onFilterByTypeChange('regular')}
                  className={cn(filterByType === 'regular' && "bg-accent")}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {t('notesMenu.regularNotes')}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onFilterByTypeChange('code')}
                  className={cn(filterByType === 'code' && "bg-accent")}
                >
                  <Code className="h-4 w-4 mr-2" />
                  {t('notesMenu.codeNotes')}
                </DropdownMenuItem>
              </>
            )}
            
            {/* Sorting Options */}
            {onSortByChange && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  <ArrowUpDown className="h-3 w-3 inline mr-1" />
                  {t('notesMenu.sortBy')}
                </div>
                <DropdownMenuItem 
                  onClick={() => onSortByChange('date')}
                  className={cn(sortBy === 'date' && "bg-accent")}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {t('notesMenu.byDate')}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onSortByChange('title')}
                  className={cn(sortBy === 'title' && "bg-accent")}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {t('notesMenu.byTitle')}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onSortByChange('type')}
                  className={cn(sortBy === 'type' && "bg-accent")}
                >
                  <StickyNote className="h-4 w-4 mr-2" />
                  {t('notesMenu.byType')}
                </DropdownMenuItem>
              </>
            )}
            
            <DropdownMenuSeparator />
            
            {/* Create Folder */}
            <DropdownMenuItem onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('notesMenu.createFolder')}
            </DropdownMenuItem>
            
            {/* Add Notes to Folder */}
            {isCustomFolder && onAddNotesToFolder && availableNotes.length > 0 && (
              <DropdownMenuItem onClick={() => setIsAddNotesOpen(true)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                {t('notesMenu.addNotesToFolder')}
              </DropdownMenuItem>
            )}
            
            {/* Remove Notes from Folder */}
            {isCustomFolder && onRemoveNoteFromFolder && folderNotes.length > 0 && (
              <DropdownMenuItem onClick={() => setIsRemoveNotesOpen(true)}>
                <FolderMinus className="h-4 w-4 mr-2" />
                {t('notesMenu.removeNotesFromFolder')}
              </DropdownMenuItem>
            )}
            
            {/* Trash and Archive Views */}
            {onViewModeChange && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onViewModeChange(viewMode === 'trash' ? 'notes' : 'trash')}
                  className={cn(viewMode === 'trash' && "bg-accent")}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {viewMode === 'trash' ? t('notesMenu.backToNotes') : `${t('notes.trash')}${trashedNotesCount > 0 ? ` (${trashedNotesCount})` : ''}`}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onViewModeChange(viewMode === 'archive' ? 'notes' : 'archive')}
                  className={cn(viewMode === 'archive' && "bg-accent")}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  {viewMode === 'archive' ? t('notesMenu.backToNotes') : `${t('notes.archived')}${archivedNotesCount > 0 ? ` (${archivedNotesCount})` : ''}`}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Add Notes Dialog */}
      <Dialog open={isAddNotesOpen} onOpenChange={setIsAddNotesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Notes to "{selectedFolder?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Select notes to add to this folder:
            </p>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {availableNotes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleToggleNoteSelection(note.id)}
                  >
                    <Checkbox
                      checked={selectedNoteIds.includes(note.id)}
                      onCheckedChange={() => handleToggleNoteSelection(note.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{note.title || 'Untitled'}</p>
                      <p className="text-xs text-muted-foreground capitalize">{note.type} note</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Button
              onClick={handleAddSelectedNotes}
              className="w-full"
              disabled={selectedNoteIds.length === 0}
            >
              Add {selectedNoteIds.length} Note{selectedNoteIds.length !== 1 ? 's' : ''} to Folder
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Notes Dialog */}
      <Dialog open={isRemoveNotesOpen} onOpenChange={setIsRemoveNotesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Notes from "{selectedFolder?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Select notes to move back to All Notes:
            </p>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {folderNotes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleToggleRemoveNoteSelection(note.id)}
                  >
                    <Checkbox
                      checked={selectedRemoveNoteIds.includes(note.id)}
                      onCheckedChange={() => handleToggleRemoveNoteSelection(note.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{note.title || 'Untitled'}</p>
                      <p className="text-xs text-muted-foreground capitalize">{note.type} note</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Button
              onClick={handleRemoveSelectedNotes}
              className="w-full"
              disabled={selectedRemoveNoteIds.length === 0}
              variant="destructive"
            >
              {t('folderManager.removeNotesFromFolder', { count: selectedRemoveNoteIds.length })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('folderManager.createNewFolder')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder={t('folderManager.folderName')}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div>
              <label className="text-sm font-medium mb-2 block">{t('folderManager.color')}</label>
              <div className="flex gap-2">
                {folderColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className="w-10 h-10 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: color,
                      borderColor: selectedColor === color ? color : 'transparent',
                      transform: selectedColor === color ? 'scale(1.1)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>
            <Button onClick={handleCreate} className="w-full">
              {t('folderManager.createFolder')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex gap-1.5 xs:gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={handleSelectAllNotes}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, null)}
          className="flex items-center gap-1.5 xs:gap-2 px-3 xs:px-4 py-1.5 xs:py-2 rounded-full whitespace-nowrap transition-all text-xs xs:text-sm touch-target flex-shrink-0"
          style={{
            backgroundColor: selectedFolderId === null ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
            color: selectedFolderId === null ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
          }}
        >
          <FolderOpen className="w-3.5 h-3.5 xs:w-4 xs:h-4 flex-shrink-0" />
          <span className="flex-shrink-0">{t('folderManager.allNotes')}</span>
        </button>

        {folders.map((folder) => (
          <div key={folder.id} className="relative">
            {editingId === folder.id ? (
              <div className="flex items-center gap-1 px-2 py-2 rounded-full bg-muted">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEdit(folder.id);
                    if (e.key === 'Escape') {
                      setEditingId(null);
                      setShowActionsForFolder(null);
                      setFolderClickCounts(prev => ({ ...prev, [folder.id]: 0 }));
                    }
                  }}
                  className="h-6 text-sm w-24"
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => handleEdit(folder.id)}
                >
                  ✓
                </Button>
              </div>
            ) : (
              <button
                onClick={() => handleFolderClick(folder.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleFolderLongPress(folder.id);
                }}
                onTouchStart={(e) => {
                  const timer = setTimeout(() => handleFolderLongPress(folder.id), 500);
                  (e.currentTarget as any)._longPressTimer = timer;
                }}
                onTouchEnd={(e) => {
                  if ((e.currentTarget as any)._longPressTimer) {
                    clearTimeout((e.currentTarget as any)._longPressTimer);
                  }
                }}
                onTouchMove={(e) => {
                  if ((e.currentTarget as any)._longPressTimer) {
                    clearTimeout((e.currentTarget as any)._longPressTimer);
                  }
                }}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, folder.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all active:scale-95"
                style={{
                  backgroundColor: selectedFolderId === folder.id ? folder.color : 'hsl(var(--muted))',
                  color: selectedFolderId === folder.id ? '#ffffff' : 'hsl(var(--foreground))',
                }}
              >
                <FolderIcon className="w-4 h-4" />
                {folder.name}
              </button>
            )}

            {!folder.isDefault && editingId !== folder.id && showActionsForFolder === folder.id && (
              <div className="absolute -top-2 -right-2 flex gap-1 animate-fade-in">
                <button
                  onClick={() => {
                    setEditingId(folder.id);
                    setEditName(folder.name);
                  }}
                  className="w-6 h-6 rounded-full bg-background border shadow-sm flex items-center justify-center hover:bg-muted"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDelete(folder.id)}
                  className="w-6 h-6 rounded-full bg-background border shadow-sm flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
