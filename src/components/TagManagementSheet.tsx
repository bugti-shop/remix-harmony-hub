import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppTag, TAG_COLORS, getAllTags, createTag, saveTag, deleteTag } from '@/utils/tagStorage';
import { Plus, X, Tag, Pencil, Trash2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TagManagementSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Selection mode: pick tags
  selectionMode?: boolean;
  selectedTagIds?: string[];
  onSelectionChange?: (tagIds: string[]) => void;
}

export const TagManagementSheet = ({
  open,
  onOpenChange,
  selectionMode = false,
  selectedTagIds = [],
  onSelectionChange,
}: TagManagementSheetProps) => {
  const { t } = useTranslation();
  const [tags, setTags] = useState<AppTag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [newTagIcon, setNewTagIcon] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (open) {
      getAllTags().then(setTags);
    }
  }, [open]);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    // Check duplicate
    if (tags.some(t => t.name.toLowerCase() === newTagName.trim().toLowerCase())) {
      toast.error('Tag already exists!');
      return;
    }

    const tag = await createTag(newTagName, newTagColor, newTagIcon || undefined);
    setTags(prev => [tag, ...prev]);
    setNewTagName('');
    setNewTagIcon('');
    setNewTagColor(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]);
    setShowCreateForm(false);
    toast.success(`Tag "${tag.name}" created!`);
  };

  const handleDeleteTag = async (tagId: string) => {
    await deleteTag(tagId);
    setTags(prev => prev.filter(t => t.id !== tagId));
    toast.success('Tag deleted');
  };

  const handleUpdateTag = async (tagId: string) => {
    const tag = tags.find(t => t.id === tagId);
    if (!tag || !editName.trim()) return;
    
    const updated = { ...tag, name: editName.trim(), color: editColor };
    await saveTag(updated);
    setTags(prev => prev.map(t => t.id === tagId ? updated : t));
    setEditingTag(null);
    toast.success('Tag updated');
  };

  const toggleSelection = (tagId: string) => {
    if (!onSelectionChange) return;
    const isSelected = selectedTagIds.includes(tagId);
    if (isSelected) {
      onSelectionChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onSelectionChange([...selectedTagIds, tagId]);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl bg-background">
        <SheetHeader className="pb-3">
          <SheetTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            {selectionMode ? 'Assign Tags' : 'Manage Tags'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto max-h-[calc(85vh-100px)] pb-6">
          {/* Create new tag */}
          {!showCreateForm ? (
            <Button
              variant="outline"
              className="w-full border-dashed border-2 gap-2"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="h-4 w-4" />
              Create New Tag
            </Button>
          ) : (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Tag name..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="flex-1"
                  maxLength={24}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                />
                <Input
                  placeholder="🏷️"
                  value={newTagIcon}
                  onChange={(e) => setNewTagIcon(e.target.value)}
                  className="w-14 text-center text-lg"
                  maxLength={2}
                />
              </div>
              
              {/* Color picker */}
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewTagColor(color)}
                    className={cn(
                      'h-7 w-7 rounded-full transition-all',
                      newTagColor === color ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'hover:scale-105'
                    )}
                    style={{ backgroundColor: `hsl(${color})` }}
                  />
                ))}
              </div>

              {/* Preview + actions */}
              <div className="flex items-center justify-between">
                <span
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: `hsl(${newTagColor})` }}
                >
                  {newTagIcon && <span>{newTagIcon}</span>}
                  {newTagName || 'Preview'}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleCreateTag} disabled={!newTagName.trim()}>
                    <Check className="h-4 w-4 mr-1" /> Create
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Tags list */}
          {tags.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No tags yet</p>
              <p className="text-sm">Create your first tag to organize notes & tasks</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border transition-all',
                    selectionMode && 'cursor-pointer hover:bg-accent/50',
                    selectionMode && selectedTagIds.includes(tag.id) && 'bg-primary/10 border-primary'
                  )}
                  onClick={() => selectionMode && toggleSelection(tag.id)}
                >
                  {/* Tag color dot */}
                  <div
                    className="h-4 w-4 rounded-full shrink-0"
                    style={{ backgroundColor: `hsl(${tag.color})` }}
                  />

                  {editingTag === tag.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 text-sm flex-1"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateTag(tag.id)}
                      />
                      <div className="flex gap-1">
                        {TAG_COLORS.slice(0, 5).map((c) => (
                          <button
                            key={c}
                            onClick={(e) => { e.stopPropagation(); setEditColor(c); }}
                            className={cn('h-5 w-5 rounded-full', editColor === c && 'ring-2 ring-offset-1 ring-foreground')}
                            style={{ backgroundColor: `hsl(${c})` }}
                          />
                        ))}
                      </div>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditingTag(null); }}>
                        <X className="h-3 w-3" />
                      </Button>
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); handleUpdateTag(tag.id); }}>
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: `hsl(${tag.color})` }}
                          >
                            {tag.icon && <span>{tag.icon}</span>}
                            {tag.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {tag.usageCount} uses
                          </span>
                        </div>
                      </div>

                      {selectionMode ? (
                        <div className={cn(
                          'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0',
                          selectedTagIds.includes(tag.id)
                            ? 'bg-primary border-primary'
                            : 'border-muted-foreground/40'
                        )}>
                          {selectedTagIds.includes(tag.id) && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTag(tag.id);
                              setEditName(tag.name);
                              setEditColor(tag.color);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTag(tag.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Selection mode done button */}
          {selectionMode && (
            <Button className="w-full mt-2" onClick={() => onOpenChange(false)}>
              Done ({selectedTagIds.length} selected)
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
