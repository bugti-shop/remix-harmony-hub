import { useCallback, useRef, useState, useEffect, memo } from 'react';
import { X, RotateCw } from 'lucide-react';

interface CanvasTriangleProps {
  visible: boolean;
  onClose: () => void;
  onRulerUpdate: (edges: TriangleEdges | null) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  zoomRef: React.RefObject<number>;
  panRef: React.RefObject<{ x: number; y: number }>;
  zoomDisplay: number;
}

export interface TriangleEdges {
  hyp: { x1: number; y1: number; x2: number; y2: number };
  base: { x1: number; y1: number; x2: number; y2: number };
  vert: { x1: number; y1: number; x2: number; y2: number };
}

const TRI_BASE = 200;
const TRI_HEIGHT = 200;
const SNAP_DISTANCE = 18;

const snapToLine = (
  wx: number, wy: number,
  lx1: number, ly1: number, lx2: number, ly2: number,
  threshold: number
): { x: number; y: number; snapped: boolean } => {
  const dx = lx2 - lx1; const dy = ly2 - ly1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { x: wx, y: wy, snapped: false };
  let t = ((wx - lx1) * dx + (wy - ly1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = lx1 + t * dx; const py = ly1 + t * dy;
  const dist = Math.sqrt((wx - px) ** 2 + (wy - py) ** 2);
  if (dist < threshold) {
    // Offset outward so line stays outside the triangle body
    const len = Math.sqrt(len2);
    const offset = 3;
    // Normal pointing outward (away from triangle interior)
    const nx = -dy / len;
    const ny = dx / len;
    // Determine which side the point is on and push outward
    const side = (wx - px) * nx + (wy - py) * ny;
    const dir = side >= 0 ? 1 : -1;
    return { x: px + nx * offset * dir, y: py + ny * offset * dir, snapped: true };
  }
  return { x: wx, y: wy, snapped: false };
};

export const snapToTriangle = (
  wx: number, wy: number,
  edges: TriangleEdges | null,
  threshold: number = SNAP_DISTANCE
): { x: number; y: number; snapped: boolean } => {
  if (!edges) return { x: wx, y: wy, snapped: false };
  for (const edge of [edges.hyp, edges.base, edges.vert]) {
    const r = snapToLine(wx, wy, edge.x1, edge.y1, edge.x2, edge.y2, threshold);
    if (r.snapped) return r;
  }
  return { x: wx, y: wy, snapped: false };
};

export const CanvasTriangle = memo(({ visible, onClose, onRulerUpdate, containerRef, zoomRef, panRef, zoomDisplay }: CanvasTriangleProps) => {
  const [position, setPosition] = useState({ x: 120, y: 180 });
  const [rotation, setRotation] = useState(0);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const rotateRef = useRef<{ startAngle: number; startRotation: number; cx: number; cy: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) { onRulerUpdate(null); return; }
    const zoom = zoomRef.current;
    const pan = panRef.current;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad); const sin = Math.sin(rad);
    // Transform origin is '0% 100%' → anchor at (position.x, position.y + TRI_HEIGHT)
    const anchorX = position.x;
    const anchorY = position.y + TRI_HEIGHT;
    const toWorld = (sx: number, sy: number) => {
      // Rotate relative to transform origin
      const relX = sx;
      const relY = sy - TRI_HEIGHT;
      const rx = relX * cos - relY * sin;
      const ry = relX * sin + relY * cos;
      return { x: (anchorX + rx - pan.x) / zoom, y: (anchorY + ry - pan.y) / zoom };
    };
    const bl = toWorld(0, TRI_HEIGHT);
    const br = toWorld(TRI_BASE, TRI_HEIGHT);
    const tl = toWorld(0, 0);
    onRulerUpdate({
      hyp: { x1: tl.x, y1: tl.y, x2: br.x, y2: br.y },
      base: { x1: bl.x, y1: bl.y, x2: br.x, y2: br.y },
      vert: { x1: tl.x, y1: tl.y, x2: bl.x, y2: bl.y },
    });
  }, [visible, position, rotation, zoomDisplay, onRulerUpdate]);

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: position.x, startPosY: position.y };
  }, [position]);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (dragRef.current) {
      setPosition({
        x: dragRef.current.startPosX + e.clientX - dragRef.current.startX,
        y: dragRef.current.startPosY + e.clientY - dragRef.current.startY,
      });
    }
    if (rotateRef.current) {
      const angle = Math.atan2(e.clientY - rotateRef.current.cy, e.clientX - rotateRef.current.cx) * (180 / Math.PI);
      let newRot = rotateRef.current.startRotation + (angle - rotateRef.current.startAngle);
      const snaps = [0, 45, 90, 135, 180, -45, -90, -135, -180];
      for (const s of snaps) { if (Math.abs(newRot - s) < 3) { newRot = s; break; } }
      setRotation(newRot);
    }
  }, []);

  const handleDragEnd = useCallback(() => { dragRef.current = null; rotateRef.current = null; }, []);

  const handleRotateStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2; const cy = rect.top + rect.height / 2;
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
    rotateRef.current = { startAngle, startRotation: rotation, cx, cy };
  }, [rotation]);

  if (!visible) return null;

  const baseTicks: JSX.Element[] = [];
  for (let i = 0; i <= Math.floor(TRI_BASE / 3.78); i++) {
    const x = i * 3.78;
    if (x > TRI_BASE - 2) break;
    const isCm = i % 10 === 0; const isHalf = i % 5 === 0;
    const h = isCm ? 14 : isHalf ? 9 : 4;
    baseTicks.push(
      <line key={`b${i}`} x1={x} y1={TRI_HEIGHT} x2={x} y2={TRI_HEIGHT - h}
        stroke="rgba(60,55,45,0.5)" strokeWidth={isCm ? 0.8 : 0.4} />
    );
    if (isCm && i > 0) {
      baseTicks.push(
        <text key={`bl${i}`} x={x} y={TRI_HEIGHT - 16} textAnchor="middle"
          fontSize="7" fill="rgba(60,55,45,0.6)" fontFamily="system-ui">{i / 10}</text>
      );
    }
  }

  const vertTicks: JSX.Element[] = [];
  for (let i = 0; i <= Math.floor(TRI_HEIGHT / 3.78); i++) {
    const y = TRI_HEIGHT - i * 3.78;
    if (y < 2) break;
    const isCm = i % 10 === 0; const isHalf = i % 5 === 0;
    const h = isCm ? 14 : isHalf ? 9 : 4;
    vertTicks.push(
      <line key={`v${i}`} x1={0} y1={y} x2={h} y2={y}
        stroke="rgba(60,55,45,0.5)" strokeWidth={isCm ? 0.8 : 0.4} />
    );
    if (isCm && i > 0) {
      vertTicks.push(
        <text key={`vl${i}`} x={16} y={y + 3} textAnchor="start"
          fontSize="7" fill="rgba(60,55,45,0.6)" fontFamily="system-ui">{i / 10}</text>
      );
    }
  }

  return (
    <div
      ref={ref}
      className="absolute z-30 select-none"
      style={{
        left: position.x, top: position.y,
        width: TRI_BASE, height: TRI_HEIGHT,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: '0% 100%',
        cursor: 'grab', touchAction: 'none',
      }}
      onPointerDown={handleDragStart}
      onPointerMove={handleDragMove}
      onPointerUp={handleDragEnd}
      onPointerCancel={handleDragEnd}
    >
      <svg width={TRI_BASE} height={TRI_HEIGHT} className="absolute inset-0">
        <polygon
          points={`0,0 0,${TRI_HEIGHT} ${TRI_BASE},${TRI_HEIGHT}`}
          fill="rgba(255,255,255,0.35)" stroke="rgba(180,175,160,0.45)" strokeWidth="1"
          style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.12))' }}
        />
        <polygon
          points={`6,12 6,${TRI_HEIGHT - 6} ${TRI_BASE - 12},${TRI_HEIGHT - 6}`}
          fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1"
        />
        <rect x="1" y={TRI_HEIGHT - 15} width="14" height="14"
          fill="none" stroke="rgba(60,55,45,0.4)" strokeWidth="0.7" />
        <line x1="2" y1={TRI_HEIGHT} x2={TRI_BASE - 2} y2={TRI_HEIGHT}
          stroke="rgba(59,130,246,0.5)" strokeWidth="1.5" />
        <line x1="0" y1="4" x2="0" y2={TRI_HEIGHT - 2}
          stroke="rgba(59,130,246,0.4)" strokeWidth="1" />
        <line x1="2" y1="2" x2={TRI_BASE - 2} y2={TRI_HEIGHT - 2}
          stroke="rgba(59,130,246,0.35)" strokeWidth="1" />
        <text x="24" y={TRI_HEIGHT - 8} fontSize="8" fill="rgba(60,55,45,0.6)" fontFamily="system-ui">90°</text>
        <text x={TRI_BASE - 30} y={TRI_HEIGHT - 8} fontSize="8" fill="rgba(60,55,45,0.6)" fontFamily="system-ui">45°</text>
        <text x="8" y="18" fontSize="8" fill="rgba(60,55,45,0.6)" fontFamily="system-ui">45°</text>
        <text x={TRI_BASE / 2} y={TRI_HEIGHT - 20} textAnchor="middle"
          fontSize="6" fill="rgba(60,55,45,0.4)" fontFamily="system-ui">cm</text>
        {baseTicks}
        {vertTicks}
      </svg>

      <div
        className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing"
        style={{ right: '-20px', background: 'rgba(59,130,246,0.8)', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}
        onPointerDown={handleRotateStart}
      >
        <RotateCw className="h-3 w-3 text-white" strokeWidth={2.5} />
      </div>

      <div
        className="absolute -top-3 w-4 h-4 rounded-full flex items-center justify-center cursor-pointer"
        style={{ right: '-8px', background: 'rgba(239,68,68,0.85)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
        onPointerDown={(e) => { e.stopPropagation(); onClose(); }}
      >
        <X className="h-2.5 w-2.5 text-white" strokeWidth={3} />
      </div>
    </div>
  );
});

CanvasTriangle.displayName = 'CanvasTriangle';
