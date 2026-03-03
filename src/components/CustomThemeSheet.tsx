import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Plus, Sparkles, Palette, Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CustomTheme,
  getCustomThemes,
  saveCustomTheme,
  deleteCustomTheme,
  applyCustomTheme,
  themePresets,
} from '@/utils/customThemeStorage';
import { useToast } from '@/hooks/use-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onThemeSelect: (theme: CustomTheme) => void;
  activeCustomThemeId: string | null;
}

const colorFields: { key: keyof CustomTheme['colors']; label: string; group: string }[] = [
  { key: 'background', label: 'Background', group: 'Base' },
  { key: 'foreground', label: 'Text', group: 'Base' },
  { key: 'card', label: 'Card', group: 'Base' },
  { key: 'cardForeground', label: 'Card Text', group: 'Base' },
  { key: 'primary', label: 'Primary', group: 'Brand' },
  { key: 'primaryForeground', label: 'Primary Text', group: 'Brand' },
  { key: 'secondary', label: 'Secondary', group: 'Brand' },
  { key: 'secondaryForeground', label: 'Secondary Text', group: 'Brand' },
  { key: 'muted', label: 'Muted', group: 'UI' },
  { key: 'mutedForeground', label: 'Muted Text', group: 'UI' },
  { key: 'accent', label: 'Accent', group: 'UI' },
  { key: 'accentForeground', label: 'Accent Text', group: 'UI' },
  { key: 'border', label: 'Border', group: 'UI' },
  { key: 'input', label: 'Input', group: 'UI' },
];

// Convert HSL string "H S% L%" to hex for color picker
const hslToHex = (hsl: string): string => {
  const parts = hsl.trim().split(/\s+/);
  const h = parseFloat(parts[0]) || 0;
  const s = (parseFloat(parts[1]) || 0) / 100;
  const l = (parseFloat(parts[2]) || 0) / 100;

  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

// Convert hex to HSL string
const hexToHsl = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }

  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

const defaultColors: CustomTheme['colors'] = {
  background: '220 15% 12%',
  foreground: '0 0% 95%',
  card: '220 15% 14%',
  cardForeground: '0 0% 95%',
  primary: '220 85% 59%',
  primaryForeground: '0 0% 100%',
  secondary: '220 12% 18%',
  secondaryForeground: '0 0% 95%',
  muted: '220 10% 18%',
  mutedForeground: '220 8% 65%',
  accent: '220 15% 20%',
  accentForeground: '0 0% 95%',
  border: '220 10% 22%',
  input: '220 10% 22%',
};

