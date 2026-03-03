import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, Plus, Minus, Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Table style presets
export type TableStyle = 'default' | 'striped' | 'bordered' | 'minimal' | 'modern';

export const TABLE_STYLES: { id: TableStyle; name: string; description: string }[] = [
  { id: 'default', name: 'Default', description: 'Standard with header row' },
  { id: 'striped', name: 'Striped', description: 'Alternating row colors' },
  { id: 'bordered', name: 'Bordered', description: 'All cells bordered' },
  { id: 'minimal', name: 'Minimal', description: 'Clean, no borders' },
  { id: 'modern', name: 'Modern', description: 'Rounded with shadow' },
];

interface TableEditorProps {
  onInsertTable: (rows: number, cols: number, style?: TableStyle) => void;
}

export const TableEditor = ({ onInsertTable }: TableEditorProps) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<TableStyle>('default');

  const handleInsert = () => {
    onInsertTable(rows, cols, selectedStyle);
    setIsOpen(false);
    setRows(3);
    setCols(3);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title={t('tableEditor.insertTable')}
        >
          <Table className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4" align="start">
        <div className="space-y-4">
          <div className="font-medium text-sm">{t('tableEditor.insertTable')}</div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">{t('tableEditor.rows')}</Label>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => setRows(Math.max(1, rows - 1))}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center text-sm font-medium">{rows}</span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => setRows(Math.min(20, rows + 1))}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <Label className="text-sm">{t('tableEditor.columns')}</Label>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => setCols(Math.max(1, cols - 1))}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center text-sm font-medium">{cols}</span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => setCols(Math.min(10, cols + 1))}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Style Selection */}
          <div className="space-y-2">
            <Label className="text-sm">{t('tableEditor.style')}</Label>
            <div className="grid grid-cols-2 gap-1">
              {TABLE_STYLES.map((style) => (
                <Button
                  key={style.id}
                  variant={selectedStyle === style.id ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 text-xs justify-start",
                    selectedStyle === style.id && "ring-1 ring-primary"
                  )}
                  onClick={() => setSelectedStyle(style.id)}
                >
                  {style.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Grid preview */}
          <div className="border rounded p-2 bg-muted/30">
            <div 
              className="grid gap-0.5"
              style={{ 
                gridTemplateColumns: `repeat(${Math.min(cols, 6)}, 1fr)`,
              }}
            >
              {Array.from({ length: Math.min(rows, 5) * Math.min(cols, 6) }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square bg-primary/20 rounded-sm min-w-[12px]"
                />
              ))}
            </div>
            {(rows > 5 || cols > 6) && (
              <p className="text-xs text-muted-foreground mt-1 text-center">
                {rows}×{cols} table
              </p>
            )}
          </div>

          <Button onClick={handleInsert} className="w-full" size="sm">
            {t('tableEditor.insertTable')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Helper to generate table HTML with styles and editable cells
export const generateTableHTML = (rows: number, cols: number, style: TableStyle = 'default'): string => {
  const styles = getTableStyles(style);
  
  // Add contenteditable to cells for inline editing
  const headerRow = `<tr>${Array(cols).fill(null).map(() => 
    `<th style="${styles.headerCell}" contenteditable="true">Header</th>`
  ).join('')}</tr>`;
  
  const bodyRows = Array(rows - 1)
    .fill(null)
    .map((_, rowIdx) => {
      const isEven = rowIdx % 2 === 0;
      const cellStyle = style === 'striped' && isEven ? styles.stripedCell : styles.bodyCell;
      return `<tr>${Array(cols).fill(null).map(() => 
        `<td style="${cellStyle}" contenteditable="true">Cell</td>`
      ).join('')}</tr>`;
    })
    .join('');
  
  return `<table style="${styles.table}" data-table-style="${style}">${headerRow}${bodyRows}</table><p><br></p>`;
};

// Get styles for different table presets
export const getTableStyles = (style: TableStyle) => {
  switch (style) {
    case 'striped':
      return {
        table: 'border-collapse: collapse; width: 100%; margin: 16px 0;',
        headerCell: 'border: 1px solid hsl(var(--border)); padding: 10px 12px; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); font-weight: 600; text-align: left;',
        bodyCell: 'border: 1px solid hsl(var(--border)); padding: 10px 12px;',
        stripedCell: 'border: 1px solid hsl(var(--border)); padding: 10px 12px; background: hsl(var(--muted));',
      };
    case 'bordered':
      return {
        table: 'border-collapse: collapse; width: 100%; margin: 16px 0; border: 2px solid hsl(var(--border));',
        headerCell: 'border: 2px solid hsl(var(--border)); padding: 10px 12px; background: hsl(var(--muted)); font-weight: 600;',
        bodyCell: 'border: 2px solid hsl(var(--border)); padding: 10px 12px;',
        stripedCell: 'border: 2px solid hsl(var(--border)); padding: 10px 12px;',
      };
    case 'minimal':
      return {
        table: 'border-collapse: collapse; width: 100%; margin: 16px 0;',
        headerCell: 'border-bottom: 2px solid hsl(var(--border)); padding: 10px 12px; font-weight: 600; text-align: left;',
        bodyCell: 'border-bottom: 1px solid hsl(var(--border)/0.5); padding: 10px 12px;',
        stripedCell: 'border-bottom: 1px solid hsl(var(--border)/0.5); padding: 10px 12px;',
      };
    case 'modern':
      return {
        table: 'border-collapse: separate; border-spacing: 0; width: 100%; margin: 16px 0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);',
        headerCell: 'padding: 12px 16px; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); font-weight: 600; text-align: left;',
        bodyCell: 'padding: 12px 16px; border-bottom: 1px solid hsl(var(--border)); background: hsl(var(--background));',
        stripedCell: 'padding: 12px 16px; border-bottom: 1px solid hsl(var(--border)); background: hsl(var(--background));',
      };
    default:
      return {
        table: 'border-collapse: collapse; width: 100%; margin: 16px 0;',
        headerCell: 'border: 1px solid hsl(var(--border)); padding: 8px; background: hsl(var(--muted)); font-weight: 600;',
        bodyCell: 'border: 1px solid hsl(var(--border)); padding: 8px;',
        stripedCell: 'border: 1px solid hsl(var(--border)); padding: 8px;',
      };
  }
};

// Table manipulation functions
export const addTableRow = (table: HTMLTableElement, position: 'above' | 'below', rowIndex: number): void => {
  const style = (table.getAttribute('data-table-style') as TableStyle) || 'default';
  const styles = getTableStyles(style);
  const newRow = table.insertRow(position === 'above' ? rowIndex : rowIndex + 1);
  const cellCount = table.rows[0]?.cells.length || 1;
  
  for (let i = 0; i < cellCount; i++) {
    const cell = newRow.insertCell(i);
    cell.style.cssText = styles.bodyCell;
    cell.textContent = 'Cell';
    cell.contentEditable = 'true';
  }
};

export const addTableColumn = (table: HTMLTableElement, position: 'left' | 'right', colIndex: number): void => {
  const style = (table.getAttribute('data-table-style') as TableStyle) || 'default';
  const styles = getTableStyles(style);
  
  Array.from(table.rows).forEach((row, rowIdx) => {
    const cell = row.insertCell(position === 'left' ? colIndex : colIndex + 1);
    cell.contentEditable = 'true';
    
    if (rowIdx === 0) {
      cell.style.cssText = styles.headerCell;
      cell.textContent = 'Header';
    } else {
      cell.style.cssText = styles.bodyCell;
      cell.textContent = 'Cell';
    }
  });
};

export const deleteTableRow = (table: HTMLTableElement, rowIndex: number): void => {
  if (table.rows.length > 1) {
    table.deleteRow(rowIndex);
  }
};

export const deleteTableColumn = (table: HTMLTableElement, colIndex: number): void => {
  if (table.rows[0]?.cells.length > 1) {
    Array.from(table.rows).forEach(row => {
      if (row.cells[colIndex]) {
        row.deleteCell(colIndex);
      }
    });
  }
};

// Table Context Menu Component
interface TableContextMenuProps {
  table: HTMLTableElement;
  rowIndex: number;
  colIndex: number;
  position: { x: number; y: number };
  onClose: () => void;
  onTableChange: () => void;
}

export const TableContextMenu = ({ 
  table, 
  rowIndex, 
  colIndex, 
  position, 
  onClose,
  onTableChange 
}: TableContextMenuProps) => {
  const handleAction = (action: () => void) => {
    action();
    onTableChange();
    onClose();
  };

  return (
    <div 
      className="fixed z-[100] bg-popover border rounded-lg shadow-lg py-1 min-w-[180px]"
      style={{ left: position.x, top: position.y }}
    >
      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b mb-1">
        Table Actions
      </div>
      
      {/* Row Actions */}
      <button
        className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
        onClick={() => handleAction(() => addTableRow(table, 'above', rowIndex))}
      >
        <ChevronUp className="h-4 w-4" />
        Insert Row Above
      </button>
      <button
        className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
        onClick={() => handleAction(() => addTableRow(table, 'below', rowIndex))}
      >
        <ChevronDown className="h-4 w-4" />
        Insert Row Below
      </button>
      
      <div className="h-px bg-border my-1" />
      
      {/* Column Actions */}
      <button
        className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
        onClick={() => handleAction(() => addTableColumn(table, 'left', colIndex))}
      >
        <ChevronLeft className="h-4 w-4" />
        Insert Column Left
      </button>
      <button
        className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
        onClick={() => handleAction(() => addTableColumn(table, 'right', colIndex))}
      >
        <ChevronRight className="h-4 w-4" />
        Insert Column Right
      </button>
      
      <div className="h-px bg-border my-1" />
      
      {/* Delete Actions */}
      <button
        className="w-full px-3 py-2 text-sm text-left hover:bg-destructive/10 text-destructive flex items-center gap-2"
        onClick={() => handleAction(() => deleteTableRow(table, rowIndex))}
        disabled={table.rows.length <= 1}
      >
        <Trash2 className="h-4 w-4" />
        Delete Row
      </button>
      <button
        className="w-full px-3 py-2 text-sm text-left hover:bg-destructive/10 text-destructive flex items-center gap-2"
        onClick={() => handleAction(() => deleteTableColumn(table, colIndex))}
        disabled={(table.rows[0]?.cells.length || 0) <= 1}
      >
        <Trash2 className="h-4 w-4" />
        Delete Column
      </button>
    </div>
  );
};
