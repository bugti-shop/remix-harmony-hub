import { useCallback, useEffect, useRef, useState, memo, useMemo } from 'react';
import { triggerHaptic } from '@/utils/haptics';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import {
  Pen, Eraser, Undo2, Redo2, Trash2, Palette, Minus,
  Minus as LineIcon, Square, Circle, MoveRight, Ruler,
  Pencil, PenTool, Highlighter, SprayCan, Brush,
  Layers, Eye, EyeOff, Maximize, Pipette, Grid3X3, ZoomIn,
  MousePointer2, Copy, Clipboard, Trash, RotateCw, Focus,
  Download, Share2, FileText, FileImage, FileCode, Play, Pause, Save, FolderOpen, Plus, Film, FlipHorizontal, FlipVertical, ScissorsLineDashed, Monitor, Crosshair, Sticker, BookmarkPlus, Check, ArrowRight, ArrowUpRight, Bookmark, Ribbon,
  Type, Bold, Italic, Triangle, Star, Diamond, Hexagon, Navigation,
  Droplets, CircleDot, PaintbrushVertical, PenLine, StickyNote, ImagePlus, Sparkles,
  Heart, Cloud, MessageSquare, Pentagon, Moon, Cylinder,
  Mic, Square as StopSquare, Wand2, ChevronLeft, ChevronRight, FileUp, Video, Repeat,
  Search, X, Hand, ZoomOut, Shrink,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CanvasRuler, RulerLine, snapToRuler } from '@/components/CanvasRuler';
import { SketchVideoPanel, VideoBookmark } from '@/components/SketchVideoPanel';
import { CanvasProtractor, ProtractorLine, snapToProtractor } from '@/components/CanvasProtractor';
import { CanvasTriangle, TriangleEdges, snapToTriangle } from '@/components/CanvasTriangle';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

// --- Types ---

type DrawToolType = 'pencil' | 'pen' | 'marker' | 'highlighter' | 'calligraphy' | 'spray' | 'fountain' | 'crayon' | 'watercolor' | 'dotpen' | 'neon' | 'textHighlight';
type ShapeToolType = 'line' | 'rect' | 'circle' | 'arrow' | 'triangle' | 'star' | 'diamond' | 'polygon' | 'pentagon' | 'heart' | 'moon' | 'cloud' | 'speechBubble' | 'cylinder' | 'trapezoid' | 'cone';
type ToolType = DrawToolType | ShapeToolType | 'eraser' | 'select' | 'text' | 'sticky' | 'image' | 'laser' | 'washi' | 'pdfTextSelect';
type BackgroundType = 'plain' | 'grid-sm' | 'grid-lg' | 'dotted' | 'ruled' | 'isometric' | 'dark' | 'dotted-grid' | 'graph-sm' | 'music-staff';

interface Point {
  x: number;
  y: number;
  pressure: number;
  timestamp?: number;
}

interface TextAnnotation {
  id: number;
  x: number;
  y: number;
  text: string;
  font: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
}

interface StickyNoteData {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
  fontSize: number;
  rotation?: number;
}

interface CanvasImageData {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  src: string; // base64 data URL
  naturalWidth: number;
  naturalHeight: number;
}

interface BrushSettings {
  textureIntensity: number; // 0-1, how much texture/grain overlay
  grainSize: number;        // 0.5-3, multiplier for grain particle size
  wetness: number;          // 0-1, controls spread/bleed (watercolor), density (spray), ink flow (fountain)
}

const DEFAULT_BRUSH_SETTINGS: Record<DrawToolType, BrushSettings> = {
  pencil:      { textureIntensity: 0.5, grainSize: 1, wetness: 0.3 },
  pen:         { textureIntensity: 0.1, grainSize: 1, wetness: 0.5 },
  fountain:    { textureIntensity: 0.2, grainSize: 1, wetness: 0.7 },
  marker:      { textureIntensity: 0.1, grainSize: 1, wetness: 0.5 },
  highlighter: { textureIntensity: 0.1, grainSize: 1, wetness: 0.5 },
  calligraphy: { textureIntensity: 0.3, grainSize: 1, wetness: 0.5 },
  crayon:      { textureIntensity: 0.8, grainSize: 1.5, wetness: 0.2 },
  watercolor:  { textureIntensity: 0.6, grainSize: 1.2, wetness: 0.8 },
  spray:       { textureIntensity: 0.5, grainSize: 1, wetness: 0.6 },
  dotpen:      { textureIntensity: 0.3, grainSize: 1, wetness: 0.5 },
  neon:        { textureIntensity: 0.2, grainSize: 1, wetness: 0.7 },
  textHighlight: { textureIntensity: 0.1, grainSize: 1, wetness: 0.5 },
};

interface Stroke {
  points: Point[];
  color: string;
  width: number;
  tool: ToolType;
  fillColor?: string;
  fillOpacity?: number;
  pressureOpacity?: boolean;
  isClipMask?: boolean;
  audioTimestamp?: number; // ms offset from audio recording start
  washiPatternId?: string;
  brushSettings?: BrushSettings;
}

type LayerBlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light';

const BLEND_MODE_OPTIONS: { id: LayerBlendMode; label: string; composite: GlobalCompositeOperation }[] = [
  { id: 'normal', label: 'Normal', composite: 'source-over' },
  { id: 'multiply', label: 'Multiply', composite: 'multiply' },
  { id: 'screen', label: 'Screen', composite: 'screen' },
  { id: 'overlay', label: 'Overlay', composite: 'overlay' },
  { id: 'soft-light', label: 'Soft Light', composite: 'soft-light' as GlobalCompositeOperation },
];

interface Layer {
  id: number;
  name: string;
  strokes: Stroke[];
  textAnnotations: TextAnnotation[];
  stickyNotes: StickyNoteData[];
  images: CanvasImageData[];
  washiTapes: WashiTapeData[];
  opacity: number;
  visible: boolean;
  blendMode?: LayerBlendMode;
}

export interface SketchData {
  layers: Layer[];
  activeLayerId: number;
  background?: BackgroundType;
  width: number;
  height: number;
  version: 2;
  strokes?: Stroke[];
  audioRecording?: { dataUrl: string; duration: number };
  videoUrl?: string;
  videoBookmarks?: VideoBookmark[];
}

interface BBox {
  x: number; y: number; w: number; h: number;
}

type HandleType = 'tl' | 'tr' | 'bl' | 'br' | 'rotate' | 'body';

// --- Constants ---

const MAX_UNDO = 50;
const MIN_POINT_DISTANCE = 1;
const SMOOTHING_FACTOR = 0.3; // 0 = no smoothing, 1 = max smoothing
const PALM_REJECTION_RADIUS = 20;
const MAX_LAYERS = 3;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;
const DOUBLE_TAP_DELAY = 400;
const MAX_RECENT_COLORS = 8;
const HANDLE_SIZE = 8;
const HIT_TOLERANCE = 12;

const GRID_SIZES: Record<BackgroundType, number> = {
  'plain': 20, 'grid-sm': 16, 'grid-lg': 40, 'dotted': 20,
  'ruled': 28, 'isometric': 30, 'dark': 20,
  'dotted-grid': 20, 'graph-sm': 8, 'music-staff': 28,
};

const snapToGrid = (val: number, gridSize: number): number =>
  Math.round(val / gridSize) * gridSize;

const SHAPE_TOOLS: { id: ShapeToolType; icon: typeof Pen; label: string }[] = [
  { id: 'line', icon: LineIcon, label: 'Line' },
  { id: 'rect', icon: Square, label: 'Rectangle' },
  { id: 'circle', icon: Circle, label: 'Circle' },
  { id: 'arrow', icon: MoveRight, label: 'Arrow' },
  { id: 'triangle', icon: Triangle, label: 'Triangle' },
  { id: 'star', icon: Star, label: 'Star' },
  { id: 'diamond', icon: Diamond, label: 'Diamond' },
  { id: 'polygon', icon: Hexagon, label: 'Hexagon' },
  { id: 'pentagon', icon: Pentagon, label: 'Pentagon' },
  { id: 'heart', icon: Heart, label: 'Heart' },
  { id: 'moon', icon: Moon, label: 'Moon' },
  { id: 'cloud', icon: Cloud, label: 'Cloud' },
  { id: 'speechBubble', icon: MessageSquare, label: 'Speech Bubble' },
  { id: 'cylinder', icon: Cylinder, label: 'Cylinder' },
  { id: 'trapezoid', icon: Navigation, label: 'Trapezoid' },
  { id: 'cone', icon: Triangle, label: 'Cone' },
];

const DRAW_TOOLS: { id: DrawToolType; icon: typeof Pen; label: string }[] = [
  { id: 'pencil', icon: Pencil, label: 'Pencil' },
  { id: 'pen', icon: Pen, label: 'Pen' },
  { id: 'fountain', icon: PenLine, label: 'Fountain' },
  { id: 'marker', icon: PenTool, label: 'Marker' },
  { id: 'highlighter', icon: Highlighter, label: 'Highlighter' },
  { id: 'calligraphy', icon: Brush, label: 'Calligraphy' },
  { id: 'crayon', icon: PaintbrushVertical, label: 'Crayon' },
  { id: 'watercolor', icon: Droplets, label: 'Watercolor' },
  { id: 'spray', icon: SprayCan, label: 'Spray' },
  { id: 'dotpen', icon: CircleDot, label: 'Dot Pen' },
  { id: 'neon', icon: Sparkles, label: 'Neon Glow' },
  { id: 'textHighlight', icon: Highlighter, label: 'Highlight' },
];

const BACKGROUNDS: { id: BackgroundType; label: string }[] = [
  { id: 'plain', label: 'Plain' },
  { id: 'grid-sm', label: 'Small Grid' },
  { id: 'grid-lg', label: 'Large Grid' },
  { id: 'graph-sm', label: 'Graph Paper' },
  { id: 'dotted', label: 'Dotted' },
  { id: 'dotted-grid', label: 'Dotted Grid' },
  { id: 'ruled', label: 'Ruled' },
  { id: 'music-staff', label: 'Music Staff' },
  { id: 'isometric', label: 'Isometric' },
  { id: 'dark', label: 'Dark' },
];

const isDrawingTool = (t: ToolType): t is DrawToolType | ShapeToolType | 'eraser' =>
  t !== 'select' && t !== 'text' && t !== 'sticky' && t !== 'image' && t !== 'laser' && t !== 'washi';

const STICKY_COLORS = [
  '#FEF3C7', // warm yellow
  '#FBCFE8', // pink
  '#BBF7D0', // green
  '#BFDBFE', // blue
  '#E9D5FF', // purple
  '#FED7AA', // orange
  '#FECACA', // red
  '#D1FAE5', // teal
];

const isShapeTool = (t: ToolType): t is ShapeToolType =>
  ['line','rect','circle','arrow','triangle','star','diamond','polygon','pentagon','heart','moon','cloud','speechBubble','cylinder','trapezoid','cone'].includes(t);

// --- Sticker Library ---

interface StickerElement {
  id: string;
  name: string;
  strokes: Stroke[];
  builtIn?: boolean;
}

const mkPt = (x: number, y: number): Point => ({ x, y, pressure: 0.5 });

const BUILT_IN_STICKERS: StickerElement[] = [
  {
    id: 'builtin-arrow-right', name: 'Arrow Right', builtIn: true,
    strokes: [{ points: [mkPt(0,25), mkPt(50,25)], color: '#000000', width: 3, tool: 'pen' as ToolType },
              { points: [mkPt(40,15), mkPt(50,25), mkPt(40,35)], color: '#000000', width: 3, tool: 'pen' as ToolType }],
  },
  {
    id: 'builtin-arrow-up-right', name: 'Arrow Diagonal', builtIn: true,
    strokes: [{ points: [mkPt(0,50), mkPt(50,0)], color: '#000000', width: 3, tool: 'pen' as ToolType },
              { points: [mkPt(35,0), mkPt(50,0), mkPt(50,15)], color: '#000000', width: 3, tool: 'pen' as ToolType }],
  },
  {
    id: 'builtin-checkmark', name: 'Checkmark', builtIn: true,
    strokes: [{ points: [mkPt(5,30), mkPt(18,45), mkPt(45,5)], color: '#16a34a', width: 4, tool: 'pen' as ToolType }],
  },
  {
    id: 'builtin-cross', name: 'Cross', builtIn: true,
    strokes: [{ points: [mkPt(5,5), mkPt(45,45)], color: '#dc2626', width: 3, tool: 'pen' as ToolType },
              { points: [mkPt(45,5), mkPt(5,45)], color: '#dc2626', width: 3, tool: 'pen' as ToolType }],
  },
  {
    id: 'builtin-star', name: 'Star', builtIn: true,
    strokes: [{ points: [mkPt(25,0), mkPt(30,18), mkPt(50,18), mkPt(34,28), mkPt(40,48), mkPt(25,35), mkPt(10,48), mkPt(16,28), mkPt(0,18), mkPt(20,18), mkPt(25,0)], color: '#eab308', width: 2, tool: 'pen' as ToolType, fillColor: '#fef08a', fillOpacity: 0.6 }],
  },
  {
    id: 'builtin-bracket-left', name: 'Left Bracket', builtIn: true,
    strokes: [{ points: [mkPt(20,0), mkPt(5,0), mkPt(5,50), mkPt(20,50)], color: '#000000', width: 3, tool: 'pen' as ToolType }],
  },
  {
    id: 'builtin-bracket-right', name: 'Right Bracket', builtIn: true,
    strokes: [{ points: [mkPt(5,0), mkPt(20,0), mkPt(20,50), mkPt(5,50)], color: '#000000', width: 3, tool: 'pen' as ToolType }],
  },
  {
    id: 'builtin-heart', name: 'Heart', builtIn: true,
    strokes: [{ points: [mkPt(25,45), mkPt(5,25), mkPt(5,12), mkPt(12,2), mkPt(25,12), mkPt(38,2), mkPt(45,12), mkPt(45,25), mkPt(25,45)], color: '#ef4444', width: 2, tool: 'pen' as ToolType, fillColor: '#fca5a5', fillOpacity: 0.5 }],
  },
  {
    id: 'builtin-circle', name: 'Circle', builtIn: true,
    strokes: [{ points: Array.from({length: 25}, (_, i) => { const a = (i/24)*Math.PI*2; return mkPt(25+20*Math.cos(a), 25+20*Math.sin(a)); }), color: '#3b82f6', width: 2, tool: 'pen' as ToolType }],
  },
  {
    id: 'builtin-underline', name: 'Underline', builtIn: true,
    strokes: [{ points: [mkPt(0,2), mkPt(60,2)], color: '#000000', width: 3, tool: 'pen' as ToolType },
              { points: [mkPt(0,8), mkPt(60,8)], color: '#000000', width: 1, tool: 'pen' as ToolType }],
  },
  // --- Decorative stickers ---
  {
    id: 'builtin-ribbon-banner', name: 'Banner', builtIn: true,
    strokes: [
      { points: [mkPt(5,15), mkPt(0,20), mkPt(5,25), mkPt(5,15)], color: '#f59e0b', width: 2, tool: 'pen' as ToolType, fillColor: '#fbbf24', fillOpacity: 0.7 },
      { points: [mkPt(5,12), mkPt(45,12), mkPt(45,28), mkPt(5,28), mkPt(5,12)], color: '#f59e0b', width: 2, tool: 'pen' as ToolType, fillColor: '#fef3c7', fillOpacity: 0.8 },
      { points: [mkPt(45,15), mkPt(50,20), mkPt(45,25), mkPt(45,15)], color: '#f59e0b', width: 2, tool: 'pen' as ToolType, fillColor: '#fbbf24', fillOpacity: 0.7 },
    ],
  },
  {
    id: 'builtin-speech-bubble', name: 'Speech', builtIn: true,
    strokes: [
      { points: [mkPt(5,5), mkPt(45,5), mkPt(45,30), mkPt(20,30), mkPt(12,42), mkPt(15,30), mkPt(5,30), mkPt(5,5)], color: '#6366f1', width: 2, tool: 'pen' as ToolType, fillColor: '#e0e7ff', fillOpacity: 0.6 },
    ],
  },
  {
    id: 'builtin-thought-bubble', name: 'Thought', builtIn: true,
    strokes: [
      { points: Array.from({length: 25}, (_, i) => { const a = (i/24)*Math.PI*2; return mkPt(25+18*Math.cos(a), 20+14*Math.sin(a)); }), color: '#8b5cf6', width: 2, tool: 'pen' as ToolType, fillColor: '#ede9fe', fillOpacity: 0.5 },
      { points: Array.from({length: 13}, (_, i) => { const a = (i/12)*Math.PI*2; return mkPt(14+3*Math.cos(a), 38+3*Math.sin(a)); }), color: '#8b5cf6', width: 1.5, tool: 'pen' as ToolType, fillColor: '#ede9fe', fillOpacity: 0.5 },
      { points: Array.from({length: 13}, (_, i) => { const a = (i/12)*Math.PI*2; return mkPt(10+2*Math.cos(a), 44+2*Math.sin(a)); }), color: '#8b5cf6', width: 1.5, tool: 'pen' as ToolType, fillColor: '#ede9fe', fillOpacity: 0.5 },
    ],
  },
  {
    id: 'builtin-lightning', name: 'Lightning', builtIn: true,
    strokes: [{ points: [mkPt(30,0), mkPt(15,22), mkPt(28,22), mkPt(18,50), mkPt(38,18), mkPt(25,18), mkPt(30,0)], color: '#f59e0b', width: 2, tool: 'pen' as ToolType, fillColor: '#fef08a', fillOpacity: 0.7 }],
  },
  {
    id: 'builtin-crown', name: 'Crown', builtIn: true,
    strokes: [{ points: [mkPt(5,35), mkPt(5,15), mkPt(15,25), mkPt(25,8), mkPt(35,25), mkPt(45,15), mkPt(45,35), mkPt(5,35)], color: '#f59e0b', width: 2, tool: 'pen' as ToolType, fillColor: '#fef08a', fillOpacity: 0.7 }],
  },
  {
    id: 'builtin-flame', name: 'Flame', builtIn: true,
    strokes: [{ points: [mkPt(25,48), mkPt(10,30), mkPt(8,18), mkPt(15,8), mkPt(22,15), mkPt(25,2), mkPt(28,15), mkPt(35,8), mkPt(42,18), mkPt(40,30), mkPt(25,48)], color: '#ef4444', width: 2, tool: 'pen' as ToolType, fillColor: '#fca5a5', fillOpacity: 0.5 }],
  },
  {
    id: 'builtin-sun', name: 'Sun', builtIn: true,
    strokes: [
      { points: Array.from({length: 25}, (_, i) => { const a = (i/24)*Math.PI*2; return mkPt(25+10*Math.cos(a), 25+10*Math.sin(a)); }), color: '#f59e0b', width: 2, tool: 'pen' as ToolType, fillColor: '#fef08a', fillOpacity: 0.7 },
      ...Array.from({length: 8}, (_, i) => { const a = (i/8)*Math.PI*2; return { points: [mkPt(25+14*Math.cos(a), 25+14*Math.sin(a)), mkPt(25+22*Math.cos(a), 25+22*Math.sin(a))], color: '#f59e0b', width: 2, tool: 'pen' as ToolType }; }),
    ],
  },
  {
    id: 'builtin-music-note', name: 'Music', builtIn: true,
    strokes: [
      { points: [mkPt(20,10), mkPt(20,40)], color: '#000000', width: 2.5, tool: 'pen' as ToolType },
      { points: Array.from({length: 13}, (_, i) => { const a = (i/12)*Math.PI*2; return mkPt(15+6*Math.cos(a), 40+4*Math.sin(a)); }), color: '#000000', width: 2, tool: 'pen' as ToolType, fillColor: '#000000', fillOpacity: 0.8 },
      { points: [mkPt(20,10), mkPt(35,7)], color: '#000000', width: 3, tool: 'pen' as ToolType },
    ],
  },
  {
    id: 'builtin-exclamation', name: 'Alert', builtIn: true,
    strokes: [
      { points: [mkPt(10,0), mkPt(40,0), mkPt(50,45), mkPt(25,40), mkPt(0,45), mkPt(10,0)], color: '#ef4444', width: 2, tool: 'pen' as ToolType, fillColor: '#fecaca', fillOpacity: 0.7 },
      { points: [mkPt(25,10), mkPt(25,28)], color: '#ef4444', width: 3, tool: 'pen' as ToolType },
      { points: Array.from({length: 13}, (_, i) => { const a = (i/12)*Math.PI*2; return mkPt(25+2*Math.cos(a), 34+2*Math.sin(a)); }), color: '#ef4444', width: 1, tool: 'pen' as ToolType, fillColor: '#ef4444', fillOpacity: 1 },
    ],
  },
  {
    id: 'builtin-pin', name: 'Pin', builtIn: true,
    strokes: [
      { points: Array.from({length: 25}, (_, i) => { const a = (i/24)*Math.PI*2; return mkPt(25+12*Math.cos(a), 15+12*Math.sin(a)); }), color: '#ef4444', width: 2, tool: 'pen' as ToolType, fillColor: '#fca5a5', fillOpacity: 0.7 },
      { points: [mkPt(25,27), mkPt(25,48)], color: '#6b7280', width: 2, tool: 'pen' as ToolType },
    ],
  },
  {
    id: 'builtin-flower', name: 'Flower', builtIn: true,
    strokes: [
      ...Array.from({length: 6}, (_, i) => { const a = (i/6)*Math.PI*2; return { points: Array.from({length: 13}, (_, j) => { const b = (j/12)*Math.PI*2; return mkPt(25+15*Math.cos(a)+6*Math.cos(b), 25+15*Math.sin(a)+6*Math.sin(b)); }), color: '#ec4899', width: 1.5, tool: 'pen' as ToolType, fillColor: '#fbcfe8', fillOpacity: 0.6 }; }),
      { points: Array.from({length: 13}, (_, i) => { const a = (i/12)*Math.PI*2; return mkPt(25+5*Math.cos(a), 25+5*Math.sin(a)); }), color: '#f59e0b', width: 1.5, tool: 'pen' as ToolType, fillColor: '#fef08a', fillOpacity: 0.8 },
    ],
  },
  {
    id: 'builtin-cloud', name: 'Cloud', builtIn: true,
    strokes: [{ points: [mkPt(10,35), mkPt(5,30), mkPt(5,22), mkPt(10,18), mkPt(15,15), mkPt(20,12), mkPt(28,10), mkPt(35,12), mkPt(40,15), mkPt(43,20), mkPt(45,25), mkPt(43,30), mkPt(40,35), mkPt(10,35)], color: '#60a5fa', width: 2, tool: 'pen' as ToolType, fillColor: '#dbeafe', fillOpacity: 0.6 }],
  },
];

// Emoji sticker categories
const EMOJI_STICKERS: { category: string; emojis: string[] }[] = [
  { category: 'Faces', emojis: ['😀','😂','🥰','😎','🤔','😱','🥺','😤','🤩','😴','🤗','😇','🫡','🥳','😈'] },
  { category: 'Hands', emojis: ['👍','👎','👏','🙌','✌️','🤞','👋','💪','🤝','☝️','✋','🫶','🤟','👆','👇'] },
  { category: 'Hearts', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💕','💖','💗','💘','💝','❣️','💔'] },
  { category: 'Nature', emojis: ['🌸','🌺','🌻','🌹','🌷','🍀','🌿','🌴','🌈','⭐','🌙','☀️','❄️','🔥','💧'] },
  { category: 'Food', emojis: ['🍎','🍕','🍔','🍟','🌮','🍩','🍪','🎂','☕','🧋','🍿','🍰','🍫','🍇','🥑'] },
  { category: 'Objects', emojis: ['📌','📎','✏️','📝','📚','💡','🔔','🎵','🎯','🏆','🎁','🎈','🎉','🚀','💎'] },
  { category: 'Symbols', emojis: ['✅','❌','⚠️','❓','❗','💯','🔴','🟢','🔵','⬛','🟨','➡️','⬆️','⬇️','🔄'] },
  { category: 'Animals', emojis: ['🐱','🐶','🐰','🦊','🐻','🐼','🦁','🐸','🦋','🐝','🐢','🦄','🐬','🦅','🐙'] },
];

const STICKER_STORAGE_KEY = 'sketch-sticker-library';

const loadSavedStickers = (): StickerElement[] => {
  try {
    const raw = localStorage.getItem(STICKER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveStickersToDisk = (stickers: StickerElement[]) => {
  localStorage.setItem(STICKER_STORAGE_KEY, JSON.stringify(stickers));
};

// --- Washi Tape ---

interface WashiTapeData {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  patternId: string;
  opacity: number;
}

interface WashiTapePattern {
  id: string;
  name: string;
  color: string;
  bgColor: string;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

const WASHI_PATTERNS: WashiTapePattern[] = [
  {
    id: 'solid-pink', name: 'Rose Quartz', color: '#f9a8d4', bgColor: '#fbcfe8',
    draw: (ctx, w, h) => {
      // Rich gradient base
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#fce7f3'); grad.addColorStop(0.3, '#fbcfe8');
      grad.addColorStop(0.7, '#f9a8d4'); grad.addColorStop(1, '#fce7f3');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      // Fiber texture overlay
      ctx.globalAlpha = 0.08;
      for (let i = 0; i < w * h * 0.02; i++) {
        const fx = Math.random() * w, fy = Math.random() * h;
        const fl = 2 + Math.random() * 6;
        const fa = Math.random() * Math.PI;
        ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 0.3;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + Math.cos(fa) * fl, fy + Math.sin(fa) * fl); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Subtle shimmer
      const shimmer = ctx.createLinearGradient(0, 0, w * 0.5, 0);
      shimmer.addColorStop(0, 'rgba(255,255,255,0)'); shimmer.addColorStop(0.5, 'rgba(255,255,255,0.12)');
      shimmer.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shimmer; ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'solid-mint', name: 'Jade Mint', color: '#6ee7b7', bgColor: '#a7f3d0',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w * 0.7, h);
      grad.addColorStop(0, '#d1fae5'); grad.addColorStop(0.4, '#a7f3d0');
      grad.addColorStop(0.8, '#6ee7b7'); grad.addColorStop(1, '#d1fae5');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      // Woven texture
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = '#059669'; ctx.lineWidth = 0.5;
      for (let x = 0; x < w; x += 4) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 4) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'solid-lavender', name: 'Amethyst', color: '#c4b5fd', bgColor: '#ddd6fe',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h * 0.8);
      grad.addColorStop(0, '#ede9fe'); grad.addColorStop(0.35, '#ddd6fe');
      grad.addColorStop(0.65, '#c4b5fd'); grad.addColorStop(1, '#ede9fe');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      // Sparkle effect
      ctx.globalAlpha = 0.15;
      for (let i = 0; i < Math.min(w * h * 0.003, 60); i++) {
        const sx = Math.random() * w, sy = Math.random() * h, sr = 0.5 + Math.random() * 1.5;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'solid-peach', name: 'Sunset Peach', color: '#fdba74', bgColor: '#fed7aa',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#fff7ed'); grad.addColorStop(0.3, '#fed7aa');
      grad.addColorStop(0.6, '#fdba74'); grad.addColorStop(1, '#fbbf24');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      // Warm glow spots
      ctx.globalAlpha = 0.08;
      for (let i = 0; i < 5; i++) {
        const gx = Math.random() * w, gy = Math.random() * h, gr = 4 + Math.random() * 8;
        const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        glow.addColorStop(0, '#ffffff'); glow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glow; ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
      }
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'stripes-blue', name: 'Ocean Stripes', color: '#93c5fd', bgColor: '#bfdbfe',
    draw: (ctx, w, h) => {
      // Rich blue gradient base
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#dbeafe'); grad.addColorStop(0.5, '#bfdbfe'); grad.addColorStop(1, '#93c5fd');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      // HD diagonal stripes with anti-aliased edges
      ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      for (let x = -h * 2; x < w + h * 2; x += 8) {
        const stripeGrad = ctx.createLinearGradient(x, 0, x + h, h);
        stripeGrad.addColorStop(0, '#3b82f6'); stripeGrad.addColorStop(0.5, '#60a5fa'); stripeGrad.addColorStop(1, '#3b82f6');
        ctx.strokeStyle = stripeGrad;
        ctx.globalAlpha = 0.45;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Subtle highlight on top
      const shine = ctx.createLinearGradient(0, 0, 0, h * 0.3);
      shine.addColorStop(0, 'rgba(255,255,255,0.2)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine; ctx.fillRect(0, 0, w, h * 0.3);
    },
  },
  {
    id: 'stripes-red', name: 'Cherry Stripes', color: '#fca5a5', bgColor: '#fecaca',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#fee2e2'); grad.addColorStop(0.5, '#fecaca'); grad.addColorStop(1, '#fca5a5');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      ctx.lineCap = 'round'; ctx.lineWidth = 2.5;
      for (let x = -h * 2; x < w + h * 2; x += 7) {
        const stripeGrad = ctx.createLinearGradient(x, 0, x + h, h);
        stripeGrad.addColorStop(0, '#ef4444'); stripeGrad.addColorStop(0.5, '#f87171'); stripeGrad.addColorStop(1, '#ef4444');
        ctx.strokeStyle = stripeGrad;
        ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Top highlight
      const shine = ctx.createLinearGradient(0, 0, 0, h * 0.25);
      shine.addColorStop(0, 'rgba(255,255,255,0.18)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine; ctx.fillRect(0, 0, w, h * 0.25);
    },
  },
  {
    id: 'polka-yellow', name: 'Gold Dots', color: '#fde047', bgColor: '#fef9c3',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#fefce8'); grad.addColorStop(0.5, '#fef9c3'); grad.addColorStop(1, '#fde68a');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      // HD polka dots with gradient fill and shadow
      for (let x = 6; x < w; x += 12) {
        for (let y = 4; y < h; y += 12) {
          const ox = Math.floor(y / 12) % 2 ? 6 : 0;
          const dx = x + ox, dy = y;
          // Dot shadow
          ctx.globalAlpha = 0.08;
          ctx.fillStyle = '#92400e';
          ctx.beginPath(); ctx.arc(dx + 0.5, dy + 0.8, 3, 0, Math.PI * 2); ctx.fill();
          // Dot with radial gradient
          ctx.globalAlpha = 0.85;
          const dotGrad = ctx.createRadialGradient(dx - 0.8, dy - 0.8, 0.5, dx, dy, 3);
          dotGrad.addColorStop(0, '#fef08a'); dotGrad.addColorStop(0.6, '#facc15'); dotGrad.addColorStop(1, '#eab308');
          ctx.fillStyle = dotGrad;
          ctx.beginPath(); ctx.arc(dx, dy, 2.8, 0, Math.PI * 2); ctx.fill();
          // Tiny highlight
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(dx - 1, dy - 1, 0.8, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'polka-green', name: 'Emerald Dots', color: '#86efac', bgColor: '#bbf7d0',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w * 0.5, h);
      grad.addColorStop(0, '#ecfdf5'); grad.addColorStop(0.5, '#d1fae5'); grad.addColorStop(1, '#bbf7d0');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      for (let x = 5; x < w; x += 10) {
        for (let y = 5; y < h; y += 10) {
          // Shadow
          ctx.globalAlpha = 0.06;
          ctx.fillStyle = '#064e3b';
          ctx.beginPath(); ctx.arc(x + 0.4, y + 0.6, 2.5, 0, Math.PI * 2); ctx.fill();
          // Dot gradient
          ctx.globalAlpha = 0.8;
          const dg = ctx.createRadialGradient(x - 0.5, y - 0.5, 0.3, x, y, 2.5);
          dg.addColorStop(0, '#86efac'); dg.addColorStop(0.7, '#4ade80'); dg.addColorStop(1, '#22c55e');
          ctx.fillStyle = dg;
          ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
          // Highlight
          ctx.globalAlpha = 0.45;
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(x - 0.7, y - 0.7, 0.6, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'floral-pink', name: 'Cherry Blossom', color: '#f9a8d4', bgColor: '#fce7f3',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#fdf2f8'); grad.addColorStop(0.5, '#fce7f3'); grad.addColorStop(1, '#fbcfe8');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      for (let x = 8; x < w; x += 18) {
        for (let y = 7; y < h; y += 16) {
          const ox = Math.floor(y / 16) % 2 ? 9 : 0;
          const fx = x + ox, fy = y;
          // Flower shadow
          ctx.globalAlpha = 0.05;
          ctx.fillStyle = '#831843';
          ctx.beginPath(); ctx.arc(fx + 0.5, fy + 1, 5, 0, Math.PI * 2); ctx.fill();
          // Petals with gradient
          for (let a = 0; a < 5; a++) {
            const ang = (a / 5) * Math.PI * 2 - Math.PI / 2;
            const px = fx + Math.cos(ang) * 3.5, py = fy + Math.sin(ang) * 3.5;
            ctx.globalAlpha = 0.75;
            const pg = ctx.createRadialGradient(px, py, 0, px, py, 2.5);
            pg.addColorStop(0, '#fce7f3'); pg.addColorStop(0.5, '#f9a8d4'); pg.addColorStop(1, '#ec4899');
            ctx.fillStyle = pg;
            ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill();
          }
          // Center with golden gradient
          ctx.globalAlpha = 0.9;
          const cg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 2);
          cg.addColorStop(0, '#fef3c7'); cg.addColorStop(0.6, '#fbbf24'); cg.addColorStop(1, '#f59e0b');
          ctx.fillStyle = cg;
          ctx.beginPath(); ctx.arc(fx, fy, 1.8, 0, Math.PI * 2); ctx.fill();
          // Center highlight
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(fx - 0.4, fy - 0.4, 0.5, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'checker-purple', name: 'Royal Checker', color: '#c084fc', bgColor: '#e9d5ff',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#f5f3ff'); grad.addColorStop(0.5, '#ede9fe'); grad.addColorStop(1, '#ddd6fe');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      const s = 7;
      for (let x = 0; x < w; x += s) {
        for (let y = 0; y < h; y += s) {
          if ((Math.floor(x / s) + Math.floor(y / s)) % 2 === 0) {
            const cg = ctx.createLinearGradient(x, y, x + s, y + s);
            cg.addColorStop(0, '#c4b5fd'); cg.addColorStop(1, '#a78bfa');
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = cg;
            ctx.fillRect(x, y, s, s);
          }
        }
      }
      ctx.globalAlpha = 1;
      // Glass overlay
      const glass = ctx.createLinearGradient(0, 0, 0, h * 0.4);
      glass.addColorStop(0, 'rgba(255,255,255,0.15)'); glass.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glass; ctx.fillRect(0, 0, w, h * 0.4);
    },
  },
  {
    id: 'galaxy', name: 'Galaxy', color: '#6366f1', bgColor: '#312e81',
    draw: (ctx, w, h) => {
      // Deep space gradient
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#0f0a2e'); grad.addColorStop(0.25, '#1e1b4b');
      grad.addColorStop(0.5, '#312e81'); grad.addColorStop(0.75, '#3730a3');
      grad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      // Nebula clouds
      ctx.globalAlpha = 0.15;
      for (let i = 0; i < 6; i++) {
        const nx = Math.random() * w, ny = Math.random() * h, nr = 8 + Math.random() * 15;
        const nebula = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
        const colors = ['#a78bfa', '#c084fc', '#818cf8', '#f472b6', '#38bdf8'];
        nebula.addColorStop(0, colors[i % colors.length]); nebula.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = nebula; ctx.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
      }
      // Stars - bright
      for (let i = 0; i < Math.min(w * h * 0.008, 120); i++) {
        const sx = Math.random() * w, sy = Math.random() * h;
        const sr = 0.3 + Math.random() * 1.2;
        ctx.globalAlpha = 0.5 + Math.random() * 0.5;
        const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
        sg.addColorStop(0, '#ffffff'); sg.addColorStop(0.4, '#e0e7ff'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
      }
      // Star cross flares on bright stars
      ctx.globalAlpha = 0.35; ctx.strokeStyle = '#e0e7ff'; ctx.lineWidth = 0.4;
      for (let i = 0; i < 8; i++) {
        const fx = Math.random() * w, fy = Math.random() * h, fl = 2 + Math.random() * 4;
        ctx.beginPath(); ctx.moveTo(fx - fl, fy); ctx.lineTo(fx + fl, fy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(fx, fy - fl); ctx.lineTo(fx, fy + fl); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Top shimmer
      const shimmer = ctx.createLinearGradient(0, 0, w * 0.6, h * 0.3);
      shimmer.addColorStop(0, 'rgba(139,92,246,0.12)'); shimmer.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shimmer; ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'watercolor-splash', name: 'Watercolor Splash', color: '#67e8f9', bgColor: '#ecfeff',
    draw: (ctx, w, h) => {
      // Soft paper base
      const base = ctx.createLinearGradient(0, 0, w, h);
      base.addColorStop(0, '#f0fdfa'); base.addColorStop(0.5, '#ecfeff'); base.addColorStop(1, '#f0f9ff');
      ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
      // Paper grain texture
      ctx.globalAlpha = 0.04;
      for (let i = 0; i < w * h * 0.015; i++) {
        const gx = Math.random() * w, gy = Math.random() * h;
        ctx.fillStyle = '#334155';
        ctx.fillRect(gx, gy, 1, 1);
      }
      // Watercolor blobs
      const splashColors = [
        { c: '#22d3ee', a: 0.25 }, { c: '#a78bfa', a: 0.2 },
        { c: '#fb923c', a: 0.18 }, { c: '#34d399', a: 0.22 },
        { c: '#f472b6', a: 0.2 }, { c: '#60a5fa', a: 0.18 },
      ];
      for (const splash of splashColors) {
        const bx = Math.random() * w, by = Math.random() * h;
        const br = 6 + Math.random() * 12;
        ctx.globalAlpha = splash.a;
        const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        bg.addColorStop(0, splash.c); bg.addColorStop(0.6, splash.c + '88');
        bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
        // Feathered edges
        ctx.globalAlpha = splash.a * 0.4;
        for (let d = 0; d < 4; d++) {
          const dx = bx + (Math.random() - 0.5) * br * 1.5;
          const dy = by + (Math.random() - 0.5) * br * 1.2;
          const dr = 2 + Math.random() * 5;
          const dg = ctx.createRadialGradient(dx, dy, 0, dx, dy, dr);
          dg.addColorStop(0, splash.c + 'aa'); dg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = dg;
          ctx.beginPath(); ctx.arc(dx, dy, dr, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      // Wet edge shimmer
      const shine = ctx.createLinearGradient(0, 0, 0, h * 0.35);
      shine.addColorStop(0, 'rgba(255,255,255,0.15)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine; ctx.fillRect(0, 0, w, h * 0.35);
    },
  },
  {
    id: 'gold-foil', name: 'Gold Foil', color: '#fbbf24', bgColor: '#fef3c7',
    draw: (ctx, w, h) => {
      // Luxurious gold base
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#fef9c3'); grad.addColorStop(0.2, '#fde68a');
      grad.addColorStop(0.4, '#fbbf24'); grad.addColorStop(0.6, '#f59e0b');
      grad.addColorStop(0.8, '#fbbf24'); grad.addColorStop(1, '#fde68a');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      // Metallic striations
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#92400e'; ctx.lineWidth = 0.3;
      for (let i = 0; i < 40; i++) {
        const sy = Math.random() * h;
        ctx.beginPath(); ctx.moveTo(0, sy);
        ctx.bezierCurveTo(w * 0.3, sy + (Math.random() - 0.5) * 3, w * 0.7, sy + (Math.random() - 0.5) * 3, w, sy);
        ctx.stroke();
      }
      // Foil crinkle texture
      ctx.globalAlpha = 0.06;
      for (let i = 0; i < w * h * 0.01; i++) {
        const cx = Math.random() * w, cy = Math.random() * h;
        const cl = 1 + Math.random() * 4; const ca = Math.random() * Math.PI;
        ctx.strokeStyle = Math.random() > 0.5 ? '#ffffff' : '#78350f';
        ctx.lineWidth = 0.3;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ca) * cl, cy + Math.sin(ca) * cl); ctx.stroke();
      }
      // Bright specular highlights
      ctx.globalAlpha = 0.25;
      for (let i = 0; i < 10; i++) {
        const hx = Math.random() * w, hy = Math.random() * h, hr = 1 + Math.random() * 4;
        const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
        hg.addColorStop(0, '#ffffff'); hg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Top glass reflection
      const glass = ctx.createLinearGradient(0, 0, w * 0.8, h * 0.3);
      glass.addColorStop(0, 'rgba(255,255,255,0.3)'); glass.addColorStop(0.5, 'rgba(255,255,255,0.08)');
      glass.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glass; ctx.fillRect(0, 0, w, h * 0.4);
    },
  },
  {
    id: 'sakura-leaves', name: 'Sakura Leaves', color: '#fda4af', bgColor: '#fff1f2',
    draw: (ctx, w, h) => {
      // Soft spring gradient
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#fff1f2'); grad.addColorStop(0.4, '#ffe4e6');
      grad.addColorStop(0.7, '#fecdd3'); grad.addColorStop(1, '#fff1f2');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      // Falling sakura petals
      for (let i = 0; i < Math.min(w * h * 0.004, 50); i++) {
        const px = Math.random() * w, py = Math.random() * h;
        const angle = Math.random() * Math.PI * 2;
        const size = 2 + Math.random() * 3;
        ctx.save(); ctx.translate(px, py); ctx.rotate(angle);
        // Petal shape
        ctx.globalAlpha = 0.5 + Math.random() * 0.3;
        const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
        pg.addColorStop(0, '#fecdd3'); pg.addColorStop(0.5, '#fda4af'); pg.addColorStop(1, '#fb7185');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.bezierCurveTo(size * 0.8, -size * 0.6, size * 0.8, size * 0.6, 0, size * 0.5);
        ctx.bezierCurveTo(-size * 0.8, size * 0.6, -size * 0.8, -size * 0.6, 0, -size);
        ctx.fill();
        // Petal highlight
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(-size * 0.2, -size * 0.3, size * 0.25, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // Small leaf veins on some petals
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = '#9f1239'; ctx.lineWidth = 0.3;
      for (let i = 0; i < 15; i++) {
        const lx = Math.random() * w, ly = Math.random() * h;
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + (Math.random() - 0.5) * 4, ly + 3); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Gentle top light
      const light = ctx.createLinearGradient(0, 0, 0, h * 0.3);
      light.addColorStop(0, 'rgba(255,255,255,0.18)'); light.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = light; ctx.fillRect(0, 0, w, h * 0.3);
    },
  },
  {
    id: 'rainbow-gradient', name: 'Rainbow Gradient', color: '#f472b6', bgColor: '#fdf2f8',
    draw: (ctx, w, h) => {
      // Full rainbow gradient across the width
      const rainbow = ctx.createLinearGradient(0, 0, w, 0);
      rainbow.addColorStop(0, '#ef4444');     // Red
      rainbow.addColorStop(0.17, '#f97316');  // Orange
      rainbow.addColorStop(0.33, '#eab308');  // Yellow
      rainbow.addColorStop(0.5, '#22c55e');   // Green
      rainbow.addColorStop(0.67, '#3b82f6');  // Blue
      rainbow.addColorStop(0.83, '#8b5cf6');  // Indigo
      rainbow.addColorStop(1, '#ec4899');     // Pink
      ctx.fillStyle = rainbow; ctx.fillRect(0, 0, w, h);
      // Soft white overlay for tape look
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      // Fiber texture
      ctx.globalAlpha = 0.05;
      for (let i = 0; i < w * h * 0.012; i++) {
        const fx = Math.random() * w, fy = Math.random() * h;
        const fl = 2 + Math.random() * 5; const fa = Math.random() * Math.PI;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.4;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + Math.cos(fa) * fl, fy + Math.sin(fa) * fl); ctx.stroke();
      }
      // Vertical shimmer bands
      ctx.globalAlpha = 0.08;
      for (let x = 0; x < w; x += 12) {
        const band = ctx.createLinearGradient(x, 0, x + 6, 0);
        band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(0.5, 'rgba(255,255,255,0.3)');
        band.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = band; ctx.fillRect(x, 0, 6, h);
      }
      ctx.globalAlpha = 1;
      // Glass top reflection
      const glass = ctx.createLinearGradient(0, 0, 0, h * 0.35);
      glass.addColorStop(0, 'rgba(255,255,255,0.22)'); glass.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glass; ctx.fillRect(0, 0, w, h * 0.35);
    },
  },
  {
    id: 'polka-red', name: 'Red Polka', color: '#ef4444', bgColor: '#dc2626',
    draw: (ctx, w, h) => {
      // Solid red base
      ctx.fillStyle = '#dc2626'; ctx.fillRect(0, 0, w, h);
      // Subtle gradient
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(0.5, 'rgba(0,0,0,0.05)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      // White polka dots
      for (let x = 5; x < w; x += 10) {
        for (let y = 5; y < h; y += 10) {
          const ox = Math.floor(y / 10) % 2 ? 5 : 0;
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(x + ox, y, 2.2, 0, Math.PI * 2); ctx.fill();
          // Tiny highlight
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(x + ox - 0.6, y - 0.6, 0.7, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      // Top shine
      const shine = ctx.createLinearGradient(0, 0, 0, h * 0.3);
      shine.addColorStop(0, 'rgba(255,255,255,0.12)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine; ctx.fillRect(0, 0, w, h * 0.3);
    },
  },
  {
    id: 'stripes-red-diag', name: 'Red Diagonal', color: '#ef4444', bgColor: '#dc2626',
    draw: (ctx, w, h) => {
      // Solid red base
      ctx.fillStyle = '#dc2626'; ctx.fillRect(0, 0, w, h);
      // Diagonal stripes
      ctx.strokeStyle = '#b91c1c'; ctx.lineWidth = 2.5; ctx.lineCap = 'butt';
      ctx.globalAlpha = 0.5;
      for (let x = -h * 2; x < w + h * 2; x += 7) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Lighter stripe accents
      ctx.strokeStyle = '#fca5a5'; ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.2;
      for (let x = -h * 2; x < w + h * 2; x += 7) {
        ctx.beginPath(); ctx.moveTo(x + 1, 0); ctx.lineTo(x + h + 1, h); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Top shine
      const shine = ctx.createLinearGradient(0, 0, 0, h * 0.25);
      shine.addColorStop(0, 'rgba(255,255,255,0.1)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine; ctx.fillRect(0, 0, w, h * 0.25);
    },
  },
  {
    id: 'grid-red', name: 'Red Grid', color: '#ef4444', bgColor: '#dc2626',
    draw: (ctx, w, h) => {
      // Solid red base
      ctx.fillStyle = '#dc2626'; ctx.fillRect(0, 0, w, h);
      // Crosshatch grid pattern
      const spacing = 6;
      ctx.strokeStyle = '#b91c1c'; ctx.lineWidth = 1.8; ctx.lineCap = 'butt';
      ctx.globalAlpha = 0.5;
      // Horizontal lines
      for (let y = 0; y < h; y += spacing) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      // Vertical lines
      for (let x = 0; x < w; x += spacing) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Subtle inner glow at intersections
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#ffffff';
      for (let x = 0; x < w; x += spacing) {
        for (let y = 0; y < h; y += spacing) {
          ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      // Top shine
      const shine = ctx.createLinearGradient(0, 0, 0, h * 0.25);
      shine.addColorStop(0, 'rgba(255,255,255,0.1)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine; ctx.fillRect(0, 0, w, h * 0.25);
    },
  },
  {
    id: 'polka-blue', name: 'Blue Polka', color: '#3b82f6', bgColor: '#2563eb',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#3b82f6'); grad.addColorStop(0.5, '#2563eb'); grad.addColorStop(1, '#1d4ed8');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      for (let x = 6; x < w; x += 12) {
        for (let y = 4; y < h; y += 12) {
          const ox = Math.floor(y / 12) % 2 ? 6 : 0;
          const dx = x + ox, dy = y;
          ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(dx, dy, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.4; ctx.fillStyle = '#bfdbfe';
          ctx.beginPath(); ctx.arc(dx - 0.6, dy - 0.6, 0.7, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      const shine = ctx.createLinearGradient(0, 0, 0, h * 0.25);
      shine.addColorStop(0, 'rgba(255,255,255,0.15)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine; ctx.fillRect(0, 0, w, h * 0.25);
    },
  },
  {
    id: 'stripes-green-diag', name: 'Green Diagonal', color: '#22c55e', bgColor: '#16a34a',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#22c55e'); grad.addColorStop(0.5, '#16a34a'); grad.addColorStop(1, '#15803d');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      ctx.lineCap = 'round'; ctx.lineWidth = 3;
      for (let x = -h * 2; x < w + h * 2; x += 8) {
        ctx.strokeStyle = '#15803d'; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const shine = ctx.createLinearGradient(0, 0, 0, h * 0.25);
      shine.addColorStop(0, 'rgba(255,255,255,0.15)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine; ctx.fillRect(0, 0, w, h * 0.25);
    },
  },
  {
    id: 'grid-purple', name: 'Purple Grid', color: '#a855f7', bgColor: '#9333ea',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#a855f7'); grad.addColorStop(0.5, '#9333ea'); grad.addColorStop(1, '#7e22ce');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      const spacing = 6;
      ctx.strokeStyle = '#7e22ce'; ctx.lineWidth = 1.8;
      ctx.globalAlpha = 0.5;
      for (let y = 0; y < h; y += spacing) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      for (let x = 0; x < w; x += spacing) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      ctx.globalAlpha = 0.08; ctx.fillStyle = '#ffffff';
      for (let x = 0; x < w; x += spacing) {
        for (let y = 0; y < h; y += spacing) {
          ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      const shine = ctx.createLinearGradient(0, 0, 0, h * 0.25);
      shine.addColorStop(0, 'rgba(255,255,255,0.12)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine; ctx.fillRect(0, 0, w, h * 0.25);
    },
  },
  {
    id: 'chevron-yellow', name: 'Yellow Chevron', color: '#eab308', bgColor: '#ca8a04',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#fef08a'); grad.addColorStop(0.5, '#facc15'); grad.addColorStop(1, '#eab308');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      // Chevron pattern
      ctx.strokeStyle = '#a16207'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.45;
      const cw = 10, ch = 6;
      for (let x = -cw; x < w + cw; x += cw) {
        for (let y = -ch; y < h + ch; y += ch * 2) {
          const oy = (Math.floor(x / cw) % 2) * ch;
          ctx.beginPath();
          ctx.moveTo(x, y + oy);
          ctx.lineTo(x + cw / 2, y + ch + oy);
          ctx.lineTo(x + cw, y + oy);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 0.2; ctx.strokeStyle = '#fef9c3'; ctx.lineWidth = 0.8;
      for (let x = -cw; x < w + cw; x += cw) {
        for (let y = -ch; y < h + ch; y += ch * 2) {
          const oy = (Math.floor(x / cw) % 2) * ch;
          ctx.beginPath();
          ctx.moveTo(x + 1, y + oy + 1);
          ctx.lineTo(x + cw / 2 + 1, y + ch + oy + 1);
          ctx.lineTo(x + cw + 1, y + oy + 1);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      const shine = ctx.createLinearGradient(0, 0, 0, h * 0.25);
      shine.addColorStop(0, 'rgba(255,255,255,0.15)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine; ctx.fillRect(0, 0, w, h * 0.25);
    },
  },
  {
    id: 'waves-teal', name: 'Teal Waves', color: '#14b8a6', bgColor: '#0d9488',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#5eead4'); grad.addColorStop(0.5, '#14b8a6'); grad.addColorStop(1, '#0d9488');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      // Wave pattern
      ctx.strokeStyle = '#0f766e'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.globalAlpha = 0.5;
      const waveH = 4, waveW = 14;
      for (let y = 3; y < h + waveH; y += waveH * 2) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 1) {
          const yy = y + Math.sin((x / waveW) * Math.PI * 2) * waveH;
          if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      // Lighter wave accent
      ctx.strokeStyle = '#99f6e4'; ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.3;
      for (let y = 3 + waveH; y < h + waveH; y += waveH * 2) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 1) {
          const yy = y + Math.sin((x / waveW) * Math.PI * 2 + Math.PI * 0.5) * (waveH * 0.6);
          if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const shine = ctx.createLinearGradient(0, 0, 0, h * 0.25);
      shine.addColorStop(0, 'rgba(255,255,255,0.15)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine; ctx.fillRect(0, 0, w, h * 0.25);
    },
  },
  {
    id: 'zigzag-orange', name: 'Orange Zigzag', color: '#f97316', bgColor: '#ea580c',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#fdba74'); grad.addColorStop(0.5, '#f97316'); grad.addColorStop(1, '#ea580c');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      // Zigzag pattern
      ctx.strokeStyle = '#9a3412'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.45;
      const zw = 8, zh = 5;
      for (let y = zh; y < h; y += zh * 2.5) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x < w + zw; x += zw) {
          const peak = (Math.floor(x / zw) % 2 === 0) ? y - zh : y + zh;
          ctx.lineTo(x, peak);
        }
        ctx.stroke();
      }
      // Lighter zigzag accent
      ctx.strokeStyle = '#fed7aa'; ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.25;
      for (let y = zh; y < h; y += zh * 2.5) {
        ctx.beginPath();
        ctx.moveTo(1, y + 1);
        for (let x = 0; x < w + zw; x += zw) {
          const peak = (Math.floor(x / zw) % 2 === 0) ? y - zh + 1 : y + zh + 1;
          ctx.lineTo(x + 1, peak);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const shine = ctx.createLinearGradient(0, 0, 0, h * 0.25);
      shine.addColorStop(0, 'rgba(255,255,255,0.15)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine; ctx.fillRect(0, 0, w, h * 0.25);
    },
  },
];

// Cache for washi tape pattern canvases to avoid re-creating every frame
const washiPatternCache = new Map<string, CanvasPattern | HTMLCanvasElement>();

const drawTornEdge = (ctx: CanvasRenderingContext2D, x: number, y: number, height: number, direction: 1 | -1) => {
  ctx.beginPath();
  ctx.moveTo(x, y);
  const steps = Math.ceil(height / 4);
  for (let i = 0; i <= steps; i++) {
    const py = y + (i / steps) * height;
    const px = x + direction * (Math.random() * 4 + 1);
    ctx.lineTo(px, py);
  }
  ctx.lineTo(x, y + height);
};

const drawWashiTape = (ctx: CanvasRenderingContext2D, tape: WashiTapeData, zoom: number, isSelected: boolean) => {
  const pattern = WASHI_PATTERNS.find(p => p.id === tape.patternId) || WASHI_PATTERNS[0];
  ctx.save();
  const cx = tape.x + tape.width / 2;
  const cy = tape.y + tape.height / 2;
  ctx.translate(cx, cy);
  ctx.rotate(tape.rotation);
  ctx.translate(-tape.width / 2, -tape.height / 2);

  // Shadow layer
  ctx.globalAlpha = 0.1;
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#000';
  ctx.fillRect(-1, -1, tape.width + 2, tape.height + 2);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

  // Cached HD pattern
  const legacyCacheKey = `legacy_${pattern.id}_${Math.round(tape.width)}_${Math.round(tape.height)}`;
  let cachedLegacy = washiPatternCache.get(legacyCacheKey) as any;
  if (!cachedLegacy) {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = Math.max(4, Math.round(tape.width * 2));
    offCanvas.height = Math.max(4, Math.round(tape.height * 2));
    const offCtx = offCanvas.getContext('2d')!;
    offCtx.scale(2, 2);
    pattern.draw(offCtx, tape.width, tape.height);
    (washiPatternCache as any).set(legacyCacheKey, offCanvas);
    cachedLegacy = offCanvas;
  }

  // Torn edge clipping
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(tape.width, 0);
  const rSteps = Math.ceil(tape.height / 5);
  for (let i = 0; i <= rSteps; i++) {
    const py = (i / rSteps) * tape.height;
    const px = tape.width + (((i * 7 + 3) % 5) - 2) * 1.2;
    ctx.lineTo(px, py);
  }
  ctx.lineTo(0, tape.height);
  for (let i = rSteps; i >= 0; i--) {
    const py = (i / rSteps) * tape.height;
    const px = (((i * 11 + 2) % 5) - 2) * 1.2;
    ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.clip();

  ctx.globalAlpha = tape.opacity;
  ctx.drawImage(cachedLegacy, 0, 0, tape.width, tape.height);

  // Top glossy highlight
  ctx.globalAlpha = 0.12;
  const gloss = ctx.createLinearGradient(0, 0, 0, tape.height * 0.35);
  gloss.addColorStop(0, 'rgba(255,255,255,0.5)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(0, 0, tape.width, tape.height * 0.35);

  ctx.restore();

  // Selection UI
  if (isSelected) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'hsl(210 100% 50%)';
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.strokeRect(-2 / zoom, -2 / zoom, tape.width + 4 / zoom, tape.height + 4 / zoom);
    ctx.setLineDash([]);
    const hs = 6 / zoom;
    const handles = [
      [0, 0], [tape.width, 0], [0, tape.height], [tape.width, tape.height],
    ];
    for (const [hx, hy] of handles) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'hsl(210 100% 50%)';
      ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath(); ctx.arc(hx, hy, hs, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    const rotX = tape.width / 2;
    const rotY = -20 / zoom;
    ctx.beginPath(); ctx.moveTo(tape.width / 2, 0); ctx.lineTo(rotX, rotY); ctx.strokeStyle = 'hsl(210 100% 50%)'; ctx.lineWidth = 1 / zoom; ctx.stroke();
    ctx.beginPath(); ctx.arc(rotX, rotY, hs * 0.7, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = 'hsl(210 100% 50%)'; ctx.lineWidth = 1.5 / zoom; ctx.stroke();
  }

  ctx.restore();
};

const TEXT_FONTS = [
  { id: 'sans-serif', label: 'Sans Serif' },
  { id: 'serif', label: 'Serif' },
  { id: 'monospace', label: 'Mono' },
  { id: 'cursive', label: 'Cursive' },
  { id: '"Georgia", serif', label: 'Georgia' },
];

const createDefaultLayers = (): Layer[] => [
  { id: 1, name: 'Layer 1', strokes: [], textAnnotations: [], stickyNotes: [], images: [], washiTapes: [], opacity: 1, visible: true },
  { id: 2, name: 'Layer 2', strokes: [], textAnnotations: [], stickyNotes: [], images: [], washiTapes: [], opacity: 1, visible: true },
  { id: 3, name: 'Layer 3', strokes: [], textAnnotations: [], stickyNotes: [], images: [], washiTapes: [], opacity: 1, visible: true },
];

// --- Shape Recognition ---

type RecognizedShape = 
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'rect'; x: number; y: number; w: number; h: number }
  | { type: 'circle'; cx: number; cy: number; rx: number; ry: number }
  | { type: 'triangle'; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number }
  | null;

const recognizeShape = (points: Point[]): RecognizedShape => {
  if (points.length < 5) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const totalLen = getTotalLength(points);
  if (totalLen < 20) return null;

  // Check if the path is closed (first ~= last)
  const closeDist = Math.sqrt((first.x - last.x) ** 2 + (first.y - last.y) ** 2);
  const isClosed = closeDist < totalLen * 0.15;

  // --- Line detection ---
  if (!isClosed) {
    const lineErr = getLineDeviation(points, first, last);
    const segLen = Math.sqrt((last.x - first.x) ** 2 + (last.y - first.y) ** 2);
    if (segLen > 20 && lineErr < 0.06) {
      return { type: 'line', x1: first.x, y1: first.y, x2: last.x, y2: last.y };
    }
  }

  if (!isClosed) return null;

  // Compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const bw = maxX - minX;
  const bh = maxY - minY;
  if (bw < 15 || bh < 15) return null;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = bw / 2;
  const ry = bh / 2;

  // --- Circle/Ellipse detection ---
  // Check how well points fit an ellipse
  let circleErr = 0;
  for (const p of points) {
    const nx = (p.x - cx) / rx;
    const ny = (p.y - cy) / ry;
    const d = Math.sqrt(nx * nx + ny * ny);
    circleErr += (d - 1) ** 2;
  }
  circleErr = Math.sqrt(circleErr / points.length);
  if (circleErr < 0.25) {
    return { type: 'circle', cx, cy, rx, ry };
  }

  // --- Corner detection for rectangle/triangle ---
  const corners = detectCorners(points, totalLen);

  // Rectangle: ~4 corners, roughly right angles
  if (corners.length >= 4 && corners.length <= 6) {
    // Pick the 4 most prominent corners
    const top4 = corners.slice(0, 4);
    // Check if they form a roughly rectangular shape
    const rectErr = getRectangleFit(top4, minX, minY, maxX, maxY);
    if (rectErr < 0.2) {
      return { type: 'rect', x: minX, y: minY, w: bw, h: bh };
    }
  }

  // Triangle: ~3 corners
  if (corners.length >= 3 && corners.length <= 5) {
    const top3 = corners.slice(0, 3);
    const triArea = Math.abs(
      (top3[1].x - top3[0].x) * (top3[2].y - top3[0].y) -
      (top3[2].x - top3[0].x) * (top3[1].y - top3[0].y)
    ) / 2;
    const bboxArea = bw * bh;
    // A triangle's area should be roughly half the bbox area
    if (triArea > bboxArea * 0.25 && triArea < bboxArea * 0.7) {
      return {
        type: 'triangle',
        x1: top3[0].x, y1: top3[0].y,
        x2: top3[1].x, y2: top3[1].y,
        x3: top3[2].x, y3: top3[2].y,
      };
    }
  }

  return null;
};

const getTotalLength = (points: Point[]): number => {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.sqrt((points[i].x - points[i - 1].x) ** 2 + (points[i].y - points[i - 1].y) ** 2);
  }
  return len;
};

const getLineDeviation = (points: Point[], a: Point, b: Point): number => {
  const segLen = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  if (segLen === 0) return 1;
  let maxDev = 0;
  for (const p of points) {
    const d = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x) / segLen;
    if (d > maxDev) maxDev = d;
  }
  return maxDev / segLen;
};

const detectCorners = (points: Point[], totalLen: number): Point[] => {
  // Sample points at regular intervals, compute angle changes
  const step = Math.max(1, Math.floor(points.length / 40));
  const windowSize = Math.max(3, Math.floor(points.length / 15));
  const angles: { idx: number; angle: number }[] = [];

  for (let i = windowSize; i < points.length - windowSize; i += step) {
    const before = points[Math.max(0, i - windowSize)];
    const at = points[i];
    const after = points[Math.min(points.length - 1, i + windowSize)];
    const a1 = Math.atan2(at.y - before.y, at.x - before.x);
    const a2 = Math.atan2(after.y - at.y, after.x - at.x);
    let diff = Math.abs(a2 - a1);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    angles.push({ idx: i, angle: diff });
  }

  // Sort by angle change (largest = sharpest corners)
  angles.sort((a, b) => b.angle - a.angle);

  // Filter: must be significant angle change, and not too close to each other
  const minDist = points.length * 0.1;
  const corners: Point[] = [];
  for (const a of angles) {
    if (a.angle < 0.4) break; // ~23 degrees minimum
    const p = points[a.idx];
    const tooClose = corners.some(c => Math.sqrt((c.x - p.x) ** 2 + (c.y - p.y) ** 2) < totalLen * 0.08);
    if (!tooClose) {
      corners.push(p);
      if (corners.length >= 6) break;
    }
  }
  return corners;
};

const getRectangleFit = (corners: Point[], minX: number, minY: number, maxX: number, maxY: number): number => {
  // Check how close the 4 corners are to the bounding box corners
  const bboxCorners = [
    { x: minX, y: minY }, { x: maxX, y: minY },
    { x: maxX, y: maxY }, { x: minX, y: maxY },
  ];
  const bw = maxX - minX;
  const bh = maxY - minY;
  const diag = Math.sqrt(bw * bw + bh * bh);
  if (diag === 0) return 1;

  let totalErr = 0;
  const used = new Set<number>();
  for (const bc of bboxCorners) {
    let bestDist = Infinity;
    let bestIdx = -1;
    for (let i = 0; i < corners.length; i++) {
      if (used.has(i)) continue;
      const d = Math.sqrt((corners[i].x - bc.x) ** 2 + (corners[i].y - bc.y) ** 2);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    if (bestIdx >= 0) {
      used.add(bestIdx);
      totalErr += bestDist;
    } else {
      totalErr += diag;
    }
  }
  return totalErr / diag;
};

const convertToCleanShape = (stroke: Stroke, shape: RecognizedShape): Stroke | null => {
  if (!shape) return null;
  const pressure = 0.5;
  switch (shape.type) {
    case 'line':
      return {
        ...stroke,
        tool: 'line',
        points: [
          { x: shape.x1, y: shape.y1, pressure },
          { x: shape.x2, y: shape.y2, pressure },
        ],
      };
    case 'rect':
      return {
        ...stroke,
        tool: 'rect',
        points: [
          { x: shape.x, y: shape.y, pressure },
          { x: shape.x + shape.w, y: shape.y + shape.h, pressure },
        ],
      };
    case 'circle':
      return {
        ...stroke,
        tool: 'circle',
        points: [
          { x: shape.cx - shape.rx, y: shape.cy - shape.ry, pressure },
          { x: shape.cx + shape.rx, y: shape.cy + shape.ry, pressure },
        ],
      };
    case 'triangle': {
      // Use bounding box approach: top-center to bottom corners
      const minX = Math.min(shape.x1, shape.x2, shape.x3);
      const maxX = Math.max(shape.x1, shape.x2, shape.x3);
      const minY = Math.min(shape.y1, shape.y2, shape.y3);
      const maxY = Math.max(shape.y1, shape.y2, shape.y3);
      return {
        ...stroke,
        tool: 'triangle',
        points: [
          { x: minX, y: minY, pressure },
          { x: maxX, y: maxY, pressure },
        ],
      };
    }
  }
};

// --- Helpers ---

const seededRandom = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const hslToHex = (h: number, s: number, l: number): string => {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * Math.max(0, Math.min(1, color)))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

const hexToHsl = (hex: string): [number, number, number] => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [h, s, l];
};

// --- Selection helpers ---

const getStrokeBBox = (stroke: Stroke): BBox => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of stroke.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const pad = stroke.width * 2;
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
};

const getSelectionBBox = (strokes: Stroke[]): BBox | null => {
  if (strokes.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) {
    const b = getStrokeBBox(s);
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
    if (b.y + b.h > maxY) maxY = b.y + b.h;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
};

const distToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2);
};

const hitTestStroke = (stroke: Stroke, px: number, py: number, tolerance: number): boolean => {
  if (stroke.tool === 'eraser') return false;
  // Quick bbox check
  const bbox = getStrokeBBox(stroke);
  if (px < bbox.x - tolerance || px > bbox.x + bbox.w + tolerance ||
      py < bbox.y - tolerance || py > bbox.y + bbox.h + tolerance) return false;

  for (let i = 0; i < stroke.points.length - 1; i++) {
    const a = stroke.points[i], b = stroke.points[i + 1];
    if (distToSegment(px, py, a.x, a.y, b.x, b.y) < tolerance + stroke.width) return true;
  }
  // Single point
  if (stroke.points.length === 1) {
    const p = stroke.points[0];
    return Math.sqrt((px - p.x) ** 2 + (py - p.y) ** 2) < tolerance + stroke.width;
  }
  return false;
};

const hitTestHandle = (px: number, py: number, bbox: BBox, zoom: number): HandleType | null => {
  const hs = HANDLE_SIZE / zoom;
  const corners: [number, number, HandleType][] = [
    [bbox.x, bbox.y, 'tl'],
    [bbox.x + bbox.w, bbox.y, 'tr'],
    [bbox.x, bbox.y + bbox.h, 'bl'],
    [bbox.x + bbox.w, bbox.y + bbox.h, 'br'],
  ];
  // Rotate handle above top center
  const rotX = bbox.x + bbox.w / 2;
  const rotY = bbox.y - 24 / zoom;
  if (Math.abs(px - rotX) < hs * 1.5 && Math.abs(py - rotY) < hs * 1.5) return 'rotate';

  for (const [cx, cy, type] of corners) {
    if (Math.abs(px - cx) < hs * 1.5 && Math.abs(py - cy) < hs * 1.5) return type;
  }
  // Body (inside bbox)
  if (px >= bbox.x && px <= bbox.x + bbox.w && py >= bbox.y && py <= bbox.y + bbox.h) return 'body';
  return null;
};

const transformStrokes = (
  strokes: Stroke[],
  origBBox: BBox,
  newBBox: BBox,
  rotation: number,
): Stroke[] => {
  const cx = origBBox.x + origBBox.w / 2;
  const cy = origBBox.y + origBBox.h / 2;
  const ncx = newBBox.x + newBBox.w / 2;
  const ncy = newBBox.y + newBBox.h / 2;
  const sx = origBBox.w > 0 ? newBBox.w / origBBox.w : 1;
  const sy = origBBox.h > 0 ? newBBox.h / origBBox.h : 1;
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);

  return strokes.map(s => ({
    ...s,
    points: s.points.map(p => {
      // Scale relative to original center
      let x = (p.x - cx) * sx;
      let y = (p.y - cy) * sy;
      // Rotate
      const rx = x * cosR - y * sinR;
      const ry = x * sinR + y * cosR;
      return { ...p, x: rx + ncx, y: ry + ncy };
    }),
  }));
};

const cloneStrokes = (strokes: Stroke[]): Stroke[] =>
  strokes.map(s => ({ ...s, points: s.points.map(p => ({ ...p })) }));

// --- Background drawing ---

const drawBackground = (
  ctx: CanvasRenderingContext2D, 
  x0: number, y0: number, x1: number, y1: number, 
  bg: BackgroundType,
  gridColor?: string,
  gridOpacity?: number
) => {
  ctx.save();
  const w = x1 - x0;
  const h = y1 - y0;

  if (bg === 'dark') {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x0, y0, w, h);
    ctx.restore();
    return;
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x0, y0, w, h);

  const gOpacity = gridOpacity ?? 0.45;
  const gColor = gridColor ?? '#8c8c8c';
  const lineColor = `${gColor}${Math.round(gOpacity * 255).toString(16).padStart(2, '0')}`;
  const dotColor = `${gColor}${Math.round(Math.min(1, gOpacity + 0.1) * 255).toString(16).padStart(2, '0')}`;

  // Helper: snap start to grid origin so lines tile seamlessly
  const gridStart = (origin: number, step: number) => Math.floor(origin / step) * step;

  switch (bg) {
    case 'plain': break;
    case 'grid-sm': {
      const s = 16;
      ctx.strokeStyle = lineColor; ctx.lineWidth = 0.5;
      for (let x = gridStart(x0, s); x <= x1; x += s) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
      for (let y = gridStart(y0, s); y <= y1; y += s) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
      break;
    }
    case 'grid-lg': {
      const s = 40;
      ctx.strokeStyle = lineColor; ctx.lineWidth = 0.5;
      for (let x = gridStart(x0, s); x <= x1; x += s) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
      for (let y = gridStart(y0, s); y <= y1; y += s) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
      break;
    }
    case 'dotted': {
      const s = 20;
      ctx.fillStyle = dotColor;
      for (let x = gridStart(x0, s); x <= x1; x += s) { for (let y = gridStart(y0, s); y <= y1; y += s) { ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill(); } }
      break;
    }
    case 'ruled': {
      const lineHeight = 28;
      ctx.strokeStyle = `${gColor}${Math.round(Math.min(1, gOpacity + 0.15) * 255).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = 0.7;
      const startY = gridStart(y0, lineHeight);
      for (let y = startY; y <= y1; y += lineHeight) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
      break;
    }
    case 'isometric': {
      ctx.strokeStyle = lineColor; ctx.lineWidth = 0.5;
      const size = 30; const rowH = size * Math.sin(Math.PI / 3);
      const startRow = Math.floor(y0 / rowH);
      const endRow = Math.ceil(y1 / rowH) + 1;
      for (let row = startRow; row <= endRow; row++) {
        const y = row * rowH; const offset = row % 2 === 0 ? 0 : size / 2;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
        const startX = Math.floor((x0 - size) / size) * size + offset;
        for (let x = startX; x <= x1 + size; x += size) {
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + size / 2, y + rowH); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - size / 2, y + rowH); ctx.stroke();
        }
      }
      break;
    }
    case 'dotted-grid': {
      // Dots at grid intersections with faint grid lines
      const s = 20;
      ctx.strokeStyle = `${gColor}${Math.round(gOpacity * 0.3 * 255).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = 0.3;
      for (let x = gridStart(x0, s); x <= x1; x += s) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
      for (let y = gridStart(y0, s); y <= y1; y += s) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
      ctx.fillStyle = dotColor;
      for (let x = gridStart(x0, s); x <= x1; x += s) { for (let y = gridStart(y0, s); y <= y1; y += s) { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); } }
      break;
    }
    case 'graph-sm': {
      // Fine graph paper with major/minor lines
      const minor = 8;
      const major = 40;
      ctx.strokeStyle = `${gColor}${Math.round(gOpacity * 0.25 * 255).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = 0.3;
      for (let x = gridStart(x0, minor); x <= x1; x += minor) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
      for (let y = gridStart(y0, minor); y <= y1; y += minor) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
      ctx.strokeStyle = `${gColor}${Math.round(gOpacity * 0.6 * 255).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = 0.6;
      for (let x = gridStart(x0, major); x <= x1; x += major) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
      for (let y = gridStart(y0, major); y <= y1; y += major) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
      break;
    }
    case 'music-staff': {
      // 5-line staff groups with spacing between staves
      const lineGap = 10;
      const staffLines = 5;
      const staffHeight = lineGap * (staffLines - 1); // 40px per staff
      const staffSpacing = 36; // gap between staves
      const totalStaff = staffHeight + staffSpacing; // 76px per group
      ctx.strokeStyle = `${gColor}${Math.round(Math.min(1, gOpacity + 0.1) * 255).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = 0.8;
      const startStaff = Math.floor(y0 / totalStaff);
      const endStaff = Math.ceil(y1 / totalStaff) + 1;
      for (let s = startStaff; s <= endStaff; s++) {
        const baseY = s * totalStaff + staffSpacing / 2;
        for (let i = 0; i < staffLines; i++) {
          const ly = baseY + i * lineGap;
          if (ly >= y0 - 10 && ly <= y1 + 10) {
            ctx.beginPath(); ctx.moveTo(x0, ly); ctx.lineTo(x1, ly); ctx.stroke();
          }
        }
      }
      break;
    }
  }
  ctx.restore();
};

// --- HSL Color Wheel Canvas Component ---

const HSL_WHEEL_SIZE = 160;

const HslColorWheel = memo(({
  hue, saturation, lightness,
  onHueChange, onSatLightChange,
}: {
  hue: number; saturation: number; lightness: number;
  onHueChange: (h: number) => void;
  onSatLightChange: (s: number, l: number) => void;
}) => {
  const wheelRef = useRef<HTMLCanvasElement>(null);
  const slRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = wheelRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const size = HSL_WHEEL_SIZE;
    const cx = size / 2, cy = size / 2;
    const outerR = size / 2 - 2, innerR = outerR - 18;
    ctx.clearRect(0, 0, size, size);
    for (let angle = 0; angle < 360; angle++) {
      const rad1 = (angle - 0.5) * (Math.PI / 180);
      const rad2 = (angle + 0.5) * (Math.PI / 180);
      ctx.beginPath(); ctx.arc(cx, cy, outerR, rad1, rad2); ctx.arc(cx, cy, innerR, rad2, rad1, true); ctx.closePath();
      ctx.fillStyle = `hsl(${angle}, 100%, 50%)`; ctx.fill();
    }
    const hueRad = (hue - 90) * (Math.PI / 180);
    const midR = (outerR + innerR) / 2;
    const ix = cx + Math.cos(hueRad) * midR;
    const iy = cy + Math.sin(hueRad) * midR;
    ctx.beginPath(); ctx.arc(ix, iy, 7, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
  }, [hue]);

  useEffect(() => {
    const canvas = slRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const s = 90; canvas.width = s; canvas.height = s;
    const imgData = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const sat = x / s; const light = 1 - y / s;
        const hex = hslToHex(hue, sat, light);
        const r = parseInt(hex.slice(1, 3), 16); const g = parseInt(hex.slice(3, 5), 16); const b = parseInt(hex.slice(5, 7), 16);
        const idx = (y * s + x) * 4;
        imgData.data[idx] = r; imgData.data[idx + 1] = g; imgData.data[idx + 2] = b; imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const ix = saturation * s; const iy = (1 - lightness) * s;
    ctx.beginPath(); ctx.arc(ix, iy, 5, 0, Math.PI * 2);
    ctx.strokeStyle = lightness > 0.5 ? '#000' : '#fff'; ctx.lineWidth = 2; ctx.stroke();
  }, [hue, saturation, lightness]);

  const handleWheelPointer = (e: React.PointerEvent) => {
    const canvas = wheelRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    let angle = Math.atan2(e.clientY - rect.top - cy, e.clientX - rect.left - cx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    onHueChange(angle);
  };

  const handleSLPointer = (e: React.PointerEvent) => {
    const canvas = slRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    onSatLightChange(x, 1 - y);
  };

  const [draggingWheel, setDraggingWheel] = useState(false);
  const [draggingSL, setDraggingSL] = useState(false);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: HSL_WHEEL_SIZE, height: HSL_WHEEL_SIZE }}>
        <canvas ref={wheelRef} width={HSL_WHEEL_SIZE} height={HSL_WHEEL_SIZE} className="absolute inset-0 cursor-crosshair"
          onPointerDown={(e) => { setDraggingWheel(true); (e.target as HTMLElement).setPointerCapture(e.pointerId); handleWheelPointer(e); }}
          onPointerMove={(e) => draggingWheel && handleWheelPointer(e)}
          onPointerUp={() => setDraggingWheel(false)}
        />
        <canvas ref={slRef} width={90} height={90} className="absolute cursor-crosshair rounded-sm"
          style={{ left: (HSL_WHEEL_SIZE - 90) / 2, top: (HSL_WHEEL_SIZE - 90) / 2 }}
          onPointerDown={(e) => { setDraggingSL(true); (e.target as HTMLElement).setPointerCapture(e.pointerId); handleSLPointer(e); }}
          onPointerMove={(e) => draggingSL && handleSLPointer(e)}
          onPointerUp={() => setDraggingSL(false)}
        />
      </div>
    </div>
  );
});
HslColorWheel.displayName = 'HslColorWheel';

// --- Drawing helpers ---

const drawArrowhead = (ctx: CanvasRenderingContext2D, from: Point, to: Point, size: number) => {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(angle - Math.PI / 6), to.y - size * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(angle + Math.PI / 6), to.y - size * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
};

const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke, asClipPath?: boolean) => {
  if (stroke.points.length < 1) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Apply pressure-based opacity if enabled on this stroke
  const usePressureOpacity = stroke.pressureOpacity && !asClipPath;

  // For pressure-based opacity, compute average pressure and apply as global opacity multiplier
  if (usePressureOpacity && stroke.points.length > 0) {
    let avgPressure = 0;
    for (const p of stroke.points) avgPressure += p.pressure;
    avgPressure = Math.max(0.15, avgPressure / stroke.points.length);
    ctx.globalAlpha = avgPressure;
  }

  const start = stroke.points[0];
  const end = stroke.points[stroke.points.length - 1];

  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = stroke.width;
    if (stroke.points.length < 2) { ctx.restore(); return; }
    ctx.beginPath(); ctx.moveTo(start.x, start.y);
    for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    ctx.stroke(); ctx.restore(); return;
  }

  ctx.globalCompositeOperation = 'source-over';

  if (isShapeTool(stroke.tool)) {
    if (stroke.points.length < 2) { ctx.restore(); return; }
    ctx.strokeStyle = stroke.color; ctx.lineWidth = stroke.width;
    const hasFill = stroke.fillColor && stroke.fillOpacity && stroke.fillOpacity > 0;
    switch (stroke.tool) {
      case 'line': ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke(); break;
      case 'rect':
        if (hasFill) {
          ctx.fillStyle = hexToRgba(stroke.fillColor!, stroke.fillOpacity!);
          ctx.fillRect(start.x, start.y, end.x - start.x, end.y - start.y);
        }
        ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
        break;
      case 'circle': {
        const rx = Math.abs(end.x - start.x) / 2; const ry = Math.abs(end.y - start.y) / 2;
        const cx = start.x + (end.x - start.x) / 2; const cy = start.y + (end.y - start.y) / 2;
        ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        if (hasFill) {
          ctx.fillStyle = hexToRgba(stroke.fillColor!, stroke.fillOpacity!);
          ctx.fill();
        }
        ctx.stroke();
        break;
      }
      case 'arrow':
        ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
        drawArrowhead(ctx, start, end, Math.max(10, stroke.width * 3)); break;
      case 'triangle': {
        const mx = (start.x + end.x) / 2;
        ctx.beginPath(); ctx.moveTo(mx, start.y); ctx.lineTo(end.x, end.y); ctx.lineTo(start.x, end.y); ctx.closePath();
        if (hasFill) { ctx.fillStyle = hexToRgba(stroke.fillColor!, stroke.fillOpacity!); ctx.fill(); }
        ctx.stroke(); break;
      }
      case 'diamond': {
        const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2;
        ctx.beginPath(); ctx.moveTo(cx, start.y); ctx.lineTo(end.x, cy); ctx.lineTo(cx, end.y); ctx.lineTo(start.x, cy); ctx.closePath();
        if (hasFill) { ctx.fillStyle = hexToRgba(stroke.fillColor!, stroke.fillOpacity!); ctx.fill(); }
        ctx.stroke(); break;
      }
      case 'star': {
        const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2;
        const outerR = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) / 2;
        const innerR = outerR * 0.4;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const angle = (i * Math.PI / 5) - Math.PI / 2;
          const px = cx + r * Math.cos(angle), py = cy + r * Math.sin(angle);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        if (hasFill) { ctx.fillStyle = hexToRgba(stroke.fillColor!, stroke.fillOpacity!); ctx.fill(); }
        ctx.stroke(); break;
      }
      case 'polygon': {
        const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2;
        const r = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) / 2;
        const sides = 6;
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
          const angle = (i * 2 * Math.PI / sides) - Math.PI / 2;
          const px = cx + r * Math.cos(angle), py = cy + r * Math.sin(angle);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        if (hasFill) { ctx.fillStyle = hexToRgba(stroke.fillColor!, stroke.fillOpacity!); ctx.fill(); }
        ctx.stroke(); break;
      }
      case 'pentagon': {
        const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2;
        const r = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) / 2;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
          const px = cx + r * Math.cos(angle), py = cy + r * Math.sin(angle);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        if (hasFill) { ctx.fillStyle = hexToRgba(stroke.fillColor!, stroke.fillOpacity!); ctx.fill(); }
        ctx.stroke(); break;
      }
      case 'heart': {
        const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2;
        const w = Math.abs(end.x - start.x) / 2, h = Math.abs(end.y - start.y) / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy + h * 0.9);
        ctx.bezierCurveTo(cx - w * 0.1, cy + h * 0.6, cx - w, cy + h * 0.2, cx - w, cy - h * 0.2);
        ctx.bezierCurveTo(cx - w, cy - h * 0.8, cx - w * 0.4, cy - h, cx, cy - h * 0.4);
        ctx.bezierCurveTo(cx + w * 0.4, cy - h, cx + w, cy - h * 0.8, cx + w, cy - h * 0.2);
        ctx.bezierCurveTo(cx + w, cy + h * 0.2, cx + w * 0.1, cy + h * 0.6, cx, cy + h * 0.9);
        ctx.closePath();
        if (hasFill) { ctx.fillStyle = hexToRgba(stroke.fillColor!, stroke.fillOpacity!); ctx.fill(); }
        ctx.stroke(); break;
      }
      case 'moon': {
        const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2;
        const r = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        if (hasFill) { ctx.fillStyle = hexToRgba(stroke.fillColor!, stroke.fillOpacity!); ctx.fill(); }
        ctx.stroke();
        // Inner cutout
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(cx + r * 0.4, cy - r * 0.1, r * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Re-stroke outline
        ctx.beginPath();
        ctx.arc(cx, cy, r, -0.55, Math.PI + 0.55);
        ctx.stroke();
        break;
      }
      case 'cloud': {
        const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2;
        const w = Math.abs(end.x - start.x) / 2, h = Math.abs(end.y - start.y) / 2;
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.6, cy + h * 0.3);
        ctx.bezierCurveTo(cx - w, cy + h * 0.3, cx - w, cy - h * 0.2, cx - w * 0.6, cy - h * 0.3);
        ctx.bezierCurveTo(cx - w * 0.6, cy - h * 0.8, cx - w * 0.1, cy - h, cx + w * 0.1, cy - h * 0.7);
        ctx.bezierCurveTo(cx + w * 0.3, cy - h, cx + w * 0.8, cy - h * 0.8, cx + w * 0.7, cy - h * 0.3);
        ctx.bezierCurveTo(cx + w, cy - h * 0.2, cx + w, cy + h * 0.3, cx + w * 0.6, cy + h * 0.3);
        ctx.closePath();
        if (hasFill) { ctx.fillStyle = hexToRgba(stroke.fillColor!, stroke.fillOpacity!); ctx.fill(); }
        ctx.stroke(); break;
      }
      case 'speechBubble': {
        const x = Math.min(start.x, end.x), y = Math.min(start.y, end.y);
        const w = Math.abs(end.x - start.x), h = Math.abs(end.y - start.y);
        const r2 = Math.min(w, h) * 0.15;
        const tailH = h * 0.2;
        const bodyH = h - tailH;
        ctx.beginPath();
        ctx.moveTo(x + r2, y); ctx.lineTo(x + w - r2, y);
        ctx.arcTo(x + w, y, x + w, y + r2, r2);
        ctx.lineTo(x + w, y + bodyH - r2);
        ctx.arcTo(x + w, y + bodyH, x + w - r2, y + bodyH, r2);
        ctx.lineTo(x + w * 0.35, y + bodyH);
        ctx.lineTo(x + w * 0.15, y + h);
        ctx.lineTo(x + w * 0.25, y + bodyH);
        ctx.lineTo(x + r2, y + bodyH);
        ctx.arcTo(x, y + bodyH, x, y + bodyH - r2, r2);
        ctx.lineTo(x, y + r2);
        ctx.arcTo(x, y, x + r2, y, r2);
        ctx.closePath();
        if (hasFill) { ctx.fillStyle = hexToRgba(stroke.fillColor!, stroke.fillOpacity!); ctx.fill(); }
        ctx.stroke(); break;
      }
      case 'cylinder': {
        const x = Math.min(start.x, end.x), y = Math.min(start.y, end.y);
        const w = Math.abs(end.x - start.x), h = Math.abs(end.y - start.y);
        const ellipseH = h * 0.15;
        const cx = x + w / 2;
        if (hasFill) {
          ctx.fillStyle = hexToRgba(stroke.fillColor!, stroke.fillOpacity!);
          ctx.beginPath(); ctx.ellipse(cx, y + ellipseH, w / 2, ellipseH, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillRect(x, y + ellipseH, w, h - ellipseH * 2);
          ctx.beginPath(); ctx.ellipse(cx, y + h - ellipseH, w / 2, ellipseH, 0, 0, Math.PI * 2); ctx.fill();
        }
        // Side lines
        ctx.beginPath(); ctx.moveTo(x, y + ellipseH); ctx.lineTo(x, y + h - ellipseH); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + w, y + ellipseH); ctx.lineTo(x + w, y + h - ellipseH); ctx.stroke();
        // Top ellipse
        ctx.beginPath(); ctx.ellipse(cx, y + ellipseH, w / 2, ellipseH, 0, 0, Math.PI * 2); ctx.stroke();
        // Bottom ellipse
        ctx.beginPath(); ctx.ellipse(cx, y + h - ellipseH, w / 2, ellipseH, 0, 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case 'trapezoid': {
        const x = Math.min(start.x, end.x), y = Math.min(start.y, end.y);
        const w = Math.abs(end.x - start.x), h = Math.abs(end.y - start.y);
        const inset = w * 0.2;
        ctx.beginPath();
        ctx.moveTo(x + inset, y); ctx.lineTo(x + w - inset, y);
        ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h);
        ctx.closePath();
        if (hasFill) { ctx.fillStyle = hexToRgba(stroke.fillColor!, stroke.fillOpacity!); ctx.fill(); }
        ctx.stroke(); break;
      }
      case 'cone': {
        const cx = (start.x + end.x) / 2;
        const y = Math.min(start.y, end.y), h = Math.abs(end.y - start.y);
        const w = Math.abs(end.x - start.x) / 2;
        const ellipseH = h * 0.12;
        ctx.beginPath();
        ctx.moveTo(cx, y); ctx.lineTo(cx + w, y + h - ellipseH); 
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, y); ctx.lineTo(cx - w, y + h - ellipseH);
        ctx.stroke();
        ctx.beginPath(); ctx.ellipse(cx, y + h - ellipseH, w, ellipseH, 0, 0, Math.PI * 2);
        if (hasFill) { ctx.fillStyle = hexToRgba(stroke.fillColor!, stroke.fillOpacity!); ctx.fill(); }
        ctx.stroke(); break;
      }
    }
    ctx.restore(); return;
  }

  if (stroke.points.length < 2 && stroke.tool !== 'spray') { ctx.restore(); return; }

  // Extract brush settings with defaults
  const bs = stroke.brushSettings || DEFAULT_BRUSH_SETTINGS[stroke.tool as DrawToolType] || DEFAULT_BRUSH_SETTINGS.pen;
  const texI = bs.textureIntensity; // 0-1
  const grS = bs.grainSize;         // 0.5-3
  const wet = bs.wetness;           // 0-1

  switch (stroke.tool) {
    case 'pencil': {
      ctx.strokeStyle = stroke.color; ctx.globalAlpha = 0.85;
      // Main stroke with smooth curves
      ctx.lineWidth = stroke.width * 0.6;
      ctx.beginPath(); ctx.moveTo(start.x, start.y);
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const curr = stroke.points[i]; const next = stroke.points[i + 1];
        const pressure = Math.max(0.2, curr.pressure);
        ctx.lineWidth = stroke.width * pressure * 0.6;
        const jitterScale = texI * 1.5;
        const jx = Math.sin(i * 7.3 + curr.x * 0.1) * jitterScale; const jy = Math.cos(i * 5.1 + curr.y * 0.1) * jitterScale;
        ctx.quadraticCurveTo(curr.x + jx, curr.y + jy, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
      }
      if (stroke.points.length >= 2) ctx.lineTo(end.x, end.y);
      ctx.stroke();
      // Texture overlay controlled by textureIntensity
      if (texI > 0.05) {
        ctx.globalAlpha = texI * 0.5;
        ctx.lineWidth = stroke.width * 0.25 * grS;
        ctx.beginPath(); ctx.moveTo(start.x + 0.3, start.y - 0.3);
        for (let i = 1; i < stroke.points.length - 1; i++) {
          const curr = stroke.points[i]; const next = stroke.points[i + 1];
          const g = grS * 0.3;
          ctx.quadraticCurveTo(curr.x - g, curr.y + g, (curr.x + next.x) / 2 + g * 0.7, (curr.y + next.y) / 2 - g * 0.7);
        }
        if (stroke.points.length >= 2) ctx.lineTo(end.x - 0.3, end.y + 0.3);
        ctx.stroke();
      }
      break;
    }
    case 'pen': {
      ctx.strokeStyle = stroke.color;
      if (stroke.points.length === 2) {
        ctx.lineWidth = stroke.width;
        ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
      } else {
        // Draw as a single continuous path using average pressure for smooth lines
        // Group points into segments of similar pressure to minimize beginPath calls
        let segStart = 0;
        const pressureThreshold = 0.15;
        
        const drawSegment = (fromIdx: number, toIdx: number) => {
          if (toIdx - fromIdx < 1) return;
          let avgPressure = 0;
          for (let j = fromIdx; j <= toIdx; j++) avgPressure += stroke.points[j].pressure;
          avgPressure = Math.max(0.3, avgPressure / (toIdx - fromIdx + 1));
          ctx.lineWidth = stroke.width * avgPressure;
          ctx.beginPath();
          // Extend slightly before start for overlap
          const p0 = stroke.points[fromIdx];
          ctx.moveTo(p0.x, p0.y);
          for (let j = fromIdx + 1; j < toIdx; j++) {
            const curr = stroke.points[j]; const next = stroke.points[j + 1];
            ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
          }
          ctx.lineTo(stroke.points[toIdx].x, stroke.points[toIdx].y);
          ctx.stroke();
        };

        for (let i = 1; i < stroke.points.length; i++) {
          const pDiff = Math.abs(stroke.points[i].pressure - stroke.points[segStart].pressure);
          if (pDiff > pressureThreshold || i === stroke.points.length - 1) {
            // Overlap by 1 point to eliminate gaps
            drawSegment(segStart, i);
            segStart = Math.max(0, i - 1);
          }
        }
      }
      break;
    }
    case 'marker': {
      // Clean chisel-tip marker: single layer, no dark overlap
      const markerWidth = stroke.width * 3;
      ctx.lineCap = 'square';
      ctx.lineJoin = 'miter';
      ctx.strokeStyle = hexToRgba(stroke.color, 0.45);
      ctx.lineWidth = markerWidth;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const curr = stroke.points[i]; const next = stroke.points[i + 1];
        const mx = (curr.x + next.x) / 2, my = (curr.y + next.y) / 2;
        ctx.quadraticCurveTo(curr.x, curr.y, mx, my);
      }
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      break;
    }
    case 'highlighter': {
      // Realistic highlighter: flat rectangular tip, transparent, multiply blend
      const hlWidth = stroke.width * 4.5;
      ctx.globalCompositeOperation = 'multiply';
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'bevel';
      // Main highlight pass - flat transparent band
      ctx.strokeStyle = hexToRgba(stroke.color, 0.3);
      ctx.lineWidth = hlWidth;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const curr = stroke.points[i]; const next = stroke.points[i + 1];
        const mx = (curr.x + next.x) / 2, my = (curr.y + next.y) / 2;
        ctx.quadraticCurveTo(curr.x, curr.y, mx, my);
      }
      if (stroke.points.length >= 2) ctx.lineTo(end.x, end.y);
      ctx.stroke();
      // Edge darkening for ink build-up at borders
      ctx.strokeStyle = hexToRgba(stroke.color, 0.12);
      ctx.lineWidth = hlWidth * 1.05;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const curr = stroke.points[i]; const next = stroke.points[i + 1];
        const mx = (curr.x + next.x) / 2, my = (curr.y + next.y) / 2;
        ctx.quadraticCurveTo(curr.x, curr.y, mx, my);
      }
      if (stroke.points.length >= 2) ctx.lineTo(end.x, end.y);
      ctx.stroke();
      // Subtle center saturation boost
      ctx.strokeStyle = hexToRgba(stroke.color, 0.1);
      ctx.lineWidth = hlWidth * 0.5;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const curr = stroke.points[i]; const next = stroke.points[i + 1];
        const mx = (curr.x + next.x) / 2, my = (curr.y + next.y) / 2;
        ctx.quadraticCurveTo(curr.x, curr.y, mx, my);
      }
      if (stroke.points.length >= 2) ctx.lineTo(end.x, end.y);
      ctx.stroke();
      break;
    }
    case 'textHighlight': {
      // PDF text highlight: flat transparent rectangle band, snapped to Y of first point
      if (stroke.points.length < 2) { ctx.restore(); return; }
      const hlHeight = stroke.width * 5;
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const bandWidth = maxX - minX;
      const bandY = start.y - hlHeight / 2;
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = hexToRgba(stroke.color, stroke.fillOpacity ?? 0.35);
      // Slightly rounded corners for a polished look
      const r = Math.min(3, hlHeight / 4);
      ctx.beginPath();
      ctx.moveTo(minX + r, bandY);
      ctx.lineTo(minX + bandWidth - r, bandY);
      ctx.arcTo(minX + bandWidth, bandY, minX + bandWidth, bandY + r, r);
      ctx.lineTo(minX + bandWidth, bandY + hlHeight - r);
      ctx.arcTo(minX + bandWidth, bandY + hlHeight, minX + bandWidth - r, bandY + hlHeight, r);
      ctx.lineTo(minX + r, bandY + hlHeight);
      ctx.arcTo(minX, bandY + hlHeight, minX, bandY + hlHeight - r, r);
      ctx.lineTo(minX, bandY + r);
      ctx.arcTo(minX, bandY, minX + r, bandY, r);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'calligraphy': {
      ctx.strokeStyle = stroke.color;
      const mainPath: {x: number, y: number}[] = [];
      const subPath: {x: number, y: number}[] = [];
      let avgWidth = stroke.width * (1.2 + wet * 0.8); // wetness increases ink flow
      let totalSpeed = 0;
      for (let i = 1; i < stroke.points.length; i++) {
        const prev = stroke.points[i - 1]; const curr = stroke.points[i];
        const dx = curr.x - prev.x; const dy = curr.y - prev.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dt = (curr.timestamp && prev.timestamp) ? Math.max(1, curr.timestamp - prev.timestamp) : 16;
        const speedFactor = Math.max(0.2, Math.min(1, 1 - (dist / dt) * 0.15));
        totalSpeed += speedFactor;
        const angle = Math.atan2(dy, dx);
        const nibOffset = Math.abs(Math.sin(angle)) * stroke.width * (0.2 + texI * 0.3);
        mainPath.push({x: curr.x, y: curr.y - nibOffset});
        subPath.push({x: curr.x, y: curr.y + nibOffset});
      }
      avgWidth *= Math.max(0.3, stroke.points[0].pressure) * (totalSpeed / Math.max(1, stroke.points.length - 1));
      ctx.lineWidth = avgWidth;
      ctx.beginPath(); ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 0; i < mainPath.length - 1; i++) {
        const curr = mainPath[i]; const next = mainPath[i + 1];
        ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
      }
      if (mainPath.length > 0) ctx.lineTo(mainPath[mainPath.length - 1].x, mainPath[mainPath.length - 1].y);
      ctx.stroke();
      // Sub stroke intensity controlled by textureIntensity
      if (texI > 0.05) {
        ctx.lineWidth = avgWidth * (0.15 + texI * 0.3);
        ctx.beginPath(); ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 0; i < subPath.length - 1; i++) {
          const curr = subPath[i]; const next = subPath[i + 1];
          ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
        }
        if (subPath.length > 0) ctx.lineTo(subPath[subPath.length - 1].x, subPath[subPath.length - 1].y);
        ctx.stroke();
      }
      break;
    }
    case 'spray': {
      ctx.fillStyle = stroke.color;
      const radius = stroke.width * (1.5 + wet * 1.5); // wetness = spread
      const density = Math.max(3, Math.floor(stroke.width * (1 + wet)));
      for (let i = 0; i < stroke.points.length; i++) {
        const p = stroke.points[i];
        const rng = seededRandom(Math.floor(p.x * 1000 + p.y * 7 + i * 13));
        for (let j = 0; j < density; j++) {
          const a = rng() * Math.PI * 2; const r = rng() * radius;
          ctx.globalAlpha = (0.2 + rng() * 0.4) * (0.5 + texI * 0.5);
          const dotR = Math.max(0.3, rng() * grS * 1.5);
          ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, dotR, 0, Math.PI * 2); ctx.fill();
        }
      }
      break;
    }
    case 'fountain': {
      ctx.strokeStyle = stroke.color;
      const segSize = 8;
      for (let seg = 0; seg < stroke.points.length - 1; seg += Math.max(1, segSize - 2)) {
        const segEnd = Math.min(seg + segSize, stroke.points.length - 1);
        if (segEnd <= seg) break;
        let avgPressure = 0, avgDownFactor = 0;
        for (let i = seg; i <= segEnd; i++) {
          avgPressure += stroke.points[i].pressure;
          if (i > 0) {
            const dy = stroke.points[i].y - stroke.points[i - 1].y;
            avgDownFactor += Math.max(0.3, Math.min(1.5, 0.5 + (dy > 0 ? dy * 0.05 : dy * 0.02)));
          } else avgDownFactor += 0.7;
        }
        const count = segEnd - seg + 1;
        avgPressure = Math.max(0.15, avgPressure / count);
        avgDownFactor = avgDownFactor / count;
        ctx.lineWidth = stroke.width * (1.4 + wet * 0.8) * avgPressure * avgDownFactor;
        ctx.beginPath();
        ctx.moveTo(stroke.points[seg].x, stroke.points[seg].y);
        for (let i = seg + 1; i < segEnd; i++) {
          const curr = stroke.points[i]; const next = stroke.points[i + 1];
          ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
        }
        ctx.lineTo(stroke.points[segEnd].x, stroke.points[segEnd].y);
        ctx.stroke();
      }
      // Ink pooling at endpoints - controlled by wetness
      const poolAlpha = 0.2 + wet * 0.3;
      ctx.globalAlpha = poolAlpha;
      ctx.beginPath(); ctx.arc(start.x, start.y, stroke.width * (0.3 + wet * 0.4), 0, Math.PI * 2); ctx.fillStyle = stroke.color; ctx.fill();
      ctx.beginPath(); ctx.arc(end.x, end.y, stroke.width * (0.2 + wet * 0.3), 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'crayon': {
      ctx.strokeStyle = stroke.color;
      const rng2 = seededRandom(Math.floor(start.x * 100 + start.y * 7));
      const crayonPasses = Math.max(2, Math.round(2 + texI * 3)); // more texture = more passes
      for (let i = 1; i < stroke.points.length; i++) {
        const prev = stroke.points[i - 1]; const curr = stroke.points[i];
        const w = stroke.width * 1.8 * Math.max(0.4, curr.pressure);
        for (let t = 0; t < crayonPasses; t++) {
          const spread = grS * 0.6;
          const ox = (rng2() - 0.5) * w * spread;
          const oy = (rng2() - 0.5) * w * spread;
          ctx.globalAlpha = (0.15 + rng2() * 0.25) * (0.5 + texI * 0.5);
          ctx.lineWidth = w * (0.2 + rng2() * 0.3) * grS;
          ctx.beginPath();
          ctx.moveTo(prev.x + ox, prev.y + oy);
          ctx.lineTo(curr.x + ox, curr.y + oy);
          ctx.stroke();
        }
      }
      break;
    }
    case 'watercolor': {
      const rng3 = seededRandom(Math.floor(start.x * 100 + start.y * 7));
      const wcPasses = Math.max(2, Math.round(2 + wet * 3)); // wetness = more bleed layers
      for (let pass = 0; pass < wcPasses; pass++) {
        ctx.strokeStyle = stroke.color;
        ctx.globalAlpha = (0.05 + pass * 0.03) * (0.6 + wet * 0.4);
        ctx.lineWidth = stroke.width * (3 + wet * 3 - pass * (0.5 + wet * 0.3));
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const jitterMul = grS * (3 - pass * 0.5);
        ctx.beginPath(); ctx.moveTo(start.x + (rng3() - 0.5) * jitterMul, start.y + (rng3() - 0.5) * jitterMul);
        for (let i = 1; i < stroke.points.length; i++) {
          const p = stroke.points[i];
          const jx = (rng3() - 0.5) * 2 * jitterMul;
          const jy = (rng3() - 0.5) * 2 * jitterMul;
          ctx.lineTo(p.x + jx, p.y + jy);
        }
        ctx.stroke();
      }
      // Core line
      ctx.globalAlpha = 0.1 + texI * 0.1;
      ctx.lineWidth = stroke.width * 0.8;
      ctx.beginPath(); ctx.moveTo(start.x, start.y);
      for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      ctx.stroke();
      break;
    }
    case 'dotpen': {
      ctx.fillStyle = stroke.color;
      const spacing = Math.max(stroke.width * (1 + (1 - wet)), 3); // wetness = denser dots
      let accumulated = 0;
      for (let i = 1; i < stroke.points.length; i++) {
        const prev = stroke.points[i - 1]; const curr = stroke.points[i];
        const dx = curr.x - prev.x; const dy = curr.y - prev.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        accumulated += dist;
        while (accumulated >= spacing) {
          const ratio = 1 - (accumulated - spacing) / dist;
          const px = prev.x + dx * ratio;
          const py = prev.y + dy * ratio;
          const r = stroke.width * 0.5 * grS * Math.max(0.3, curr.pressure);
          ctx.globalAlpha = 0.6 + texI * 0.3;
          ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
          accumulated -= spacing;
        }
      }
      break;
    }
    case 'neon': {
      const neonW = stroke.width * (0.8 + wet * 0.8); // wetness = glow spread
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Outer glow
      ctx.shadowColor = stroke.color;
      ctx.shadowBlur = neonW * (4 + wet * 4);
      ctx.strokeStyle = hexToRgba(stroke.color, 0.15);
      ctx.lineWidth = neonW * 4;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const curr = stroke.points[i]; const next = stroke.points[i + 1];
        ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
      }
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      // Mid glow
      ctx.shadowBlur = neonW * 3;
      ctx.strokeStyle = hexToRgba(stroke.color, 0.4);
      ctx.lineWidth = neonW * 2;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const curr = stroke.points[i]; const next = stroke.points[i + 1];
        ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
      }
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      // Bright core
      ctx.shadowBlur = neonW * 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = neonW * 0.6;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const curr = stroke.points[i]; const next = stroke.points[i + 1];
        ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
      }
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      // Inner bright color line
      ctx.shadowBlur = 0;
      ctx.strokeStyle = hexToRgba(stroke.color, 0.9);
      ctx.lineWidth = neonW * 0.9;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const curr = stroke.points[i]; const next = stroke.points[i + 1];
        ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
      }
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      break;
    }
    case 'washi': {
      // Optimized freeform washi tape - cached pattern for performance
      const washiWidth = stroke.width * 7;
      const pattern = WASHI_PATTERNS.find(p => p.id === stroke.washiPatternId) || WASHI_PATTERNS[0];
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Helper to draw the stroke path
      const drawWashiPath = () => {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < stroke.points.length - 1; i++) {
          const curr = stroke.points[i]; const next = stroke.points[i + 1];
          ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
        }
        if (stroke.points.length >= 2) ctx.lineTo(end.x, end.y);
      };

      // Layer 1: Soft shadow
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = washiWidth * 1.15;
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 3;
      drawWashiPath();
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Layer 2: Cached pattern fill
      const cacheKey = `${pattern.id}_${Math.round(washiWidth)}`;
      let canvasPattern = washiPatternCache.get(cacheKey) as CanvasPattern | undefined;
      if (!canvasPattern) {
        const patSize = Math.max(4, Math.round(washiWidth * 2));
        const offCanvas = document.createElement('canvas');
        offCanvas.width = patSize;
        offCanvas.height = patSize;
        const offCtx = offCanvas.getContext('2d')!;
        offCtx.scale(2, 2);
        pattern.draw(offCtx, washiWidth, washiWidth);
        const p = ctx.createPattern(offCanvas, 'repeat');
        if (p) {
          const matrix = new DOMMatrix();
          matrix.scaleSelf(0.5, 0.5);
          p.setTransform(matrix);
          washiPatternCache.set(cacheKey, p);
          canvasPattern = p;
        }
      }

      ctx.globalAlpha = 0.82;
      if (canvasPattern) {
        ctx.strokeStyle = canvasPattern;
      } else {
        ctx.strokeStyle = pattern.bgColor;
      }
      ctx.lineWidth = washiWidth;
      drawWashiPath();
      ctx.stroke();

      // Layer 3: Paper texture (simplified)
      ctx.globalAlpha = 0.04;
      ctx.strokeStyle = '#4a3728';
      ctx.lineWidth = washiWidth * 0.95;
      ctx.setLineDash([1, 3]);
      drawWashiPath();
      ctx.stroke();
      ctx.setLineDash([]);

      // Layer 4: Top edge highlight
      ctx.globalAlpha = 0.12;
      ctx.lineWidth = washiWidth * 0.3;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      drawWashiPath();
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
};

// --- Draw selection box ---

const drawSelectionBox = (ctx: CanvasRenderingContext2D, bbox: BBox, rotation: number, zoom: number) => {
  ctx.save();
  const cx = bbox.x + bbox.w / 2;
  const cy = bbox.y + bbox.h / 2;
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.translate(-cx, -cy);

  // Dashed border
  ctx.strokeStyle = 'hsl(210 100% 50%)';
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([6 / zoom, 4 / zoom]);
  ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
  ctx.setLineDash([]);

  // Corner handles
  const hs = HANDLE_SIZE / zoom;
  const corners: [number, number][] = [
    [bbox.x, bbox.y], [bbox.x + bbox.w, bbox.y],
    [bbox.x, bbox.y + bbox.h], [bbox.x + bbox.w, bbox.y + bbox.h],
  ];
  for (const [x, y] of corners) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - hs / 2, y - hs / 2, hs, hs);
    ctx.strokeStyle = 'hsl(210 100% 50%)';
    ctx.lineWidth = 1.5 / zoom;
    ctx.strokeRect(x - hs / 2, y - hs / 2, hs, hs);
  }

  // Rotate handle
  const rotX = bbox.x + bbox.w / 2;
  const rotY = bbox.y - 24 / zoom;
  // Line from top center to rotate handle
  ctx.strokeStyle = 'hsl(210 100% 50%)';
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath(); ctx.moveTo(bbox.x + bbox.w / 2, bbox.y); ctx.lineTo(rotX, rotY); ctx.stroke();
  // Rotate circle
  ctx.beginPath(); ctx.arc(rotX, rotY, hs * 0.7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.strokeStyle = 'hsl(210 100% 50%)'; ctx.lineWidth = 1.5 / zoom; ctx.stroke();
  // Arrow icon in rotate handle
  ctx.beginPath();
  ctx.arc(rotX, rotY, hs * 0.4, -Math.PI * 0.7, Math.PI * 0.3);
  ctx.strokeStyle = 'hsl(210 100% 50%)'; ctx.lineWidth = 1 / zoom; ctx.stroke();

  ctx.restore();
};

// --- SVG generation ---

const strokeToSvgPath = (stroke: Stroke): string => {
  if (stroke.points.length < 1 || stroke.tool === 'eraser' || stroke.tool === 'select') return '';
  const pts = stroke.points;

  if (isShapeTool(stroke.tool) && pts.length >= 2) {
    const s = pts[0], e = pts[pts.length - 1];
    switch (stroke.tool) {
      case 'line': return `<line x1="${s.x}" y1="${s.y}" x2="${e.x}" y2="${e.y}" stroke="${stroke.color}" stroke-width="${stroke.width}" stroke-linecap="round"/>`;
      case 'rect': {
        const fill = stroke.fillColor && stroke.fillOpacity ? hexToRgba(stroke.fillColor, stroke.fillOpacity) : 'none';
        return `<rect x="${Math.min(s.x, e.x)}" y="${Math.min(s.y, e.y)}" width="${Math.abs(e.x - s.x)}" height="${Math.abs(e.y - s.y)}" stroke="${stroke.color}" stroke-width="${stroke.width}" fill="${fill}"/>`;
      }
      case 'circle': {
        const rx = Math.abs(e.x - s.x) / 2, ry = Math.abs(e.y - s.y) / 2;
        const cx = s.x + (e.x - s.x) / 2, cy = s.y + (e.y - s.y) / 2;
        const fill = stroke.fillColor && stroke.fillOpacity ? hexToRgba(stroke.fillColor, stroke.fillOpacity) : 'none';
        return `<ellipse cx="${cx}" cy="${cy}" rx="${Math.max(1, rx)}" ry="${Math.max(1, ry)}" stroke="${stroke.color}" stroke-width="${stroke.width}" fill="${fill}"/>`;
      }
      case 'arrow': {
        const angle = Math.atan2(e.y - s.y, e.x - s.x);
        const aSize = Math.max(10, stroke.width * 3);
        const a1x = e.x - aSize * Math.cos(angle - Math.PI / 6), a1y = e.y - aSize * Math.sin(angle - Math.PI / 6);
        const a2x = e.x - aSize * Math.cos(angle + Math.PI / 6), a2y = e.y - aSize * Math.sin(angle + Math.PI / 6);
        return `<line x1="${s.x}" y1="${s.y}" x2="${e.x}" y2="${e.y}" stroke="${stroke.color}" stroke-width="${stroke.width}" stroke-linecap="round"/><line x1="${e.x}" y1="${e.y}" x2="${a1x}" y2="${a1y}" stroke="${stroke.color}" stroke-width="${stroke.width}" stroke-linecap="round"/><line x1="${e.x}" y1="${e.y}" x2="${a2x}" y2="${a2y}" stroke="${stroke.color}" stroke-width="${stroke.width}" stroke-linecap="round"/>`;
      }
      case 'triangle': {
        const mx = (s.x + e.x) / 2;
        const fill = stroke.fillColor && stroke.fillOpacity ? hexToRgba(stroke.fillColor, stroke.fillOpacity) : 'none';
        return `<polygon points="${mx},${s.y} ${e.x},${e.y} ${s.x},${e.y}" stroke="${stroke.color}" stroke-width="${stroke.width}" fill="${fill}" stroke-linejoin="round"/>`;
      }
      case 'diamond': {
        const cx = (s.x + e.x) / 2, cy = (s.y + e.y) / 2;
        const fill = stroke.fillColor && stroke.fillOpacity ? hexToRgba(stroke.fillColor, stroke.fillOpacity) : 'none';
        return `<polygon points="${cx},${s.y} ${e.x},${cy} ${cx},${e.y} ${s.x},${cy}" stroke="${stroke.color}" stroke-width="${stroke.width}" fill="${fill}" stroke-linejoin="round"/>`;
      }
      case 'star': {
        const cx = (s.x + e.x) / 2, cy = (s.y + e.y) / 2;
        const outerR = Math.max(Math.abs(e.x - s.x), Math.abs(e.y - s.y)) / 2;
        const innerR = outerR * 0.4;
        const pts: string[] = [];
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const angle = (i * Math.PI / 5) - Math.PI / 2;
          pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
        }
        const fill = stroke.fillColor && stroke.fillOpacity ? hexToRgba(stroke.fillColor, stroke.fillOpacity) : 'none';
        return `<polygon points="${pts.join(' ')}" stroke="${stroke.color}" stroke-width="${stroke.width}" fill="${fill}" stroke-linejoin="round"/>`;
      }
      case 'polygon': {
        const cx = (s.x + e.x) / 2, cy = (s.y + e.y) / 2;
        const r = Math.max(Math.abs(e.x - s.x), Math.abs(e.y - s.y)) / 2;
        const sides = 6;
        const pts: string[] = [];
        for (let i = 0; i < sides; i++) {
          const angle = (i * 2 * Math.PI / sides) - Math.PI / 2;
          pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
        }
        const fill = stroke.fillColor && stroke.fillOpacity ? hexToRgba(stroke.fillColor, stroke.fillOpacity) : 'none';
        return `<polygon points="${pts.join(' ')}" stroke="${stroke.color}" stroke-width="${stroke.width}" fill="${fill}" stroke-linejoin="round"/>`;
      }
      case 'pentagon': {
        const cx = (s.x + e.x) / 2, cy = (s.y + e.y) / 2;
        const r = Math.max(Math.abs(e.x - s.x), Math.abs(e.y - s.y)) / 2;
        const pts: string[] = [];
        for (let i = 0; i < 5; i++) {
          const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
          pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
        }
        const fill = stroke.fillColor && stroke.fillOpacity ? hexToRgba(stroke.fillColor, stroke.fillOpacity) : 'none';
        return `<polygon points="${pts.join(' ')}" stroke="${stroke.color}" stroke-width="${stroke.width}" fill="${fill}" stroke-linejoin="round"/>`;
      }
      case 'trapezoid': {
        const x = Math.min(s.x, e.x), y = Math.min(s.y, e.y);
        const w = Math.abs(e.x - s.x), h = Math.abs(e.y - s.y);
        const inset = w * 0.2;
        const fill = stroke.fillColor && stroke.fillOpacity ? hexToRgba(stroke.fillColor, stroke.fillOpacity) : 'none';
        return `<polygon points="${x+inset},${y} ${x+w-inset},${y} ${x+w},${y+h} ${x},${y+h}" stroke="${stroke.color}" stroke-width="${stroke.width}" fill="${fill}" stroke-linejoin="round"/>`;
      }
      case 'heart':
      case 'moon':
      case 'cloud':
      case 'speechBubble':
      case 'cylinder':
      case 'cone': {
        // Complex shapes: fallback to path-based SVG
        const fill = stroke.fillColor && stroke.fillOpacity ? hexToRgba(stroke.fillColor, stroke.fillOpacity) : 'none';
        return `<rect x="${Math.min(s.x,e.x)}" y="${Math.min(s.y,e.y)}" width="${Math.abs(e.x-s.x)}" height="${Math.abs(e.y-s.y)}" stroke="${stroke.color}" stroke-width="${stroke.width}" fill="${fill}" rx="4" opacity="0.8"/>`;
      }
    }
  }

  if (pts.length < 2 && stroke.tool !== 'spray') return '';

  if (stroke.tool === 'spray') {
    let circles = '';
    const radius = stroke.width * 2;
    const density = Math.max(5, Math.floor(stroke.width * 1.5));
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const rng = seededRandom(Math.floor(p.x * 1000 + p.y * 7 + i * 13));
      for (let j = 0; j < density; j++) {
        const a = rng() * Math.PI * 2, r = rng() * radius;
        const opacity = 0.3 + rng() * 0.5;
        circles += `<circle cx="${p.x + Math.cos(a) * r}" cy="${p.y + Math.sin(a) * r}" r="${Math.max(0.5, rng() * 1.5)}" fill="${stroke.color}" opacity="${opacity.toFixed(2)}"/>`;
      }
    }
    return circles;
  }

  // Freehand path
  let d = `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) {
    d += ` L ${pts[1].x} ${pts[1].y}`;
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const curr = pts[i], next = pts[i + 1];
      d += ` Q ${curr.x} ${curr.y} ${(curr.x + next.x) / 2} ${(curr.y + next.y) / 2}`;
    }
    d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  }

  let opacity = '1';
  let color = stroke.color;
  if (stroke.tool === 'highlighter') opacity = '0.25';
  else if (stroke.tool === 'marker') opacity = '0.4';
  else if (stroke.tool === 'textHighlight') {
    // Render as filled rect in SVG
    if (stroke.points.length >= 2) {
      const s = stroke.points[0], e = stroke.points[stroke.points.length - 1];
      const hlHeight = stroke.width * 5;
      const minX = Math.min(s.x, e.x);
      const maxX = Math.max(s.x, e.x);
      const bandY = s.y - hlHeight / 2;
      return `<rect x="${minX}" y="${bandY}" width="${maxX - minX}" height="${hlHeight}" rx="3" fill="${color}" opacity="${stroke.fillOpacity ?? 0.35}" style="mix-blend-mode:multiply"/>`;
    }
    return '';
  }

  const sw = stroke.tool === 'marker' ? stroke.width * 3 : stroke.tool === 'highlighter' ? stroke.width * 4 : stroke.width;

  return `<path d="${d}" stroke="${color}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
};

const generateSvg = (layers: Layer[], w: number, h: number, bg: BackgroundType): string => {
  const bgColor = bg === 'dark' ? '#1a1a2e' : '#ffffff';
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
  svg += `<rect width="${w}" height="${h}" fill="${bgColor}"/>`;

  for (const layer of layers) {
    if (!layer.visible) continue;
    svg += `<g opacity="${layer.opacity}">`;
    for (const stroke of layer.strokes) {
      svg += strokeToSvgPath(stroke);
    }
    for (const ta of (layer.textAnnotations || [])) {
      const style = `${ta.italic ? 'italic ' : ''}${ta.bold ? 'bold ' : ''}${ta.fontSize}px ${ta.font}`;
      const lines = ta.text.split('\n');
      for (let li = 0; li < lines.length; li++) {
        const escaped = lines[li].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        svg += `<text x="${ta.x}" y="${ta.y + li * ta.fontSize * 1.2 + ta.fontSize}" fill="${ta.color}" font="${style}" style="font: ${style}">${escaped}</text>`;
      }
    }
    svg += '</g>';
  }
  svg += '</svg>';
  return svg;
};

// --- Minimap Component ---

const MINIMAP_W = 120;
const MINIMAP_H = 80;

const MiniMap = memo(({
  layersRef, zoomRef, panRef, canvasSizeRef, zoomDisplay,
  onPanChange, onResetZoom,
}: {
  layersRef: React.RefObject<Layer[]>;
  zoomRef: React.RefObject<number>;
  panRef: React.RefObject<{ x: number; y: number }>;
  canvasSizeRef: React.RefObject<{ w: number; h: number }>;
  zoomDisplay: number;
  onPanChange: (pan: { x: number; y: number }) => void;
  onResetZoom: () => void;
}) => {
  const miniRef = useRef<HTMLCanvasElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const canvas = miniRef.current;
    if (!canvas || collapsed) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = MINIMAP_W * dpr;
    canvas.height = MINIMAP_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, MINIMAP_W, MINIMAP_H);

    // Gather all stroke bounding points
    const allPoints: { x: number; y: number }[] = [];
    for (const layer of layersRef.current) {
      if (!layer.visible) continue;
      for (const s of layer.strokes) {
        for (const p of s.points) allPoints.push(p);
      }
    }

    const zoom = zoomRef.current;
    const pan = panRef.current;
    const { w, h } = canvasSizeRef.current;

    // Viewport in world coords
    const vx0 = -pan.x / zoom;
    const vy0 = -pan.y / zoom;
    const vx1 = vx0 + w / zoom;
    const vy1 = vy0 + h / zoom;

    // World bounds = union of strokes + viewport
    let wx0 = vx0, wy0 = vy0, wx1 = vx1, wy1 = vy1;
    for (const p of allPoints) {
      if (p.x < wx0) wx0 = p.x;
      if (p.y < wy0) wy0 = p.y;
      if (p.x > wx1) wx1 = p.x;
      if (p.y > wy1) wy1 = p.y;
    }

    // Add padding
    const pad = 50;
    wx0 -= pad; wy0 -= pad; wx1 += pad; wy1 += pad;
    const worldW = wx1 - wx0 || 1;
    const worldH = wy1 - wy0 || 1;

    // Scale to fit minimap
    const scale = Math.min(MINIMAP_W / worldW, MINIMAP_H / worldH);
    const offX = (MINIMAP_W - worldW * scale) / 2;
    const offY = (MINIMAP_H - worldH * scale) / 2;

    // Background
    ctx.fillStyle = 'hsl(var(--muted))';
    ctx.fillRect(0, 0, MINIMAP_W, MINIMAP_H);

    // Draw strokes as simplified lines
    ctx.save();
    ctx.translate(offX, offY);
    for (const layer of layersRef.current) {
      if (!layer.visible) continue;
      ctx.globalAlpha = layer.opacity * 0.8;
      for (const s of layer.strokes) {
        if (s.points.length === 0) continue;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = Math.max(0.5, s.width * scale * 0.3);
        ctx.beginPath();
        const p0 = s.points[0];
        ctx.moveTo((p0.x - wx0) * scale, (p0.y - wy0) * scale);
        for (let i = 1; i < s.points.length; i++) {
          const p = s.points[i];
          ctx.lineTo((p.x - wx0) * scale, (p.y - wy0) * scale);
        }
        ctx.stroke();
      }
    }
    ctx.restore();

    // Draw viewport rectangle
    const rvx = offX + (vx0 - wx0) * scale;
    const rvy = offY + (vy0 - wy0) * scale;
    const rvw = (vx1 - vx0) * scale;
    const rvh = (vy1 - vy0) * scale;

    ctx.strokeStyle = 'hsl(var(--primary))';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rvx, rvy, rvw, rvh);
    ctx.fillStyle = 'hsl(var(--primary) / 0.08)';
    ctx.fillRect(rvx, rvy, rvw, rvh);
  });

  const handleMinimapClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = miniRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (MINIMAP_W / rect.width);
    const my = (e.clientY - rect.top) * (MINIMAP_H / rect.height);

    const allPoints: { x: number; y: number }[] = [];
    for (const layer of layersRef.current) {
      if (!layer.visible) continue;
      for (const s of layer.strokes) for (const p of s.points) allPoints.push(p);
    }
    const zoom = zoomRef.current;
    const pan = panRef.current;
    const { w, h } = canvasSizeRef.current;
    const vx0 = -pan.x / zoom; const vy0 = -pan.y / zoom;
    const vx1 = vx0 + w / zoom; const vy1 = vy0 + h / zoom;
    let wx0 = vx0, wy0 = vy0, wx1 = vx1, wy1 = vy1;
    for (const p of allPoints) { if (p.x < wx0) wx0 = p.x; if (p.y < wy0) wy0 = p.y; if (p.x > wx1) wx1 = p.x; if (p.y > wy1) wy1 = p.y; }
    const pad = 50;
    wx0 -= pad; wy0 -= pad; wx1 += pad; wy1 += pad;
    const worldW = wx1 - wx0 || 1; const worldH = wy1 - wy0 || 1;
    const scale = Math.min(MINIMAP_W / worldW, MINIMAP_H / worldH);
    const offX = (MINIMAP_W - worldW * scale) / 2;
    const offY = (MINIMAP_H - worldH * scale) / 2;

    const worldX = (mx - offX) / scale + wx0;
    const worldY = (my - offY) / scale + wy0;
    const newPanX = -(worldX * zoom - w / 2);
    const newPanY = -(worldY * zoom - h / 2);
    onPanChange({ x: newPanX, y: newPanY });
  }, [layersRef, zoomRef, panRef, canvasSizeRef, onPanChange]);

  if (collapsed) {
    return (
      <div className="absolute top-2 right-2 flex gap-1">
        <button
          onClick={() => setCollapsed(false)}
          className="bg-card/90 backdrop-blur-sm border border-border/50 rounded-lg px-2 py-1 text-[10px] text-muted-foreground flex items-center gap-1 hover:bg-muted transition-colors"
        >
          <Navigation className="h-3 w-3" />Map
        </button>
        {zoomDisplay !== 100 && (
          <button onClick={onResetZoom}
            className="bg-card/90 backdrop-blur-sm border border-border/50 rounded-lg px-2 py-1 text-[10px] text-muted-foreground flex items-center gap-1 hover:bg-muted transition-colors"
          >
            <Maximize className="h-3 w-3" />{zoomDisplay}%
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="absolute top-2 right-2 bg-card/90 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-2 py-1 border-b border-border/30">
        <span className="text-[9px] text-muted-foreground font-medium">Navigator</span>
        <div className="flex items-center gap-1">
          {zoomDisplay !== 100 && (
            <button onClick={onResetZoom}
              className="text-[9px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {zoomDisplay}%
            </button>
          )}
          <button onClick={() => setCollapsed(true)} className="text-muted-foreground hover:text-foreground transition-colors">
            <Minus className="h-3 w-3" />
          </button>
        </div>
      </div>
      <canvas
        ref={miniRef}
        width={MINIMAP_W}
        height={MINIMAP_H}
        className="cursor-pointer block"
        style={{ width: MINIMAP_W, height: MINIMAP_H }}
        onClick={handleMinimapClick}
      />
    </div>
  );
});
MiniMap.displayName = 'MiniMap';

// --- Component ---

interface SketchEditorProps {
  initialData?: string;
  onChange: (json: string) => void;
  onImageExport?: (pngDataUrl: string) => void;
  className?: string;
}

// --- Pen Preview Canvas ---
const PenPreviewCanvas = memo(({ penType, isActive, currentColor }: { penType: DrawToolType; isActive: boolean; currentColor: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Generate a wavy S-curve with simulated pressure
    const points: { x: number; y: number; p: number }[] = [];
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = t * w * 0.9 + w * 0.05;
      const y = h / 2 + Math.sin(t * Math.PI * 2) * (h * 0.25);
      // Pressure: ramp up then down
      const p = 0.2 + 0.8 * Math.sin(t * Math.PI);
      points.push({ x, y, p });
    }

    const c = currentColor || '#3C78F0';

    switch (penType) {
      case 'pencil': {
        ctx.strokeStyle = c;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        points.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
        ctx.stroke();
        break;
      }
      case 'pen': {
        ctx.strokeStyle = c;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (let i = 1; i < points.length; i++) {
          ctx.lineWidth = 1 + points[i].p * 2;
          ctx.beginPath();
          ctx.moveTo(points[i - 1].x, points[i - 1].y);
          ctx.lineTo(points[i].x, points[i].y);
          ctx.stroke();
        }
        break;
      }
      case 'fountain': {
        ctx.strokeStyle = c;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (let i = 1; i < points.length; i++) {
          ctx.globalAlpha = 0.7 + points[i].p * 0.3;
          ctx.lineWidth = 0.5 + points[i].p * 3.5;
          ctx.beginPath();
          ctx.moveTo(points[i - 1].x, points[i - 1].y);
          ctx.lineTo(points[i].x, points[i].y);
          ctx.stroke();
        }
        break;
      }
      case 'marker': {
        // Live preview: clean chisel-tip marker, single layer
        ctx.lineJoin = 'miter';
        ctx.lineCap = 'square';
        const liveMarkerW = 4;
        ctx.strokeStyle = c;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = liveMarkerW;
        ctx.beginPath();
        points.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else {
            const prev = points[i - 1];
            const mx = (prev.x + pt.x) / 2, my = (prev.y + pt.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
          }
        });
        ctx.stroke();
        break;
      }
      case 'highlighter': {
        // Live preview: flat transparent band with multiply blend
        ctx.globalCompositeOperation = 'multiply';
        ctx.lineJoin = 'bevel';
        ctx.lineCap = 'butt';
        const liveHlW = 8;
        ctx.strokeStyle = c;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = liveHlW;
        ctx.beginPath();
        points.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else {
            const prev = points[i - 1];
            const mx = (prev.x + pt.x) / 2, my = (prev.y + pt.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
          }
        });
        ctx.stroke();
        // Subtle center boost
        ctx.globalAlpha = 0.1;
        ctx.lineWidth = liveHlW * 0.5;
        ctx.beginPath();
        points.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else {
            const prev = points[i - 1];
            const mx = (prev.x + pt.x) / 2, my = (prev.y + pt.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
          }
        });
        ctx.stroke();
        break;
      }
      case 'calligraphy': {
        ctx.fillStyle = c;
        ctx.globalAlpha = 0.9;
        for (let i = 1; i < points.length; i++) {
          const dx = points[i].x - points[i - 1].x;
          const dy = points[i].y - points[i - 1].y;
          const angle = Math.atan2(dy, dx);
          const width = 1 + points[i].p * 3;
          const nx = Math.cos(angle + Math.PI / 2) * width / 2;
          const ny = Math.sin(angle + Math.PI / 2) * width / 2;
          ctx.beginPath();
          ctx.moveTo(points[i - 1].x - nx, points[i - 1].y - ny);
          ctx.lineTo(points[i - 1].x + nx, points[i - 1].y + ny);
          ctx.lineTo(points[i].x + nx, points[i].y + ny);
          ctx.lineTo(points[i].x - nx, points[i].y - ny);
          ctx.fill();
        }
        break;
      }
      case 'crayon': {
        ctx.strokeStyle = c;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 3;
        for (let i = 1; i < points.length; i++) {
          ctx.globalAlpha = 0.3 + Math.random() * 0.4;
          ctx.beginPath();
          ctx.moveTo(points[i - 1].x + (Math.random() - 0.5) * 2, points[i - 1].y + (Math.random() - 0.5) * 2);
          ctx.lineTo(points[i].x + (Math.random() - 0.5) * 2, points[i].y + (Math.random() - 0.5) * 2);
          ctx.stroke();
        }
        break;
      }
      case 'watercolor': {
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (let pass = 0; pass < 3; pass++) {
          ctx.strokeStyle = c;
          ctx.globalAlpha = 0.1;
          ctx.lineWidth = 5 + pass * 2;
          ctx.beginPath();
          points.forEach((pt, i) => {
            const ox = (Math.random() - 0.5) * 2 * pass;
            const oy = (Math.random() - 0.5) * 2 * pass;
            i === 0 ? ctx.moveTo(pt.x + ox, pt.y + oy) : ctx.lineTo(pt.x + ox, pt.y + oy);
          });
          ctx.stroke();
        }
        break;
      }
      case 'spray': {
        ctx.fillStyle = c;
        for (const pt of points) {
          const density = Math.floor(3 + pt.p * 5);
          const radius = 3 + pt.p * 3;
          for (let j = 0; j < density; j++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * radius;
            ctx.globalAlpha = 0.3 + Math.random() * 0.4;
            ctx.beginPath();
            ctx.arc(pt.x + Math.cos(angle) * r, pt.y + Math.sin(angle) * r, 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }
      case 'dotpen': {
        ctx.fillStyle = c;
        ctx.globalAlpha = 0.9;
        for (let i = 0; i < points.length; i += 3) {
          const pt = points[i];
          const r = 0.8 + pt.p * 1.5;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'neon': {
        // Preview: neon glow with shadow
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = c;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = c;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 5;
        ctx.beginPath();
        points.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else {
            const prev = points[i - 1];
            ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + pt.x) / 2, (prev.y + pt.y) / 2);
          }
        });
        ctx.stroke();
        // White core
        ctx.shadowBlur = 4;
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        points.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else {
            const prev = points[i - 1];
            ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + pt.x) / 2, (prev.y + pt.y) / 2);
          }
        });
        ctx.stroke();
        break;
      }
    }
  }, [penType, currentColor]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={32}
      className={cn(
        'rounded-lg w-full h-8',
        isActive ? 'bg-primary/5' : 'bg-muted/40'
      )}
    />
  );
});
PenPreviewCanvas.displayName = 'PenPreviewCanvas';

export const SketchEditor = memo(({ initialData, onChange, onImageExport, className }: SketchEditorProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<ToolType>('pen');
  const [color, setColor] = useState('#1a1a1a');
  const [highlightOpacity, setHighlightOpacity] = useState(0.35);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [toolOpacity, setToolOpacity] = useState(1);
  const [brushSettingsMap, setBrushSettingsMap] = useState<Record<string, BrushSettings>>(() => ({ ...DEFAULT_BRUSH_SETTINGS }));
  const currentBrushSettings = brushSettingsMap[tool as DrawToolType] || DEFAULT_BRUSH_SETTINGS.pen;
  const updateBrushSetting = (key: keyof BrushSettings, value: number) => {
    setBrushSettingsMap(prev => ({ ...prev, [tool]: { ...(prev[tool as DrawToolType] || DEFAULT_BRUSH_SETTINGS.pen), [key]: value } }));
  };
  const [activeLayerId, setActiveLayerId] = useState(1);
  const [background, setBackground] = useState<BackgroundType>('grid-sm');
  const [recentColors, setRecentColors] = useState<string[]>(['#1a1a1a']);
  const [eyedropperActive, setEyedropperActive] = useState(false);
  const [, forceUpdate] = useState(0);

  // HSL state
  const [hslH, setHslH] = useState(0);
  const [hslS, setHslS] = useState(0);
  const [hslL, setHslL] = useState(0.1);

  // Grid snap state
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [gridColor, setGridColor] = useState('#8c8c8c');
  const [gridOpacity, setGridOpacity] = useState(0.45);

  // Focus mode & ruler state
  const [focusMode, setFocusMode] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const presentationContainerRef = useRef<HTMLDivElement>(null);
  const cursorHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cursorHidden, setCursorHidden] = useState(false);
  
  // Laser pointer state
  const laserTrailRef = useRef<{ x: number; y: number; time: number }[]>([]);
  const laserRafRef = useRef(0);
  const laserActiveRef = useRef(false);
  
  // Presentation mode swipe state
  const presentationSwipeRef = useRef<{ startX: number; startY: number } | null>(null);

  // Sticker library state
  const [stickerLibraryOpen, setStickerLibraryOpen] = useState(false);

  // Toolbar popover state - only one open at a time, click to toggle
  const [openToolbarPopover, setOpenToolbarPopover] = useState<string | null>(null);
  const toggleToolbarPopover = (id: string) => setOpenToolbarPopover(prev => prev === id ? null : id);
  const [savedStickers, setSavedStickers] = useState<StickerElement[]>(() => loadSavedStickers());

  // Washi tape state
  const [selectedWashiId, setSelectedWashiId] = useState<number | null>(null);
  const [washiPatternId, setWashiPatternId] = useState(WASHI_PATTERNS[0].id);
  const nextWashiIdRef = useRef(1);
  const washiDragRef = useRef<{
    tapeId: number;
    startX: number; startY: number;
    origX: number; origY: number;
    type: 'move' | 'resize' | 'rotate' | 'create';
    origW?: number; origH?: number;
    origRotation?: number;
    handle?: 'tl' | 'tr' | 'bl' | 'br';
  } | null>(null);

  const [showRulers, setShowRulers] = useState(false);
  const [showPhysicalRuler, setShowPhysicalRuler] = useState(false);
  const physicalRulerRef = useRef<RulerLine | null>(null);
  const [rulerMeasurement, setRulerMeasurement] = useState<{ lengthPx: number; screenX: number; screenY: number } | null>(null);
  const rulerDrawStartRef = useRef<{ x: number; y: number } | null>(null);
  const [showProtractor, setShowProtractor] = useState(false);
  const protractorRef = useRef<ProtractorLine | null>(null);
  const [showTriangle, setShowTriangle] = useState(false);
  const triangleRef = useRef<TriangleEdges | null>(null);
  // Fill color state for shapes
  const [fillEnabled, setFillEnabled] = useState(false);
  const [fillColor, setFillColor] = useState('#3b82f6');
  const [fillOpacity, setFillOpacity] = useState(0.3);
  const [pressureOpacityEnabled, setPressureOpacityEnabled] = useState(false);

  // Color palette manager state
  const [savedPalettes, setSavedPalettes] = useState<{ name: string; colors: string[] }[]>(() => {
    try {
      const stored = localStorage.getItem('sketch-color-palettes');
      return stored ? JSON.parse(stored) : [
        { name: 'Default', colors: ['#1a1a1a', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'] },
        { name: 'Pastel', colors: ['#fecdd3', '#fed7aa', '#fef08a', '#bbf7d0', '#bfdbfe', '#ddd6fe', '#fbcfe8', '#e2e8f0'] },
        { name: 'Earth', colors: ['#292524', '#78716c', '#a16207', '#854d0e', '#365314', '#1e3a5f', '#44403c', '#d6d3d1'] },
      ];
    } catch { return []; }
  });
  const [activePaletteIdx, setActivePaletteIdx] = useState(0);
  const [newPaletteName, setNewPaletteName] = useState('');

  // Timelapse state
  const [isPlayingTimelapse, setIsPlayingTimelapse] = useState(false);
  const timelapseAbortRef = useRef(false);
  const [isTimelapseRecording, setIsTimelapseRecording] = useState(false);
  const timelapseRecordStartRef = useRef<number>(0);
  const [timelapseSpeed, setTimelapseSpeed] = useState<number>(4);
  const [isExportingTimelapse, setIsExportingTimelapse] = useState(false);

  // Audio-sync recording state
  const [isAudioRecording, setIsAudioRecording] = useState(false);
  const [audioRecordingTime, setAudioRecordingTime] = useState(0);
  const [hasAudioRecording, setHasAudioRecording] = useState(false);
  const [isAudioSyncPlaying, setIsAudioSyncPlaying] = useState(false);
  const audioRecordingStartRef = useRef<number>(0);
  const audioMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioDataUrlRef = useRef<string | null>(null);
  const audioDurationRef = useRef<number>(0);
  const audioSyncAbortRef = useRef(false);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const [audioScrubTime, setAudioScrubTime] = useState(0); // ms
  const audioScrubTimeRef = useRef(0);
  const audioSyncSavedLayersRef = useRef<Layer[] | null>(null);
  const audioSyncedStrokesRef = useRef<{ layerId: number; stroke: Stroke; audioTimestamp: number }[]>([]);
  const [audioLoopEnabled, setAudioLoopEnabled] = useState(false);
  const [audioLoopA, setAudioLoopA] = useState<number | null>(null); // ms
  const [audioLoopB, setAudioLoopB] = useState<number | null>(null); // ms
  const audioLoopEnabledRef = useRef(false);
  const audioLoopARef = useRef<number | null>(null);
  const audioLoopBRef = useRef<number | null>(null);
  const audioSyncUnsyncedRef = useRef<{ layerId: number; stroke: Stroke }[]>([]);
  const audioSyncHasPointTimestampsRef = useRef(false);
  const audioSyncRafRef = useRef(0);

  // Video panel state
  const [showVideoPanel, setShowVideoPanel] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoBookmarks, setVideoBookmarks] = useState<VideoBookmark[]>([]);
  const videoUrlRef = useRef('');
  const videoBookmarksRef = useRef<VideoBookmark[]>([]);

  const handleVideoUrlChange = useCallback((url: string) => {
    setVideoUrl(url);
    videoUrlRef.current = url;
    // Trigger save
    requestAnimationFrame(() => emitChangeRef.current?.());
  }, []);

  const handleVideoBookmarksChange = useCallback((bms: VideoBookmark[]) => {
    setVideoBookmarks(bms);
    videoBookmarksRef.current = bms;
    requestAnimationFrame(() => emitChangeRef.current?.());
  }, []);

  // Shape recognition state
  const [shapeRecognitionEnabled, setShapeRecognitionEnabled] = useState(false);

  // SVG import ref
  const svgInputRef = useRef<HTMLInputElement>(null);

  // Symmetry mode state
  type SymmetryMode = 'off' | '2' | '4' | '8';
  const [symmetryMode, setSymmetryMode] = useState<SymmetryMode>('off');

  // Generate symmetry-mirrored strokes for N axes (radial symmetry around center)
  const getSymmetryStrokes = useCallback((stroke: Stroke, centerX: number, centerY: number, mode: SymmetryMode): Stroke[] => {
    if (mode === 'off') return [];
    const axes = parseInt(mode);
    const mirrored: Stroke[] = [];
    for (let i = 1; i < axes * 2; i++) {
      const angle = (Math.PI * i) / axes;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      // For even indices: rotate; for odd indices: reflect then rotate
      const isReflect = i % 2 === 1;
      mirrored.push({
        ...stroke,
        points: stroke.points.map(p => {
          let dx = p.x - centerX;
          let dy = p.y - centerY;
          if (isReflect) dx = -dx; // reflect across vertical axis through center
          return {
            ...p,
            x: centerX + dx * cosA - dy * sinA,
            y: centerY + dx * sinA + dy * cosA,
          };
        }),
      });
    }
    return mirrored;
  }, []);

  // Zoom-to-Write state
  const [zoomWriteActive, setZoomWriteActive] = useState(false);
  const zoomWriteCanvasRef = useRef<HTMLCanvasElement>(null);
  const zoomWriteDrawingRef = useRef(false);
  const zoomWriteStrokeRef = useRef<Stroke | null>(null);
  const zoomWriteLastPointRef = useRef<Point | null>(null);
  const zoomWriteOffsetRef = useRef({ x: 0, y: 0 }); // current write position on main canvas (world coords)
  const zoomWriteBoxWidthRef = useRef(0);
  const ZOOM_WRITE_SCALE = 3.5;
  const ZOOM_WRITE_HEIGHT = 120;
  const zoomWriteRafRef = useRef(0);

  // Selection state
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [selectionRotation, setSelectionRotation] = useState(0);
  const selectionActionRef = useRef<{
    type: HandleType;
    startPos: { x: number; y: number };
    origBBox: BBox;
    origStrokes: Stroke[];
    origRotation: number;
  } | null>(null);
  const clipboardRef = useRef<Stroke[]>([]);

  // Text tool state
  const [textFont, setTextFont] = useState('sans-serif');
  const [textFontSize, setTextFontSize] = useState(24);
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [editingText, setEditingText] = useState<{ x: number; y: number; annotationId?: number } | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const nextTextIdRef = useRef(1);

  // Sticky note state
  const [stickyColor, setStickyColor] = useState('#FEF3C7');
  const [editingStickyId, setEditingStickyId] = useState<number | null>(null);
  const [editingStickyText, setEditingStickyText] = useState('');
  const [selectedStickyId, setSelectedStickyId] = useState<number | null>(null);
  const stickyInputRef = useRef<HTMLTextAreaElement>(null);
  const nextStickyIdRef = useRef(1);
  
  const stickyDragRef = useRef<{
    noteId: number;
    startX: number; startY: number;
    origX: number; origY: number;
    type: 'move' | 'resize' | 'rotate';
    origW?: number; origH?: number;
    handle?: 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r';
    origRotation?: number;
  } | null>(null);
  const stickyLastTapRef = useRef<{ time: number; id: number }>({ time: 0, id: -1 });

  // Image tool state
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const nextImageIdRef = useRef(1);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const imageDragRef = useRef<{
    imageId: number;
    startX: number; startY: number;
    origX: number; origY: number;
    type: 'move' | 'resize';
    origW?: number; origH?: number;
    handle?: 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r';
  } | null>(null);

  // PDF annotation state
  const [pdfPages, setPdfPages] = useState<string[]>([]); // data URLs of rendered pages
  const [pdfPageIndex, setPdfPageIndex] = useState(0);
  const [pdfPageDimensions, setPdfPageDimensions] = useState<{ w: number; h: number }[]>([]);
  const pdfPageImageCache = useRef<Map<number, HTMLImageElement>>(new Map());
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [pdfAnnotations, setPdfAnnotations] = useState<Map<number, Layer[]>>(new Map()); // per-page annotations

  // PDF text selection state
  interface PdfTextItem {
    str: string;
    x: number; // world coords (centered at origin like the PDF image)
    y: number;
    width: number;
    height: number;
  }
  const pdfTextItemsRef = useRef<Map<number, PdfTextItem[]>>(new Map()); // per-page text items
  const [pdfSelectedText, setPdfSelectedText] = useState('');
  const [pdfTextSelectionRects, setPdfTextSelectionRects] = useState<{ x: number; y: number; w: number; h: number }[]>([]);
  const pdfTextDragRef = useRef<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const pdfDocRef = useRef<any>(null); // Keep reference for lazy text extraction

  const [pdfSearchQuery, setPdfSearchQuery] = useState('');
  const [pdfSearchMatchRects, setPdfSearchMatchRects] = useState<{ x: number; y: number; w: number; h: number }[]>([]);
  const [showPdfSearch, setShowPdfSearch] = useState(false);

  // Marquee selection state
  const marqueeRef = useRef<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  const layersRef = useRef<Layer[]>(createDefaultLayers());
  const undoStackRef = useRef<Layer[][]>([]);
  const redoStackRef = useRef<Layer[][]>([]);

  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const currentPressureRef = useRef(0);
  const [showPressure, setShowPressure] = useState(false);
  const [pressureValue, setPressureValue] = useState(0);
  const rafRef = useRef<number>(0);
  const canvasSizeRef = useRef({ w: 0, h: 0 });

  // Scribble-to-erase gesture detection
  const scribbleDetectorRef = useRef<{
    directionChanges: number;
    lastDx: number;
    lastDy: number;
    pointCount: number;
    minX: number; minY: number; maxX: number; maxY: number;
    triggered: boolean;
  } | null>(null);

  // Scribble erase dissolve particles
  const scribbleParticlesRef = useRef<{
    particles: { x: number; y: number; vx: number; vy: number; r: number; opacity: number; color: string }[];
    startTime: number;
    duration: number;
  } | null>(null);
  const scribbleAnimFrameRef = useRef<number>(0);

  // Zoom & pan state
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const [zoomDisplay, setZoomDisplay] = useState(100);

  // Infinite canvas: spacebar panning state
  const isSpacebarDownRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  // Pan inertia
  const panVelocityRef = useRef({ vx: 0, vy: 0 });
  const panInertiaRafRef = useRef(0);
  const lastPanTimeRef = useRef(0);
  const lastPanPosRef = useRef({ x: 0, y: 0 });

  // Multi-touch gesture tracking
  const activeTouchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureStateRef = useRef<{
    isPinching: boolean;
    initialDist: number;
    initialZoom: number;
    initialPan: { x: number; y: number };
    initialMid: { x: number; y: number };
  } | null>(null);
  const lastTapRef = useRef(0);

  const cloneLayers = (layers: Layer[]): Layer[] =>
    layers.map(l => ({ ...l, strokes: l.strokes.map(s => ({ ...s, points: [...s.points] })), textAnnotations: [...(l.textAnnotations || [])], stickyNotes: (l.stickyNotes || []).map(sn => ({ ...sn })), images: (l.images || []).map(img => ({ ...img })), washiTapes: (l.washiTapes || []).map(wt => ({ ...wt })) }));

  // --- Image loading cache ---
  const redrawRef = useRef<() => void>(() => {});
  const emitChangeRef = useRef<() => void>(() => {});
  const getOrLoadImage = useCallback((src: string): HTMLImageElement | null => {
    const cached = imageCacheRef.current.get(src);
    if (cached && cached.complete) return cached;
    if (!cached) {
      const img = new window.Image();
      img.onload = () => { redrawRef.current(); };
      img.src = src;
      imageCacheRef.current.set(src, img);
    }
    return null;
  }, []);

  const handleImageUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        imageCacheRef.current.set(dataUrl, img);
        const layer = layersRef.current.find(l => l.id === activeLayerId);
        if (!layer) return;
        undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), cloneLayers(layersRef.current)];
        redoStackRef.current = [];
        if (!layer.images) layer.images = [];
        const maxDim = 300;
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        const zoom = zoomRef.current;
        const pan = panRef.current;
        const cw = canvasSizeRef.current.w;
        const ch = canvasSizeRef.current.h;
        const cx = (cw / 2 - pan.x) / zoom;
        const cy = (ch / 2 - pan.y) / zoom;
        const newImg: CanvasImageData = {
          id: nextImageIdRef.current++,
          x: cx - w / 2,
          y: cy - h / 2,
          width: w,
          height: h,
          src: dataUrl,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        };
        layer.images.push(newImg);
        setSelectedImageId(newImg.id);
        setTool('select');
        forceUpdate(n => n + 1);
        redrawRef.current();
        emitChangeRef.current();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, [activeLayerId]);

  // --- PDF import ---
  const handlePdfImport = useCallback(async (file: File) => {
    try {
      toast.loading('📄 Loading PDF...', { id: 'pdf-load' });
      const pdfjsLib = await import('pdfjs-dist');
      // Set worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      pdfDocRef.current = pdf;
      const numPages = pdf.numPages;
      
      const pages: string[] = [];
      const dims: { w: number; h: number }[] = [];
      const scale = 2; // Render at 2x for quality
      const textItemsMap = new Map<number, PdfTextItem[]>();
      
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        pages.push(canvas.toDataURL('image/png'));
        const pageW = viewport.width / scale;
        const pageH = viewport.height / scale;
        dims.push({ w: pageW, h: pageH });

        // Extract text items with positions (at scale=1)
        try {
          const vp1 = page.getViewport({ scale: 1 });
          const textContent = await page.getTextContent();
          const items: PdfTextItem[] = [];
          for (const item of textContent.items) {
            if (!('str' in item) || !item.str) continue;
            const ti = item as any;
            const tx = ti.transform;
            // transform: [scaleX, skewY, skewX, scaleY, translateX, translateY]
            const x = tx[4];
            const y = vp1.height - tx[5]; // PDF coords are bottom-up
            const w = ti.width;
            const h = ti.height || Math.abs(tx[3]);
            // Convert to world coords (centered at origin)
            items.push({
              str: ti.str,
              x: x - pageW / 2,
              y: y - h - pageH / 2,
              width: w,
              height: h,
            });
          }
          textItemsMap.set(i - 1, items);
        } catch {}
      }
      
      pdfTextItemsRef.current = textItemsMap;
      setPdfPages(pages);
      setPdfPageDimensions(dims);
      setPdfPageIndex(0);
      setPdfAnnotations(new Map());
      pdfPageImageCache.current.clear();
      
      // Pre-cache first page image
      const img = new window.Image();
      img.src = pages[0];
      img.onload = () => {
        pdfPageImageCache.current.set(0, img);
        redrawRef.current();
      };
      
      toast.success(t('sketch.pdfLoaded', { pages: `${numPages}` }), { id: 'pdf-load' });
    } catch (error) {
      console.error('PDF import error:', error);
      toast.error(t('sketch.pdfLoadFailed'), { id: 'pdf-load' });
    }
  }, []);

  const handlePdfPageChange = useCallback((newIndex: number) => {
    if (newIndex < 0 || newIndex >= pdfPages.length) return;
    
    // Save current page annotations
    const currentAnnotations = cloneLayers(layersRef.current);
    setPdfAnnotations(prev => {
      const next = new Map(prev);
      next.set(pdfPageIndex, currentAnnotations);
      return next;
    });
    
    // Load target page annotations or create fresh layers
    setPdfPageIndex(newIndex);
    setPdfAnnotations(prev => {
      const saved = prev.get(newIndex);
      if (saved) {
        layersRef.current = saved;
      } else {
        layersRef.current = createDefaultLayers();
      }
      return prev;
    });
    
    // Pre-cache page image
    if (!pdfPageImageCache.current.has(newIndex)) {
      const img = new window.Image();
      img.src = pdfPages[newIndex];
      img.onload = () => {
        pdfPageImageCache.current.set(newIndex, img);
        redrawRef.current();
      };
    }
    
    undoStackRef.current = [];
    redoStackRef.current = [];
    forceUpdate(n => n + 1);
    setTimeout(() => redrawRef.current(), 50);
  }, [pdfPages, pdfPageIndex]);

  const closePdf = useCallback(() => {
    // Save current annotations first
    if (pdfPages.length > 0) {
      const currentAnnotations = cloneLayers(layersRef.current);
      setPdfAnnotations(prev => {
        const next = new Map(prev);
        next.set(pdfPageIndex, currentAnnotations);
        return next;
      });
    }
    setPdfPages([]);
    setPdfPageDimensions([]);
    setPdfPageIndex(0);
    pdfPageImageCache.current.clear();
    layersRef.current = createDefaultLayers();
    undoStackRef.current = [];
    redoStackRef.current = [];
    forceUpdate(n => n + 1);
    redrawRef.current();
    toast('PDF closed');
  }, [pdfPages, pdfPageIndex]);

  // --- Color helpers ---

  const addToRecent = useCallback((c: string) => {
    setRecentColors(prev => {
      const filtered = prev.filter(rc => rc !== c);
      return [c, ...filtered].slice(0, MAX_RECENT_COLORS);
    });
  }, []);

  const applyColor = useCallback((c: string) => {
    setColor(c);
    const [h, s, l] = hexToHsl(c);
    setHslH(h); setHslS(s); setHslL(l);
    addToRecent(c);
  }, [addToRecent]);

  const handleHslChange = useCallback((h: number, s: number, l: number) => {
    const hex = hslToHex(h, s, l);
    setColor(hex); setHslH(h); setHslS(s); setHslL(l);
  }, []);

  // --- Selection helpers ---

  const getSelectedStrokes = useCallback((): Stroke[] => {
    const layer = layersRef.current.find(l => l.id === activeLayerId);
    if (!layer) return [];
    return selectedIndices.map(i => layer.strokes[i]).filter(Boolean);
  }, [selectedIndices, activeLayerId]);

  const clearSelection = useCallback(() => {
    setSelectedIndices([]);
    setSelectionRotation(0);
    selectionActionRef.current = null;
    setSelectedImageId(null);
    setSelectedStickyId(null);
    setSelectedWashiId(null);
  }, []);

  // --- Canvas ---

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { w, h } = canvasSizeRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, w, h);

    const zoom = zoomRef.current;
    const pan = panRef.current;
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw background in world coordinates — infinite canvas
    const vx0 = -pan.x / zoom;
    const vy0 = -pan.y / zoom;
    const vx1 = vx0 + w / zoom;
    const vy1 = vy0 + h / zoom;
    drawBackground(ctx, vx0, vy0, vx1, vy1, background, gridColor, gridOpacity);

    // Draw PDF page as background if loaded
    if (pdfPages.length > 0) {
      const cachedImg = pdfPageImageCache.current.get(pdfPageIndex);
      if (cachedImg && cachedImg.complete) {
        const dim = pdfPageDimensions[pdfPageIndex];
        if (dim) {
          // Center the PDF page at origin
          const px = -dim.w / 2;
          const py = -dim.h / 2;
          ctx.save();
          ctx.drawImage(cachedImg, px, py, dim.w, dim.h);
          // Draw subtle border around page
          ctx.strokeStyle = 'rgba(0,0,0,0.15)';
          ctx.lineWidth = 1 / zoom;
          ctx.strokeRect(px, py, dim.w, dim.h);
          ctx.restore();
        }
      }
    }

    for (const layer of layersRef.current) {
      if (!layer.visible) continue;

      // Check if this layer has any eraser strokes
      const hasEraser = layer.strokes.some(s => s.tool === 'eraser');

      if (hasEraser) {
        // Render strokes on an offscreen canvas so eraser only removes strokes, not background
        const offscreen = document.createElement('canvas');
        offscreen.width = canvas.width;
        offscreen.height = canvas.height;
        const offCtx = offscreen.getContext('2d')!;
        offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        offCtx.imageSmoothingEnabled = true;
        offCtx.imageSmoothingQuality = 'high';
        offCtx.translate(pan.x, pan.y);
        offCtx.scale(zoom, zoom);

        for (let si = 0; si < layer.strokes.length; si++) {
          const stroke = layer.strokes[si];
          if (stroke.isClipMask && isShapeTool(stroke.tool)) {
            offCtx.save();
            drawStroke(offCtx, stroke);
            offCtx.setLineDash([6 / zoom, 4 / zoom]);
            offCtx.strokeStyle = 'hsl(280 80% 60% / 0.6)';
            offCtx.lineWidth = 1.5 / zoom;
            const s2 = stroke.points[0], e2 = stroke.points[stroke.points.length - 1];
            if (stroke.tool === 'rect') {
              offCtx.strokeRect(Math.min(s2.x, e2.x), Math.min(s2.y, e2.y), Math.abs(e2.x - s2.x), Math.abs(e2.y - s2.y));
            } else if (stroke.tool === 'circle') {
              offCtx.beginPath(); offCtx.ellipse((s2.x + e2.x) / 2, (s2.y + e2.y) / 2, Math.abs(e2.x - s2.x) / 2, Math.abs(e2.y - s2.y) / 2, 0, 0, Math.PI * 2); offCtx.stroke();
            }
            offCtx.setLineDash([]);
            offCtx.beginPath();
            const s = stroke.points[0], e = stroke.points[stroke.points.length - 1];
            switch (stroke.tool) {
              case 'rect': offCtx.rect(Math.min(s.x, e.x), Math.min(s.y, e.y), Math.abs(e.x - s.x), Math.abs(e.y - s.y)); break;
              case 'circle': offCtx.ellipse((s.x + e.x) / 2, (s.y + e.y) / 2, Math.abs(e.x - s.x) / 2, Math.abs(e.y - s.y) / 2, 0, 0, Math.PI * 2); break;
              case 'triangle': { const cx2 = (s.x + e.x) / 2; offCtx.moveTo(cx2, s.y); offCtx.lineTo(e.x, e.y); offCtx.lineTo(s.x, e.y); offCtx.closePath(); break; }
              default: offCtx.rect(Math.min(s.x, e.x), Math.min(s.y, e.y), Math.abs(e.x - s.x), Math.abs(e.y - s.y)); break;
            }
            offCtx.clip();
            for (let ci = si + 1; ci < layer.strokes.length; ci++) {
              if (layer.strokes[ci].isClipMask) break;
              drawStroke(offCtx, layer.strokes[ci]);
              si = ci;
            }
            offCtx.restore();
          } else {
            drawStroke(offCtx, stroke);
          }
        }

        // Draw text annotations on offscreen too
        for (const ta of (layer.textAnnotations || [])) {
          offCtx.save();
          const style = `${ta.italic ? 'italic ' : ''}${ta.bold ? 'bold ' : ''}${ta.fontSize}px ${ta.font}`;
          offCtx.font = style;
          offCtx.fillStyle = ta.color;
          offCtx.textBaseline = 'top';
          const lines = ta.text.split('\n');
          for (let li = 0; li < lines.length; li++) {
            offCtx.fillText(lines[li], ta.x, ta.y + li * ta.fontSize * 1.2);
          }
          offCtx.restore();
        }

        // Composite the offscreen layer onto the main canvas
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = layer.opacity;
        const blendComposite = BLEND_MODE_OPTIONS.find(b => b.id === (layer.blendMode || 'normal'))?.composite || 'source-over';
        ctx.globalCompositeOperation = blendComposite;
        ctx.drawImage(offscreen, 0, 0);
        ctx.restore();
        // Restore transform for remaining layers
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.translate(pan.x, pan.y);
        ctx.scale(zoom, zoom);
      } else {
        // No eraser strokes — render directly (faster)
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        const directBlend = BLEND_MODE_OPTIONS.find(b => b.id === (layer.blendMode || 'normal'))?.composite || 'source-over';
        ctx.globalCompositeOperation = directBlend;
        for (let si = 0; si < layer.strokes.length; si++) {
          const stroke = layer.strokes[si];
          if (stroke.isClipMask && isShapeTool(stroke.tool)) {
            ctx.save();
            drawStroke(ctx, stroke);
            ctx.setLineDash([6 / zoom, 4 / zoom]);
            ctx.strokeStyle = 'hsl(280 80% 60% / 0.6)';
            ctx.lineWidth = 1.5 / zoom;
            const s2 = stroke.points[0], e2 = stroke.points[stroke.points.length - 1];
            if (stroke.tool === 'rect') {
              ctx.strokeRect(Math.min(s2.x, e2.x), Math.min(s2.y, e2.y), Math.abs(e2.x - s2.x), Math.abs(e2.y - s2.y));
            } else if (stroke.tool === 'circle') {
              ctx.beginPath(); ctx.ellipse((s2.x + e2.x) / 2, (s2.y + e2.y) / 2, Math.abs(e2.x - s2.x) / 2, Math.abs(e2.y - s2.y) / 2, 0, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.setLineDash([]);
            ctx.beginPath();
            const s = stroke.points[0], e = stroke.points[stroke.points.length - 1];
            switch (stroke.tool) {
              case 'rect': ctx.rect(Math.min(s.x, e.x), Math.min(s.y, e.y), Math.abs(e.x - s.x), Math.abs(e.y - s.y)); break;
              case 'circle': ctx.ellipse((s.x + e.x) / 2, (s.y + e.y) / 2, Math.abs(e.x - s.x) / 2, Math.abs(e.y - s.y) / 2, 0, 0, Math.PI * 2); break;
              case 'triangle': { const cx2 = (s.x + e.x) / 2; ctx.moveTo(cx2, s.y); ctx.lineTo(e.x, e.y); ctx.lineTo(s.x, e.y); ctx.closePath(); break; }
              default: ctx.rect(Math.min(s.x, e.x), Math.min(s.y, e.y), Math.abs(e.x - s.x), Math.abs(e.y - s.y)); break;
            }
            ctx.clip();
            for (let ci = si + 1; ci < layer.strokes.length; ci++) {
              if (layer.strokes[ci].isClipMask) break;
              drawStroke(ctx, layer.strokes[ci]);
              si = ci;
            }
            ctx.restore();
          } else {
            drawStroke(ctx, stroke);
          }
        }
        // Draw text annotations
        for (const ta of (layer.textAnnotations || [])) {
          ctx.save();
          const style = `${ta.italic ? 'italic ' : ''}${ta.bold ? 'bold ' : ''}${ta.fontSize}px ${ta.font}`;
          ctx.font = style;
          ctx.fillStyle = ta.color;
          ctx.textBaseline = 'top';
          const lines = ta.text.split('\n');
          for (let li = 0; li < lines.length; li++) {
            ctx.fillText(lines[li], ta.x, ta.y + li * ta.fontSize * 1.2);
          }
          ctx.restore();
        }
      }
      // Draw images
      for (const img of (layer.images || [])) {
        const htmlImg = getOrLoadImage(img.src);
        if (htmlImg) {
          ctx.save();
          ctx.drawImage(htmlImg, img.x, img.y, img.width, img.height);
          // Draw selection handles if selected
          if (img.id === selectedImageId) {
            ctx.strokeStyle = 'hsl(210 100% 50%)';
            ctx.lineWidth = 2 / zoom;
            ctx.setLineDash([6 / zoom, 4 / zoom]);
            ctx.strokeRect(img.x - 2/zoom, img.y - 2/zoom, img.width + 4/zoom, img.height + 4/zoom);
            ctx.setLineDash([]);
            const hs = HANDLE_SIZE / zoom;
            // 8 handles: 4 corners + 4 edges
            const handlePositions = [
              [img.x, img.y], [img.x + img.width / 2, img.y], [img.x + img.width, img.y],
              [img.x, img.y + img.height / 2], [img.x + img.width, img.y + img.height / 2],
              [img.x, img.y + img.height], [img.x + img.width / 2, img.y + img.height], [img.x + img.width, img.y + img.height],
            ];
            for (const [cx2, cy2] of handlePositions) {
              ctx.fillStyle = '#ffffff';
              ctx.strokeStyle = 'hsl(210 100% 50%)';
              ctx.lineWidth = 1.5 / zoom;
              ctx.beginPath();
              ctx.arc(cx2, cy2, hs, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
          }
          ctx.restore();
        }
      }
      // Draw sticky notes
      for (const sn of (layer.stickyNotes || [])) {
        ctx.save();
        // Apply rotation if any
        if (sn.rotation) {
          const cx = sn.x + sn.width / 2;
          const cy = sn.y + sn.height / 2;
          ctx.translate(cx, cy);
          ctx.rotate(sn.rotation);
          ctx.translate(-cx, -cy);
        }
        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 4;
        // Note body
        ctx.fillStyle = sn.color;
        ctx.beginPath();
        ctx.moveTo(sn.x, sn.y);
        ctx.lineTo(sn.x + sn.width, sn.y);
        ctx.lineTo(sn.x + sn.width, sn.y + sn.height);
        ctx.lineTo(sn.x, sn.y + sn.height);
        ctx.closePath();
        ctx.fill();
        // Folded corner
        ctx.shadowColor = 'transparent';
        const foldSize = Math.min(20, sn.width * 0.12, sn.height * 0.12);
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.beginPath();
        ctx.moveTo(sn.x + sn.width - foldSize, sn.y + sn.height);
        ctx.lineTo(sn.x + sn.width, sn.y + sn.height - foldSize);
        ctx.lineTo(sn.x + sn.width, sn.y + sn.height);
        ctx.closePath();
        ctx.fill();
        // Text
        if (sn.text) {
          ctx.fillStyle = '#1a1a1a';
          ctx.font = `${sn.fontSize}px sans-serif`;
          ctx.textBaseline = 'top';
          const padding = 10;
          const maxW = sn.width - padding * 2;
          const words = sn.text.split(/\n/);
          let lineY = sn.y + padding;
          for (const paragraph of words) {
            const pWords = paragraph.split(' ');
            let line = '';
            for (const word of pWords) {
              const test = line ? line + ' ' + word : word;
              if (ctx.measureText(test).width > maxW && line) {
                ctx.fillText(line, sn.x + padding, lineY);
                lineY += sn.fontSize * 1.3;
                line = word;
              } else {
                line = test;
              }
            }
            if (line) {
              ctx.fillText(line, sn.x + padding, lineY);
              lineY += sn.fontSize * 1.3;
            }
          }
        }
        ctx.restore();
        // Draw selection handles if this sticky is selected (8 handles + rotate)
        if (sn.id === selectedStickyId) {
          ctx.save();
          // Apply rotation transform for handles too
          if (sn.rotation) {
            const cx = sn.x + sn.width / 2;
            const cy = sn.y + sn.height / 2;
            ctx.translate(cx, cy);
            ctx.rotate(sn.rotation);
            ctx.translate(-cx, -cy);
          }
          ctx.strokeStyle = 'hsl(210 100% 50%)';
          ctx.lineWidth = 2 / zoom;
          ctx.setLineDash([6 / zoom, 4 / zoom]);
          ctx.strokeRect(sn.x - 2/zoom, sn.y - 2/zoom, sn.width + 4/zoom, sn.height + 4/zoom);
          ctx.setLineDash([]);
          const hs = HANDLE_SIZE / zoom;
          // 8 handles: 4 corners + 4 edges
          const handlePositions = [
            [sn.x, sn.y], [sn.x + sn.width / 2, sn.y], [sn.x + sn.width, sn.y],
            [sn.x, sn.y + sn.height / 2], [sn.x + sn.width, sn.y + sn.height / 2],
            [sn.x, sn.y + sn.height], [sn.x + sn.width / 2, sn.y + sn.height], [sn.x + sn.width, sn.y + sn.height],
          ];
          for (const [cx2, cy2] of handlePositions) {
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = 'hsl(210 100% 50%)';
            ctx.lineWidth = 1.5 / zoom;
            ctx.beginPath();
            ctx.arc(cx2, cy2, hs, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
          // Rotate handle (above top center)
          const rotX = sn.x + sn.width / 2;
          const rotY = sn.y - 24 / zoom;
          ctx.strokeStyle = 'hsl(210 100% 50%)';
          ctx.lineWidth = 1 / zoom;
          ctx.beginPath(); ctx.moveTo(sn.x + sn.width / 2, sn.y); ctx.lineTo(rotX, rotY); ctx.stroke();
          ctx.beginPath(); ctx.arc(rotX, rotY, hs * 0.7, 0, Math.PI * 2);
          ctx.fillStyle = '#fff'; ctx.fill();
          ctx.strokeStyle = 'hsl(210 100% 50%)'; ctx.lineWidth = 1.5 / zoom; ctx.stroke();
          // Arrow icon in rotate handle
          ctx.beginPath();
          ctx.arc(rotX, rotY, hs * 0.4, -Math.PI * 0.7, Math.PI * 0.3);
          ctx.strokeStyle = 'hsl(210 100% 50%)'; ctx.lineWidth = 1 / zoom; ctx.stroke();
          ctx.restore();
        }
      }
      // Draw washi tapes
      for (const wt of (layer.washiTapes || [])) {
        drawWashiTape(ctx, wt, zoom, wt.id === selectedWashiId);
      }
      if (layer.id === activeLayerId && currentStrokeRef.current) {
        drawStroke(ctx, currentStrokeRef.current);
        // Draw live mirrored strokes
        if (symmetryMode !== 'off') {
          const cw = canvasSizeRef.current.w;
          const ch = canvasSizeRef.current.h;
          const centerX = (cw / 2 - pan.x) / zoom;
          const centerY = (ch / 2 - pan.y) / zoom;
          const cs = currentStrokeRef.current;
          const mirroredStrokes = getSymmetryStrokes(cs, centerX, centerY, symmetryMode);
          mirroredStrokes.forEach(ms => drawStroke(ctx, ms));
        }
      }
      ctx.restore();
    }

    // Draw selection box
    if (selectedIndices.length > 0) {
      const selStrokes = getSelectedStrokes();
      const bbox = getSelectionBBox(selStrokes);
      if (bbox) {
        drawSelectionBox(ctx, bbox, selectionRotation, zoom);
      }
    }

    // Draw marquee rectangle
    if (marqueeRef.current) {
      const m = marqueeRef.current;
      const mx = Math.min(m.startX, m.currentX);
      const my = Math.min(m.startY, m.currentY);
      const mw = Math.abs(m.currentX - m.startX);
      const mh = Math.abs(m.currentY - m.startY);
      if (mw > 2 || mh > 2) {
        ctx.strokeStyle = 'hsl(210 100% 50% / 0.7)';
        ctx.fillStyle = 'hsl(210 100% 50% / 0.08)';
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        ctx.fillRect(mx, my, mw, mh);
        ctx.strokeRect(mx, my, mw, mh);
        ctx.setLineDash([]);
      }
    }

    // Draw PDF text selection highlights
    if (pdfTextDragRef.current || pdfTextSelectionRects.length > 0) {
      const rects = pdfTextSelectionRects;
      for (const r of rects) {
        ctx.fillStyle = 'hsl(210 100% 50% / 0.2)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = 'hsl(210 100% 50% / 0.5)';
        ctx.lineWidth = 1 / zoom;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
      }
    }

    // Draw PDF search match highlights
    if (pdfSearchMatchRects.length > 0) {
      for (const r of pdfSearchMatchRects) {
        ctx.fillStyle = 'hsl(45 100% 50% / 0.3)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = 'hsl(45 100% 40% / 0.7)';
        ctx.lineWidth = 1.5 / zoom;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
      }
    }


    if (symmetryMode !== 'off') {
      const centerX = (canvasSizeRef.current.w / 2 - pan.x) / zoom;
      const centerY = (canvasSizeRef.current.h / 2 - pan.y) / zoom;
      const axes = parseInt(symmetryMode);
      ctx.setLineDash([8 / zoom, 6 / zoom]);
      ctx.lineWidth = 1 / zoom;
      ctx.strokeStyle = 'hsl(280 80% 60% / 0.5)';
      for (let i = 0; i < axes; i++) {
        const angle = (Math.PI * i) / axes;
        const dx = Math.cos(angle) * 10000;
        const dy = Math.sin(angle) * 10000;
        ctx.beginPath();
        ctx.moveTo(centerX - dx, centerY - dy);
        ctx.lineTo(centerX + dx, centerY + dy);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Draw laser pointer trail
    if (laserTrailRef.current.length > 0) {
      const now = Date.now();
      const trailDuration = 1000; // 1 second fade
      // Filter out expired points
      laserTrailRef.current = laserTrailRef.current.filter(p => now - p.time < trailDuration);
      
      for (const point of laserTrailRef.current) {
        const age = now - point.time;
        const alpha = Math.max(0, 1 - age / trailDuration);
        const radius = 4 / zoom;
        
        // Outer glow
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius * 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 30, 30, ${alpha * 0.12})`;
        ctx.fill();
        
        // Mid glow
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 40, 40, ${alpha * 0.25})`;
        ctx.fill();
        
        // Inner bright dot
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 60, 60, ${alpha * 0.9})`;
        ctx.fill();
        
        // White hot center
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
        ctx.fill();
      }
    }

    ctx.restore();
  }, [activeLayerId, background, selectedIndices, selectionRotation, getSelectedStrokes, selectedStickyId, selectedImageId, gridColor, gridOpacity, getOrLoadImage, pdfPages, pdfPageIndex, pdfPageDimensions]);

  // Keep redrawRef in sync
  redrawRef.current = redrawAll;

  // --- Zoom-to-Write box redraw ---
  const redrawZoomWriteBox = useCallback((zwCanvas: HTMLCanvasElement, liveStroke?: Stroke) => {
    const ctx = zwCanvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = zwCanvas.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = ZOOM_WRITE_HEIGHT;
    if (zwCanvas.width !== w * dpr || zwCanvas.height !== h * dpr) {
      zwCanvas.width = w * dpr;
      zwCanvas.height = h * dpr;
    }
    zoomWriteBoxWidthRef.current = w;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = background === 'dark' ? '#1a1a2e' : '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Guide lines for neat writing
    const guideColor = background === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
    const strongGuideColor = background === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
    
    // Baseline (center)
    ctx.strokeStyle = strongGuideColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // x-height line (upper guide)
    ctx.strokeStyle = guideColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.25);
    ctx.lineTo(w, h * 0.25);
    ctx.stroke();

    // Descender line (lower guide)
    ctx.beginPath();
    ctx.moveTo(0, h * 0.75);
    ctx.lineTo(w, h * 0.75);
    ctx.stroke();

    // Top & bottom margin lines
    ctx.strokeStyle = guideColor;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.08);
    ctx.lineTo(w, h * 0.08);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, h * 0.92);
    ctx.lineTo(w, h * 0.92);
    ctx.stroke();
    ctx.setLineDash([]);

    // Transform to show world coordinates at zoom
    ctx.save();
    ctx.translate(-zoomWriteOffsetRef.current.x * ZOOM_WRITE_SCALE, -zoomWriteOffsetRef.current.y * ZOOM_WRITE_SCALE + h / 2);
    ctx.scale(ZOOM_WRITE_SCALE, ZOOM_WRITE_SCALE);

    // Draw existing strokes that are visible in this region
    const worldX0 = zoomWriteOffsetRef.current.x;
    const worldX1 = worldX0 + w / ZOOM_WRITE_SCALE;
    const worldY0 = zoomWriteOffsetRef.current.y - (h / 2) / ZOOM_WRITE_SCALE;
    const worldY1 = zoomWriteOffsetRef.current.y + (h / 2) / ZOOM_WRITE_SCALE;

    for (const layer of layersRef.current) {
      if (!layer.visible) continue;
      ctx.globalAlpha = layer.opacity;
      for (const stroke of layer.strokes) {
        // Quick bbox check
        const bbox = getStrokeBBox(stroke);
        if (bbox.x + bbox.w < worldX0 || bbox.x > worldX1 || bbox.y + bbox.h < worldY0 || bbox.y > worldY1) continue;
        drawStroke(ctx, stroke);
      }
    }

    // Draw live stroke
    if (liveStroke) {
      drawStroke(ctx, liveStroke);
    }

    ctx.restore();

    // Write position indicator (left edge marker)
    ctx.fillStyle = 'hsl(var(--primary))';
    ctx.globalAlpha = 0.6;
    ctx.fillRect(0, 0, 3, h);
    ctx.globalAlpha = 1;

    ctx.restore();
  }, [background]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(rect.width); const h = Math.floor(rect.height);
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    canvasSizeRef.current = { w, h };
    redrawAll();
  }, [redrawAll]);

  // --- Pointer events ---

  // Track whether the last getPos call snapped to a ruler/protractor/triangle
  const lastSnapRef = useRef(false);

  const getPos = (e: PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const zoom = zoomRef.current;
    const pan = panRef.current;
    let wx = (screenX - pan.x) / zoom;
    let wy = (screenY - pan.y) / zoom;
    
    // Zoom-adjusted snap threshold so snapping feels consistent at all zoom levels
    const snapThreshold = 18 / zoom;
    let didSnap = false;
    
    // Snap to physical ruler edge if active
    if (physicalRulerRef.current) {
      const snapped = snapToRuler(wx, wy, physicalRulerRef.current, snapThreshold);
      if (snapped.snapped) {
        wx = snapped.x; wy = snapped.y; didSnap = true;
        // Update measurement display
        if (isDrawingRef.current && rulerDrawStartRef.current) {
          const dx = wx - rulerDrawStartRef.current.x;
          const dy = wy - rulerDrawStartRef.current.y;
          const lengthPx = Math.sqrt(dx * dx + dy * dy);
          setRulerMeasurement({ lengthPx, screenX: e.clientX, screenY: e.clientY });
        } else if (isDrawingRef.current) {
          rulerDrawStartRef.current = { x: wx, y: wy };
        }
      }
    }
    // Snap to protractor flat edge
    if (protractorRef.current) {
      const snapped = snapToProtractor(wx, wy, protractorRef.current, snapThreshold);
      if (snapped.snapped) { wx = snapped.x; wy = snapped.y; didSnap = true; }
    }
    // Snap to triangle edges
    if (triangleRef.current) {
      const snapped = snapToTriangle(wx, wy, triangleRef.current, snapThreshold);
      if (snapped.snapped) { wx = snapped.x; wy = snapped.y; didSnap = true; }
    }
    
    lastSnapRef.current = didSnap;
    
    return {
      x: wx,
      y: wy,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
      timestamp: e.timeStamp,
    };
  };

  const isPalmTouch = (e: PointerEvent): boolean => {
    if (e.pointerType !== 'touch') return false;
    const w = (e as any).width ?? 0;
    const h = (e as any).height ?? 0;
    return w > PALM_REJECTION_RADIUS || h > PALM_REJECTION_RADIUS;
  };

  const handlePlaybackStrokeTapRef = useRef<((x: number, y: number) => boolean) | null>(null);

  const onPointerDown = useCallback((e: PointerEvent) => {
    if (isPalmTouch(e)) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    // Infinite canvas: spacebar+click or middle mouse button panning
    if (isSpacebarDownRef.current || e.button === 1) {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      isPanningRef.current = true;
      setIsPanning(true);
      cancelAnimationFrame(panInertiaRafRef.current);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: panRef.current.x, panY: panRef.current.y };
      lastPanPosRef.current = { x: e.clientX, y: e.clientY };
      lastPanTimeRef.current = Date.now();
      panVelocityRef.current = { vx: 0, vy: 0 };
      return;
    }

    // Audio sync playback: tap on stroke to jump to its timestamp
    if (isAudioSyncPlaying && audioPlaybackRef.current && handlePlaybackStrokeTapRef.current) {
      const point = getPos(e);
      if (handlePlaybackStrokeTapRef.current(point.x, point.y)) {
        return;
      }
    }

    // Presentation mode: handle swipe start for page navigation
    if (presentationMode) {
      presentationSwipeRef.current = { startX: e.clientX, startY: e.clientY };
      // Laser pointer in presentation mode
      if (tool === 'laser') {
        canvas.setPointerCapture(e.pointerId);
        laserActiveRef.current = true;
        const point = getPos(e);
        laserTrailRef.current.push({ x: point.x, y: point.y, time: Date.now() });
        // Start continuous redraw for laser fade
        const animateLaser = () => {
          if (!laserActiveRef.current && laserTrailRef.current.length === 0) return;
          redrawAll();
          if (laserTrailRef.current.length > 0 || laserActiveRef.current) {
            laserRafRef.current = requestAnimationFrame(animateLaser);
          }
        };
        cancelAnimationFrame(laserRafRef.current);
        laserRafRef.current = requestAnimationFrame(animateLaser);
      }
      return;
    }

    // Laser pointer tool (non-presentation mode)
    if (tool === 'laser') {
      canvas.setPointerCapture(e.pointerId);
      laserActiveRef.current = true;
      const point = getPos(e);
      laserTrailRef.current.push({ x: point.x, y: point.y, time: Date.now() });
      const animateLaser = () => {
        if (!laserActiveRef.current && laserTrailRef.current.length === 0) return;
        redrawAll();
        if (laserTrailRef.current.length > 0 || laserActiveRef.current) {
          laserRafRef.current = requestAnimationFrame(animateLaser);
        }
      };
      cancelAnimationFrame(laserRafRef.current);
      laserRafRef.current = requestAnimationFrame(animateLaser);
      return;
    }

    // Eyedropper mode
    if (eyedropperActive) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        const px = Math.floor((e.clientX - rect.left) * dpr);
        const py = Math.floor((e.clientY - rect.top) * dpr);
        const pixel = ctx.getImageData(px, py, 1, 1).data;
        const hex = `#${pixel[0].toString(16).padStart(2, '0')}${pixel[1].toString(16).padStart(2, '0')}${pixel[2].toString(16).padStart(2, '0')}`;
        applyColor(hex);
        setEyedropperActive(false);
      }
      return;
    }

    // --- PDF Text Select tool logic ---
    if (tool === 'pdfTextSelect' && pdfPages.length > 0) {
      const point = getPos(e);
      canvas.setPointerCapture(e.pointerId);
      pdfTextDragRef.current = { startX: point.x, startY: point.y, currentX: point.x, currentY: point.y };
      setPdfSelectedText('');
      setPdfTextSelectionRects([]);
      return;
    }

    // Touch gesture tracking
    if (e.pointerType === 'touch') {
      activeTouchesRef.current.set(e.pointerId, { x: e.clientX - rect.left, y: e.clientY - rect.top });

      if (activeTouchesRef.current.size >= 2) {
        if (isDrawingRef.current) {
          isDrawingRef.current = false;
          currentStrokeRef.current = null;
          lastPointRef.current = null;
          redrawAll();
        }
        const touches = Array.from(activeTouchesRef.current.values());
        const dx = touches[1].x - touches[0].x; const dy = touches[1].y - touches[0].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const midX = (touches[0].x + touches[1].x) / 2; const midY = (touches[0].y + touches[1].y) / 2;
        gestureStateRef.current = {
          isPinching: true, initialDist: dist, initialZoom: zoomRef.current,
          initialPan: { ...panRef.current }, initialMid: { x: midX, y: midY },
        };
        canvas.setPointerCapture(e.pointerId);
        return;
      }

      // Only do global double-tap-to-reset-zoom for draw/eraser tools, not when sticky/select might handle double-tap
      if (tool !== 'sticky' && tool !== 'select') {
        const now = Date.now();
        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
          zoomRef.current = 1; panRef.current = { x: 0, y: 0 }; setZoomDisplay(100); redrawAll();
          lastTapRef.current = 0; return;
        }
        lastTapRef.current = now;
      }
    }

    if (e.pointerType === 'touch' && isDrawingRef.current) return;

    // --- Text tool logic ---
    if (tool === 'text') {
      const point = getPos(e);
      const layer = layersRef.current.find(l => l.id === activeLayerId);
      if (!layer?.visible) return;

      // Check if tapping on existing text annotation to edit it
      let hitAnnotation: TextAnnotation | null = null;
      for (let i = (layer.textAnnotations || []).length - 1; i >= 0; i--) {
        const ta = layer.textAnnotations[i];
        const lines = ta.text.split('\n');
        const textH = lines.length * ta.fontSize * 1.2;
        // Rough width estimate
        const maxLineW = Math.max(...lines.map(l => l.length * ta.fontSize * 0.6));
        if (point.x >= ta.x && point.x <= ta.x + maxLineW && point.y >= ta.y && point.y <= ta.y + textH) {
          hitAnnotation = ta;
          break;
        }
      }

      if (hitAnnotation) {
        setEditingText({ x: hitAnnotation.x, y: hitAnnotation.y, annotationId: hitAnnotation.id });
        setEditingTextValue(hitAnnotation.text);
        setTextFont(hitAnnotation.font);
        setTextFontSize(hitAnnotation.fontSize);
        setTextBold(hitAnnotation.bold);
        setTextItalic(hitAnnotation.italic);
      } else {
        setEditingText({ x: point.x, y: point.y });
        setEditingTextValue('');
      }
      return;
    }

    // --- Sticky note tool logic ---
    if (tool === 'sticky') {
      const point = getPos(e);
      const layer = layersRef.current.find(l => l.id === activeLayerId);
      if (!layer?.visible) return;
      canvas.setPointerCapture(e.pointerId);

      // Check if tapping on existing sticky note
      for (let i = (layer.stickyNotes || []).length - 1; i >= 0; i--) {
        const sn = layer.stickyNotes[i];
        if (point.x >= sn.x - 10/zoomRef.current && point.x <= sn.x + sn.width + 10/zoomRef.current &&
            point.y >= sn.y - 10/zoomRef.current && point.y <= sn.y + sn.height + 10/zoomRef.current) {
          
          // Check for double-tap to edit
          const now = Date.now();
          if (now - stickyLastTapRef.current.time < DOUBLE_TAP_DELAY && stickyLastTapRef.current.id === sn.id) {
            stickyLastTapRef.current = { time: 0, id: -1 };
            setEditingStickyId(sn.id);
            setEditingStickyText(sn.text);
            return;
          }
          stickyLastTapRef.current = { time: now, id: sn.id };

          // If already selected, check rotate handle first, then resize handles, then body for move
          if (selectedStickyId === sn.id) {
            const ha = 20 / zoomRef.current;
            // Check rotate handle (above top center)
            const rotHX = sn.x + sn.width / 2;
            const rotHY = sn.y - 24 / zoomRef.current;
            if (Math.abs(point.x - rotHX) < ha && Math.abs(point.y - rotHY) < ha) {
              undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), cloneLayers(layersRef.current)];
              redoStackRef.current = [];
              stickyDragRef.current = {
                noteId: sn.id, startX: point.x, startY: point.y,
                origX: sn.x, origY: sn.y, type: 'rotate',
                origW: sn.width, origH: sn.height,
                origRotation: sn.rotation || 0,
              };
              redrawAll();
              return;
            }
            type StickyHandleType = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r';
            const handles: { key: StickyHandleType; cx: number; cy: number }[] = [
              { key: 'tl', cx: sn.x, cy: sn.y },
              { key: 't', cx: sn.x + sn.width / 2, cy: sn.y },
              { key: 'tr', cx: sn.x + sn.width, cy: sn.y },
              { key: 'l', cx: sn.x, cy: sn.y + sn.height / 2 },
              { key: 'r', cx: sn.x + sn.width, cy: sn.y + sn.height / 2 },
              { key: 'bl', cx: sn.x, cy: sn.y + sn.height },
              { key: 'b', cx: sn.x + sn.width / 2, cy: sn.y + sn.height },
              { key: 'br', cx: sn.x + sn.width, cy: sn.y + sn.height },
            ];
            let hitHandle: StickyHandleType | null = null;
            for (const h of handles) {
              if (Math.abs(point.x - h.cx) < ha && Math.abs(point.y - h.cy) < ha) {
                hitHandle = h.key;
                break;
              }
            }
            undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), cloneLayers(layersRef.current)];
            redoStackRef.current = [];
            if (hitHandle) {
              stickyDragRef.current = {
                noteId: sn.id, startX: point.x, startY: point.y,
                origX: sn.x, origY: sn.y, type: 'resize',
                origW: sn.width, origH: sn.height, handle: hitHandle,
              };
            } else if (point.x >= sn.x && point.x <= sn.x + sn.width &&
                       point.y >= sn.y && point.y <= sn.y + sn.height) {
              stickyDragRef.current = {
                noteId: sn.id, startX: point.x, startY: point.y,
                origX: sn.x, origY: sn.y, type: 'move',
              };
            }
          } else {
            // Single click: select the sticky note
            setSelectedStickyId(sn.id);
          }
          redrawAll();
          return;
        }
      }

      // Tapped empty space: deselect any sticky
      if (selectedStickyId != null) {
        setSelectedStickyId(null);
        redrawAll();
        return;
      }

      // Create new sticky note
      undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), cloneLayers(layersRef.current)];
      redoStackRef.current = [];
      if (!layer.stickyNotes) layer.stickyNotes = [];
      const newNote: StickyNoteData = {
        id: nextStickyIdRef.current++,
        x: point.x - 75,
        y: point.y - 75,
        width: 150,
        height: 150,
        text: '',
        color: stickyColor,
        fontSize: 14,
      };
      layer.stickyNotes.push(newNote);
      // Auto-select the new note
      setSelectedStickyId(newNote.id);
      setEditingStickyText('');
      forceUpdate(n => n + 1);
      redrawAll();
      emitChange();
      return;
    }

    // --- Image tool logic ---
    if (tool === 'image') {
      imageInputRef.current?.click();
      return;
    }

    // --- Washi tape tool logic (freeform stroke-based) ---
    if (tool === 'washi') {
      const point = getPos(e);
      const layer = layersRef.current.find(l => l.id === activeLayerId);
      if (!layer) return;

      // Check if clicking on an existing (legacy) washi tape for selection/move
      if (!layer.washiTapes) layer.washiTapes = [];
      for (let i = layer.washiTapes.length - 1; i >= 0; i--) {
        const wt = layer.washiTapes[i];
        const cx = wt.x + wt.width / 2;
        const cy = wt.y + wt.height / 2;
        const cos = Math.cos(-wt.rotation);
        const sin = Math.sin(-wt.rotation);
        const dx = point.x - cx;
        const dy = point.y - cy;
        const lx = dx * cos - dy * sin + wt.width / 2;
        const ly = dx * sin + dy * cos + wt.height / 2;
        const ha = 12 / zoomRef.current;

        if (selectedWashiId === wt.id) {
          const rotHX = wt.width / 2;
          const rotHY = -20 / zoomRef.current;
          if (Math.abs(lx - rotHX) < ha && Math.abs(ly - rotHY) < ha) {
            undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), cloneLayers(layersRef.current)];
            redoStackRef.current = [];
            washiDragRef.current = { tapeId: wt.id, startX: e.clientX, startY: e.clientY, origX: wt.x, origY: wt.y, type: 'rotate', origRotation: wt.rotation };
            canvas.setPointerCapture(e.pointerId);
            return;
          }
          const corners: [number, number, 'tl' | 'tr' | 'bl' | 'br'][] = [
            [0, 0, 'tl'], [wt.width, 0, 'tr'], [0, wt.height, 'bl'], [wt.width, wt.height, 'br'],
          ];
          for (const [hx, hy, handle] of corners) {
            if (Math.abs(lx - hx) < ha && Math.abs(ly - hy) < ha) {
              undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), cloneLayers(layersRef.current)];
              redoStackRef.current = [];
              washiDragRef.current = { tapeId: wt.id, startX: e.clientX, startY: e.clientY, origX: wt.x, origY: wt.y, type: 'resize', origW: wt.width, origH: wt.height, handle };
              canvas.setPointerCapture(e.pointerId);
              return;
            }
          }
        }

        if (lx >= 0 && lx <= wt.width && ly >= 0 && ly <= wt.height) {
          undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), cloneLayers(layersRef.current)];
          redoStackRef.current = [];
          setSelectedWashiId(wt.id);
          washiDragRef.current = { tapeId: wt.id, startX: e.clientX, startY: e.clientY, origX: wt.x, origY: wt.y, type: 'move' };
          canvas.setPointerCapture(e.pointerId);
          return;
        }
      }

      // Freeform drawing: fall through to normal stroke creation below
      // (washi will be treated as a stroke-based drawing tool)
      setSelectedWashiId(null);
    }

    // --- Select tool logic ---
    if (tool === 'select') {
      const point = getPos(e);
      const layer = layersRef.current.find(l => l.id === activeLayerId);
      if (!layer?.visible) return;
      canvas.setPointerCapture(e.pointerId);

      // Check if clicking on existing selection handles
      if (selectedIndices.length > 0) {
        const selStrokes = selectedIndices.map(i => layer.strokes[i]).filter(Boolean);
        const bbox = getSelectionBBox(selStrokes);
        if (bbox) {
          const handle = hitTestHandle(point.x, point.y, bbox, zoomRef.current);
          if (handle) {
            selectionActionRef.current = {
              type: handle,
              startPos: { x: point.x, y: point.y },
              origBBox: { ...bbox },
              origStrokes: cloneStrokes(selStrokes),
              origRotation: selectionRotation,
            };
            // Push undo snapshot
            undoStackRef.current = [
              ...undoStackRef.current.slice(-(MAX_UNDO - 1)),
              cloneLayers(layersRef.current),
            ];
            redoStackRef.current = [];
            return;
          }
        }
      }

      // Hit test sticky notes first (back to front) - single click selects, double click edits
      for (let i = (layer.stickyNotes || []).length - 1; i >= 0; i--) {
        const sn = layer.stickyNotes[i];
        if (point.x >= sn.x - 10/zoomRef.current && point.x <= sn.x + sn.width + 10/zoomRef.current &&
            point.y >= sn.y - 10/zoomRef.current && point.y <= sn.y + sn.height + 10/zoomRef.current) {
          
          // Check for double-tap to edit
          const now = Date.now();
          if (now - stickyLastTapRef.current.time < DOUBLE_TAP_DELAY && stickyLastTapRef.current.id === sn.id) {
            stickyLastTapRef.current = { time: 0, id: -1 };
            clearSelection();
            setEditingStickyId(sn.id);
            setEditingStickyText(sn.text);
            redrawAll();
            return;
          }
          stickyLastTapRef.current = { time: now, id: sn.id };

          // If already selected, check rotate handle first, then resize handles, then body for move
          if (selectedStickyId === sn.id) {
            const ha = 20 / zoomRef.current;
            // Check rotate handle (above top center)
            const rotHX = sn.x + sn.width / 2;
            const rotHY = sn.y - 24 / zoomRef.current;
            if (Math.abs(point.x - rotHX) < ha && Math.abs(point.y - rotHY) < ha) {
              undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), cloneLayers(layersRef.current)];
              redoStackRef.current = [];
              stickyDragRef.current = {
                noteId: sn.id, startX: point.x, startY: point.y,
                origX: sn.x, origY: sn.y, type: 'rotate',
                origW: sn.width, origH: sn.height,
                origRotation: sn.rotation || 0,
              };
              redrawAll();
              return;
            }
            type StickyHandleType = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r';
            const handles: { key: StickyHandleType; cx: number; cy: number }[] = [
              { key: 'tl', cx: sn.x, cy: sn.y },
              { key: 't', cx: sn.x + sn.width / 2, cy: sn.y },
              { key: 'tr', cx: sn.x + sn.width, cy: sn.y },
              { key: 'l', cx: sn.x, cy: sn.y + sn.height / 2 },
              { key: 'r', cx: sn.x + sn.width, cy: sn.y + sn.height / 2 },
              { key: 'bl', cx: sn.x, cy: sn.y + sn.height },
              { key: 'b', cx: sn.x + sn.width / 2, cy: sn.y + sn.height },
              { key: 'br', cx: sn.x + sn.width, cy: sn.y + sn.height },
            ];
            let hitHandle: StickyHandleType | null = null;
            for (const h of handles) {
              if (Math.abs(point.x - h.cx) < ha && Math.abs(point.y - h.cy) < ha) {
                hitHandle = h.key;
                break;
              }
            }
            undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), cloneLayers(layersRef.current)];
            redoStackRef.current = [];
            if (hitHandle) {
              stickyDragRef.current = {
                noteId: sn.id, startX: point.x, startY: point.y,
                origX: sn.x, origY: sn.y, type: 'resize',
                origW: sn.width, origH: sn.height, handle: hitHandle,
              };
            } else if (point.x >= sn.x && point.x <= sn.x + sn.width &&
                       point.y >= sn.y && point.y <= sn.y + sn.height) {
              stickyDragRef.current = {
                noteId: sn.id, startX: point.x, startY: point.y,
                origX: sn.x, origY: sn.y, type: 'move',
              };
            }
            redrawAll();
            return;
          }

          // Single click: select the sticky
          clearSelection();
          setSelectedStickyId(sn.id);
          redrawAll();
          return;
        }
      }

      // Hit test images (back to front)
      for (let i = (layer.images || []).length - 1; i >= 0; i--) {
        const img = layer.images[i];
        if (point.x >= img.x - 10/zoomRef.current && point.x <= img.x + img.width + 10/zoomRef.current &&
            point.y >= img.y - 10/zoomRef.current && point.y <= img.y + img.height + 10/zoomRef.current) {
          clearSelection();
          setSelectedImageId(img.id);
          const ha = 20 / zoomRef.current;
          // Detect which handle is hit (8 handles)
          type HandleType = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r';
          const handles: { key: HandleType; cx: number; cy: number }[] = [
            { key: 'tl', cx: img.x, cy: img.y },
            { key: 't', cx: img.x + img.width / 2, cy: img.y },
            { key: 'tr', cx: img.x + img.width, cy: img.y },
            { key: 'l', cx: img.x, cy: img.y + img.height / 2 },
            { key: 'r', cx: img.x + img.width, cy: img.y + img.height / 2 },
            { key: 'bl', cx: img.x, cy: img.y + img.height },
            { key: 'b', cx: img.x + img.width / 2, cy: img.y + img.height },
            { key: 'br', cx: img.x + img.width, cy: img.y + img.height },
          ];
          let hitHandle: HandleType | null = null;
          for (const h of handles) {
            if (Math.abs(point.x - h.cx) < ha && Math.abs(point.y - h.cy) < ha) {
              hitHandle = h.key;
              break;
            }
          }
          undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), cloneLayers(layersRef.current)];
          redoStackRef.current = [];
          if (hitHandle) {
            imageDragRef.current = {
              imageId: img.id, startX: point.x, startY: point.y,
              origX: img.x, origY: img.y, type: 'resize',
              origW: img.width, origH: img.height, handle: hitHandle,
            };
          } else if (point.x >= img.x && point.x <= img.x + img.width &&
                     point.y >= img.y && point.y <= img.y + img.height) {
            imageDragRef.current = {
              imageId: img.id, startX: point.x, startY: point.y,
              origX: img.x, origY: img.y, type: 'move',
            };
          }
          redrawAll();
          return;
        }
      }

      // Hit test washi tapes (back to front)
      for (let i = (layer.washiTapes || []).length - 1; i >= 0; i--) {
        const wt = layer.washiTapes[i];
        const wcx = wt.x + wt.width / 2;
        const wcy = wt.y + wt.height / 2;
        const cos = Math.cos(-wt.rotation);
        const sin = Math.sin(-wt.rotation);
        const wdx = point.x - wcx;
        const wdy = point.y - wcy;
        const lx = wdx * cos - wdy * sin + wt.width / 2;
        const ly = wdx * sin + wdy * cos + wt.height / 2;
        if (lx >= 0 && lx <= wt.width && ly >= 0 && ly <= wt.height) {
          clearSelection();
          setSelectedWashiId(wt.id);
          undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), cloneLayers(layersRef.current)];
          redoStackRef.current = [];
          washiDragRef.current = { tapeId: wt.id, startX: e.clientX, startY: e.clientY, origX: wt.x, origY: wt.y, type: 'move' };
          canvas.setPointerCapture(e.pointerId);
          redrawAll();
          return;
        }
      }

      // Hit test strokes (back to front)
      let hitIdx = -1;
      for (let i = layer.strokes.length - 1; i >= 0; i--) {
        if (hitTestStroke(layer.strokes[i], point.x, point.y, HIT_TOLERANCE / zoomRef.current)) {
          hitIdx = i;
          break;
        }
      }

      if (hitIdx >= 0) {
        setSelectedIndices([hitIdx]);
        setSelectionRotation(0);
      } else {
        clearSelection();
        // Start marquee selection
        marqueeRef.current = { startX: point.x, startY: point.y, currentX: point.x, currentY: point.y };
      }
      redrawAll();
      return;
    }

    // --- Drawing tools ---
    const layer = layersRef.current.find(l => l.id === activeLayerId);
    if (!layer?.visible) return;

    // Clear selection when switching to drawing
    if (selectedIndices.length > 0) clearSelection();

    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    currentPressureRef.current = e.pressure > 0 ? e.pressure : 0.5;
    setPressureValue(currentPressureRef.current);
    setShowPressure(true);

    const point = getPos(e);
    lastPointRef.current = point;

    let strokeColor = color;
    if (toolOpacity < 1) strokeColor = hexToRgba(color, toolOpacity);

    // Stamp first point with audio offset for real-time sync
    if (isAudioRecording && audioRecordingStartRef.current > 0) {
      point.timestamp = Date.now() - audioRecordingStartRef.current;
    }

    const startPoint = snapEnabled && isShapeTool(tool)
      ? { ...point, x: snapToGrid(point.x, GRID_SIZES[background]), y: snapToGrid(point.y, GRID_SIZES[background]) }
      : point;

    currentStrokeRef.current = {
      points: [startPoint],
      color: strokeColor,
      width: strokeWidth,
      tool,
      ...(isShapeTool(tool) && fillEnabled ? { fillColor, fillOpacity } : {}),
      ...(tool === 'textHighlight' ? { fillOpacity: highlightOpacity } : {}),
      ...(pressureOpacityEnabled && !isShapeTool(tool) && tool !== 'eraser' ? { pressureOpacity: true } : {}),
      ...(tool === 'washi' ? { washiPatternId } : {}),
      ...(!isShapeTool(tool) && tool !== 'eraser' ? { brushSettings: currentBrushSettings } : {}),
    };

    // Initialize scribble-to-erase detector for draw tools (not shapes/eraser/select/etc)
    const drawTools: ToolType[] = ['pencil', 'pen', 'marker', 'highlighter', 'calligraphy', 'spray', 'fountain', 'crayon', 'watercolor', 'dotpen', 'neon', 'washi'];
    if (drawTools.includes(tool)) {
      scribbleDetectorRef.current = {
        directionChanges: 0,
        lastDx: 0, lastDy: 0,
        pointCount: 0,
        minX: startPoint.x, minY: startPoint.y,
        maxX: startPoint.x, maxY: startPoint.y,
        triggered: false,
      };
    } else {
      scribbleDetectorRef.current = null;
    }
  }, [color, strokeWidth, tool, activeLayerId, redrawAll, eyedropperActive, applyColor, toolOpacity, selectedIndices, selectionRotation, clearSelection, fillEnabled, fillColor, fillOpacity, snapEnabled, background, pressureOpacityEnabled, highlightOpacity, presentationMode, isAudioSyncPlaying, washiPatternId]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    // Infinite canvas: panning in progress
    if (isPanningRef.current && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      panRef.current = { x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy };
      // Track velocity for inertia
      const now = Date.now();
      const dt = now - lastPanTimeRef.current;
      if (dt > 0) {
        const alpha = 0.4;
        panVelocityRef.current = {
          vx: panVelocityRef.current.vx * (1 - alpha) + (e.clientX - lastPanPosRef.current.x) * alpha,
          vy: panVelocityRef.current.vy * (1 - alpha) + (e.clientY - lastPanPosRef.current.y) * alpha,
        };
      }
      lastPanPosRef.current = { x: e.clientX, y: e.clientY };
      lastPanTimeRef.current = now;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(redrawAll);
      return;
    }

    if (e.pointerType === 'touch' && activeTouchesRef.current.has(e.pointerId)) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      activeTouchesRef.current.set(e.pointerId, { x: e.clientX - rect.left, y: e.clientY - rect.top });

      const gesture = gestureStateRef.current;
      if (gesture?.isPinching && activeTouchesRef.current.size >= 2) {
        const touches = Array.from(activeTouchesRef.current.values());
        const dx = touches[1].x - touches[0].x; const dy = touches[1].y - touches[0].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const midX = (touches[0].x + touches[1].x) / 2; const midY = (touches[0].y + touches[1].y) / 2;
        const scale = dist / gesture.initialDist;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, gesture.initialZoom * scale));
        const panDx = midX - gesture.initialMid.x; const panDy = midY - gesture.initialMid.y;
        zoomRef.current = newZoom;
        panRef.current = { x: gesture.initialPan.x + panDx, y: gesture.initialPan.y + panDy };
        setZoomDisplay(Math.round(newZoom * 100));
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(redrawAll);
        return;
      }
    }

    // PDF text select drag — multi-line aware selection
    if (pdfTextDragRef.current && tool === 'pdfTextSelect') {
      const point = getPos(e);
      pdfTextDragRef.current.currentX = point.x;
      pdfTextDragRef.current.currentY = point.y;
      const drag = pdfTextDragRef.current;
      const textItems = pdfTextItemsRef.current.get(pdfPageIndex) || [];
      if (textItems.length === 0) { redrawAll(); return; }

      // Sort text items top-to-bottom, left-to-right for reading order
      const sorted = [...textItems].sort((a, b) => {
        const lineTolerance = Math.min(a.height, b.height) * 0.5;
        if (Math.abs(a.y - b.y) < lineTolerance) return a.x - b.x;
        return a.y - b.y;
      });

      // Find start and end items closest to drag start/end
      const findClosest = (px: number, py: number) => {
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < sorted.length; i++) {
          const ti = sorted[i];
          const cx = ti.x + ti.width / 2;
          const cy = ti.y + ti.height / 2;
          const d = (cx - px) ** 2 + (cy - py) ** 2;
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
        return bestIdx;
      };

      const startIdx = findClosest(drag.startX, drag.startY);
      const endIdx = findClosest(drag.currentX, drag.currentY);
      const lo = Math.min(startIdx, endIdx);
      const hi = Math.max(startIdx, endIdx);

      const selectedItems: PdfTextItem[] = [];
      const rects: { x: number; y: number; w: number; h: number }[] = [];
      for (let i = lo; i <= hi; i++) {
        const ti = sorted[i];
        selectedItems.push(ti);
        rects.push({ x: ti.x, y: ti.y, w: ti.width, h: ti.height });
      }

      setPdfTextSelectionRects(rects);
      setPdfSelectedText(selectedItems.map(i => i.str).join(' '));
      redrawAll();
      return;
    }

    // Washi tape drag/resize/rotate
    if (washiDragRef.current) {
      const layer = layersRef.current.find(l => l.id === activeLayerId);
      const tape = layer?.washiTapes?.find(wt => wt.id === washiDragRef.current!.tapeId);
      if (tape && layer) {
        const zoom = zoomRef.current;
        const dx = (e.clientX - washiDragRef.current.startX) / zoom;
        const dy = (e.clientY - washiDragRef.current.startY) / zoom;
        if (washiDragRef.current.type === 'move') {
          tape.x = washiDragRef.current.origX + dx;
          tape.y = washiDragRef.current.origY + dy;
        } else if (washiDragRef.current.type === 'create') {
          tape.width = Math.max(10, Math.abs(dx));
          if (dx < 0) tape.x = washiDragRef.current.origX + dx;
        } else if (washiDragRef.current.type === 'resize') {
          const ow = washiDragRef.current.origW || tape.width;
          const oh = washiDragRef.current.origH || tape.height;
          const h = washiDragRef.current.handle;
          if (h === 'br') { tape.width = Math.max(20, ow + dx); tape.height = Math.max(10, oh + dy); }
          else if (h === 'tr') { tape.width = Math.max(20, ow + dx); tape.height = Math.max(10, oh - dy); tape.y = washiDragRef.current.origY + dy; }
          else if (h === 'bl') { tape.width = Math.max(20, ow - dx); tape.x = washiDragRef.current.origX + dx; tape.height = Math.max(10, oh + dy); }
          else if (h === 'tl') { tape.width = Math.max(20, ow - dx); tape.height = Math.max(10, oh - dy); tape.x = washiDragRef.current.origX + dx; tape.y = washiDragRef.current.origY + dy; }
        } else if (washiDragRef.current.type === 'rotate') {
          const cx = tape.x + tape.width / 2;
          const cy = tape.y + tape.height / 2;
          const point = getPos(e);
          tape.rotation = Math.atan2(point.y - cy, point.x - cx) + Math.PI / 2;
        }
        redrawAll();
      }
      return;
    }

    // Sticky note drag/resize (works in both sticky and select tool)
    if (stickyDragRef.current) {
      const point = getPos(e);
      const drag = stickyDragRef.current;
      const dx = point.x - drag.startX;
      const dy = point.y - drag.startY;
      const layer = layersRef.current.find(l => l.id === activeLayerId);
      if (!layer) return;
      const sn = (layer.stickyNotes || []).find(s => s.id === drag.noteId);
      if (!sn) return;
      if (drag.type === 'move') {
        sn.x = drag.origX + dx;
        sn.y = drag.origY + dy;
      } else if (drag.type === 'rotate') {
        // Calculate angle from center of sticky to pointer
        const cx = sn.x + sn.width / 2;
        const cy = sn.y + sn.height / 2;
        const startAngle = Math.atan2(drag.startY - cy, drag.startX - cx);
        const currentAngle = Math.atan2(point.y - cy, point.x - cx);
        sn.rotation = (drag.origRotation || 0) + (currentAngle - startAngle);
      } else {
        const oW = drag.origW || 150;
        const oH = drag.origH || 150;
        const oX = drag.origX;
        const oY = drag.origY;
        const h = drag.handle || 'br';
        let newX = oX, newY = oY, newW = oW, newH = oH;
        if (h === 'br') { newW = oW + dx; newH = oH + dy; }
        else if (h === 'bl') { newX = oX + dx; newW = oW - dx; newH = oH + dy; }
        else if (h === 'tr') { newY = oY + dy; newW = oW + dx; newH = oH - dy; }
        else if (h === 'tl') { newX = oX + dx; newY = oY + dy; newW = oW - dx; newH = oH - dy; }
        else if (h === 't') { newY = oY + dy; newH = oH - dy; }
        else if (h === 'b') { newH = oH + dy; }
        else if (h === 'l') { newX = oX + dx; newW = oW - dx; }
        else if (h === 'r') { newW = oW + dx; }
        if (newW < 60) { newW = 60; if (h === 'tl' || h === 'bl' || h === 'l') newX = oX + oW - 60; }
        if (newH < 60) { newH = 60; if (h === 'tl' || h === 'tr' || h === 't') newY = oY + oH - 60; }
        sn.x = newX; sn.y = newY; sn.width = newW; sn.height = newH;
      }
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(redrawAll);
      return;
    }

    // Image drag/resize
    if (imageDragRef.current) {
      const point = getPos(e);
      const drag = imageDragRef.current;
      const dx = point.x - drag.startX;
      const dy = point.y - drag.startY;
      const layer = layersRef.current.find(l => l.id === activeLayerId);
      if (!layer) return;
      const img = (layer.images || []).find(im => im.id === drag.imageId);
      if (!img) return;
      if (drag.type === 'move') {
        img.x = drag.origX + dx;
        img.y = drag.origY + dy;
      } else {
        const oW = drag.origW || 100;
        const oH = drag.origH || 100;
        const oX = drag.origX;
        const oY = drag.origY;
        const h = drag.handle || 'br';
        let newX = oX, newY = oY, newW = oW, newH = oH;
        if (h === 'br') { newW = oW + dx; newH = oH + dy; }
        else if (h === 'bl') { newX = oX + dx; newW = oW - dx; newH = oH + dy; }
        else if (h === 'tr') { newY = oY + dy; newW = oW + dx; newH = oH - dy; }
        else if (h === 'tl') { newX = oX + dx; newY = oY + dy; newW = oW - dx; newH = oH - dy; }
        else if (h === 't') { newY = oY + dy; newH = oH - dy; }
        else if (h === 'b') { newH = oH + dy; }
        else if (h === 'l') { newX = oX + dx; newW = oW - dx; }
        else if (h === 'r') { newW = oW + dx; }
        if (newW < 20) { newW = 20; if (h === 'tl' || h === 'bl' || h === 'l') newX = oX + oW - 20; }
        if (newH < 20) { newH = 20; if (h === 'tl' || h === 'tr' || h === 't') newY = oY + oH - 20; }
        img.x = newX; img.y = newY; img.width = newW; img.height = newH;
      }
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(redrawAll);
      return;
    }

    // Selection dragging
    if (tool === 'select' && selectionActionRef.current) {
      const point = getPos(e);
      const action = selectionActionRef.current;
      const layer = layersRef.current.find(l => l.id === activeLayerId);
      if (!layer) return;

      const dx = point.x - action.startPos.x;
      const dy = point.y - action.startPos.y;

      if (action.type === 'body') {
        // Move
        const transformed = action.origStrokes.map(s => ({
          ...s,
          points: s.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })),
        }));
        for (let i = 0; i < selectedIndices.length; i++) {
          if (selectedIndices[i] < layer.strokes.length) {
            layer.strokes[selectedIndices[i]] = transformed[i];
          }
        }
      } else if (action.type === 'rotate') {
        const cx = action.origBBox.x + action.origBBox.w / 2;
        const cy = action.origBBox.y + action.origBBox.h / 2;
        const startAngle = Math.atan2(action.startPos.y - cy, action.startPos.x - cx);
        const currAngle = Math.atan2(point.y - cy, point.x - cx);
        const rotation = currAngle - startAngle;
        setSelectionRotation(action.origRotation + rotation);

        const transformed = transformStrokes(action.origStrokes, action.origBBox, action.origBBox, rotation);
        for (let i = 0; i < selectedIndices.length; i++) {
          if (selectedIndices[i] < layer.strokes.length) {
            layer.strokes[selectedIndices[i]] = transformed[i];
          }
        }
      } else {
        // Resize
        const ob = action.origBBox;
        let newX = ob.x, newY = ob.y, newW = ob.w, newH = ob.h;

        switch (action.type) {
          case 'br': newW = Math.max(10, ob.w + dx); newH = Math.max(10, ob.h + dy); break;
          case 'bl': newX = ob.x + dx; newW = Math.max(10, ob.w - dx); newH = Math.max(10, ob.h + dy); break;
          case 'tr': newW = Math.max(10, ob.w + dx); newY = ob.y + dy; newH = Math.max(10, ob.h - dy); break;
          case 'tl': newX = ob.x + dx; newY = ob.y + dy; newW = Math.max(10, ob.w - dx); newH = Math.max(10, ob.h - dy); break;
        }

        const newBBox: BBox = { x: newX, y: newY, w: newW, h: newH };
        const transformed = transformStrokes(action.origStrokes, ob, newBBox, 0);
        for (let i = 0; i < selectedIndices.length; i++) {
          if (selectedIndices[i] < layer.strokes.length) {
            layer.strokes[selectedIndices[i]] = transformed[i];
          }
        }
      }

      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(redrawAll);
      return;
    }

    // Marquee drag
    if (tool === 'select' && marqueeRef.current) {
      const point = getPos(e);
      marqueeRef.current.currentX = point.x;
      marqueeRef.current.currentY = point.y;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(redrawAll);
      return;
    }

    // Laser pointer tracking in move
    if (tool === 'laser' && laserActiveRef.current) {
      const point = getPos(e);
      laserTrailRef.current.push({ x: point.x, y: point.y, time: Date.now() });
      return;
    }

    // Presentation mode swipe tracking
    if (presentationMode && presentationSwipeRef.current && tool !== 'laser') {
      return; // just track, handle in pointerUp
    }

    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    if (isPalmTouch(e)) return;

    const point = getPos(e);
    currentPressureRef.current = e.pressure > 0 ? e.pressure : 0.5;
    setPressureValue(currentPressureRef.current);

    if (isShapeTool(currentStrokeRef.current.tool)) {
      const snapped = snapEnabled
        ? { ...point, x: snapToGrid(point.x, GRID_SIZES[background]), y: snapToGrid(point.y, GRID_SIZES[background]) }
        : point;
      currentStrokeRef.current.points = [currentStrokeRef.current.points[0], snapped];
    } else {
      const last = lastPointRef.current;
      const wasSnapped = lastSnapRef.current;
      if (last) {
        const dx = point.x - last.x; const dy = point.y - last.y;
        if (dx * dx + dy * dy < MIN_POINT_DISTANCE * MIN_POINT_DISTANCE) return;
        // Skip smoothing when snapped to ruler/protractor/triangle for perfectly straight lines
        if (!wasSnapped) {
          // Apply exponential moving average smoothing for silky lines
          point.x = last.x + (point.x - last.x) * (1 - SMOOTHING_FACTOR);
          point.y = last.y + (point.y - last.y) * (1 - SMOOTHING_FACTOR);
        }
        // Smooth pressure too to avoid sudden width jumps
        point.pressure = last.pressure * SMOOTHING_FACTOR + point.pressure * (1 - SMOOTHING_FACTOR);
      }
      lastPointRef.current = point;
      // For textHighlight, snap Y to starting point for straight band
      if (currentStrokeRef.current.tool === 'textHighlight' && currentStrokeRef.current.points.length > 0) {
        point.y = currentStrokeRef.current.points[0].y;
      }
      // Stamp each point with audio offset for real-time sync playback
      if (isAudioRecording && audioRecordingStartRef.current > 0) {
        point.timestamp = Date.now() - audioRecordingStartRef.current;
      }
      currentStrokeRef.current.points.push(point);

      // Scribble-to-erase detection: track direction changes in small area
      const sd = scribbleDetectorRef.current;
      if (sd && !sd.triggered && currentStrokeRef.current.points.length >= 3) {
        const pts = currentStrokeRef.current.points;
        const prev = pts[pts.length - 2];
        const dx = point.x - prev.x;
        const dy = point.y - prev.y;
        // Update bounding box
        sd.minX = Math.min(sd.minX, point.x);
        sd.minY = Math.min(sd.minY, point.y);
        sd.maxX = Math.max(sd.maxX, point.x);
        sd.maxY = Math.max(sd.maxY, point.y);
        sd.pointCount++;
        // Detect direction reversal (dot product < 0 means reversal)
        if (sd.lastDx !== 0 || sd.lastDy !== 0) {
          const dot = dx * sd.lastDx + dy * sd.lastDy;
          if (dot < 0) sd.directionChanges++;
        }
        sd.lastDx = dx;
        sd.lastDy = dy;
        // Check scribble conditions: many direction changes in a small bounding box
        const bboxW = sd.maxX - sd.minX;
        const bboxH = sd.maxY - sd.minY;
        const bboxArea = bboxW * bboxH;
        const maxBboxSize = 120 / zoomRef.current; // Scale-aware threshold
        if (sd.directionChanges >= 6 && sd.pointCount >= 12 && bboxW < maxBboxSize && bboxH < maxBboxSize && bboxArea > 0) {
          sd.triggered = true;
          // Erase strokes under the scribble area
          const layer = layersRef.current.find(l => l.id === activeLayerId);
          if (layer) {
            const eraseBbox = { x: sd.minX, y: sd.minY, w: bboxW, h: bboxH };
            const toRemove: number[] = [];
            for (let i = 0; i < layer.strokes.length; i++) {
              const s = layer.strokes[i];
              if (s === currentStrokeRef.current || s.tool === 'eraser') continue;
              // Check if any point of the stroke is inside the scribble bbox
              for (const sp of s.points) {
                if (sp.x >= eraseBbox.x && sp.x <= eraseBbox.x + eraseBbox.w &&
                    sp.y >= eraseBbox.y && sp.y <= eraseBbox.y + eraseBbox.h) {
                  toRemove.push(i);
                  break;
                }
              }
            }
            if (toRemove.length > 0) {
              // Collect colors from erased strokes for particle effect
              const erasedColors = toRemove.map(i => layer.strokes[i].color);
              const cx = (sd.minX + sd.maxX) / 2;
              const cy = (sd.minY + sd.maxY) / 2;
              const radius = Math.max(bboxW, bboxH) / 2;

              undoStackRef.current = [...undoStackRef.current.slice(-(50 - 1)), cloneLayers(layersRef.current)];
              redoStackRef.current = [];
              layer.strokes = layer.strokes.filter((_, i) => !toRemove.includes(i) && layer.strokes[i] !== currentStrokeRef.current);
              // Cancel current stroke (the scribble itself)
              currentStrokeRef.current = null;
              isDrawingRef.current = false;
              lastPointRef.current = null;
              scribbleDetectorRef.current = null;

              // Spawn dissolve particles
              const particles: { x: number; y: number; vx: number; vy: number; r: number; opacity: number; color: string }[] = [];
              for (let p = 0; p < 28; p++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = (0.5 + Math.random() * 2) / zoomRef.current;
                particles.push({
                  x: cx + (Math.random() - 0.5) * radius * 1.5,
                  y: cy + (Math.random() - 0.5) * radius * 1.5,
                  vx: Math.cos(angle) * speed,
                  vy: Math.sin(angle) * speed,
                  r: (2 + Math.random() * 4) / zoomRef.current,
                  opacity: 0.7 + Math.random() * 0.3,
                  color: erasedColors[Math.floor(Math.random() * erasedColors.length)] || '#888',
                });
              }
              scribbleParticlesRef.current = { particles, startTime: performance.now(), duration: 500 };

              // Animate dissolve
              const animateDissolve = () => {
                const sp = scribbleParticlesRef.current;
                if (!sp) return;
                const elapsed = performance.now() - sp.startTime;
                const t = Math.min(elapsed / sp.duration, 1);
                if (t >= 1) {
                  scribbleParticlesRef.current = null;
                  redrawAll();
                  return;
                }
                // Update particles
                for (const p of sp.particles) {
                  p.x += p.vx;
                  p.y += p.vy;
                  p.vy -= 0.02 / zoomRef.current; // float up
                  p.opacity = (1 - t) * 0.8;
                  p.r *= 0.995;
                }
                redrawAll();
                // Draw particles on top
                const canvas = canvasRef.current;
                if (canvas) {
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    const zoom = zoomRef.current;
                    const pan = panRef.current;
                    ctx.save();
                    for (const p of sp.particles) {
                      const sx = (p.x * zoom) + pan.x;
                      const sy = (p.y * zoom) + pan.y;
                      const sr = p.r * zoom;
                      ctx.globalAlpha = p.opacity;
                      ctx.fillStyle = p.color;
                      ctx.beginPath();
                      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
                      ctx.fill();
                    }
                    ctx.restore();
                  }
                }
                scribbleAnimFrameRef.current = requestAnimationFrame(animateDissolve);
              };
              cancelAnimationFrame(scribbleAnimFrameRef.current);
              scribbleAnimFrameRef.current = requestAnimationFrame(animateDissolve);

              emitChangeRef.current();
              triggerHaptic('medium');
              toast('🧹 Scribble erase', { duration: 1200 });
              return;
            }
          }
        }
      }
    }

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(redrawAll);
  }, [redrawAll, tool, selectedIndices, activeLayerId, snapEnabled, background, presentationMode]);

  const emitChange = useCallback(() => {
    // Don't emit empty state before initial data has been loaded
    if (!initialLoadDoneRef.current) {
      console.log('[SketchEditor] emitChange BLOCKED - initial load not done yet');
      return;
    }
    const data: SketchData = {
      layers: layersRef.current,
      activeLayerId,
      background,
      width: canvasSizeRef.current.w,
      height: canvasSizeRef.current.h,
      version: 2,
      ...(audioDataUrlRef.current ? { audioRecording: { dataUrl: audioDataUrlRef.current, duration: audioDurationRef.current } } : {}),
      ...(videoUrlRef.current ? { videoUrl: videoUrlRef.current, videoBookmarks: videoBookmarksRef.current } : {}),
    };
    const json = JSON.stringify(data);
    const strokeCount = layersRef.current.reduce((sum, l) => sum + l.strokes.length, 0);
    console.log(`[SketchEditor] emitChange: ${strokeCount} strokes, json length: ${json.length}`);
    lastEmittedRef.current = json;
    onChange(json);
  }, [onChange, activeLayerId, background]);

  // Keep refs in sync
  emitChangeRef.current = emitChange;

  const onPointerUp = useCallback((e: PointerEvent) => {
    // Infinite canvas: end panning
    if (isPanningRef.current) {
      isPanningRef.current = false;
      panStartRef.current = null;
      if (!isSpacebarDownRef.current) setIsPanning(false);
      startPanInertia();
      return;
    }

    if (e.pointerType === 'touch') {
      activeTouchesRef.current.delete(e.pointerId);
      if (activeTouchesRef.current.size < 2) gestureStateRef.current = null;
    }

    // Laser pointer release
    if (tool === 'laser' && laserActiveRef.current) {
      laserActiveRef.current = false;
      // Trail will fade out via the animation loop
      return;
    }

    // Presentation mode swipe navigation
    if (presentationMode && presentationSwipeRef.current) {
      const dx = e.clientX - presentationSwipeRef.current.startX;
      const threshold = 80;
      if (pdfPages.length > 1) {
        if (dx < -threshold && pdfPageIndex < pdfPages.length - 1) {
          handlePdfPageChange(pdfPageIndex + 1);
        } else if (dx > threshold && pdfPageIndex > 0) {
          handlePdfPageChange(pdfPageIndex - 1);
        }
      }
      presentationSwipeRef.current = null;
      return;
    }

    // Finish PDF text select drag
    if (pdfTextDragRef.current && tool === 'pdfTextSelect') {
      pdfTextDragRef.current = null;
      // Selection rects and text remain visible for user to act on
      return;
    }

    // Finish washi tape drag
    if (washiDragRef.current) {
      washiDragRef.current = null;
      redrawAll();
      emitChange();
      return;
    }

    // Finish sticky note drag (works in both sticky and select tool)
    if (stickyDragRef.current) {
      stickyDragRef.current = null;
      forceUpdate(n => n + 1);
      redrawAll();
      emitChange();
      return;
    }
    // Finish image drag
    if (imageDragRef.current) {
      imageDragRef.current = null;
      forceUpdate(n => n + 1);
      redrawAll();
      emitChange();
      return;
    }

    // Clear image selection if clicking empty space in select mode
    if (tool === 'select' && selectedImageId != null && !imageDragRef.current) {
      const point = getPos(e);
      const layer = layersRef.current.find(l => l.id === activeLayerId);
      if (layer) {
        const hitImg = (layer.images || []).some(img =>
          point.x >= img.x && point.x <= img.x + img.width &&
          point.y >= img.y && point.y <= img.y + img.height
        );
        if (!hitImg) setSelectedImageId(null);
      }
    }

    // Finish marquee selection
    if (tool === 'select' && marqueeRef.current) {
      const m = marqueeRef.current;
      const mx = Math.min(m.startX, m.currentX);
      const my = Math.min(m.startY, m.currentY);
      const mw = Math.abs(m.currentX - m.startX);
      const mh = Math.abs(m.currentY - m.startY);
      marqueeRef.current = null;

      if (mw > 5 || mh > 5) {
        const layer = layersRef.current.find(l => l.id === activeLayerId);
        if (layer) {
          const hits: number[] = [];
          for (let i = 0; i < layer.strokes.length; i++) {
            if (layer.strokes[i].tool === 'eraser') continue;
            const sb = getStrokeBBox(layer.strokes[i]);
            // Check if stroke bbox intersects marquee
            if (sb.x + sb.w >= mx && sb.x <= mx + mw && sb.y + sb.h >= my && sb.y <= my + mh) {
              hits.push(i);
            }
          }
          if (hits.length > 0) {
            setSelectedIndices(hits);
            setSelectionRotation(0);
          }
        }
      }
      redrawAll();
      return;
    }

    // Finish selection action
    if (tool === 'select' && selectionActionRef.current) {
      selectionActionRef.current = null;
      forceUpdate(n => n + 1);
      redrawAll();
      emitChange();
      return;
    }

    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    rulerDrawStartRef.current = null;
    setRulerMeasurement(null);
    setShowPressure(false);
    scribbleDetectorRef.current = null;

    const finishedStroke = currentStrokeRef.current;
    const minPoints = finishedStroke.tool === 'spray' ? 1 : 2;
    if (finishedStroke.points.length >= minPoints) {
      undoStackRef.current = [
        ...undoStackRef.current.slice(-(MAX_UNDO - 1)),
        cloneLayers(layersRef.current),
      ];
      redoStackRef.current = [];
      const layer = layersRef.current.find(l => l.id === activeLayerId);
      if (layer) {
        // Shape recognition: convert freehand to clean shapes
        let strokeToAdd = finishedStroke;
        if (shapeRecognitionEnabled && !isShapeTool(finishedStroke.tool) && finishedStroke.tool !== 'eraser' && finishedStroke.tool !== 'washi') {
          const recognized = recognizeShape(finishedStroke.points);
          if (recognized) {
            const cleanStroke = convertToCleanShape(finishedStroke, recognized);
            if (cleanStroke) {
              strokeToAdd = cleanStroke;
              toast.success(`✨ ${t('sketch.shapeDetected', { shape: recognized.type.charAt(0).toUpperCase() + recognized.type.slice(1) })}`, { duration: 1500 });
            }
          }
        }

        // Stamp stroke with audio timestamp if recording
        if (isAudioRecording && audioRecordingStartRef.current > 0) {
          strokeToAdd.audioTimestamp = Date.now() - audioRecordingStartRef.current;
        }
        // Stamp stroke with timelapse timestamp if recording
        if (isTimelapseRecording && timelapseRecordStartRef.current > 0) {
          strokeToAdd.audioTimestamp = strokeToAdd.audioTimestamp ?? (Date.now() - timelapseRecordStartRef.current);
        }
        layer.strokes = [...layer.strokes, strokeToAdd];

        // Add mirrored strokes for symmetry mode
        if (symmetryMode !== 'off') {
          const cw = canvasSizeRef.current.w;
          const ch = canvasSizeRef.current.h;
          const zm = zoomRef.current;
          const pn = panRef.current;
          const centerX = (cw / 2 - pn.x) / zm;
          const centerY = (ch / 2 - pn.y) / zm;
          const mirroredStrokes = getSymmetryStrokes(strokeToAdd, centerX, centerY, symmetryMode);
          layer.strokes.push(...mirroredStrokes);
        }

        // Auto-select shapes after drawing
        if (isShapeTool(strokeToAdd.tool)) {
          const newIdx = layer.strokes.length - 1;
          setSelectedIndices([newIdx]);
          setSelectionRotation(0);
          setTool('select');
        }
      }
    }
    currentStrokeRef.current = null;
    redrawAll();
    emitChange();
  }, [redrawAll, emitChange, activeLayerId, tool, symmetryMode, isAudioRecording, isTimelapseRecording, shapeRecognitionEnabled, presentationMode, pdfPages, pdfPageIndex]);

  // --- Presentation mode: fullscreen, keyboard nav, auto-hide cursor ---
  const enterPresentationMode = useCallback(() => {
    setPresentationMode(true);
    setTool('laser' as ToolType);
    // Try entering fullscreen
    const el = containerRef.current?.closest('.sketch-editor-root') as HTMLElement;
    if (el?.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  const exitPresentationMode = useCallback(() => {
    setPresentationMode(false);
    setCursorHidden(false);
    if (cursorHideTimerRef.current) clearTimeout(cursorHideTimerRef.current);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Listen for fullscreen exit (e.g. user presses browser Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && presentationMode) {
        setPresentationMode(false);
        setCursorHidden(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [presentationMode]);

  // Keyboard navigation in presentation mode
  useEffect(() => {
    if (!presentationMode) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitPresentationMode();
        return;
      }
      if (pdfPages.length > 1) {
        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          if (pdfPageIndex < pdfPages.length - 1) handlePdfPageChange(pdfPageIndex + 1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (pdfPageIndex > 0) handlePdfPageChange(pdfPageIndex - 1);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [presentationMode, pdfPages.length, pdfPageIndex, exitPresentationMode]);

  // Auto-hide cursor after 3s of inactivity in presentation mode
  useEffect(() => {
    if (!presentationMode) return;
    const resetTimer = () => {
      setCursorHidden(false);
      if (cursorHideTimerRef.current) clearTimeout(cursorHideTimerRef.current);
      cursorHideTimerRef.current = setTimeout(() => setCursorHidden(true), 3000);
    };
    resetTimer();
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      if (cursorHideTimerRef.current) clearTimeout(cursorHideTimerRef.current);
    };
  }, [presentationMode]);

  // --- Wheel zoom ---

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
    const zoomFactor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    const oldZoom = zoomRef.current;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * zoomFactor));
    const pan = panRef.current;
    panRef.current = {
      x: mouseX - (mouseX - pan.x) * (newZoom / oldZoom),
      y: mouseY - (mouseY - pan.y) * (newZoom / oldZoom),
    };
    zoomRef.current = newZoom;
    setZoomDisplay(Math.round(newZoom * 100));
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(redrawAll);
  }, [redrawAll]);

  const handleResetZoom = useCallback(() => {
    zoomRef.current = 1; panRef.current = { x: 0, y: 0 }; setZoomDisplay(100); redrawAll();
  }, [redrawAll]);

  // Zoom in/out buttons
  const handleZoomIn = useCallback(() => {
    const { w, h } = canvasSizeRef.current;
    const cx = w / 2; const cy = h / 2;
    const oldZoom = zoomRef.current;
    const newZoom = Math.min(MAX_ZOOM, oldZoom * 1.3);
    panRef.current = { x: cx - (cx - panRef.current.x) * (newZoom / oldZoom), y: cy - (cy - panRef.current.y) * (newZoom / oldZoom) };
    zoomRef.current = newZoom;
    setZoomDisplay(Math.round(newZoom * 100));
    redrawAll();
  }, [redrawAll]);

  const handleZoomOut = useCallback(() => {
    const { w, h } = canvasSizeRef.current;
    const cx = w / 2; const cy = h / 2;
    const oldZoom = zoomRef.current;
    const newZoom = Math.max(MIN_ZOOM, oldZoom / 1.3);
    panRef.current = { x: cx - (cx - panRef.current.x) * (newZoom / oldZoom), y: cy - (cy - panRef.current.y) * (newZoom / oldZoom) };
    zoomRef.current = newZoom;
    setZoomDisplay(Math.round(newZoom * 100));
    redrawAll();
  }, [redrawAll]);

  // Fit-to-content
  const handleFitToContent = useCallback(() => {
    const allPoints: Point[] = [];
    for (const layer of layersRef.current) {
      for (const s of layer.strokes) for (const p of s.points) allPoints.push(p);
      for (const ta of (layer.textAnnotations || [])) allPoints.push({ x: ta.x, y: ta.y, pressure: 1 });
      for (const img of (layer.images || [])) {
        allPoints.push({ x: img.x, y: img.y, pressure: 1 });
        allPoints.push({ x: img.x + (img.width || 100), y: img.y + (img.height || 100), pressure: 1 });
      }
      for (const sn of (layer.stickyNotes || [])) {
        allPoints.push({ x: sn.x, y: sn.y, pressure: 1 });
        allPoints.push({ x: sn.x + sn.width, y: sn.y + sn.height, pressure: 1 });
      }
    }
    if (allPoints.length === 0) { handleResetZoom(); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of allPoints) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
    const contentW = maxX - minX || 100;
    const contentH = maxY - minY || 100;
    const { w, h } = canvasSizeRef.current;
    const padding = 40;
    const zoom = Math.min((w - padding * 2) / contentW, (h - padding * 2) / contentH, MAX_ZOOM);
    const clampedZoom = Math.max(MIN_ZOOM, zoom);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    panRef.current = { x: w / 2 - centerX * clampedZoom, y: h / 2 - centerY * clampedZoom };
    zoomRef.current = clampedZoom;
    setZoomDisplay(Math.round(clampedZoom * 100));
    redrawAll();
  }, [redrawAll, handleResetZoom]);

  // Spacebar panning keyboard listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        isSpacebarDownRef.current = true;
        setIsPanning(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacebarDownRef.current = false;
        if (!isPanningRef.current) setIsPanning(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, []);

  // Pan inertia animation
  const startPanInertia = useCallback(() => {
    const { vx, vy } = panVelocityRef.current;
    if (Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) return;
    const friction = 0.92;
    const animate = () => {
      const v = panVelocityRef.current;
      v.vx *= friction; v.vy *= friction;
      if (Math.abs(v.vx) < 0.3 && Math.abs(v.vy) < 0.3) return;
      panRef.current = { x: panRef.current.x + v.vx, y: panRef.current.y + v.vy };
      redrawAll();
      panInertiaRafRef.current = requestAnimationFrame(animate);
    };
    cancelAnimationFrame(panInertiaRafRef.current);
    panInertiaRafRef.current = requestAnimationFrame(animate);
  }, [redrawAll]);

  // --- Actions ---

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    redoStackRef.current.push(cloneLayers(layersRef.current));
    layersRef.current = undoStackRef.current.pop()!;
    clearSelection();
    forceUpdate(n => n + 1);
    redrawAll();
    emitChange();
  }, [redrawAll, emitChange, clearSelection]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    undoStackRef.current.push(cloneLayers(layersRef.current));
    layersRef.current = redoStackRef.current.pop()!;
    clearSelection();
    forceUpdate(n => n + 1);
    redrawAll();
    emitChange();
  }, [redrawAll, emitChange, clearSelection]);

  const handleClear = useCallback(() => {
    undoStackRef.current.push(cloneLayers(layersRef.current));
    redoStackRef.current = [];
    const layer = layersRef.current.find(l => l.id === activeLayerId);
    if (layer) { layer.strokes = []; layer.textAnnotations = []; layer.stickyNotes = []; layer.images = []; }
    clearSelection();
    forceUpdate(n => n + 1);
    redrawAll();
    emitChange();
  }, [redrawAll, emitChange, activeLayerId, clearSelection]);

  const handleExportPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onImageExport) return;
    onImageExport(canvas.toDataURL('image/png'));
  }, [onImageExport]);

  const nativeSaveAndShare = useCallback(async (base64Data: string, filename: string, mimeType: string, shareOnly = false) => {
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache,
        });
        if (shareOnly) {
          await Share.share({ title: filename, url: result.uri, dialogTitle: 'Share Sketch' });
        } else {
          await Share.share({ title: filename, url: result.uri, dialogTitle: 'Save / Share' });
        }
        toast.success(`${filename} ready`);
      } catch (e) {
        console.error('Native save/share failed:', e);
        toast.error(t('sketch.exportFailed'));
      }
    } else {
      // Web fallback
      const byteStr = atob(base64Data);
      const arr = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
      const blob = new Blob([arr], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    }
  }, []);

  const handleExportSvg = useCallback(async () => {
    const { w, h } = canvasSizeRef.current;
    const svg = generateSvg(layersRef.current, w, h, background);
    const base64 = btoa(unescape(encodeURIComponent(svg)));
    await nativeSaveAndShare(base64, 'sketch.svg', 'image/svg+xml');
  }, [background, nativeSaveAndShare]);

  const handleExportPdf = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // If no PDF is loaded, export current canvas as single-page PDF
    if (pdfPages.length === 0) {
      const { w, h } = canvasSizeRef.current;
      const orientation = w >= h ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation, unit: 'px', format: [w, h] });
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, w, h);
      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      await nativeSaveAndShare(pdfBase64, 'sketch.pdf', 'application/pdf');
      return;
    }

    // Export annotated PDF: render each page + its annotations
    toast.loading('📄 Exporting annotated PDF...', { id: 'pdf-export' });
    try {
      // Save current page annotations first
      const currentAnnotations = cloneLayers(layersRef.current);
      const allAnnotations = new Map(pdfAnnotations);
      allAnnotations.set(pdfPageIndex, currentAnnotations);

      let pdf: jsPDF | null = null;

      for (let pageIdx = 0; pageIdx < pdfPages.length; pageIdx++) {
        const dim = pdfPageDimensions[pageIdx];
        if (!dim) continue;

        const scale = 2; // render at 2x for quality
        const offscreen = document.createElement('canvas');
        offscreen.width = dim.w * scale;
        offscreen.height = dim.h * scale;
        const ctx = offscreen.getContext('2d')!;
        ctx.scale(scale, scale);

        // Draw PDF page background
        const pageImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new window.Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = pdfPages[pageIdx];
        });
        ctx.drawImage(pageImg, 0, 0, dim.w, dim.h);

        // Draw annotations for this page
        const pageLayers = allAnnotations.get(pageIdx) || createDefaultLayers();
        // Offset so strokes centered at origin map to page center
        const offsetX = dim.w / 2;
        const offsetY = dim.h / 2;

        for (const layer of pageLayers) {
          if (!layer.visible) continue;
          ctx.save();
          ctx.globalAlpha = layer.opacity;
          ctx.translate(offsetX, offsetY);

          for (const stroke of layer.strokes) {
            if (stroke.tool === 'eraser') continue; // skip eraser for export
            drawStroke(ctx, stroke);
          }

          // Text annotations
          for (const ta of (layer.textAnnotations || [])) {
            ctx.save();
            const style = `${ta.italic ? 'italic ' : ''}${ta.bold ? 'bold ' : ''}${ta.fontSize}px ${ta.font}`;
            ctx.font = style;
            ctx.fillStyle = ta.color;
            ctx.textBaseline = 'top';
            const lines = ta.text.split('\n');
            for (let li = 0; li < lines.length; li++) {
              ctx.fillText(lines[li], ta.x, ta.y + li * ta.fontSize * 1.2);
            }
            ctx.restore();
          }

          // Images
          for (const img of (layer.images || [])) {
            const htmlImg = getOrLoadImage(img.src);
            if (htmlImg) {
              ctx.drawImage(htmlImg, img.x, img.y, img.width, img.height);
            }
          }

          ctx.restore();
        }

        // Draw sticky notes
        for (const layer of pageLayers) {
          if (!layer.visible) continue;
          for (const sn of (layer.stickyNotes || [])) {
            ctx.save();
            ctx.translate(offsetX, offsetY);
            ctx.globalAlpha = layer.opacity;
            ctx.fillStyle = sn.color;
            if (sn.rotation) {
              ctx.translate(sn.x + sn.width / 2, sn.y + sn.height / 2);
              ctx.rotate((sn.rotation * Math.PI) / 180);
              ctx.translate(-(sn.x + sn.width / 2), -(sn.y + sn.height / 2));
            }
            ctx.shadowColor = 'rgba(0,0,0,0.15)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetY = 2;
            ctx.fillRect(sn.x, sn.y, sn.width, sn.height);
            ctx.shadowColor = 'transparent';
            // Draw sticky text
            ctx.fillStyle = '#333';
            ctx.font = `${sn.fontSize}px sans-serif`;
            ctx.textBaseline = 'top';
            const stLines = sn.text.split('\n');
            for (let li = 0; li < stLines.length; li++) {
              ctx.fillText(stLines[li], sn.x + 8, sn.y + 8 + li * sn.fontSize * 1.3, sn.width - 16);
            }
            ctx.restore();
          }
        }

        const imgData = offscreen.toDataURL('image/png', 1.0);
        const orientation = dim.w >= dim.h ? 'landscape' : 'portrait';

        if (pageIdx === 0) {
          pdf = new jsPDF({ orientation, unit: 'px', format: [dim.w, dim.h] });
        } else {
          pdf!.addPage([dim.w, dim.h], orientation);
        }
        pdf!.addImage(imgData, 'PNG', 0, 0, dim.w, dim.h);
      }

      if (pdf) {
        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        await nativeSaveAndShare(pdfBase64, 'annotated.pdf', 'application/pdf');
        toast.success(`📄 ${t('sketch.annotatedPdfExported')}`, { id: 'pdf-export' });
      }
    } catch (error) {
      console.error('Annotated PDF export error:', error);
      toast.error(t('sketch.exportFailed'), { id: 'pdf-export' });
    }
  }, [nativeSaveAndShare, pdfPages, pdfPageIndex, pdfPageDimensions, pdfAnnotations, getOrLoadImage]);

  const handleDownloadPng = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    await nativeSaveAndShare(base64, 'sketch.png', 'image/png');
  }, [nativeSaveAndShare]);

  const handleNativeShare = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    await nativeSaveAndShare(base64, 'sketch.png', 'image/png', true);
  }, [nativeSaveAndShare]);

  // --- Palette manager ---
  const savePalettes = useCallback((palettes: { name: string; colors: string[] }[]) => {
    setSavedPalettes(palettes);
    try { localStorage.setItem('sketch-color-palettes', JSON.stringify(palettes)); } catch {}
  }, []);

  const addCurrentColorToPalette = useCallback(() => {
    const updated = [...savedPalettes];
    const palette = updated[activePaletteIdx];
    if (palette && !palette.colors.includes(color)) {
      palette.colors = [...palette.colors, color];
      savePalettes(updated);
    }
  }, [savedPalettes, activePaletteIdx, color, savePalettes]);

  const removeColorFromPalette = useCallback((colorToRemove: string) => {
    const updated = [...savedPalettes];
    const palette = updated[activePaletteIdx];
    if (palette) {
      palette.colors = palette.colors.filter(c => c !== colorToRemove);
      savePalettes(updated);
    }
  }, [savedPalettes, activePaletteIdx, savePalettes]);

  const createNewPalette = useCallback((name: string) => {
    if (!name.trim()) return;
    const updated = [...savedPalettes, { name: name.trim(), colors: [color] }];
    savePalettes(updated);
    setActivePaletteIdx(updated.length - 1);
    setNewPaletteName('');
  }, [savedPalettes, color, savePalettes]);

  const deletePalette = useCallback((idx: number) => {
    if (savedPalettes.length <= 1) return;
    const updated = savedPalettes.filter((_, i) => i !== idx);
    savePalettes(updated);
    setActivePaletteIdx(Math.min(activePaletteIdx, updated.length - 1));
  }, [savedPalettes, activePaletteIdx, savePalettes]);

  // --- SVG Import ---
  const handleSvgImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const svgText = ev.target?.result as string;
      // Create an image from SVG
      const blob = new Blob([svgText], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = new window.Image();
      img.onload = () => {
        const dataUrl = (() => {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || 300;
          c.height = img.naturalHeight || 300;
          const cx = c.getContext('2d');
          if (cx) cx.drawImage(img, 0, 0);
          return c.toDataURL('image/png');
        })();
        URL.revokeObjectURL(url);
        imageCacheRef.current.set(dataUrl, img);
        const layer = layersRef.current.find(l => l.id === activeLayerId);
        if (!layer) return;
        undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), cloneLayers(layersRef.current)];
        redoStackRef.current = [];
        if (!layer.images) layer.images = [];
        const maxDim = 300;
        const nw = img.naturalWidth || 300;
        const nh = img.naturalHeight || 300;
        const scale = Math.min(1, maxDim / Math.max(nw, nh));
        const w = nw * scale;
        const h = nh * scale;
        const zoom = zoomRef.current;
        const pan = panRef.current;
        const cw = canvasSizeRef.current.w;
        const ch = canvasSizeRef.current.h;
        const cx = (cw / 2 - pan.x) / zoom;
        const cy = (ch / 2 - pan.y) / zoom;
        const newImg: CanvasImageData = {
          id: nextImageIdRef.current++,
          x: cx - w / 2, y: cy - h / 2,
          width: w, height: h,
          src: dataUrl,
          naturalWidth: nw, naturalHeight: nh,
        };
        layer.images.push(newImg);
        setSelectedImageId(newImg.id);
        setTool('select');
        forceUpdate(n => n + 1);
        redrawRef.current();
        emitChangeRef.current();
      };
      img.src = url;
    };
    reader.readAsText(file);
  }, [activeLayerId]);

  // --- Timelapse Recording Toggle ---
  const toggleTimelapseRecording = useCallback(() => {
    if (isTimelapseRecording) {
      setIsTimelapseRecording(false);
      timelapseRecordStartRef.current = 0;
      toast.success(`🎬 ${t('sketch.timelapseRecordingStopped')}`);
    } else {
      timelapseRecordStartRef.current = Date.now();
      setIsTimelapseRecording(true);
      toast.success(`🎬 ${t('sketch.timelapseRecordingStarted')}`);
    }
  }, [isTimelapseRecording]);

  // --- Timelapse Replay ---
  const handleTimelapseReplay = useCallback(async () => {
    if (isPlayingTimelapse) {
      timelapseAbortRef.current = true;
      return;
    }
    const allStrokes: { layerId: number; stroke: Stroke }[] = [];
    for (const layer of layersRef.current) {
      for (const stroke of layer.strokes) {
        allStrokes.push({ layerId: layer.id, stroke });
      }
    }
    if (allStrokes.length === 0) return;

    const savedLayers = cloneLayers(layersRef.current);
    for (const layer of layersRef.current) layer.strokes = [];
    redrawAll();

    setIsPlayingTimelapse(true);
    timelapseAbortRef.current = false;

    for (let i = 0; i < allStrokes.length; i++) {
      if (timelapseAbortRef.current) break;
      const { layerId, stroke } = allStrokes[i];
      const layer = layersRef.current.find(l => l.id === layerId);
      if (layer) {
        layer.strokes.push(stroke);
        redrawAll();
      }
      const baseDelay = Math.min(200, Math.max(30, stroke.points.length * 2));
      await new Promise(r => setTimeout(r, baseDelay / timelapseSpeed));
    }

    if (timelapseAbortRef.current) {
      layersRef.current.splice(0, layersRef.current.length, ...savedLayers);
      redrawAll();
    }
    setIsPlayingTimelapse(false);
  }, [isPlayingTimelapse, redrawAll, timelapseSpeed]);

  // --- Export Timelapse as MP4 ---
  const handleExportTimelapseMP4 = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const allStrokes: { layerId: number; stroke: Stroke }[] = [];
    for (const layer of layersRef.current) {
      for (const stroke of layer.strokes) {
        allStrokes.push({ layerId: layer.id, stroke });
      }
    }
    if (allStrokes.length === 0) {
      toast.error(t('sketch.noStrokesToExport'));
      return;
    }

    setIsExportingTimelapse(true);
    toast('🎬 Exporting timelapse video...', { duration: 3000 });

    const savedLayers = cloneLayers(layersRef.current);

    try {
      const stream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm',
        videoBitsPerSecond: 5_000_000,
      });
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      const done = new Promise<void>((resolve) => { mediaRecorder.onstop = () => resolve(); });
      mediaRecorder.start(100);

      // Clear canvas for recording
      for (const layer of layersRef.current) layer.strokes = [];
      redrawAll();

      // Wait a frame for blank canvas
      await new Promise(r => setTimeout(r, 200));

      // Replay strokes at timelapse speed
      for (let i = 0; i < allStrokes.length; i++) {
        const { layerId, stroke } = allStrokes[i];
        const layer = layersRef.current.find(l => l.id === layerId);
        if (layer) {
          layer.strokes.push(stroke);
          redrawAll();
        }
        const baseDelay = Math.min(200, Math.max(30, stroke.points.length * 2));
        await new Promise(r => setTimeout(r, baseDelay / timelapseSpeed));
      }

      // Hold final frame
      await new Promise(r => setTimeout(r, 1000));

      mediaRecorder.stop();
      await done;

      // Restore original strokes
      layersRef.current.splice(0, layersRef.current.length, ...savedLayers);
      redrawAll();

      const blob = new Blob(chunks, { type: 'video/webm' });

      // Try native share on mobile, fallback to download
      if (Capacitor.isNativePlatform()) {
        try {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = (reader.result as string).split(',')[1];
            const fileName = `timelapse_${Date.now()}.webm`;
            await Filesystem.writeFile({
              path: fileName,
              data: base64,
              directory: Directory.Cache,
            });
            const uri = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
            await Share.share({ title: 'Drawing Timelapse', url: uri.uri });
          };
          reader.readAsDataURL(blob);
        } catch {
          // Fallback download
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `timelapse_${Date.now()}.webm`;
          a.click(); URL.revokeObjectURL(url);
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `timelapse_${Date.now()}.webm`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast.success(`🎬 ${t('sketch.timelapseExported')}`);
    } catch (err) {
      console.error('Timelapse export failed:', err);
      // Restore on error
      layersRef.current.splice(0, layersRef.current.length, ...savedLayers);
      redrawAll();
      toast.error(t('sketch.timelapseExportFailed'));
    } finally {
      setIsExportingTimelapse(false);
    }
  }, [redrawAll, timelapseSpeed]);

  // --- Audio-Sync Recording ---
  const audioRecordingTimeRef = useRef(0);
  
  const startAudioRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      audioMediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Calculate actual duration from timestamps (not stale state)
        const actualDurationMs = Date.now() - audioRecordingStartRef.current;
        const actualDurationSec = Math.round(actualDurationMs / 1000);
        
        const reader = new FileReader();
        reader.onloadend = () => {
          audioDataUrlRef.current = reader.result as string;
          audioDurationRef.current = actualDurationSec;
          setHasAudioRecording(true);
          // Emit change with audio data
          emitChangeRef.current();
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100);
      audioRecordingStartRef.current = Date.now();
      setIsAudioRecording(true);
      setAudioRecordingTime(0);
      audioRecordingTimeRef.current = 0;
      audioTimerRef.current = setInterval(() => {
        audioRecordingTimeRef.current += 1;
        setAudioRecordingTime(prev => prev + 1);
      }, 1000);
      toast.success(`🎙️ ${t('sketch.audioRecordingStarted')}`);
    } catch (error) {
      console.error('Microphone access denied:', error);
      toast.error(t('sketch.microphoneAccessDenied'));
    }
  }, []);

  const stopAudioRecording = useCallback(() => {
    if (audioMediaRecorderRef.current && isAudioRecording) {
      audioMediaRecorderRef.current.stop();
      setIsAudioRecording(false);
      if (audioTimerRef.current) {
        clearInterval(audioTimerRef.current);
        audioTimerRef.current = null;
      }
      toast.success(`🎙️ ${t('sketch.audioRecordingSavedToast')}`);
    }
  }, [isAudioRecording]);

  const discardAudioRecording = useCallback(() => {
    audioDataUrlRef.current = null;
    audioDurationRef.current = 0;
    setHasAudioRecording(false);
    // Clear audioTimestamp from all strokes
    for (const layer of layersRef.current) {
      for (const stroke of layer.strokes) {
        delete stroke.audioTimestamp;
      }
    }
    emitChange();
    toast('Audio recording discarded');
  }, [emitChange]);

  // Render canvas showing exactly the strokes that existed at `timeMs`
  const renderCanvasAtTime = useCallback((timeMs: number) => {
    const syncedStrokes = audioSyncedStrokesRef.current;
    const unsyncedStrokes = audioSyncUnsyncedRef.current;
    const hasPointTimestamps = audioSyncHasPointTimestampsRef.current;

    // Clear all strokes from layers
    for (const layer of layersRef.current) {
      layer.strokes = [];
    }
    // Add back unsynced strokes
    for (const { layerId, stroke } of unsyncedStrokes) {
      const layer = layersRef.current.find(l => l.id === layerId);
      if (layer) layer.strokes.push(stroke);
    }

    // Add synced strokes up to timeMs
    for (const entry of syncedStrokes) {
      if (entry.audioTimestamp > timeMs) break;
      const layer = layersRef.current.find(l => l.id === entry.layerId);
      if (!layer) continue;

      if (hasPointTimestamps && entry.stroke.points.some(p => p.timestamp != null)) {
        // Point-by-point: reveal only points whose timestamp <= timeMs
        let revealedCount = 0;
        for (let i = 0; i < entry.stroke.points.length; i++) {
          const pt = entry.stroke.points[i];
          if (pt.timestamp != null && pt.timestamp <= timeMs) {
            revealedCount = i + 1;
          } else if (pt.timestamp != null && pt.timestamp > timeMs) {
            break;
          } else {
            revealedCount = i + 1; // no timestamp = reveal
          }
        }
        if (revealedCount > 0) {
          layer.strokes.push({ ...entry.stroke, points: entry.stroke.points.slice(0, revealedCount) });
        }
      } else {
        layer.strokes.push(entry.stroke);
      }
    }

    redrawAll();
  }, [redrawAll]);

  // --- Audio-Sync Playback with Scrubbing ---
  const handleAudioSyncPlayback = useCallback(async () => {
    if (isAudioSyncPlaying) {
      // Stop playback
      audioSyncAbortRef.current = true;
      cancelAnimationFrame(audioSyncRafRef.current);
      if (audioPlaybackRef.current) {
        audioPlaybackRef.current.pause();
        audioPlaybackRef.current = null;
      }
      // Restore saved layers
      if (audioSyncSavedLayersRef.current) {
        layersRef.current.splice(0, layersRef.current.length, ...audioSyncSavedLayersRef.current);
        audioSyncSavedLayersRef.current = null;
      }
      redrawAll();
      setIsAudioSyncPlaying(false);
      setAudioScrubTime(0);
      audioScrubTimeRef.current = 0;
      setAudioLoopA(null);
      setAudioLoopB(null);
      audioLoopARef.current = null;
      audioLoopBRef.current = null;
      return;
    }

    if (!audioDataUrlRef.current) {
      toast.error(t('sketch.noAudioRecording'));
      return;
    }

    // Check if strokes have per-point timestamps
    const hasPointTimestamps = layersRef.current.some(layer =>
      layer.strokes.some(s => s.audioTimestamp != null && s.points.some(p => p.timestamp != null && p.timestamp < 1e12))
    );
    audioSyncHasPointTimestampsRef.current = hasPointTimestamps;

    // Gather synced/unsynced strokes
    const syncedStrokes: { layerId: number; stroke: Stroke; audioTimestamp: number }[] = [];
    const unsyncedStrokes: { layerId: number; stroke: Stroke }[] = [];
    for (const layer of layersRef.current) {
      for (const stroke of layer.strokes) {
        if (stroke.audioTimestamp != null) {
          syncedStrokes.push({ layerId: layer.id, stroke, audioTimestamp: stroke.audioTimestamp });
        } else {
          unsyncedStrokes.push({ layerId: layer.id, stroke });
        }
      }
    }

    if (syncedStrokes.length === 0) {
      toast.error(t('sketch.noSyncedStrokes'));
      return;
    }

    syncedStrokes.sort((a, b) => a.audioTimestamp - b.audioTimestamp);
    audioSyncedStrokesRef.current = syncedStrokes;
    audioSyncUnsyncedRef.current = unsyncedStrokes;

    // Save current state for restoration
    audioSyncSavedLayersRef.current = cloneLayers(layersRef.current);

    setIsAudioSyncPlaying(true);
    audioSyncAbortRef.current = false;

    // Start audio
    const audio = new Audio(audioDataUrlRef.current);
    audioPlaybackRef.current = audio;
    audio.play().catch(() => {});

    // Playback loop: sync canvas to audio currentTime
    const replayLoop = () => {
      if (audioSyncAbortRef.current) return;

      const currentMs = (audio.currentTime || 0) * 1000;

      // Loop range check
      const loopOn = audioLoopEnabledRef.current;
      const loopA = audioLoopARef.current;
      const loopB = audioLoopBRef.current;
      if (loopOn && loopA != null && loopB != null && currentMs >= loopB) {
        audio.currentTime = loopA / 1000;
        audioScrubTimeRef.current = loopA;
        setAudioScrubTime(loopA);
        renderCanvasAtTime(loopA);
        audioSyncRafRef.current = requestAnimationFrame(replayLoop);
        return;
      }
      // Full loop (no A/B range)
      if (loopOn && loopA == null && loopB == null && audio.ended) {
        audio.currentTime = 0;
        audioScrubTimeRef.current = 0;
        setAudioScrubTime(0);
        renderCanvasAtTime(0);
        audio.play().catch(() => {});
        audioSyncRafRef.current = requestAnimationFrame(replayLoop);
        return;
      }

      audioScrubTimeRef.current = currentMs;
      setAudioScrubTime(currentMs);
      renderCanvasAtTime(currentMs);

      if (!audio.ended && !audio.paused) {
        audioSyncRafRef.current = requestAnimationFrame(replayLoop);
      } else if (audio.ended) {
        // Restore
        if (audioSyncSavedLayersRef.current) {
          layersRef.current.splice(0, layersRef.current.length, ...audioSyncSavedLayersRef.current);
          audioSyncSavedLayersRef.current = null;
        }
        redrawAll();
        setIsAudioSyncPlaying(false);
        setAudioScrubTime(0);
        audioScrubTimeRef.current = 0;
      }
    };

    audio.onplay = () => { audioSyncRafRef.current = requestAnimationFrame(replayLoop); };
    audio.onended = () => {
      // Check loop
      if (audioLoopEnabledRef.current) {
        const loopStart = audioLoopARef.current ?? 0;
        audio.currentTime = loopStart / 1000;
        audioScrubTimeRef.current = loopStart;
        setAudioScrubTime(loopStart);
        renderCanvasAtTime(loopStart);
        audio.play().catch(() => {});
        return;
      }
      if (audioSyncSavedLayersRef.current) {
        layersRef.current.splice(0, layersRef.current.length, ...audioSyncSavedLayersRef.current);
        audioSyncSavedLayersRef.current = null;
      }
      redrawAll();
      setIsAudioSyncPlaying(false);
      setAudioScrubTime(0);
      audioScrubTimeRef.current = 0;
    };
  }, [isAudioSyncPlaying, redrawAll, renderCanvasAtTime]);

  // Scrub to a specific time
  const handleScrubTo = useCallback((timeMs: number) => {
    const audio = audioPlaybackRef.current;
    if (!audio) return;
    audio.currentTime = timeMs / 1000;
    audioScrubTimeRef.current = timeMs;
    setAudioScrubTime(timeMs);
    renderCanvasAtTime(timeMs);
  }, [renderCanvasAtTime]);

  const handleScrubToRef = useRef(handleScrubTo);
  handleScrubToRef.current = handleScrubTo;

  // Tap on canvas during playback: find which stroke was drawn at that point and jump audio there
  const handlePlaybackStrokeTap = useCallback((canvasX: number, canvasY: number) => {
    const syncedStrokes = audioSyncedStrokesRef.current;
    const currentMs = audioScrubTimeRef.current;
    const visibleStrokes = syncedStrokes.filter(s => s.audioTimestamp <= currentMs);
    for (let i = visibleStrokes.length - 1; i >= 0; i--) {
      const entry = visibleStrokes[i];
      if (hitTestStroke(entry.stroke, canvasX, canvasY, 15 / zoomRef.current)) {
        handleScrubToRef.current(entry.audioTimestamp);
        return true;
      }
    }
    return false;
  }, []);

  handlePlaybackStrokeTapRef.current = handlePlaybackStrokeTap;

  // --- Selection actions ---

  const handleCopySelection = useCallback(() => {
    clipboardRef.current = cloneStrokes(getSelectedStrokes());
  }, [getSelectedStrokes]);

  const handlePasteSelection = useCallback(() => {
    if (clipboardRef.current.length === 0) return;
    const layer = layersRef.current.find(l => l.id === activeLayerId);
    if (!layer) return;

    undoStackRef.current = [
      ...undoStackRef.current.slice(-(MAX_UNDO - 1)),
      cloneLayers(layersRef.current),
    ];
    redoStackRef.current = [];

    // Offset pasted strokes slightly
    const pasted = cloneStrokes(clipboardRef.current).map(s => ({
      ...s,
      points: s.points.map(p => ({ ...p, x: p.x + 20, y: p.y + 20 })),
    }));
    const startIdx = layer.strokes.length;
    layer.strokes = [...layer.strokes, ...pasted];
    setSelectedIndices(pasted.map((_, i) => startIdx + i));
    setSelectionRotation(0);
    forceUpdate(n => n + 1);
    redrawAll();
    emitChange();
  }, [activeLayerId, redrawAll, emitChange]);

  const handleDeleteSelection = useCallback(() => {
    if (selectedIndices.length === 0) return;
    const layer = layersRef.current.find(l => l.id === activeLayerId);
    if (!layer) return;

    undoStackRef.current = [
      ...undoStackRef.current.slice(-(MAX_UNDO - 1)),
      cloneLayers(layersRef.current),
    ];
    redoStackRef.current = [];

    const toDelete = new Set(selectedIndices);
    layer.strokes = layer.strokes.filter((_, i) => !toDelete.has(i));
    clearSelection();
    forceUpdate(n => n + 1);
    redrawAll();
    emitChange();
  }, [selectedIndices, activeLayerId, redrawAll, emitChange, clearSelection]);

  // --- Sticker Library functions ---

  const handleSaveAsSticker = useCallback(() => {
    const strokes = getSelectedStrokes();
    if (strokes.length === 0) return;
    // Normalize strokes to origin (0,0)
    const bbox = getSelectionBBox(strokes);
    if (!bbox) return;
    const normalized = cloneStrokes(strokes).map(s => ({
      ...s,
      points: s.points.map(p => ({ ...p, x: p.x - bbox.x, y: p.y - bbox.y })),
    }));
    const id = `user-${Date.now()}`;
    const name = `Sticker ${savedStickers.length + 1}`;
    const newSticker: StickerElement = { id, name, strokes: normalized };
    const updated = [...savedStickers, newSticker];
    setSavedStickers(updated);
    saveStickersToDisk(updated);
    toast.success(t('sketch.savedAsSticker'));
  }, [getSelectedStrokes, savedStickers]);

  const handlePasteSticker = useCallback((sticker: StickerElement) => {
    const layer = layersRef.current.find(l => l.id === activeLayerId);
    if (!layer) return;
    undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), cloneLayers(layersRef.current)];
    redoStackRef.current = [];
    // Place sticker at center of visible area
    const zoom = zoomRef.current;
    const pan = panRef.current;
    const cw = canvasSizeRef.current.w;
    const ch = canvasSizeRef.current.h;
    const cx = (cw / 2 - pan.x) / zoom;
    const cy = (ch / 2 - pan.y) / zoom;
    const pasted = cloneStrokes(sticker.strokes).map(s => ({
      ...s,
      points: s.points.map(p => ({ ...p, x: p.x + cx - 25, y: p.y + cy - 25 })),
    }));
    const startIdx = layer.strokes.length;
    layer.strokes = [...layer.strokes, ...pasted];
    setSelectedIndices(pasted.map((_, i) => startIdx + i));
    setSelectionRotation(0);
    setTool('select');
    setStickerLibraryOpen(false);
    forceUpdate(n => n + 1);
    redrawAll();
    emitChange();
  }, [activeLayerId, redrawAll, emitChange]);

  const handleDeleteSticker = useCallback((id: string) => {
    const updated = savedStickers.filter(s => s.id !== id);
    setSavedStickers(updated);
    saveStickersToDisk(updated);
  }, [savedStickers]);

  const handlePlaceEmoji = useCallback((emoji: string) => {
    const layer = layersRef.current.find(l => l.id === activeLayerId);
    if (!layer) return;
    undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), cloneLayers(layersRef.current)];
    redoStackRef.current = [];
    const zoom = zoomRef.current;
    const pan = panRef.current;
    const cw = canvasSizeRef.current.w;
    const ch = canvasSizeRef.current.h;
    const cx = (cw / 2 - pan.x) / zoom;
    const cy = (ch / 2 - pan.y) / zoom;
    if (!layer.textAnnotations) layer.textAnnotations = [];
    layer.textAnnotations.push({
      id: nextTextIdRef.current++,
      x: cx - 20,
      y: cy - 20,
      text: emoji,
      font: 'sans-serif',
      fontSize: 48,
      color: '#000000',
      bold: false,
      italic: false,
    });
    setStickerLibraryOpen(false);
    forceUpdate(n => n + 1);
    redrawAll();
    emitChange();
  }, [activeLayerId, redrawAll, emitChange]);

  // --- Layer controls ---

  const setLayerOpacity = useCallback((layerId: number, opacity: number) => {
    const layer = layersRef.current.find(l => l.id === layerId);
    if (layer) { layer.opacity = opacity; forceUpdate(n => n + 1); redrawAll(); emitChange(); }
  }, [redrawAll, emitChange]);

  const toggleLayerVisibility = useCallback((layerId: number) => {
    const layer = layersRef.current.find(l => l.id === layerId);
    if (layer) { layer.visible = !layer.visible; forceUpdate(n => n + 1); redrawAll(); emitChange(); }
  }, [redrawAll, emitChange]);

  const setLayerBlendMode = useCallback((layerId: number, mode: LayerBlendMode) => {
    const layer = layersRef.current.find(l => l.id === layerId);
    if (layer) { layer.blendMode = mode; forceUpdate(n => n + 1); redrawAll(); emitChange(); }
  }, [redrawAll, emitChange]);

  const handleBackgroundChange = useCallback((bg: BackgroundType) => { setBackground(bg); }, []);

  useEffect(() => { redrawAll(); if (initialLoadDoneRef.current) emitChange(); }, [background]);

  // --- Init ---

  // Track what we last emitted so we don't reload our own changes
  const lastEmittedRef = useRef<string>('');
  
  // Guard: don't emit changes until initial data has been loaded
  const initialLoadDoneRef = useRef(false);

  const loadInitialData = useCallback((dataStr: string) => {
    if (!dataStr) {
      console.log('[SketchEditor] loadInitialData: empty dataStr, skipping');
      initialLoadDoneRef.current = true;
      return;
    }
    try {
      const data = JSON.parse(dataStr);
      console.log(`[SketchEditor] loadInitialData: version=${data.version}, layers=${data.layers?.length}, dataStr length=${dataStr.length}`);
      if (data.version === 2 && data.layers) {
        layersRef.current = data.layers.map((l: any) => ({ ...l, textAnnotations: l.textAnnotations || [], stickyNotes: l.stickyNotes || [], images: l.images || [] }));
        const totalStrokes = layersRef.current.reduce((sum, l) => sum + l.strokes.length, 0);
        console.log(`[SketchEditor] Loaded ${totalStrokes} strokes from initialData`);
        // Track max text id, sticky id, image id
        for (const l of layersRef.current) {
          for (const ta of l.textAnnotations) {
            if (ta.id >= nextTextIdRef.current) nextTextIdRef.current = ta.id + 1;
          }
          for (const sn of (l.stickyNotes || [])) {
            if (sn.id >= nextStickyIdRef.current) nextStickyIdRef.current = sn.id + 1;
          }
          for (const img of (l.images || [])) {
            if (img.id >= nextImageIdRef.current) nextImageIdRef.current = img.id + 1;
          }
        }
        setActiveLayerId(data.activeLayerId ?? 1);
        if (data.background) setBackground(data.background);
        // Load audio recording if present
        if (data.audioRecording?.dataUrl) {
          audioDataUrlRef.current = data.audioRecording.dataUrl;
          audioDurationRef.current = data.audioRecording.duration || 0;
          setHasAudioRecording(true);
        }
        // Load video if present
        if (data.videoUrl) {
          setVideoUrl(data.videoUrl);
          videoUrlRef.current = data.videoUrl;
          setShowVideoPanel(true);
          if (data.videoBookmarks) {
            setVideoBookmarks(data.videoBookmarks);
            videoBookmarksRef.current = data.videoBookmarks;
          }
        }
      } else if (data.strokes) {
        const layers = createDefaultLayers();
        layers[0].strokes = data.strokes;
        layersRef.current = layers;
      }
      initialLoadDoneRef.current = true;
    } catch (e) { console.error('[SketchEditor] loadInitialData parse error:', e); initialLoadDoneRef.current = true; }
  }, []);

  // Initial mount
  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (initialData) {
      loadInitialData(initialData);
      lastEmittedRef.current = initialData;
    } else {
      // No initial data = new sketch, safe to emit
      initialLoadDoneRef.current = true;
    }
    hasMountedRef.current = true;
    resizeCanvas();
    const handleResize = () => resizeCanvas();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafRef.current);
      // Reset on unmount so re-mount always reloads
      lastEmittedRef.current = '';
      hasMountedRef.current = false;
      initialLoadDoneRef.current = false;
    };
  }, []);

  // Initialize zoom-write canvas when activated
  useEffect(() => {
    if (zoomWriteActive && zoomWriteCanvasRef.current) {
      redrawZoomWriteBox(zoomWriteCanvasRef.current);
    }
  }, [zoomWriteActive, redrawZoomWriteBox]);

  // Re-load when initialData prop changes externally (e.g., note reopened)
  const prevInitialDataRef = useRef(initialData);
  useEffect(() => {
    if (!hasMountedRef.current) return; // skip on first render, handled above
    if (initialData && initialData !== prevInitialDataRef.current) {
      prevInitialDataRef.current = initialData;
      loadInitialData(initialData);
      lastEmittedRef.current = initialData;
      resizeCanvas();
    } else {
      prevInitialDataRef.current = initialData;
    }
  }, [initialData, loadInitialData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [onPointerDown, onPointerMove, onPointerUp, onWheel]);

  // Clear selection when switching away from select tool
  useEffect(() => {
    if (tool !== 'select') clearSelection();
    if (tool !== 'sticky') setSelectedStickyId(null);
  }, [tool, clearSelection]);

  // Focus text input when editing
  useEffect(() => {
    if (editingText && textInputRef.current) {
      setTimeout(() => textInputRef.current?.focus(), 50);
    }
  }, [editingText]);

  const commitTextAnnotation = useCallback(() => {
    if (!editingText || !editingTextValue.trim()) {
      setEditingText(null);
      setEditingTextValue('');
      return;
    }
    const layer = layersRef.current.find(l => l.id === activeLayerId);
    if (!layer) { setEditingText(null); return; }

    undoStackRef.current = [
      ...undoStackRef.current.slice(-(MAX_UNDO - 1)),
      cloneLayers(layersRef.current),
    ];
    redoStackRef.current = [];

    if (!layer.textAnnotations) layer.textAnnotations = [];

    if (editingText.annotationId != null) {
      // Update existing
      const idx = layer.textAnnotations.findIndex(ta => ta.id === editingText.annotationId);
      if (idx >= 0) {
        layer.textAnnotations[idx] = {
          ...layer.textAnnotations[idx],
          text: editingTextValue,
          font: textFont,
          fontSize: textFontSize,
          color,
          bold: textBold,
          italic: textItalic,
        };
      }
    } else {
      // Create new
      layer.textAnnotations.push({
        id: nextTextIdRef.current++,
        x: editingText.x,
        y: editingText.y,
        text: editingTextValue,
        font: textFont,
        fontSize: textFontSize,
        color,
        bold: textBold,
        italic: textItalic,
      });
    }

    setEditingText(null);
    setEditingTextValue('');
    forceUpdate(n => n + 1);
    redrawAll();
    emitChange();
  }, [editingText, editingTextValue, activeLayerId, color, textFont, textFontSize, textBold, textItalic, redrawAll, emitChange]);

  const commitStickyNote = useCallback(() => {
    if (editingStickyId == null) return;
    const layer = layersRef.current.find(l => l.id === activeLayerId);
    if (layer) {
      const sn = (layer.stickyNotes || []).find(s => s.id === editingStickyId);
      if (sn) {
        sn.text = editingStickyText;
      }
    }
    setEditingStickyId(null);
    setEditingStickyText('');
    forceUpdate(n => n + 1);
    redrawAll();
    emitChange();
  }, [editingStickyId, editingStickyText, activeLayerId, redrawAll, emitChange]);

  const handleDeleteStickyNote = useCallback((noteId: number) => {
    const layer = layersRef.current.find(l => l.id === activeLayerId);
    if (!layer) return;
    undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), cloneLayers(layersRef.current)];
    redoStackRef.current = [];
    layer.stickyNotes = (layer.stickyNotes || []).filter(sn => sn.id !== noteId);
    setEditingStickyId(null);
    forceUpdate(n => n + 1);
    redrawAll();
    emitChange();
  }, [activeLayerId, redrawAll, emitChange]);

  // Double-tap sticky to edit
  const handleStickyDoubleTap = useCallback((noteId: number) => {
    const layer = layersRef.current.find(l => l.id === activeLayerId);
    if (!layer) return;
    const sn = (layer.stickyNotes || []).find(s => s.id === noteId);
    if (sn) {
      setEditingStickyId(noteId);
      setEditingStickyText(sn.text);
    }
  }, [activeLayerId]);

  // Focus sticky input
  useEffect(() => {
    if (editingStickyId != null && stickyInputRef.current) {
      setTimeout(() => stickyInputRef.current?.focus(), 50);
    }
  }, [editingStickyId]);

  const activeDrawTool = DRAW_TOOLS.find(d => d.id === tool);
  const activeShapeTool = SHAPE_TOOLS.find(s => s.id === tool);
  const layers = layersRef.current;
  const hasSelection = selectedIndices.length > 0;

  return (
    <div className={cn('flex flex-col h-full sketch-editor-root', presentationMode && 'bg-black', className)}>
      <div ref={containerRef} className={cn(
        'flex-1 min-h-0 relative overflow-hidden touch-none',
        background === 'dark' ? 'bg-[#1a1a2e]' : presentationMode ? 'bg-black' : 'bg-background',
        cursorHidden && presentationMode && 'cursor-none'
      )}>
        <canvas
          ref={canvasRef}
          className={cn(
            'absolute inset-0',
            isPanning ? (isPanningRef.current ? 'cursor-grabbing' : 'cursor-grab') :
            eyedropperActive ? 'cursor-cell' :
            tool === 'text' ? 'cursor-text' :
            tool === 'pdfTextSelect' ? 'cursor-text' :
            tool === 'sticky' ? 'cursor-crosshair' :
            tool === 'laser' ? 'cursor-none' :
            tool === 'washi' ? 'cursor-crosshair' :
            tool === 'select' ? 'cursor-default' : 'cursor-crosshair'
          )}
          style={{ touchAction: 'none' }}
        />
        {/* Video Panel */}
        {showVideoPanel && !presentationMode && (
          <SketchVideoPanel
            onClose={() => { setShowVideoPanel(false); }}
            bookmarks={videoBookmarks}
            onBookmarksChange={handleVideoBookmarksChange}
            videoUrl={videoUrl}
            onVideoUrlChange={handleVideoUrlChange}
          />
        )}
        {/* Ruler overlays - hidden in presentation mode - re-render on zoom/pan changes */}
        {!presentationMode && showRulers && zoomDisplay >= 0 && (
          <>
            {/* Top horizontal ruler */}
            <canvas
              ref={(el) => {
                if (!el) return;
                const ctx = el.getContext('2d');
                if (!ctx) return;
                const dpr = window.devicePixelRatio || 1;
                const rect = el.parentElement?.getBoundingClientRect();
                if (!rect) return;
                const w = rect.width;
                el.width = w * dpr;
                el.height = 24 * dpr;
                el.style.width = w + 'px';
                el.style.height = '24px';
                ctx.scale(dpr, dpr);
                ctx.fillStyle = 'hsl(var(--card))';
                ctx.fillRect(0, 0, w, 24);
                ctx.strokeStyle = 'hsl(var(--border))';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(0, 23.5); ctx.lineTo(w, 23.5); ctx.stroke();
                const zoom = zoomRef.current;
                const panX = panRef.current.x;
                const step = zoom >= 2 ? 10 : zoom >= 0.5 ? 25 : 50;
                const majorStep = step * 4;
                ctx.font = '9px system-ui';
                ctx.fillStyle = 'hsl(var(--muted-foreground))';
                ctx.textAlign = 'center';
                const startWorld = Math.floor(-panX / zoom / step) * step - step;
                const endWorld = Math.ceil((-panX + w) / zoom / step) * step + step;
                for (let worldX = startWorld; worldX <= endWorld; worldX += step) {
                  const screenX = worldX * zoom + panX;
                  if (screenX < 24 || screenX > w) continue;
                  const isMajor = worldX % majorStep === 0;
                  ctx.strokeStyle = 'hsl(var(--muted-foreground) / 0.4)';
                  ctx.lineWidth = isMajor ? 1 : 0.5;
                  ctx.beginPath();
                  ctx.moveTo(screenX, isMajor ? 6 : 14);
                  ctx.lineTo(screenX, 23);
                  ctx.stroke();
                  if (isMajor) ctx.fillText(String(worldX), screenX, 11);
                }
                // Corner square
                ctx.fillStyle = 'hsl(var(--card))';
                ctx.fillRect(0, 0, 24, 24);
                ctx.strokeStyle = 'hsl(var(--border))';
                ctx.strokeRect(0, 0, 24, 24);
                ctx.font = '7px system-ui';
                ctx.fillStyle = 'hsl(var(--muted-foreground))';
                ctx.textAlign = 'center';
                ctx.fillText('px', 12, 15);
              }}
              key={`ruler-h-${zoomDisplay}`}
              className="absolute top-0 left-0 z-20 pointer-events-none"
            />
            {/* Left vertical ruler */}
            <canvas
              ref={(el) => {
                if (!el) return;
                const ctx = el.getContext('2d');
                if (!ctx) return;
                const dpr = window.devicePixelRatio || 1;
                const rect = el.parentElement?.getBoundingClientRect();
                if (!rect) return;
                const h = rect.height;
                el.width = 24 * dpr;
                el.height = h * dpr;
                el.style.width = '24px';
                el.style.height = h + 'px';
                ctx.scale(dpr, dpr);
                ctx.fillStyle = 'hsl(var(--card))';
                ctx.fillRect(0, 0, 24, h);
                ctx.strokeStyle = 'hsl(var(--border))';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(23.5, 0); ctx.lineTo(23.5, h); ctx.stroke();
                const zoom = zoomRef.current;
                const panY = panRef.current.y;
                const step = zoom >= 2 ? 10 : zoom >= 0.5 ? 25 : 50;
                const majorStep = step * 4;
                ctx.font = '9px system-ui';
                ctx.fillStyle = 'hsl(var(--muted-foreground))';
                ctx.textAlign = 'center';
                const startWorld = Math.floor(-panY / zoom / step) * step - step;
                const endWorld = Math.ceil((-panY + h) / zoom / step) * step + step;
                for (let worldY = startWorld; worldY <= endWorld; worldY += step) {
                  const screenY = worldY * zoom + panY;
                  if (screenY < 24 || screenY > h) continue;
                  const isMajor = worldY % majorStep === 0;
                  ctx.strokeStyle = 'hsl(var(--muted-foreground) / 0.4)';
                  ctx.lineWidth = isMajor ? 1 : 0.5;
                  ctx.beginPath();
                  ctx.moveTo(isMajor ? 6 : 14, screenY);
                  ctx.lineTo(23, screenY);
                  ctx.stroke();
                  if (isMajor) {
                    ctx.save();
                    ctx.translate(11, screenY);
                    ctx.rotate(-Math.PI / 2);
                    ctx.fillText(String(worldY), 0, 4);
                    ctx.restore();
                  }
                }
              }}
              key={`ruler-v-${zoomDisplay}`}
              className="absolute top-0 left-0 z-20 pointer-events-none"
            />
          </>
        )}
        {/* Physical ruler overlay */}
        <CanvasRuler
          visible={showPhysicalRuler}
          onClose={() => setShowPhysicalRuler(false)}
          onRulerUpdate={useCallback((r: RulerLine | null) => { physicalRulerRef.current = r; }, [])}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
          zoomRef={zoomRef}
          panRef={panRef}
          zoomDisplay={zoomDisplay}
          measurement={rulerMeasurement}
        />
        {/* Protractor overlay */}
        <CanvasProtractor
          visible={showProtractor}
          onClose={() => setShowProtractor(false)}
          onRulerUpdate={useCallback((r: ProtractorLine | null) => { protractorRef.current = r; }, [])}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
          zoomRef={zoomRef}
          panRef={panRef}
          zoomDisplay={zoomDisplay}
          strokes={layersRef.current.find(l => l.id === activeLayerId)?.strokes}
        />
        {/* Triangle ruler overlay */}
        <CanvasTriangle
          visible={showTriangle}
          onClose={() => setShowTriangle(false)}
          onRulerUpdate={useCallback((r: TriangleEdges | null) => { triangleRef.current = r; }, [])}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
          zoomRef={zoomRef}
          panRef={panRef}
          zoomDisplay={zoomDisplay}
        />
        {/* Eyedropper mode indicator */}
        {eyedropperActive && (
          <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-lg px-2 py-1 text-[10px] flex items-center gap-1">
            <Pipette className="h-3 w-3" />{t('sketch.tapToPickColor')}
          </div>
        )}
        {/* Selection floating actions */}
        {hasSelection && tool === 'select' && (
          <div className="absolute top-2 left-2 bg-card/95 backdrop-blur-sm border border-border rounded-lg px-1 py-1 flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopySelection} title={t('sketch.copy')}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePasteSelection} title={t('sketch.paste')}>
              <Clipboard className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={handleDeleteSelection} title={t('sketch.delete')}>
              <Trash className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={handleSaveAsSticker} title={t('sketch.saveAsSticker')}>
              <BookmarkPlus className="h-3.5 w-3.5" />
            </Button>
            {/* Clip mask toggle for selected shape strokes */}
            {(() => {
              const selStrokes = getSelectedStrokes();
              const hasShapeSelected = selStrokes.some(s => isShapeTool(s.tool));
              if (!hasShapeSelected) return null;
              const allClipped = selStrokes.filter(s => isShapeTool(s.tool)).every(s => s.isClipMask);
              return (
                <Button
                  variant={allClipped ? "default" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    const layer = layersRef.current.find(l => l.id === activeLayerId);
                    if (!layer) return;
                    undoStackRef.current = [...undoStackRef.current.slice(-(50 - 1)), cloneLayers(layersRef.current)];
                    redoStackRef.current = [];
                    for (const idx of selectedIndices) {
                      const s = layer.strokes[idx];
                      if (s && isShapeTool(s.tool)) {
                        s.isClipMask = !allClipped;
                      }
                    }
                    redrawAll();
                    emitChange();
                  }}
                  title={allClipped ? t('sketch.removeClipMask') : t('sketch.setAsClipMask')}
                >
                  <ScissorsLineDashed className="h-3.5 w-3.5" />
                </Button>
              );
            })()}
          </div>
        )}
        {/* Selected sticky note floating actions */}
        {selectedStickyId != null && (
          <div className="absolute top-2 left-2 bg-card/95 backdrop-blur-sm border border-border rounded-lg px-1 py-1 flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                handleStickyDoubleTap(selectedStickyId);
                setSelectedStickyId(null);
              }}
              title={t('sketch.editStickyNote')}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={() => {
                handleDeleteStickyNote(selectedStickyId);
                setSelectedStickyId(null);
              }}
              title={t('sketch.deleteStickyNote')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {/* Selected washi tape floating actions */}
        {selectedWashiId != null && (
          <div className="absolute top-2 left-2 bg-card/95 backdrop-blur-sm border border-border rounded-lg px-1 py-1 flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={() => {
                const layer = layersRef.current.find(l => l.id === activeLayerId);
                if (!layer) return;
                undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), cloneLayers(layersRef.current)];
                redoStackRef.current = [];
                layer.washiTapes = (layer.washiTapes || []).filter(wt => wt.id !== selectedWashiId);
                setSelectedWashiId(null);
                forceUpdate(n => n + 1);
                redrawAll();
                emitChange();
              }}
              title={t('sketch.deleteTape')}
            >
              <Trash className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {/* PDF text selection floating actions */}
        {pdfSelectedText && tool === 'pdfTextSelect' && (
          <div className="absolute top-2 left-2 bg-card/95 backdrop-blur-sm border border-border rounded-xl px-2 py-1.5 flex items-center gap-1 shadow-lg z-50 animate-fade-in max-w-[90%]">
            <p className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={pdfSelectedText}>
              "{pdfSelectedText.slice(0, 40)}{pdfSelectedText.length > 40 ? '…' : ''}"
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                navigator.clipboard.writeText(pdfSelectedText).then(() => toast.success(t('sketch.textCopied')));
              }}
              title={t('sketch.copyToClipboard')}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                // Create highlight strokes over selected text rects
                const layer = layersRef.current.find(l => l.id === activeLayerId);
                if (!layer) return;
                undoStackRef.current = [...undoStackRef.current.slice(-(50 - 1)), cloneLayers(layersRef.current)];
                redoStackRef.current = [];
                // Group rects by line (similar Y) and merge overlapping/adjacent ones
                const lineGroups = new Map<number, { x: number; y: number; w: number; h: number }[]>();
                for (const r of pdfTextSelectionRects) {
                  let foundLine = false;
                  for (const [lineY, group] of lineGroups) {
                    if (Math.abs(r.y - lineY) < r.h * 0.5) {
                      group.push(r);
                      foundLine = true;
                      break;
                    }
                  }
                  if (!foundLine) lineGroups.set(r.y, [r]);
                }
                for (const [, group] of lineGroups) {
                  group.sort((a, b) => a.x - b.x);
                  const merged: { x: number; y: number; w: number; h: number }[] = [];
                  for (const r of group) {
                    const last = merged[merged.length - 1];
                    const gap = r.h * 0.3;
                    if (last && r.x <= last.x + last.w + gap) {
                      const newRight = Math.max(last.x + last.w, r.x + r.w);
                      last.w = newRight - last.x;
                      last.h = Math.max(last.h, r.h);
                    } else {
                      merged.push({ ...r });
                    }
                  }
                  for (const mr of merged) {
                    const hlStroke: Stroke = {
                      points: [
                        { x: mr.x, y: mr.y + mr.h / 2, pressure: 1 },
                        { x: mr.x + mr.w, y: mr.y + mr.h / 2, pressure: 1 },
                      ],
                      color: color,
                      width: mr.h / 5,
                      tool: 'textHighlight',
                      fillOpacity: highlightOpacity,
                    };
                    layer.strokes.push(hlStroke);
                  }
                }
                setPdfSelectedText('');
                setPdfTextSelectionRects([]);
                redrawAll();
                emitChange();
                toast.success(t('sketch.textHighlighted'));
              }}
              title={t('sketch.highlightSelectedText')}
            >
              <Highlighter className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                // Create a text annotation with selected text
                const layer = layersRef.current.find(l => l.id === activeLayerId);
                if (!layer) return;
                undoStackRef.current = [...undoStackRef.current.slice(-(50 - 1)), cloneLayers(layersRef.current)];
                redoStackRef.current = [];
                const rects = pdfTextSelectionRects;
                const bx = rects.length > 0 ? Math.min(...rects.map(r => r.x)) : 0;
                const by = rects.length > 0 ? Math.max(...rects.map(r => r.y + r.h)) + 8 : 0;
                const newAnnotation: TextAnnotation = {
                  id: Date.now(),
                  x: bx,
                  y: by,
                  text: pdfSelectedText,
                  font: 'sans-serif',
                  fontSize: 14,
                  color: color,
                  bold: false,
                  italic: false,
                };
                if (!layer.textAnnotations) layer.textAnnotations = [];
                layer.textAnnotations.push(newAnnotation);
                setPdfSelectedText('');
                setPdfTextSelectionRects([]);
                redrawAll();
                emitChange();
                toast.success(t('sketch.textAnnotationCreated'));
              }}
              title={t('sketch.createTextAnnotation')}
            >
              <Type className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => {
                setPdfSelectedText('');
                setPdfTextSelectionRects([]);
                redrawAll();
              }}
              title={t('sketch.clearSelection')}
            >
              <Trash className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {/* PDF text search bar */}
        {tool === 'pdfTextSelect' && pdfPages.length > 0 && showPdfSearch && (
          <div className="absolute top-2 right-2 bg-card/95 backdrop-blur-sm border border-border rounded-xl px-2 py-1.5 flex items-center gap-1.5 shadow-lg z-50 animate-fade-in">
            <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              placeholder={t('sketch.searchPdfText')}
              value={pdfSearchQuery}
              onChange={(e) => {
                const q = e.target.value;
                setPdfSearchQuery(q);
                if (!q.trim()) { setPdfSearchMatchRects([]); redrawAll(); return; }
                const textItems = pdfTextItemsRef.current.get(pdfPageIndex) || [];
                const lower = q.toLowerCase();
                const matches: { x: number; y: number; w: number; h: number }[] = [];
                for (const ti of textItems) {
                  if (ti.str.toLowerCase().includes(lower)) {
                    matches.push({ x: ti.x, y: ti.y, w: ti.width, h: ti.height });
                  }
                }
                setPdfSearchMatchRects(matches);
                redrawAll();
              }}
              className="bg-transparent border-none outline-none text-xs text-foreground w-32 placeholder:text-muted-foreground"
              autoFocus
            />
            {pdfSearchMatchRects.length > 0 && (
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{pdfSearchMatchRects.length} {t('sketch.found')}</span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                if (pdfSearchMatchRects.length > 0) {
                  // Auto-highlight all matches
                  const layer = layersRef.current.find(l => l.id === activeLayerId);
                  if (!layer) return;
                  undoStackRef.current = [...undoStackRef.current.slice(-(50 - 1)), cloneLayers(layersRef.current)];
                  redoStackRef.current = [];
                  // Group by line and merge
                  const lineGroups = new Map<number, { x: number; y: number; w: number; h: number }[]>();
                  for (const r of pdfSearchMatchRects) {
                    let foundLine = false;
                    for (const [lineY, group] of lineGroups) {
                      if (Math.abs(r.y - lineY) < r.h * 0.5) { group.push(r); foundLine = true; break; }
                    }
                    if (!foundLine) lineGroups.set(r.y, [r]);
                  }
                  for (const [, group] of lineGroups) {
                    group.sort((a, b) => a.x - b.x);
                    const merged: { x: number; y: number; w: number; h: number }[] = [];
                    for (const r of group) {
                      const last = merged[merged.length - 1];
                      const gap = r.h * 0.3;
                      if (last && r.x <= last.x + last.w + gap) {
                        last.w = Math.max(last.x + last.w, r.x + r.w) - last.x;
                        last.h = Math.max(last.h, r.h);
                      } else { merged.push({ ...r }); }
                    }
                    for (const mr of merged) {
                      layer.strokes.push({
                        points: [
                          { x: mr.x, y: mr.y + mr.h / 2, pressure: 1 },
                          { x: mr.x + mr.w, y: mr.y + mr.h / 2, pressure: 1 },
                        ],
                        color: color,
                        width: mr.h / 5,
                        tool: 'textHighlight',
                        fillOpacity: highlightOpacity,
                      } as Stroke);
                    }
                  }
                  redrawAll();
                  emitChange();
                  toast.success(t('sketch.highlightedMatches', { count: pdfSearchMatchRects.length }));
                }
              }}
              title={t('sketch.highlightAllMatches')}
            >
              <Highlighter className="h-3 w-3" />
            </Button>
            <button
              className="h-5 w-5 rounded flex items-center justify-center hover:bg-muted"
              onClick={() => { setShowPdfSearch(false); setPdfSearchQuery(''); setPdfSearchMatchRects([]); redrawAll(); }}
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        )}
        {tool === 'pdfTextSelect' && pdfPages.length > 0 && !showPdfSearch && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 bg-card/80 backdrop-blur-sm border border-border/50 shadow-sm z-50"
            onClick={() => setShowPdfSearch(true)}
            title={t('sketch.searchPdf')}
          >
            <Search className="h-4 w-4" />
          </Button>
        )}
        {/* Inline text input overlay */}
        {editingText && (
          <div
            className="absolute z-50"
            style={{
              left: editingText.x * zoomRef.current + panRef.current.x,
              top: editingText.y * zoomRef.current + panRef.current.y,
            }}
          >
            <textarea
              ref={textInputRef}
              value={editingTextValue}
              onChange={(e) => setEditingTextValue(e.target.value)}
              onBlur={commitTextAnnotation}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setEditingText(null); setEditingTextValue(''); }
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitTextAnnotation(); }
              }}
              className="bg-transparent border border-primary/50 rounded px-1 py-0 outline-none resize-none min-w-[80px] min-h-[1.5em]"
              style={{
                font: `${textItalic ? 'italic ' : ''}${textBold ? 'bold ' : ''}${textFontSize * zoomRef.current}px ${textFont}`,
                color,
                lineHeight: 1.2,
                caretColor: color,
              }}
              rows={1}
              placeholder="Type here..."
            />
          </div>
        )}
        {/* Sticky note editing overlay */}
        {editingStickyId != null && (() => {
          const layer = layersRef.current.find(l => l.id === activeLayerId);
          const sn = layer ? (layer.stickyNotes || []).find(s => s.id === editingStickyId) : null;
          if (!sn) return null;
          const zoom = zoomRef.current;
          const pan = panRef.current;
          return (
            <div
              className="absolute z-50"
              style={{
                left: sn.x * zoom + pan.x,
                top: sn.y * zoom + pan.y,
                width: sn.width * zoom,
                height: sn.height * zoom,
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="relative w-full h-full rounded shadow-lg" style={{ backgroundColor: sn.color }}>
                <textarea
                  ref={stickyInputRef}
                  value={editingStickyText}
                  onChange={(e) => setEditingStickyText(e.target.value)}
                  onBlur={(e) => {
                    // Don't commit if clicking within the sticky overlay (color buttons, delete)
                    const related = e.relatedTarget as HTMLElement | null;
                    if (related && e.currentTarget.closest('.absolute')?.contains(related)) return;
                    commitStickyNote();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { commitStickyNote(); }
                  }}
                  className="w-full bg-transparent border-none outline-none resize-none p-2.5 text-[#1a1a1a]"
                  style={{ fontSize: sn.fontSize * zoom, height: `calc(100% - 28px)` }}
                  placeholder={t('sketch.typeOnSticky')}
                />
                <div className="absolute top-1 right-1 flex gap-1">
                  <button
                    className="w-6 h-6 rounded flex items-center justify-center bg-foreground/10 hover:bg-foreground/20 text-foreground/70"
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); commitStickyNote(); }}
                  >
                    ✓
                  </button>
                  <button
                    className="w-6 h-6 rounded flex items-center justify-center bg-destructive/20 hover:bg-destructive/40 text-destructive"
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteStickyNote(sn.id); }}
                  >
                    <Trash className="h-3 w-3" />
                  </button>
                </div>
                {/* Color picker row */}
                <div className="absolute bottom-1 left-1 right-1 flex gap-1 justify-center">
                  {STICKY_COLORS.map(c => (
                    <button
                      key={c}
                      className={cn('w-5 h-5 rounded-full border-2 transition-transform active:scale-90',
                        sn.color === c ? 'border-foreground/50 scale-110' : 'border-transparent')}
                      style={{ backgroundColor: c }}
                      onMouseDown={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        sn.color = c;
                        setStickyColor(c);
                        forceUpdate(n => n + 1);
                        redrawAll();
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Audio Sync Scrubber Bar */}
      {isAudioSyncPlaying && audioDurationRef.current > 0 && (
        <div className="absolute bottom-20 left-4 right-4 z-50 bg-card/90 backdrop-blur-md border border-border/50 rounded-2xl px-4 py-3 shadow-xl animate-fade-in">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center hover:bg-primary/25 transition-colors active:scale-95"
              onClick={() => {
                const audio = audioPlaybackRef.current;
                if (!audio) return;
                if (audio.paused) {
                  audio.play().catch(() => {});
                  // Restart the rAF loop with full loop support
                  const replayLoop = () => {
                    if (audioSyncAbortRef.current || !audioPlaybackRef.current) return;
                    const currentMs = (audioPlaybackRef.current.currentTime || 0) * 1000;
                    
                    // A/B loop range check
                    const loopOn = audioLoopEnabledRef.current;
                    const loopA = audioLoopARef.current;
                    const loopB = audioLoopBRef.current;
                    if (loopOn && loopA != null && loopB != null && currentMs >= loopB) {
                      audioPlaybackRef.current.currentTime = loopA / 1000;
                      audioScrubTimeRef.current = loopA;
                      setAudioScrubTime(loopA);
                      renderCanvasAtTime(loopA);
                      audioSyncRafRef.current = requestAnimationFrame(replayLoop);
                      return;
                    }
                    
                    audioScrubTimeRef.current = currentMs;
                    setAudioScrubTime(currentMs);
                    renderCanvasAtTime(currentMs);
                    if (!audioPlaybackRef.current.ended && !audioPlaybackRef.current.paused) {
                      audioSyncRafRef.current = requestAnimationFrame(replayLoop);
                    }
                  };
                  audioSyncRafRef.current = requestAnimationFrame(replayLoop);
                } else {
                  audio.pause();
                  cancelAnimationFrame(audioSyncRafRef.current);
                }
              }}
            >
              {audioPlaybackRef.current?.paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>

            {/* Current time */}
            <span className="text-[10px] font-mono text-muted-foreground min-w-[36px]">
              {Math.floor(audioScrubTime / 60000)}:{Math.floor((audioScrubTime % 60000) / 1000).toString().padStart(2, '0')}
            </span>

            {/* Scrubber bar */}
            <div
              className="flex-1 h-8 flex items-center cursor-pointer group"
              onPointerDown={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const newTime = frac * audioDurationRef.current * 1000;
                handleScrubTo(newTime);

                // Drag scrubbing
                const onMove = (ev: PointerEvent) => {
                  const f = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                  const t = f * audioDurationRef.current * 1000;
                  handleScrubTo(t);
                };
                const onUp = () => {
                  document.removeEventListener('pointermove', onMove);
                  document.removeEventListener('pointerup', onUp);
                };
                document.addEventListener('pointermove', onMove);
                document.addEventListener('pointerup', onUp);
              }}
            >
              <div className="relative w-full h-1.5 bg-muted rounded-full overflow-hidden">
                {/* Progress fill */}
                <div
                  className="absolute inset-y-0 left-0 bg-primary rounded-full transition-none"
                  style={{ width: `${Math.min(100, (audioScrubTime / (audioDurationRef.current * 1000)) * 100)}%` }}
                />
                {/* Stroke markers on timeline */}
                {audioSyncedStrokesRef.current.map((s, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 w-0.5 bg-foreground/20"
                    style={{ left: `${(s.audioTimestamp / (audioDurationRef.current * 1000)) * 100}%` }}
                  />
                ))}
              </div>
              {/* Thumb */}
              <div
                className="absolute w-4 h-4 bg-primary rounded-full shadow-md border-2 border-background -mt-[5px] group-hover:scale-125 transition-transform"
                style={{ left: `calc(${(audioScrubTime / (audioDurationRef.current * 1000)) * 100}% - 8px)` }}
              />
            </div>

            {/* Duration */}
            <span className="text-[10px] font-mono text-muted-foreground min-w-[36px] text-right">
              {Math.floor(audioDurationRef.current / 60)}:{Math.floor(audioDurationRef.current % 60).toString().padStart(2, '0')}
            </span>

            {/* Loop toggle */}
            <button
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center transition-colors active:scale-95",
                audioLoopEnabled ? "bg-primary/25 text-primary ring-1 ring-primary/40" : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
              onClick={() => {
                const next = !audioLoopEnabled;
                setAudioLoopEnabled(next);
                audioLoopEnabledRef.current = next;
                if (!next) {
                  setAudioLoopA(null);
                  setAudioLoopB(null);
                  audioLoopARef.current = null;
                  audioLoopBRef.current = null;
                }
              }}
              title={audioLoopEnabled ? t('sketch.disableLoop') : t('sketch.enableLoop')}
            >
              <Repeat className="h-3.5 w-3.5" />
            </button>

            {/* A/B markers (shown when loop enabled) */}
            {audioLoopEnabled && (
              <>
                <button
                  className={cn(
                    "h-6 px-1.5 rounded text-[9px] font-bold transition-colors active:scale-95",
                    audioLoopA != null ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => {
                    if (audioLoopA != null) {
                      setAudioLoopA(null);
                      audioLoopARef.current = null;
                    } else {
                      setAudioLoopA(audioScrubTime);
                      audioLoopARef.current = audioScrubTime;
                    }
                  }}
                  title={audioLoopA != null ? t('sketch.clearAMarker') : t('sketch.setAMarker')}
                >
                  A
                </button>
                <button
                  className={cn(
                    "h-6 px-1.5 rounded text-[9px] font-bold transition-colors active:scale-95",
                    audioLoopB != null ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => {
                    if (audioLoopB != null) {
                      setAudioLoopB(null);
                      audioLoopBRef.current = null;
                    } else {
                      const bVal = audioScrubTime;
                      setAudioLoopB(bVal);
                      audioLoopBRef.current = bVal;
                    }
                  }}
                  title={audioLoopB != null ? t('sketch.clearBMarker') : t('sketch.setBMarker')}
                >
                  B
                </button>
              </>
            )}

            {/* Stop button */}
            <button
              className="h-7 w-7 rounded-full bg-destructive/15 text-destructive flex items-center justify-center hover:bg-destructive/25 transition-colors active:scale-95"
              onClick={handleAudioSyncPlayback}
              title={t('sketch.stop')}
            >
              <StopSquare className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Loop range indicator on scrubber */}
          {audioLoopEnabled && audioLoopA != null && audioLoopB != null && audioDurationRef.current > 0 && (
            <div className="relative w-full h-1 mt-1 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 bg-primary/20 rounded-full"
                style={{
                  left: `${(Math.min(audioLoopA, audioLoopB) / (audioDurationRef.current * 1000)) * 100}%`,
                  width: `${(Math.abs(audioLoopB - audioLoopA) / (audioDurationRef.current * 1000)) * 100}%`,
                }}
              />
            </div>
          )}
           <p className="text-[9px] text-muted-foreground mt-1 text-center">
             {t('sketch.dragToScrub')} • {audioLoopEnabled ? t('sketch.loopOn') : t('sketch.loopOff')}
          </p>
        </div>
      )}

      {/* Focus mode floating exit button */}
      {focusMode && (
        <button
          className="absolute bottom-4 right-4 z-30 bg-card/90 backdrop-blur-sm border border-border/50 rounded-full p-3 shadow-lg text-foreground/70 hover:text-foreground hover:bg-card transition-all duration-200 active:scale-95"
          onClick={() => setFocusMode(false)}
          title={t('sketch.exitFocusMode')}
        >
          <Focus className="h-5 w-5" />
        </button>
      )}

      {/* Presentation Mode overlay */}
      {presentationMode && (
        <>
          {/* Floating exit button */}
          <button
            className={cn(
              "absolute top-4 right-4 z-50 bg-card/80 backdrop-blur-sm border border-border/50 rounded-full p-3 shadow-lg text-foreground/60 hover:text-foreground hover:bg-card transition-all duration-300 active:scale-95 animate-fade-in",
              cursorHidden && "opacity-0 pointer-events-none"
            )}
            onClick={exitPresentationMode}
            title={t('sketch.exitPresentationMode')}
          >
            <X className="h-5 w-5" />
          </button>
          {/* Laser pointer indicator */}
          {tool === 'laser' && (
            <div className="absolute top-4 left-4 z-50 bg-card/70 backdrop-blur-sm border border-border/30 rounded-full px-3 py-1.5 flex items-center gap-2 animate-fade-in">
              <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
              <span className="text-[10px] font-medium text-foreground/70">{t('sketch.laserPointerActive')}</span>
            </div>
          )}
          {/* Page indicator for PDF */}
          {pdfPages.length > 1 && (
            <div className={cn(
              "absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card/70 backdrop-blur-sm border border-border/30 rounded-full px-4 py-2 flex items-center gap-3 animate-fade-in transition-opacity duration-300",
              cursorHidden && "opacity-0 pointer-events-none"
            )}>
              <button
                className="h-7 w-7 rounded-full flex items-center justify-center text-foreground/70 hover:bg-muted/80 hover:text-foreground disabled:opacity-30 transition-colors"
                onClick={() => handlePdfPageChange(pdfPageIndex - 1)}
                disabled={pdfPageIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-medium text-foreground/80 min-w-[60px] text-center">
                {pdfPageIndex + 1} / {pdfPages.length}
              </span>
              <button
                className="h-7 w-7 rounded-full flex items-center justify-center text-foreground/70 hover:bg-muted/80 hover:text-foreground disabled:opacity-30 transition-colors"
                onClick={() => handlePdfPageChange(pdfPageIndex + 1)}
                disabled={pdfPageIndex === pdfPages.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          {/* Swipe & keyboard hint */}
          {pdfPages.length > 1 && (
            <div className={cn(
              "absolute bottom-16 left-1/2 -translate-x-1/2 z-50 text-[10px] text-foreground/40 animate-fade-in transition-opacity duration-300",
              cursorHidden && "opacity-0"
            )}>
              {t('sketch.swipeOrArrowKeys')}
            </div>
          )}
        </>
      )}

      {/* Sticker Library Panel */}
      {stickerLibraryOpen && (
        <div className="absolute right-0 top-0 bottom-0 w-72 z-40 bg-card/95 backdrop-blur-md border-l border-border shadow-2xl flex flex-col animate-fade-in">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50">
            <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sticker className="h-4 w-4" /> {t('sketch.stickerLibrary')}
            </span>
            <button
              className="h-7 w-7 rounded-lg flex items-center justify-center text-foreground/60 hover:bg-muted/80 hover:text-foreground transition-colors"
              onClick={() => setStickerLibraryOpen(false)}
            >{"✕"}</button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
            {/* Emoji Stickers */}
            {EMOJI_STICKERS.map(cat => (
              <div key={cat.category}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">{cat.category}</p>
                <div className="grid grid-cols-5 gap-1">
                  {cat.emojis.map(emoji => (
                    <button
                      key={emoji}
                      className="aspect-square rounded-lg border border-border/30 bg-background/60 hover:bg-primary/10 hover:border-primary/30 hover:scale-110 transition-all flex items-center justify-center text-xl active:scale-95"
                      onClick={() => handlePlaceEmoji(emoji)}
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Decorative Built-in stickers */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">{t('sketch.decorative')}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {BUILT_IN_STICKERS.map(sticker => (
                  <button
                    key={sticker.id}
                    className="aspect-square rounded-lg border border-border/50 bg-background/80 hover:bg-primary/10 hover:border-primary/30 transition-all flex flex-col items-center justify-center p-1 active:scale-95"
                    onClick={() => handlePasteSticker(sticker)}
                    title={sticker.name}
                  >
                    <canvas
                      className="w-full h-full"
                      width={50} height={50}
                      ref={(cvs) => {
                        if (!cvs) return;
                        const ctx = cvs.getContext('2d');
                        if (!ctx) return;
                        ctx.clearRect(0, 0, 50, 50);
                        const bbox = getSelectionBBox(sticker.strokes);
                        if (!bbox) return;
                        const scale = Math.min(44 / (bbox.w || 1), 44 / (bbox.h || 1), 2);
                        ctx.save();
                        ctx.translate(25 - (bbox.w * scale) / 2 - bbox.x * scale, 25 - (bbox.h * scale) / 2 - bbox.y * scale);
                        ctx.scale(scale, scale);
                        sticker.strokes.forEach(s => drawStroke(ctx, s));
                        ctx.restore();
                      }}
                    />
                    <span className="text-[7px] text-muted-foreground truncate w-full text-center">{sticker.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Saved stickers */}
            {savedStickers.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">{t('sketch.yourStickers')}</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {savedStickers.map(sticker => (
                    <div key={sticker.id} className="relative group">
                      <button
                        className="aspect-square w-full rounded-lg border border-border/50 bg-background/80 hover:bg-primary/10 hover:border-primary/30 transition-all flex flex-col items-center justify-center p-1 active:scale-95"
                        onClick={() => handlePasteSticker(sticker)}
                        title={sticker.name}
                      >
                        <canvas
                          className="w-full h-full"
                          width={50} height={50}
                          ref={(cvs) => {
                            if (!cvs) return;
                            const ctx = cvs.getContext('2d');
                            if (!ctx) return;
                            ctx.clearRect(0, 0, 50, 50);
                            const bbox = getSelectionBBox(sticker.strokes);
                            if (!bbox) return;
                            const scale = Math.min(44 / (bbox.w || 1), 44 / (bbox.h || 1), 2);
                            ctx.save();
                            ctx.translate(25 - (bbox.w * scale) / 2 - bbox.x * scale, 25 - (bbox.h * scale) / 2 - bbox.y * scale);
                            ctx.scale(scale, scale);
                            sticker.strokes.forEach(s => drawStroke(ctx, s));
                            ctx.restore();
                          }}
                        />
                        <span className="text-[7px] text-muted-foreground truncate w-full text-center">{sticker.name}</span>
                      </button>
                      <button
                        className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); handleDeleteSticker(sticker.id); }}
                        title={t('sketch.deleteSticker')}
                      >{"✕"}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {savedStickers.length === 0 && (
               <p className="text-[10px] text-muted-foreground text-center px-3 py-4">
                 {t('sketch.stickerHint')} <BookmarkPlus className="inline h-3 w-3 -mt-0.5" />
              </p>
            )}
          </div>
        </div>
      )}

      {zoomWriteActive && (
        <div
          className="absolute bottom-0 left-0 right-0 z-40 bg-card border-t-2 border-primary/30 shadow-2xl"
          style={{ height: ZOOM_WRITE_HEIGHT + 40 }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border/50">
            <div className="flex items-center gap-2">
              <ZoomIn className="h-3.5 w-3.5 text-primary" />
               <span className="text-[10px] font-semibold text-foreground">{t('sketch.zoomToWrite')}</span>
               <span className="text-[10px] text-muted-foreground">({ZOOM_WRITE_SCALE}x {t('sketch.magnified')})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => {
                  // Move write position down a line
                  const lineHeight = 30; // approx line height at normal scale
                  zoomWriteOffsetRef.current = {
                    x: zoomWriteOffsetRef.current.x - (zoomWriteBoxWidthRef.current / ZOOM_WRITE_SCALE) + (zoomWriteBoxWidthRef.current / ZOOM_WRITE_SCALE),
                    y: zoomWriteOffsetRef.current.y + lineHeight,
                  };
                  // Reset x to original starting x
                  const zoom = zoomRef.current;
                  const pan = panRef.current;
                  const cw = canvasSizeRef.current.w;
                  zoomWriteOffsetRef.current.x = (cw / 2 - pan.x) / zoom - 100;
                  // Redraw the zoom write canvas
                  const zwCanvas = zoomWriteCanvasRef.current;
                  if (zwCanvas) redrawZoomWriteBox(zwCanvas);
                }}
              >
                ↵ {t('sketch.newLine')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2 text-destructive hover:text-destructive"
                onClick={() => setZoomWriteActive(false)}
              >
                ✕ {t('sketch.close')}
              </Button>
            </div>
          </div>
          {/* Magnified writing canvas */}
          <canvas
            ref={zoomWriteCanvasRef}
            className="w-full cursor-crosshair"
            style={{ height: ZOOM_WRITE_HEIGHT, touchAction: 'none' }}
            onPointerDown={(e) => {
              const canvas = zoomWriteCanvasRef.current;
              if (!canvas) return;
              canvas.setPointerCapture(e.pointerId);
              zoomWriteDrawingRef.current = true;

              const rect = canvas.getBoundingClientRect();
              const sx = canvas.width / rect.width;
              const sy = canvas.height / rect.height;
              const cx = (e.clientX - rect.left) * sx;
              const cy = (e.clientY - rect.top) * sy;

              // Convert zoom-write canvas coords to world coords
              const wx = zoomWriteOffsetRef.current.x + cx / ZOOM_WRITE_SCALE;
              const wy = zoomWriteOffsetRef.current.y + (cy - ZOOM_WRITE_HEIGHT / 2) / ZOOM_WRITE_SCALE;

              const point: Point = { x: wx, y: wy, pressure: e.pressure > 0 ? e.pressure : 0.5 };
              zoomWriteLastPointRef.current = point;

              let strokeColor = color;
              if (toolOpacity < 1) strokeColor = hexToRgba(color, toolOpacity);

              zoomWriteStrokeRef.current = {
                points: [point],
                color: strokeColor,
                width: strokeWidth,
                tool: isShapeTool(tool) ? 'pen' : (tool === 'eraser' || tool === 'select' || tool === 'text' || tool === 'sticky' || tool === 'image' || tool === 'pdfTextSelect' ? 'pen' : tool),
                ...(pressureOpacityEnabled ? { pressureOpacity: true } : {}),
                ...(tool === 'washi' ? { washiPatternId } : {}),
              };
            }}
            onPointerMove={(e) => {
              if (!zoomWriteDrawingRef.current || !zoomWriteStrokeRef.current) return;
              const canvas = zoomWriteCanvasRef.current;
              if (!canvas) return;
              const rect = canvas.getBoundingClientRect();
              const sx = canvas.width / rect.width;
              const sy = canvas.height / rect.height;
              const cx = (e.clientX - rect.left) * sx;
              const cy = (e.clientY - rect.top) * sy;

              const wx = zoomWriteOffsetRef.current.x + cx / ZOOM_WRITE_SCALE;
              const wy = zoomWriteOffsetRef.current.y + (cy - ZOOM_WRITE_HEIGHT / 2) / ZOOM_WRITE_SCALE;

              const point: Point = { x: wx, y: wy, pressure: e.pressure > 0 ? e.pressure : 0.5 };
              const last = zoomWriteLastPointRef.current;
              if (last) {
                const dx = point.x - last.x; const dy = point.y - last.y;
                if (dx * dx + dy * dy < 0.5) return;
                point.pressure = last.pressure * 0.3 + point.pressure * 0.7;
              }
              zoomWriteLastPointRef.current = point;
              zoomWriteStrokeRef.current.points.push(point);

              // Live preview: draw on zoom-write canvas + main canvas
              cancelAnimationFrame(zoomWriteRafRef.current);
              zoomWriteRafRef.current = requestAnimationFrame(() => {
                redrawZoomWriteBox(canvas, zoomWriteStrokeRef.current || undefined);
                // Also draw live on main canvas
                redrawAll();
                if (zoomWriteStrokeRef.current) {
                  const mainCtx = canvasRef.current?.getContext('2d');
                  if (mainCtx) {
                    mainCtx.save();
                    const z = zoomRef.current;
                    const p = panRef.current;
                    mainCtx.translate(p.x, p.y);
                    mainCtx.scale(z, z);
                    drawStroke(mainCtx, zoomWriteStrokeRef.current);
                    mainCtx.restore();
                  }
                }
              });

              // Auto-advance: if writing reaches right edge of box
              const boxWorldWidth = canvas.width / ZOOM_WRITE_SCALE;
              if (wx > zoomWriteOffsetRef.current.x + boxWorldWidth * 0.9) {
                zoomWriteOffsetRef.current.x += boxWorldWidth * 0.7;
              }
            }}
            onPointerUp={() => {
              if (zoomWriteStrokeRef.current && zoomWriteStrokeRef.current.points.length > 1) {
                // Commit stroke to main canvas
                const layer = layersRef.current.find(l => l.id === activeLayerId);
                if (layer?.visible) {
                  undoStackRef.current.push(cloneLayers(layersRef.current));
                  redoStackRef.current = [];
                  layer.strokes = [...layer.strokes, zoomWriteStrokeRef.current];
                  redrawAll();
                  emitChange();
                }
              }
              zoomWriteStrokeRef.current = null;
              zoomWriteDrawingRef.current = false;
              zoomWriteLastPointRef.current = null;
              // Redraw zoom-write box
              const canvas = zoomWriteCanvasRef.current;
              if (canvas) redrawZoomWriteBox(canvas);
            }}
          />
        </div>
      )}


      {pdfPages.length > 1 && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-card/90 backdrop-blur-sm border border-border/50 rounded-full px-3 py-1.5 shadow-lg z-10">
          <button
            className="h-7 w-7 rounded-full flex items-center justify-center text-foreground/70 hover:bg-muted/80 hover:text-foreground disabled:opacity-30 transition-colors"
            onClick={() => handlePdfPageChange(pdfPageIndex - 1)}
            disabled={pdfPageIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-medium text-foreground min-w-[60px] text-center">
            {pdfPageIndex + 1} / {pdfPages.length}
          </span>
          <button
            className="h-7 w-7 rounded-full flex items-center justify-center text-foreground/70 hover:bg-muted/80 hover:text-foreground disabled:opacity-30 transition-colors"
            onClick={() => handlePdfPageChange(pdfPageIndex + 1)}
            disabled={pdfPageIndex === pdfPages.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* PDF single page indicator */}
      {pdfPages.length === 1 && (
        <div className="absolute top-2 left-2 bg-card/90 backdrop-blur-sm border border-border/50 rounded-lg px-2 py-1 text-[10px] text-muted-foreground flex items-center gap-1 z-10">
          <FileText className="h-3 w-3" />
          {t('sketch.pdfOnePage')}
        </div>
      )}

      {/* Bottom toolbar */}
      <div
        className={cn(
          'flex-shrink-0 border-t border-border/60 bg-gradient-to-t from-card via-card to-card/90 backdrop-blur-md transition-all duration-300 overflow-hidden shadow-[0_-2px_12px_-4px_rgba(0,0,0,0.1)]',
          (focusMode || presentationMode) && 'translate-y-full opacity-0 pointer-events-none absolute bottom-0 left-0 right-0'
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', maxWidth: '100vw' }}
      >
        <div
          className="flex items-center gap-1.5 px-3 py-2.5 scrollbar-hide"
          style={{
            overflowX: 'auto',
            overflowY: 'hidden',
            touchAction: 'pan-x',
            WebkitOverflowScrolling: 'touch' as any,
            overscrollBehaviorX: 'contain',
            scrollbarWidth: 'none' as any,
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
        >
        {/* Select tool */}
        <button
          className={cn(
            'h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200',
            tool === 'select'
              ? 'bg-primary/15 text-primary scale-105 ring-2 ring-primary/20 shadow-sm'
              : 'text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95'
          )}
          onClick={() => { setTool('select'); setEyedropperActive(false); }}
        >
          <MousePointer2 className="h-5 w-5" strokeWidth={tool === 'select' ? 2.5 : 1.8} />
        </button>

        {/* Separator */}
        <div className="w-px h-6 bg-border/50 flex-shrink-0 mx-0.5" />

        {/* Text Highlight tool — always available */}
        <Popover open={openToolbarPopover === 'textHighlight'} onOpenChange={(o) => setOpenToolbarPopover(o ? 'textHighlight' : null)}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200 relative',
                tool === 'textHighlight'
                  ? 'bg-gradient-to-br from-yellow-400/20 to-orange-400/20 text-yellow-600 dark:text-yellow-400 ring-2 ring-yellow-400/30 scale-105'
                  : 'text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95'
              )}
              onClick={() => { setTool('textHighlight'); setEyedropperActive(false); }}
              title="Highlight"
            >
              <Highlighter className="h-5 w-5" strokeWidth={tool === 'textHighlight' ? 2.5 : 1.8} />
              <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full border border-card shadow-sm" style={{ backgroundColor: color }} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 bg-card/95 backdrop-blur-md border border-border/50 shadow-xl rounded-2xl" align="start" side="top">
            <p className="text-[10px] font-semibold text-foreground mb-2">✨ {t('sketch.highlightColor')}</p>
            <div className="flex gap-2">
              {[
                { c: '#FFEB3B', label: 'Yellow' },
                { c: '#66BB6A', label: 'Green' },
                { c: '#42A5F5', label: 'Blue' },
                { c: '#EC407A', label: 'Pink' },
                { c: '#FF7043', label: 'Orange' },
                { c: '#AB47BC', label: 'Purple' },
              ].map(({ c, label }) => (
                <button
                  key={c}
                  className={cn(
                    'w-8 h-8 rounded-lg transition-all duration-150 border-2 shadow-sm',
                    color === c ? 'border-foreground scale-110 shadow-md' : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => { setColor(c); setTool('textHighlight'); setOpenToolbarPopover(null); }}
                  title={label}
                />
              ))}
            </div>
            <div className="mt-2.5 pt-2 border-t border-border/30">
              <p className="text-[10px] text-muted-foreground mb-1">{t('sketch.opacity')}: {Math.round(highlightOpacity * 100)}%</p>
              <Slider min={10} max={80} step={5} value={[Math.round(highlightOpacity * 100)]} onValueChange={([v]) => setHighlightOpacity(v / 100)} />
            </div>
          </PopoverContent>
        </Popover>

        {/* PDF Text Select tool (PDF only) */}
        {pdfPages.length > 0 && (
          <button
            className={cn(
              'h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200 relative',
              tool === 'pdfTextSelect'
                ? 'bg-primary/15 text-primary scale-105'
                : 'text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95'
            )}
            onClick={() => {
              setTool('pdfTextSelect');
              setEyedropperActive(false);
              setPdfSelectedText('');
              setPdfTextSelectionRects([]);
            }}
            title={t('sketch.selectPdfText')}
          >
            <FileText className="h-5 w-5" strokeWidth={tool === 'pdfTextSelect' ? 2.5 : 1.8} />
            <span className="absolute -bottom-0.5 -right-0.5 text-[7px] font-bold text-primary">T</span>
          </button>
        )}

        {/* Separator */}
        <div className="w-px h-6 bg-border/50 flex-shrink-0 mx-0.5" />

        {/* Sticky note tool */}
        <Popover open={openToolbarPopover === 'sticky'} onOpenChange={(o) => setOpenToolbarPopover(o ? 'sticky' : null)}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200',
                tool === 'sticky'
                  ? 'bg-primary/15 text-primary scale-105 ring-2 ring-primary/20 shadow-sm'
                  : 'text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95'
              )}
              onClick={() => { setTool('sticky'); setEyedropperActive(false); }}
            >
              <StickyNote className="h-5 w-5" strokeWidth={tool === 'sticky' ? 2.5 : 1.8} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 bg-card" align="start" side="top">
            <p className="text-[10px] font-medium text-foreground mb-2">{t('sketch.stickyNoteColor')}</p>
            <div className="flex gap-1.5 flex-wrap">
              {STICKY_COLORS.map(c => (
                <button
                  key={c}
                  className={cn('w-8 h-8 rounded-lg border-2 transition-transform active:scale-90 shadow-sm',
                    stickyColor === c ? 'border-primary scale-110' : 'border-border')}
                  style={{ backgroundColor: c }}
                  onClick={() => { setStickyColor(c); setOpenToolbarPopover(null); }}
                />
              ))}
            </div>
            <p className="text-[9px] text-muted-foreground mt-2">Tap canvas to place a sticky note</p>
          </PopoverContent>
        </Popover>

        {/* Image tool */}
        <button
          className={cn(
            'h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200',
            'text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95'
          )}
          onClick={() => imageInputRef.current?.click()}
        >
          <ImagePlus className="h-5 w-5" strokeWidth={1.8} />
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageUpload(file);
            e.target.value = '';
          }}
        />

        {/* Washi Tape tool */}
        <Popover open={openToolbarPopover === 'washi'} onOpenChange={(o) => setOpenToolbarPopover(o ? 'washi' : null)}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200',
                tool === 'washi'
                  ? 'bg-primary/15 text-primary scale-105'
                  : 'text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95'
              )}
              onClick={() => { setTool('washi' as ToolType); setEyedropperActive(false); }}
            >
              <Ribbon className="h-5 w-5" strokeWidth={tool === 'washi' ? 2.5 : 1.8} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 bg-card" align="start" side="top">
            <p className="text-[10px] font-medium text-foreground mb-2">{t('sketch.washiTapePattern')}</p>
            <div className="grid grid-cols-5 gap-1.5">
              {WASHI_PATTERNS.map(p => (
                <button
                  key={p.id}
                  className={cn(
                    'h-10 rounded-md border-2 transition-all active:scale-90 overflow-hidden',
                    washiPatternId === p.id ? 'border-primary scale-105 shadow-sm' : 'border-border/50 hover:scale-105'
                  )}
                  onClick={() => { setWashiPatternId(p.id); setTool('washi' as ToolType); setOpenToolbarPopover(null); }}
                  title={p.name}
                >
                  <canvas
                    className="w-full h-full"
                    width={40} height={40}
                    ref={(cvs) => {
                      if (!cvs) return;
                      const ctx = cvs.getContext('2d');
                      if (!ctx) return;
                      p.draw(ctx, 40, 40);
                    }}
                  />
                </button>
              ))}
            </div>
            <p className="text-[9px] text-muted-foreground mt-2">{t('sketch.washiHint')}</p>
          </PopoverContent>
        </Popover>

        {/* SVG import input */}
        <input
          ref={svgInputRef}
          type="file"
          accept=".svg,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleSvgImport(file);
            e.target.value = '';
          }}
        />
        {/* PDF import input */}
        <input
          ref={pdfInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handlePdfImport(file);
            e.target.value = '';
          }}
        />

        {/* Separator */}
        <div className="w-px h-6 bg-border/50 flex-shrink-0 mx-0.5" />

        {/* Drawing tools popover */}
        <Popover open={openToolbarPopover === 'draw'} onOpenChange={(o) => setOpenToolbarPopover(o ? 'draw' : null)}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200',
                activeDrawTool
                  ? 'bg-primary/15 text-primary scale-105 ring-2 ring-primary/20 shadow-sm'
                  : 'text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95'
              )}
            >
              {activeDrawTool ? <activeDrawTool.icon className="h-5 w-5" strokeWidth={2.5} /> : <Pen className="h-5 w-5" strokeWidth={1.8} />}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2.5 bg-card/95 backdrop-blur-md border border-border/50 shadow-xl rounded-2xl" align="start" side="top">
            <div className="grid grid-cols-2 gap-1.5" style={{ width: 280 }}>
              {DRAW_TOOLS.map((d) => (
                <button key={d.id}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200',
                    tool === d.id
                      ? 'bg-primary/15 text-primary'
                      : 'text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95'
                  )}
                  onClick={() => { setTool(d.id); setEyedropperActive(false); }}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <d.icon className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={tool === d.id ? 2.5 : 1.8} />
                    <span className="text-[10px] font-medium">{d.label}</span>
                  </div>
                  <PenPreviewCanvas penType={d.id} isActive={tool === d.id} currentColor={color} />
                </button>
              ))}
            </div>
            {/* Brush Settings Panel */}
            {DRAW_TOOLS.some(d => d.id === tool) && (
              <div className="mt-2.5 pt-2.5 border-t border-border/30 space-y-2">
                 <p className="text-[10px] font-semibold text-foreground/80 flex items-center gap-1">
                   <Brush className="h-3 w-3" />
                   {t('sketch.brushSettings')} — {DRAW_TOOLS.find(d => d.id === tool)?.label}
                </p>
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] text-muted-foreground">{t('sketch.texture')}</span>
                    <span className="text-[9px] font-mono text-muted-foreground">{Math.round(currentBrushSettings.textureIntensity * 100)}%</span>
                  </div>
                  <Slider min={0} max={100} step={5} value={[Math.round(currentBrushSettings.textureIntensity * 100)]} onValueChange={([v]) => updateBrushSetting('textureIntensity', v / 100)} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] text-muted-foreground">{t('sketch.grainSize')}</span>
                    <span className="text-[9px] font-mono text-muted-foreground">{currentBrushSettings.grainSize.toFixed(1)}x</span>
                  </div>
                  <Slider min={20} max={300} step={10} value={[Math.round(currentBrushSettings.grainSize * 100)]} onValueChange={([v]) => updateBrushSetting('grainSize', v / 100)} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] text-muted-foreground">{t('sketch.wetness')}</span>
                    <span className="text-[9px] font-mono text-muted-foreground">{Math.round(currentBrushSettings.wetness * 100)}%</span>
                  </div>
                  <Slider min={0} max={100} step={5} value={[Math.round(currentBrushSettings.wetness * 100)]} onValueChange={([v]) => updateBrushSetting('wetness', v / 100)} />
                </div>
                <button
                  className="text-[9px] text-primary hover:underline"
                  onClick={() => {
                    const defaults = DEFAULT_BRUSH_SETTINGS[tool as DrawToolType];
                    if (defaults) setBrushSettingsMap(prev => ({ ...prev, [tool]: { ...defaults } }));
                  }}
                >
                  {t('sketch.resetToDefaults')}
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Eraser */}
        <button
          className={cn(
            'h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200',
            tool === 'eraser'
              ? 'bg-primary/15 text-primary scale-105 ring-2 ring-primary/20 shadow-sm'
              : 'text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95'
          )}
          onClick={() => { setTool('eraser'); setEyedropperActive(false); }}
        >
          <Eraser className="h-5 w-5" strokeWidth={tool === 'eraser' ? 2.5 : 1.8} />
        </button>

        {/* Shape tools popover */}
        <Popover open={openToolbarPopover === 'shape'} onOpenChange={(o) => setOpenToolbarPopover(o ? 'shape' : null)}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200',
                activeShapeTool
                  ? 'bg-primary/15 text-primary scale-105 ring-2 ring-primary/20 shadow-sm'
                  : 'text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95'
              )}
            >
              {activeShapeTool
                ? <activeShapeTool.icon className={cn('h-5 w-5', activeShapeTool.id === 'line' && '-rotate-45')} strokeWidth={2.5} />
                : <Square className="h-5 w-5" strokeWidth={1.8} />}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2.5 bg-card/95 backdrop-blur-md border border-border/50 shadow-xl rounded-2xl" align="start" side="top">
            <div className="grid grid-cols-6 gap-1.5 mb-2.5" style={{ width: 270 }}>
              {SHAPE_TOOLS.map((s) => (
                <button key={s.id}
                  className={cn(
                    'h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-200',
                    tool === s.id
                      ? 'bg-primary/15 text-primary scale-105'
                      : 'text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95'
                  )}
                  onClick={() => { setTool(s.id); setEyedropperActive(false); setOpenToolbarPopover(null); }} title={s.label}
                >
                  <s.icon className={cn('h-5 w-5', s.id === 'line' && '-rotate-45')} strokeWidth={tool === s.id ? 2.5 : 1.8} />
                </button>
              ))}
            </div>
            <div className="border-t border-border pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">{t('sketch.fillColor')}</p>
                <button
                  className={cn('w-5 h-5 rounded border-2 transition-colors', fillEnabled ? 'border-primary' : 'border-border')}
                  style={{ backgroundColor: fillEnabled ? hexToRgba(fillColor, fillOpacity) : 'transparent' }}
                  onClick={() => setFillEnabled(!fillEnabled)}
                  title={fillEnabled ? t('sketch.disableFill') : t('sketch.enableFill')}
                />
              </div>
              {fillEnabled && (
                <>
                  <div className="flex gap-1 flex-wrap">
                    {['#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316','#1a1a1a','#ffffff'].map(c => (
                      <button key={c}
                        className={cn('w-5 h-5 rounded-full border-2 transition-transform active:scale-90',
                          fillColor === c ? 'border-primary scale-110' : 'border-border')}
                        style={{ backgroundColor: c }}
                        onClick={() => setFillColor(c)}
                      />
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">{t('sketch.fillOpacity')}: {Math.round(fillOpacity * 100)}%</p>
                    <Slider min={5} max={100} step={5} value={[Math.round(fillOpacity * 100)]} onValueChange={([v]) => setFillOpacity(v / 100)} />
                  </div>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Advanced color picker */}
        <Popover open={openToolbarPopover === 'color'} onOpenChange={(o) => setOpenToolbarPopover(o ? 'color' : null)}>
          <PopoverTrigger asChild>
            <button className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200 text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95 relative">
              <Palette className="h-5 w-5" strokeWidth={1.8} />
              <span className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 rounded-full border border-border shadow-sm" style={{ backgroundColor: color }} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 bg-card" align="start" side="top">
            <HslColorWheel hue={hslH} saturation={hslS} lightness={hslL}
              onHueChange={(h) => handleHslChange(h, hslS, hslL)}
              onSatLightChange={(s, l) => handleHslChange(hslH, s, l)}
            />
            <div className="flex items-center gap-2 mt-2 mb-2">
              <div className="w-8 h-8 rounded-lg border border-border flex-shrink-0" style={{ backgroundColor: color }} />
              <input type="text" value={color}
                onChange={(e) => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) applyColor(e.target.value); }}
                className="flex-1 text-xs font-mono bg-muted rounded px-2 py-1 border border-border text-foreground w-20"
                maxLength={7}
              />
              <Button variant={eyedropperActive ? 'default' : 'outline'} size="icon" className="h-8 w-8 flex-shrink-0"
                onClick={() => setEyedropperActive(!eyedropperActive)} title={t('sketch.eyedropper')}
              >
                <Pipette className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="mb-2">
              <p className="text-[10px] text-muted-foreground mb-1">{t('sketch.opacity')}: {Math.round(toolOpacity * 100)}%</p>
              <Slider min={5} max={100} step={5} value={[Math.round(toolOpacity * 100)]} onValueChange={([v]) => setToolOpacity(v / 100)} />
            </div>
            {recentColors.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">{t('sketch.recent')}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {recentColors.map((c, i) => (
                    <button key={`${c}-${i}`}
                      className={cn('w-6 h-6 rounded-full border-2 transition-transform active:scale-90',
                        color === c ? 'border-primary scale-110' : 'border-border')}
                      style={{ backgroundColor: c }} onClick={() => applyColor(c)}
                    />
                  ))}
                </div>
              </div>
            )}
            {/* Palette Manager */}
            <div className="mt-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between mb-1.5">
                 <p className="text-[10px] font-medium text-foreground">{t('sketch.palettes')}</p>
                 <Button variant="ghost" size="icon" className="h-5 w-5" onClick={addCurrentColorToPalette} title={t('sketch.addCurrentColor')}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {/* Palette tabs */}
              <div className="flex gap-1 mb-1.5 overflow-x-auto">
                {savedPalettes.map((p, idx) => (
                  <button
                    key={idx}
                    className={cn('text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap transition-colors',
                      activePaletteIdx === idx ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                    onClick={() => setActivePaletteIdx(idx)}
                    onDoubleClick={() => { if (savedPalettes.length > 1) deletePalette(idx); }}
                    title={`${p.name} (double-click to delete)`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              {/* Active palette colors */}
              {savedPalettes[activePaletteIdx] && (
                <div className="flex gap-1.5 flex-wrap">
                  {savedPalettes[activePaletteIdx].colors.map((c, i) => (
                    <button key={`pal-${c}-${i}`}
                      className={cn('w-6 h-6 rounded-full border-2 transition-transform active:scale-90 relative group',
                        color === c ? 'border-primary scale-110' : 'border-border')}
                      style={{ backgroundColor: c }}
                      onClick={() => applyColor(c)}
                      onContextMenu={(e) => { e.preventDefault(); removeColorFromPalette(c); }}
                      title={`${c} (right-click to remove)`}
                    />
                  ))}
                </div>
              )}
              {/* New palette input */}
              <div className="flex gap-1 mt-1.5">
                <input
                  type="text"
                  value={newPaletteName}
                  onChange={(e) => setNewPaletteName(e.target.value)}
                  placeholder={t('sketch.newPalette')}
                  className="flex-1 text-[10px] bg-muted rounded px-2 py-0.5 border border-border text-foreground"
                  onKeyDown={(e) => { if (e.key === 'Enter') createNewPalette(newPaletteName); }}
                />
                <Button variant="outline" size="sm" className="h-5 text-[9px] px-1.5" onClick={() => createNewPalette(newPaletteName)} disabled={!newPaletteName.trim()}>
                  <Save className="h-2.5 w-2.5" />
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Stroke width */}
        <Popover open={openToolbarPopover === 'stroke'} onOpenChange={(o) => setOpenToolbarPopover(o ? 'stroke' : null)}>
          <PopoverTrigger asChild>
            <button className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200 text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95">
              <Minus className="h-5 w-5" strokeWidth={strokeWidth > 8 ? 4 : 2} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-3 bg-card" align="center" side="top">
            <p className="text-xs text-muted-foreground mb-2">{t('common.size', 'Size')}: {strokeWidth}px</p>
            <Slider min={1} max={20} step={1} value={[strokeWidth]} onValueChange={([v]) => setStrokeWidth(v)} />
          </PopoverContent>
        </Popover>

        {/* Background selector */}
        <Popover open={openToolbarPopover === 'bg'} onOpenChange={(o) => setOpenToolbarPopover(o ? 'bg' : null)}>
          <PopoverTrigger asChild>
            <button className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200 text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95"><Grid3X3 className="h-5 w-5" strokeWidth={1.8} /></button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 bg-card" align="center" side="top">
            <p className="text-[10px] font-medium text-foreground mb-1.5 px-1">{t('sketch.background')}</p>
            <div className="grid grid-cols-4 gap-1">
              {BACKGROUNDS.map((bg) => (
                <Button key={bg.id} variant={background === bg.id ? 'default' : 'ghost'} size="sm"
                  className="h-8 text-[10px] px-2" onClick={() => { handleBackgroundChange(bg.id); setOpenToolbarPopover(null); }}>{bg.label}</Button>
              ))}
            </div>
            {background !== 'plain' && background !== 'dark' && (
              <>
                <div className="mt-2 pt-2 border-t border-border px-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-muted-foreground">{t('sketch.gridColor')}</span>
                    <input type="color" value={gridColor} onChange={(e) => setGridColor(e.target.value)}
                      className="w-6 h-6 rounded border border-border cursor-pointer" style={{ padding: 0 }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{t('sketch.opacity')}: {Math.round(gridOpacity * 100)}%</span>
                  </div>
                  <Slider min={5} max={100} step={5} value={[Math.round(gridOpacity * 100)]}
                    onValueChange={([v]) => setGridOpacity(v / 100)} className="mt-1" />
                </div>
              </>
            )}
            <div className="mt-2 pt-2 border-t border-border flex items-center justify-between px-1">
              <span className="text-[10px] text-muted-foreground">{t('sketch.snapToGrid')}</span>
              <Button variant={snapEnabled ? 'default' : 'outline'} size="sm" className="h-6 text-[10px] px-2"
                onClick={() => setSnapEnabled(!snapEnabled)}>{snapEnabled ? 'ON' : 'OFF'}</Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Layers popover */}
        <Popover open={openToolbarPopover === 'layers'} onOpenChange={(o) => setOpenToolbarPopover(o ? 'layers' : null)}>
          <PopoverTrigger asChild>
            <button className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200 text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95"><Layers className="h-5 w-5" strokeWidth={1.8} /></button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 bg-card" align="center" side="top">
            <p className="text-xs font-medium text-foreground mb-2">{t('sketch.layers')}</p>
            <div className="flex flex-col gap-2">
              {[...layers].reverse().map((layer) => (
                <div key={layer.id}
                  className={cn('flex items-center gap-2 p-1.5 rounded-lg border transition-colors cursor-pointer',
                    activeLayerId === layer.id ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted/50')}
                  onClick={() => setActiveLayerId(layer.id)}
                >
                  <button className="flex-shrink-0 p-0.5"
                    onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
                  >
                    {layer.visible ? <Eye className="h-3.5 w-3.5 text-muted-foreground" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground/50" />}
                  </button>
                  <span className={cn('text-xs flex-1 truncate', !layer.visible && 'text-muted-foreground/50')}>{layer.name}</span>
                  <span className="text-[10px] text-muted-foreground">{layer.strokes.length + (layer.textAnnotations?.length || 0) + (layer.stickyNotes?.length || 0)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-border">
               <p className="text-[10px] text-muted-foreground mb-1.5">
                 {t('sketch.opacity')}: {Math.round((layers.find(l => l.id === activeLayerId)?.opacity ?? 1) * 100)}%
              </p>
              <Slider min={0} max={100} step={5}
                value={[Math.round((layers.find(l => l.id === activeLayerId)?.opacity ?? 1) * 100)]}
                onValueChange={([v]) => setLayerOpacity(activeLayerId, v / 100)}
              />
            </div>
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground mb-1.5">{t('sketch.blendMode')}</p>
              <div className="flex flex-wrap gap-1">
                {BLEND_MODE_OPTIONS.map((bm) => (
                  <button
                    key={bm.id}
                    className={cn(
                      'px-2 py-1 rounded-md text-[10px] font-medium transition-colors',
                      (layers.find(l => l.id === activeLayerId)?.blendMode || 'normal') === bm.id
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                    onClick={() => setLayerBlendMode(activeLayerId, bm.id)}
                  >
                    {bm.label}
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Symmetry mode toggle */}
        <Popover open={openToolbarPopover === 'symmetry'} onOpenChange={(o) => setOpenToolbarPopover(o ? 'symmetry' : null)}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200',
                symmetryMode !== 'off'
                  ? 'bg-primary/15 text-primary scale-105'
                  : 'text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95'
              )}
            >
              <FlipHorizontal className="h-5 w-5" strokeWidth={symmetryMode !== 'off' ? 2.5 : 1.8} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 bg-card" align="center" side="top">
            <p className="text-[10px] font-medium text-foreground mb-1.5 px-1">{t('sketch.symmetryMode')}</p>
            <div className="flex flex-col gap-1">
              {([
                { id: 'off' as const, label: 'Off', axes: 0 },
                { id: '2' as const, label: '2 Axes', axes: 2 },
                { id: '4' as const, label: '4 Axes', axes: 4 },
                { id: '8' as const, label: '8 Axes (Mandala)', axes: 8 },
              ]).map((s) => (
                <Button
                  key={s.id}
                  variant={symmetryMode === s.id ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 text-xs justify-start gap-2 px-2"
                  onClick={() => { setSymmetryMode(s.id); setOpenToolbarPopover(null); if (s.id !== 'off') toast.success(`✨ ${t('sketch.symmetryEnabled', { mode: s.label })}` ); }}
                >
                  {s.axes > 0 ? (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16">
                      {Array.from({ length: s.axes }).map((_, i) => {
                        const angle = (Math.PI * i) / s.axes;
                        const dx = Math.cos(angle) * 7;
                        const dy = Math.sin(angle) * 7;
                        return <line key={i} x1={8 - dx} y1={8 - dy} x2={8 + dx} y2={8 + dy} stroke="currentColor" strokeWidth="1.2" />;
                      })}
                    </svg>
                  ) : <span className="w-3.5" />}
                  {s.label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={openToolbarPopover === 'ruler'} onOpenChange={(o) => setOpenToolbarPopover(o ? 'ruler' : null)}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200',
                (showRulers || showPhysicalRuler || showProtractor || showTriangle)
                  ? 'bg-primary/15 text-primary scale-105'
                  : 'text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95'
              )}
            >
              <Ruler className="h-5 w-5" strokeWidth={(showRulers || showPhysicalRuler || showProtractor || showTriangle) ? 2.5 : 1.8} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 bg-card" align="center" side="top">
            <div className="flex flex-col gap-1">
              <Button
                variant={showRulers ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 text-xs justify-start gap-2 px-2"
                onClick={() => { setShowRulers(!showRulers); setOpenToolbarPopover(null); }}
              >
                <Grid3X3 className="h-3.5 w-3.5" />
                {showRulers ? t('sketch.hidePixelRulers') : t('sketch.showPixelRulers')}
              </Button>
              <Button
                variant={showPhysicalRuler ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 text-xs justify-start gap-2 px-2"
                onClick={() => { setShowPhysicalRuler(!showPhysicalRuler); setOpenToolbarPopover(null); }}
              >
                <Ruler className="h-3.5 w-3.5" />
                {showPhysicalRuler ? t('sketch.hideStraightEdge') : `📏 ${t('sketch.straightEdge')}`}
              </Button>
              <Button
                variant={showProtractor ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 text-xs justify-start gap-2 px-2"
                onClick={() => { setShowProtractor(!showProtractor); setOpenToolbarPopover(null); }}
              >
                <span className="text-sm">📐</span>
                {showProtractor ? t('sketch.hideProtractor') : t('sketch.protractor')}
              </Button>
              <Button
                variant={showTriangle ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 text-xs justify-start gap-2 px-2"
                onClick={() => { setShowTriangle(!showTriangle); setOpenToolbarPopover(null); }}
              >
                <span className="text-sm">📐</span>
                {showTriangle ? t('sketch.hideSetSquare') : t('sketch.setSquare')}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        {/* Video Panel toggle */}
        <button
          className={cn(
            'h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200',
            showVideoPanel
              ? 'bg-destructive/15 text-destructive scale-105'
              : videoUrl
                ? 'bg-primary/15 text-primary scale-105'
                : 'text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95'
          )}
          onClick={() => setShowVideoPanel(!showVideoPanel)}
          title={t('sketch.video')}
        >
          <Video className="h-5 w-5" strokeWidth={showVideoPanel || videoUrl ? 2.5 : 1.8} />
        </button>

        {/* Audio-Sync Recording */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200',
                isAudioRecording
                  ? 'bg-destructive/20 text-destructive animate-pulse'
                  : hasAudioRecording
                    ? 'bg-primary/15 text-primary scale-105'
                    : 'text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95'
              )}
              title={t('sketch.audioSyncRecording')}
            >
              <Mic className="h-5 w-5" strokeWidth={isAudioRecording || hasAudioRecording ? 2.5 : 1.8} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 bg-card" align="center" side="top">
            <p className="text-[10px] font-medium text-foreground mb-2">🎙️ {t('sketch.audioSync')}</p>
            {isAudioRecording ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  <span className="text-xs font-mono text-destructive font-bold">
                    {Math.floor(audioRecordingTime / 60)}:{(audioRecordingTime % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                 <p className="text-[10px] text-muted-foreground">{t('sketch.drawingWhileRecording')}</p>
                 <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={stopAudioRecording}>
                   <StopSquare className="h-3.5 w-3.5 mr-1 fill-current" />{t('sketch.stopRecording')}
                 </Button>
              </div>
            ) : hasAudioRecording ? (
              <div className="flex flex-col gap-2">
                 <p className="text-[10px] text-muted-foreground">{t('sketch.audioRecordingSaved')}</p>
                 <Button variant="default" size="sm" className="h-7 text-xs" onClick={handleAudioSyncPlayback}>
                   {isAudioSyncPlaying ? <><Pause className="h-3.5 w-3.5 mr-1" />{t('sketch.stopPlayback')}</> : <><Play className="h-3.5 w-3.5 mr-1" />{t('sketch.playSynced')}</>}
                 </Button>
                 <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={discardAudioRecording}>
                   <Trash2 className="h-3.5 w-3.5 mr-1" />{t('sketch.discard')}
                 </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                 <p className="text-[10px] text-muted-foreground">{t('sketch.recordAudioHint')}</p>
                 <Button variant="default" size="sm" className="h-7 text-xs" onClick={startAudioRecording}>
                   <Mic className="h-3.5 w-3.5 mr-1" />{t('sketch.startRecording')}
                 </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        {/* Separator */}
        <div className="w-px h-6 bg-border/50 flex-shrink-0 mx-0.5" />

        <button className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200 text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95" onClick={handleUndo}>
          <Undo2 className="h-5 w-5" strokeWidth={1.8} />
        </button>
        <button className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200 text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95" onClick={handleRedo}>
          <Redo2 className="h-5 w-5" strokeWidth={1.8} />
        </button>
        <button className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200 text-destructive/70 hover:bg-destructive/10 hover:text-destructive active:scale-95" onClick={handleClear}>
          <Trash2 className="h-5 w-5" strokeWidth={1.8} />
        </button>

        {/* Export popover */}
        <Popover open={openToolbarPopover === 'export'} onOpenChange={(o) => setOpenToolbarPopover(o ? 'export' : null)}>
          <PopoverTrigger asChild>
            <button className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200 border border-border/50 text-foreground/70 hover:bg-muted/80 hover:text-foreground active:scale-95">
              <Download className="h-5 w-5" strokeWidth={1.8} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 bg-card" align="end" side="top">
            <div className="flex flex-col gap-1">
              {onImageExport && (
                <Button variant="ghost" size="sm" className="h-8 text-xs justify-start gap-2 px-2" onClick={handleExportPng}>
                  <FileImage className="h-3.5 w-3.5" />{t('sketch.insertPng')}
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-8 text-xs justify-start gap-2 px-2" onClick={handleDownloadPng}>
                <FileImage className="h-3.5 w-3.5" />{t('sketch.downloadPng')}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs justify-start gap-2 px-2" onClick={handleExportSvg}>
                <FileCode className="h-3.5 w-3.5" />{t('sketch.exportSvg')}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs justify-start gap-2 px-2" onClick={handleExportPdf}>
                <FileText className="h-3.5 w-3.5" />{pdfPages.length > 0 ? t('sketch.exportAnnotatedPdf') : t('sketch.exportPdf')}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs justify-start gap-2 px-2" onClick={handleNativeShare}>
                <Share2 className="h-3.5 w-3.5" />{t('sketch.share')}
              </Button>
              <div className="border-t border-border my-1" />
              <Button variant="ghost" size="sm" className="h-8 text-xs justify-start gap-2 px-2" onClick={() => svgInputRef.current?.click()}>
                <FileCode className="h-3.5 w-3.5" />{t('sketch.importSvg')}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs justify-start gap-2 px-2" onClick={() => pdfInputRef.current?.click()}>
                <FileUp className="h-3.5 w-3.5" />{t('sketch.importPdf')}
              </Button>
              {pdfPages.length > 0 && (
                <Button variant="ghost" size="sm" className="h-8 text-xs justify-start gap-2 px-2 text-destructive" onClick={closePdf}>
                  <Trash2 className="h-3.5 w-3.5" />{t('sketch.closePdf')}
                </Button>
              )}
              <div className="border-t border-border my-1" />
              <p className="text-[10px] font-medium text-foreground px-2 py-1">🎬 {t('sketch.timelapse')}</p>
              <Button
                variant={isTimelapseRecording ? 'destructive' : 'ghost'}
                size="sm"
                className="h-8 text-xs justify-start gap-2 px-2"
                onClick={toggleTimelapseRecording}
              >
                {isTimelapseRecording ? <><StopSquare className="h-3.5 w-3.5 fill-current" />{t('sketch.stopRecording')}</> : <><Video className="h-3.5 w-3.5" />{t('sketch.recordTimelapse')}</>}
              </Button>
              <div className="flex items-center gap-1 px-2 py-1">
                <span className="text-[10px] text-muted-foreground mr-1">{t('sketch.speed')}:</span>
                {[2, 4, 8].map((s) => (
                  <Button
                    key={s}
                    variant={timelapseSpeed === s ? 'default' : 'outline'}
                    size="sm"
                    className="h-6 w-8 text-[10px] p-0"
                    onClick={() => setTimelapseSpeed(s)}
                  >
                    {s}x
                  </Button>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="h-8 text-xs justify-start gap-2 px-2" onClick={handleTimelapseReplay}>
                {isPlayingTimelapse ? <><Pause className="h-3.5 w-3.5" />{t('sketch.stopReplay')}</> : <><Play className="h-3.5 w-3.5" />{t('sketch.previewTimelapse')}</>}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs justify-start gap-2 px-2"
                onClick={handleExportTimelapseMP4}
                disabled={isExportingTimelapse}
              >
                <Film className="h-3.5 w-3.5" />{isExportingTimelapse ? t('sketch.exporting') : t('sketch.exportMp4')}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        </div>
      </div>
    </div>
  );
});

SketchEditor.displayName = 'SketchEditor';