export const CustomThemeSheet = ({ isOpen, onClose, onThemeSelect, activeCustomThemeId }: Props) => {
  const { toast } = useToast();
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [editingTheme, setEditingTheme] = useState<CustomTheme | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const loadThemes = useCallback(async () => {
    const themes = await getCustomThemes();
    setCustomThemes(themes);
  }, []);

  useEffect(() => {
    if (isOpen) loadThemes();
  }, [isOpen, loadThemes]);

  const startNewTheme = (preset?: Omit<CustomTheme, 'id' | 'createdAt'>) => {
    setEditingTheme({
      id: crypto.randomUUID(),
      name: preset?.name || 'My Theme',
      colors: preset?.colors ? { ...preset.colors } : { ...defaultColors },
      createdAt: Date.now(),
    });
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!editingTheme) return;
    await saveCustomTheme(editingTheme);
    await loadThemes();
    setShowEditor(false);
    setEditingTheme(null);
    toast({ title: `"${editingTheme.name}" theme saved!` });
  };

  const handleDelete = async (id: string) => {
    await deleteCustomTheme(id);
    await loadThemes();
    toast({ title: 'Theme deleted' });
  };

  const handleColorChange = (key: keyof CustomTheme['colors'], hex: string) => {
    if (!editingTheme) return;
    setEditingTheme({
      ...editingTheme,
      colors: { ...editingTheme.colors, [key]: hexToHsl(hex) },
    });
  };

  const handleApplyTheme = (theme: CustomTheme) => {
    applyCustomTheme(theme);
    onThemeSelect(theme);
  };

  const handleDuplicate = (theme: CustomTheme) => {
    setEditingTheme({
      ...theme,
      id: crypto.randomUUID(),
      name: `${theme.name} Copy`,
      createdAt: Date.now(),
    });
    setShowEditor(true);
  };

  // Group color fields
  const groups = ['Base', 'Brand', 'UI'];

  if (showEditor && editingTheme) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => { if (!open) { setShowEditor(false); onClose(); } }}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl p-0">
          <SheetHeader className="p-4 pb-2 border-b border-border">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base">Edit Theme</SheetTitle>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowEditor(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSave}>Save</Button>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="h-[calc(90vh-80px)]">
            <div className="p-4 space-y-4">
              {/* Theme Name */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Theme Name</label>
                <Input
                  value={editingTheme.name}
                  onChange={(e) => setEditingTheme({ ...editingTheme, name: e.target.value })}
                  className="h-9"
                  placeholder="My Custom Theme"
                />
              </div>

              {/* Live Preview */}
              <div className="rounded-xl border border-border overflow-hidden">
                <div
                  className="p-4 space-y-3"
                  style={{
                    backgroundColor: `hsl(${editingTheme.colors.background})`,
                    color: `hsl(${editingTheme.colors.foreground})`,
                  }}
                >
                  <div className="text-sm font-semibold">Live Preview</div>
                  <div
                    className="rounded-lg p-3 space-y-2"
                    style={{
                      backgroundColor: `hsl(${editingTheme.colors.card})`,
                      color: `hsl(${editingTheme.colors.cardForeground})`,
                      border: `1px solid hsl(${editingTheme.colors.border})`,
                    }}
                  >
                    <div className="text-xs font-medium">Card Title</div>
                    <div className="text-xs" style={{ color: `hsl(${editingTheme.colors.mutedForeground})` }}>
                      This is muted text content
                    </div>
                    <div className="flex gap-2">
                      <div
                        className="px-3 py-1 rounded-md text-xs font-medium"
                        style={{
                          backgroundColor: `hsl(${editingTheme.colors.primary})`,
                          color: `hsl(${editingTheme.colors.primaryForeground})`,
                        }}
                      >
                        Primary
                      </div>
                      <div
                        className="px-3 py-1 rounded-md text-xs font-medium"
                        style={{
                          backgroundColor: `hsl(${editingTheme.colors.secondary})`,
                          color: `hsl(${editingTheme.colors.secondaryForeground})`,
                        }}
                      >
                        Secondary
                      </div>
                      <div
                        className="px-3 py-1 rounded-md text-xs font-medium"
                        style={{
                          backgroundColor: `hsl(${editingTheme.colors.accent})`,
                          color: `hsl(${editingTheme.colors.accentForeground})`,
                        }}
                      >
                        Accent
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Color Fields grouped */}
              {groups.map(group => (
                <div key={group}>
                  <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">{group}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {colorFields.filter(f => f.group === group).map(field => (
                      <div key={field.key} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                        <input
                          type="color"
                          value={hslToHex(editingTheme.colors[field.key])}
                          onChange={(e) => handleColorChange(field.key, e.target.value)}
                          className="w-8 h-8 rounded-md border border-border cursor-pointer bg-transparent"
                          style={{ padding: 0 }}
                        />
                        <span className="text-xs text-foreground">{field.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0">
        <SheetHeader className="p-4 pb-2 border-b border-border">
          <SheetTitle className="text-base flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Custom Themes
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(85vh-80px)]">
          <div className="p-4 space-y-5">
            {/* Create New */}
            <Button
              onClick={() => startNewTheme()}
              className="w-full gap-2"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              Create New Theme
            </Button>

            {/* Presets */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Starter Presets
              </div>
              <div className="grid grid-cols-2 gap-3">
                {themePresets.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => startNewTheme(preset)}
                    className="rounded-xl border border-border overflow-hidden hover:border-primary/50 transition-all"
                  >
                    <div
                      className="h-16 flex items-end p-2"
                      style={{ backgroundColor: `hsl(${preset.colors.background})` }}
                    >
                      <div className="flex gap-1">
                        {['primary', 'secondary', 'accent'].map(k => (
                          <div
                            key={k}
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: `hsl(${preset.colors[k as keyof typeof preset.colors]})` }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="p-2 text-xs font-medium text-foreground">{preset.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Saved Themes */}
            {customThemes.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  Your Themes
                </div>
                <div className="space-y-2">
                  {customThemes.map(theme => (
                    <div
                      key={theme.id}
                      className={cn(
                        "rounded-xl border overflow-hidden transition-all",
                        activeCustomThemeId === theme.id
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border"
                      )}
                    >
                      <button
                        onClick={() => handleApplyTheme(theme)}
                        className="w-full"
                      >
                        <div
                          className="h-12 flex items-center justify-between px-3"
                          style={{ backgroundColor: `hsl(${theme.colors.background})` }}
                        >
                          <span
                            className="text-sm font-medium"
                            style={{ color: `hsl(${theme.colors.foreground})` }}
                          >
                            {theme.name}
                          </span>
                          <div className="flex gap-1">
                            {['primary', 'secondary', 'accent'].map(k => (
                              <div
                                key={k}
                                className="w-3.5 h-3.5 rounded-full"
                                style={{ backgroundColor: `hsl(${theme.colors[k as keyof typeof theme.colors]})` }}
                              />
                            ))}
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                        <div className="flex gap-1">
                          {activeCustomThemeId === theme.id && (
                            <span className="text-xs text-primary font-medium flex items-center gap-1">
                              <Check className="h-3 w-3" /> Active
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); handleDuplicate(theme); }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); setEditingTheme(theme); setShowEditor(true); }}
                          >
                            <Palette className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleDelete(theme.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
