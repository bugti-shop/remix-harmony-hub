import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search, Plus, FolderPlus, Grid3X3, List, MoreVertical,
  ChevronRight, ChevronLeft, BookOpen, Pencil, Trash2,
  FolderOpen, ArrowUpDown, X, Check, MoveRight,
} from 'lucide-react';
import {
  SketchNotebook, SketchFolder, SketchPage,
  loadNotebooks, saveNotebooks, createNotebook, addPageToNotebook,
  loadSketchFolders, saveSketchFolders, createSketchFolder,
  getNotebooksInFolder, getSubFolders, getFolderPath,
} from '@/utils/sketchNotebookStorage';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface SketchNotebookLibraryProps {
  onOpenPage: (noteId: string) => void;
  onCreateNewSketch: (notebookId: string) => void;
  currentNoteId?: string;
  className?: string;
}

export function SketchNotebookLibrary({
  onOpenPage, onCreateNewSketch, currentNoteId, className,
}: SketchNotebookLibraryProps) {
  const { t } = useTranslation();
  const [notebooks, setNotebooks] = useState<SketchNotebook[]>([]);
  const [folders, setFolders] = useState<SketchFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGridView, setIsGridView] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  // Editing states
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showNewNotebook, setShowNewNotebook] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [movingNotebookId, setMovingNotebookId] = useState<string | null>(null);

  const renameInputRef = useRef<HTMLInputElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  // Load data
  useEffect(() => {
    Promise.all([loadNotebooks(), loadSketchFolders()]).then(([nbs, fds]) => {
      setNotebooks(nbs);
      setFolders(fds);
      setIsLoaded(true);
    });
  }, []);

  // Persist
  const persistNotebooks = useCallback((nbs: SketchNotebook[]) => {
    setNotebooks(nbs);
    saveNotebooks(nbs);
  }, []);

  const persistFolders = useCallback((fds: SketchFolder[]) => {
    setFolders(fds);
    saveSketchFolders(fds);
  }, []);

  // Breadcrumb
  const breadcrumb = useMemo(() => {
    if (!currentFolderId) return [];
    return getFolderPath(folders, currentFolderId);
  }, [folders, currentFolderId]);

  // Visible items
  const visibleFolders = useMemo(() => {
    let fds = getSubFolders(folders, currentFolderId);
    if (searchQuery) {
      fds = folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return fds.sort((a, b) => a.order - b.order);
  }, [folders, currentFolderId, searchQuery]);

  const visibleNotebooks = useMemo(() => {
    let nbs = searchQuery
      ? notebooks.filter(nb =>
          nb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          nb.pages.some(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : getNotebooksInFolder(notebooks, currentFolderId);
    return nbs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }, [notebooks, currentFolderId, searchQuery]);

  // Actions
  const handleCreateNotebook = useCallback(() => {
    if (!newNotebookName.trim()) return;
    const nb = createNotebook(newNotebookName.trim(), currentFolderId || undefined);
    persistNotebooks([...notebooks, nb]);
    setNewNotebookName('');
    setShowNewNotebook(false);
    toast.success(t('sketchLibrary.notebookCreated'));
  }, [newNotebookName, currentFolderId, notebooks, persistNotebooks]);

  const handleCreateFolder = useCallback(() => {
    if (!newFolderName.trim()) return;
    const f = createSketchFolder(newFolderName.trim(), currentFolderId || undefined);
    persistFolders([...folders, f]);
    setNewFolderName('');
    setShowNewFolder(false);
    toast.success(t('sketchLibrary.folderCreated'));
  }, [newFolderName, currentFolderId, folders, persistFolders]);

  const handleRename = useCallback((id: string, type: 'notebook' | 'folder') => {
    if (!renameValue.trim()) return;
    if (type === 'notebook') {
      persistNotebooks(notebooks.map(nb =>
        nb.id === id ? { ...nb, name: renameValue.trim(), updatedAt: new Date() } : nb
      ));
    } else {
      persistFolders(folders.map(f =>
        f.id === id ? { ...f, name: renameValue.trim() } : f
      ));
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renameValue, notebooks, folders, persistNotebooks, persistFolders]);

  const handleDeleteNotebook = useCallback((id: string) => {
    persistNotebooks(notebooks.filter(nb => nb.id !== id));
    toast(t('sketchLibrary.notebookDeleted'));
  }, [notebooks, persistNotebooks]);

  const handleDeleteFolder = useCallback((id: string) => {
    // Move children to parent
    const folder = folders.find(f => f.id === id);
    const parentId = folder?.parentId || undefined;
    persistFolders(folders.filter(f => f.id !== id).map(f =>
      f.parentId === id ? { ...f, parentId } : f
    ));
    persistNotebooks(notebooks.map(nb =>
      nb.folderId === id ? { ...nb, folderId: parentId } : nb
    ));
    toast(t('sketchLibrary.folderDeleted'));
  }, [folders, notebooks, persistFolders, persistNotebooks]);

  const handleMoveNotebook = useCallback((notebookId: string, targetFolderId: string | null) => {
    persistNotebooks(notebooks.map(nb =>
      nb.id === notebookId ? { ...nb, folderId: targetFolderId || undefined, updatedAt: new Date() } : nb
    ));
    setMovingNotebookId(null);
    toast.success(t('sketchLibrary.notebookMoved'));
  }, [notebooks, persistNotebooks]);

  // Focus on rename/new inputs
  useEffect(() => {
    if (renamingId) setTimeout(() => renameInputRef.current?.focus(), 50);
  }, [renamingId]);
  useEffect(() => {
    if (showNewNotebook || showNewFolder) setTimeout(() => newInputRef.current?.focus(), 50);
  }, [showNewNotebook, showNewFolder]);

  const NOTEBOOK_COLORS = ['#3C78F0', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (!isLoaded) return null;

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{t('sketchLibrary.title')}</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setIsGridView(!isGridView)}
            >
              {isGridView ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t('sketchLibrary.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm bg-muted/50 border-border/50"
          />
          {searchQuery && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearchQuery('')}>
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto">
          <button
            className={cn('hover:text-foreground transition-colors whitespace-nowrap', !currentFolderId && 'text-foreground font-medium')}
            onClick={() => setCurrentFolderId(null)}
          >
            {t('sketchLibrary.library')}
          </button>
          {breadcrumb.map((f) => (
            <div key={f.id} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 flex-shrink-0" />
              <button
                className="hover:text-foreground transition-colors whitespace-nowrap"
                onClick={() => setCurrentFolderId(f.id)}
              >
                {f.name}
              </button>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm" className="h-8 text-xs gap-1.5"
            onClick={() => { setShowNewNotebook(true); setShowNewFolder(false); }}
          >
            <Plus className="h-3.5 w-3.5" /> {t('sketchLibrary.notebook')}
          </Button>
          <Button
            variant="outline" size="sm" className="h-8 text-xs gap-1.5"
            onClick={() => { setShowNewFolder(true); setShowNewNotebook(false); }}
          >
            <FolderPlus className="h-3.5 w-3.5" /> {t('sketchLibrary.folder')}
          </Button>
        </div>

        {/* New notebook input */}
        {showNewNotebook && (
          <div className="flex items-center gap-2 animate-fade-in">
            <Input
              ref={newInputRef}
              placeholder={t('sketchLibrary.notebookNamePlaceholder')}
              value={newNotebookName}
              onChange={(e) => setNewNotebookName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateNotebook(); if (e.key === 'Escape') setShowNewNotebook(false); }}
              className="h-8 text-sm flex-1"
            />
            <Button size="icon" className="h-8 w-8" onClick={handleCreateNotebook}><Check className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowNewNotebook(false)}><X className="h-3.5 w-3.5" /></Button>
          </div>
        )}

        {/* New folder input */}
        {showNewFolder && (
          <div className="flex items-center gap-2 animate-fade-in">
            <Input
              ref={newInputRef}
              placeholder={t('sketchLibrary.folderNamePlaceholder')}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
              className="h-8 text-sm flex-1"
            />
            <Button size="icon" className="h-8 w-8" onClick={handleCreateFolder}><Check className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowNewFolder(false)}><X className="h-3.5 w-3.5" /></Button>
          </div>
        )}
      </div>

      {/* Move notebook picker */}
      {movingNotebookId && (
        <div className="mx-4 mb-2 p-3 bg-primary/5 border border-primary/20 rounded-xl animate-fade-in">
          <p className="text-xs font-medium text-foreground mb-2">{t('sketchLibrary.moveToFolder')}</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            <button
              className="w-full text-left px-2 py-1.5 text-xs rounded-lg hover:bg-muted transition-colors"
              onClick={() => handleMoveNotebook(movingNotebookId, null)}
            >
              📁 {t('sketchLibrary.rootFolder')}
            </button>
            {folders.map(f => (
              <button
                key={f.id}
                className="w-full text-left px-2 py-1.5 text-xs rounded-lg hover:bg-muted transition-colors"
                onClick={() => handleMoveNotebook(movingNotebookId, f.id)}
              >
                📁 {f.name}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs w-full" onClick={() => setMovingNotebookId(null)}>{t('sketchLibrary.cancel')}</Button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {visibleFolders.length === 0 && visibleNotebooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <BookOpen className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">
              {searchQuery ? t('sketchLibrary.noResults') : t('sketchLibrary.noNotebooks')}
            </p>
            <p className="text-xs mt-1">
              {searchQuery ? t('sketchLibrary.tryDifferentSearch') : t('sketchLibrary.createNotebookHint')}
            </p>
          </div>
        ) : (
          <div className={cn(
            isGridView
              ? 'grid grid-cols-2 gap-3'
              : 'space-y-2'
          )}>
            {/* Folders */}
            {visibleFolders.map(folder => (
              <FolderCard
                key={folder.id}
                folder={folder}
                isGrid={isGridView}
                notebooks={notebooks}
                isRenaming={renamingId === folder.id}
                renameValue={renameValue}
                renameInputRef={renameInputRef}
                onOpen={() => setCurrentFolderId(folder.id)}
                onStartRename={() => { setRenamingId(folder.id); setRenameValue(folder.name); }}
                onRename={() => handleRename(folder.id, 'folder')}
                onRenameChange={setRenameValue}
                onCancelRename={() => { setRenamingId(null); setRenameValue(''); }}
                onDelete={() => handleDeleteFolder(folder.id)}
              />
            ))}

            {/* Notebooks */}
            {visibleNotebooks.map(notebook => (
              <NotebookCard
                key={notebook.id}
                notebook={notebook}
                isGrid={isGridView}
                isRenaming={renamingId === notebook.id}
                renameValue={renameValue}
                renameInputRef={renameInputRef}
                currentNoteId={currentNoteId}
                onOpenPage={onOpenPage}
                onCreatePage={() => onCreateNewSketch(notebook.id)}
                onStartRename={() => { setRenamingId(notebook.id); setRenameValue(notebook.name); }}
                onRename={() => handleRename(notebook.id, 'notebook')}
                onRenameChange={setRenameValue}
                onCancelRename={() => { setRenamingId(null); setRenameValue(''); }}
                onDelete={() => handleDeleteNotebook(notebook.id)}
                onMove={() => setMovingNotebookId(notebook.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Sub-components ---

function FolderCard({
  folder, isGrid, notebooks, isRenaming, renameValue, renameInputRef,
  onOpen, onStartRename, onRename, onRenameChange, onCancelRename, onDelete,
}: {
  folder: SketchFolder;
  isGrid: boolean;
  notebooks: SketchNotebook[];
  isRenaming: boolean;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement>;
  onOpen: () => void;
  onStartRename: () => void;
  onRename: () => void;
  onRenameChange: (v: string) => void;
  onCancelRename: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const count = notebooks.filter(nb => nb.folderId === folder.id).length;

  return (
    <div
      className={cn(
        'group border border-border/50 rounded-xl transition-all hover:border-border hover:shadow-sm cursor-pointer',
        isGrid ? 'p-3' : 'p-3 flex items-center gap-3'
      )}
      onClick={onOpen}
    >
      <div
        className={cn('flex items-center justify-center rounded-lg', isGrid ? 'h-20 mb-2' : 'h-10 w-10 flex-shrink-0')}
        style={{ backgroundColor: `${folder.color || '#10b981'}15` }}
      >
        <FolderOpen className={cn(isGrid ? 'h-8 w-8' : 'h-5 w-5')} style={{ color: folder.color || '#10b981' }} />
      </div>
      <div className="flex-1 min-w-0">
        {isRenaming ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => onRenameChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onRename(); if (e.key === 'Escape') onCancelRename(); }}
              className="h-6 text-xs"
            />
          </div>
        ) : (
          <p className="text-sm font-medium text-foreground truncate">{folder.name}</p>
        )}
        <p className="text-[10px] text-muted-foreground">{count === 1 ? t('sketchLibrary.notebooks', { count }) : t('sketchLibrary.notebooks_plural', { count })}</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button className="h-7 w-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted transition-all">
            <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStartRename(); }}>
            <Pencil className="h-3.5 w-3.5 mr-2" /> {t('sketchLibrary.rename')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-destructive">
            <Trash2 className="h-3.5 w-3.5 mr-2" /> {t('sketchLibrary.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function NotebookCard({
  notebook, isGrid, isRenaming, renameValue, renameInputRef, currentNoteId,
  onOpenPage, onCreatePage, onStartRename, onRename, onRenameChange, onCancelRename, onDelete, onMove,
}: {
  notebook: SketchNotebook;
  isGrid: boolean;
  isRenaming: boolean;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement>;
  currentNoteId?: string;
  onOpenPage: (noteId: string) => void;
  onCreatePage: () => void;
  onStartRename: () => void;
  onRename: () => void;
  onRenameChange: (v: string) => void;
  onCancelRename: () => void;
  onDelete: () => void;
  onMove: () => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const pageCount = notebook.pages.length;
  const hasCurrentPage = notebook.pages.some(p => p.noteId === currentNoteId);

  return (
    <div
      className={cn(
        'group border rounded-xl transition-all hover:shadow-sm overflow-hidden',
        hasCurrentPage ? 'border-primary/40 bg-primary/5' : 'border-border/50 hover:border-border',
        !isGrid && 'flex flex-col'
      )}
    >
      {/* Cover / Header */}
      <div
        className={cn('cursor-pointer', isGrid ? 'p-3' : 'p-3 flex items-center gap-3')}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Thumbnail */}
        <div
          className={cn(
            'rounded-lg overflow-hidden flex items-center justify-center',
            isGrid ? 'h-24 mb-2' : 'h-12 w-12 flex-shrink-0'
          )}
          style={{ backgroundColor: `${notebook.color || '#3C78F0'}10` }}
        >
          {notebook.coverThumbnail ? (
            <img src={notebook.coverThumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <BookOpen className={cn(isGrid ? 'h-8 w-8' : 'h-5 w-5')} style={{ color: notebook.color || '#3C78F0' }} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => onRenameChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onRename(); if (e.key === 'Escape') onCancelRename(); }}
                className="h-6 text-xs"
              />
            </div>
          ) : (
            <p className="text-sm font-medium text-foreground truncate">{notebook.name}</p>
          )}
          <p className="text-[10px] text-muted-foreground">
            {pageCount === 1 ? t('sketchLibrary.pages', { count: pageCount }) : t('sketchLibrary.pages_plural', { count: pageCount })} · {new Date(notebook.updatedAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-0.5">
          <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="h-7 w-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted transition-all">
                <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCreatePage(); }}>
                <Plus className="h-3.5 w-3.5 mr-2" /> {t('sketchLibrary.addPage')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStartRename(); }}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> {t('sketchLibrary.rename')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMove(); }}>
                <MoveRight className="h-3.5 w-3.5 mr-2" /> {t('sketchLibrary.move')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> {t('sketchLibrary.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Expanded pages list */}
      {expanded && (
        <div className="border-t border-border/30 bg-muted/20 animate-fade-in">
          {notebook.pages.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-muted-foreground mb-2">{t('sketchLibrary.noPagesYet')}</p>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onCreatePage}>
                <Plus className="h-3 w-3 mr-1" /> {t('sketchLibrary.addFirstPage')}
              </Button>
            </div>
          ) : (
            <div className="py-1">
              {notebook.pages.sort((a, b) => a.order - b.order).map((page) => (
                <button
                  key={page.id}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2 hover:bg-muted/60 transition-colors text-left',
                    page.noteId === currentNoteId && 'bg-primary/10 text-primary'
                  )}
                  onClick={() => onOpenPage(page.noteId)}
                >
                  {page.thumbnail ? (
                    <div className="h-8 w-10 rounded border border-border/30 overflow-hidden flex-shrink-0">
                      <img src={page.thumbnail} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-8 w-10 rounded border border-border/30 bg-muted/50 flex items-center justify-center flex-shrink-0">
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{page.title || t('sketchLibrary.untitled')}</p>
                    <p className="text-[9px] text-muted-foreground">{new Date(page.updatedAt).toLocaleDateString()}</p>
                  </div>
                </button>
              ))}
              <button
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted/60 transition-colors text-xs text-muted-foreground"
                onClick={onCreatePage}
              >
                <Plus className="h-3 w-3" /> {t('sketchLibrary.addPage')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
