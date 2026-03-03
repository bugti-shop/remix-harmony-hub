import { useCallback, useRef, useState, useEffect, memo, useMemo } from 'react';
import { X, RotateCw } from 'lucide-react';

interface StrokePoint { x: number; y: number; }
interface StrokeData { points: StrokePoint[]; }

interface CanvasProtractorProps {
  visible: boolean;
  onClose: () => void;
  onRulerUpdate: (ruler: ProtractorLine | null) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  zoomRef: React.RefObject<number>;
  panRef: React.RefObject<{ x: number; y: number }>;
  zoomDisplay: number;
  /** Current strokes for angle measurement */
  strokes?: StrokeData[];
}

export interface ProtractorLine {
  x1: number; y1: number;
  x2: number; y2: number;
  nx: number; ny: number;
  /** Center point in world coords */
  cx: number; cy: number;
}

const PROTRACTOR_RADIUS = 120;
const PROTRACTOR_DIAMETER = PROTRACTOR_RADIUS * 2;
const SNAP_DISTANCE = 18;
const ANGLE_DETECT_RADIUS = 40; // world units – how close a stroke endpoint must be to center

export const snapToProtractor = (
  wx: number, wy: number,
  ruler: ProtractorLine | null,
  threshold: number = SNAP_DISTANCE
): { x: number; y: number; snapped: boolean } => {
  if (!ruler) return { x: wx, y: wy, snapped: false };
  const dx = ruler.x2 - ruler.x1;
  const dy = ruler.y2 - ruler.y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { x: wx, y: wy, snapped: false };
  let t = ((wx - ruler.x1) * dx + (wy - ruler.y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const projX = ruler.x1 + t * dx;
  const projY = ruler.y1 + t * dy;
  const dist = Math.sqrt((wx - projX) ** 2 + (wy - projY) ** 2);
  if (dist < threshold) {
    // Offset outward (away from protractor body = downward along normal)
    const offset = 3;
    const outX = projX + ruler.nx * offset;
    const outY = projY + ruler.ny * offset;
    return { x: outX, y: outY, snapped: true };
  }
  return { x: wx, y: wy, snapped: false };
};

/** Compute angle between two direction vectors in degrees (0-180) */
const angleBetween = (ax: number, ay: number, bx: number, by: number): number => {
  const dot = ax * bx + ay * by;
  const magA = Math.sqrt(ax * ax + ay * ay);
  const magB = Math.sqrt(bx * bx + by * by);
  if (magA === 0 || magB === 0) return 0;
  const cosA = Math.max(-1, Math.min(1, dot / (magA * magB)));
  return Math.acos(cosA) * (180 / Math.PI);
};

/** Get the direction vector of a stroke (from near-center end to far end) */
const getStrokeDirection = (stroke: StrokeData, cx: number, cy: number): { dx: number; dy: number } | null => {
  if (stroke.points.length < 2) return null;
  const first = stroke.points[0];
  const last = stroke.points[stroke.points.length - 1];
  const dFirst = Math.sqrt((first.x - cx) ** 2 + (first.y - cy) ** 2);
  const dLast = Math.sqrt((last.x - cx) ** 2 + (last.y - cy) ** 2);
  // The closer end is the "origin", direction points away
  if (dFirst <= dLast) {
    return { dx: last.x - first.x, dy: last.y - first.y };
  }
  return { dx: first.x - last.x, dy: first.y - last.y };
};

export const CanvasProtractor = memo(({ visible, onClose, onRulerUpdate, containerRef, zoomRef, panRef, zoomDisplay, strokes }: CanvasProtractorProps) => {
  const [position, setPosition] = useState({ x: 80, y: 260 });
  const [rotation, setRotation] = useState(0);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const rotateRef = useRef<{ startAngle: number; startRotation: number; cx: number; cy: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [worldCenter, setWorldCenter] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!visible) { onRulerUpdate(null); setWorldCenter(null); return; }
    const zoom = zoomRef.current;
    const pan = panRef.current;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    // Transform origin is '50% 100%' → anchor at (position.x + PROTRACTOR_RADIUS, position.y + PROTRACTOR_RADIUS + 4)
    const anchorX = position.x + PROTRACTOR_RADIUS;
    const anchorY = position.y + PROTRACTOR_RADIUS + 4;
    
    // Flat edge left: local (0, PROTRACTOR_RADIUS), relative to anchor: (-PROTRACTOR_RADIUS, -4)
    const lRelX = -PROTRACTOR_RADIUS, lRelY = -4;
    const bx = anchorX + lRelX * cos - lRelY * sin;
    const by = anchorY + lRelX * sin + lRelY * cos;
    // Flat edge right: local (PROTRACTOR_DIAMETER, PROTRACTOR_RADIUS), relative to anchor: (PROTRACTOR_RADIUS, -4)
    const rRelX = PROTRACTOR_RADIUS, rRelY = -4;
    const ex = anchorX + rRelX * cos - rRelY * sin;
    const ey = anchorY + rRelX * sin + rRelY * cos;
    
    const x1 = (bx - pan.x) / zoom;
    const y1 = (by - pan.y) / zoom;
    const x2 = (ex - pan.x) / zoom;
    const y2 = (ey - pan.y) / zoom;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    setWorldCenter({ x: cx, y: cy });
    const ldx = x2 - x1; const ldy = y2 - y1;
    const len = Math.sqrt(ldx * ldx + ldy * ldy);
    const nx = len > 0 ? -ldy / len : 0;
    const ny = len > 0 ? ldx / len : 0;
    onRulerUpdate({ x1, y1, x2, y2, nx, ny, cx, cy });
  }, [visible, position, rotation, zoomDisplay, onRulerUpdate]);

  // Compute angle + arc data from strokes near center
  const angleData = useMemo<{ angle: number; startDeg: number; endDeg: number } | null>(() => {
    if (!worldCenter || !strokes || strokes.length < 2) return null;
    const radius = ANGLE_DETECT_RADIUS / (zoomRef.current || 1);
    const nearStrokes: StrokeData[] = [];
    for (let i = strokes.length - 1; i >= 0 && nearStrokes.length < 2; i--) {
      const s = strokes[i];
      if (s.points.length < 2) continue;
      const first = s.points[0];
      const last = s.points[s.points.length - 1];
      const dFirst = Math.sqrt((first.x - worldCenter.x) ** 2 + (first.y - worldCenter.y) ** 2);
      const dLast = Math.sqrt((last.x - worldCenter.x) ** 2 + (last.y - worldCenter.y) ** 2);
      if (dFirst < radius || dLast < radius) {
        nearStrokes.push(s);
      }
    }
    if (nearStrokes.length < 2) return null;
    const dir1 = getStrokeDirection(nearStrokes[0], worldCenter.x, worldCenter.y);
    const dir2 = getStrokeDirection(nearStrokes[1], worldCenter.x, worldCenter.y);
    if (!dir1 || !dir2) return null;
    const angle = angleBetween(dir1.dx, dir1.dy, dir2.dx, dir2.dy);
    
    // Compute individual angles in protractor space (0°=left, 180°=right, measured CCW from right in math coords)
    // atan2 gives angle from +X axis, but protractor 0° is at left (π), so convert
    let a1 = Math.atan2(-dir1.dy, -dir1.dx) * (180 / Math.PI); // flip to measure from left
    let a2 = Math.atan2(-dir2.dy, -dir2.dx) * (180 / Math.PI);
    // Normalize to 0-360
    if (a1 < 0) a1 += 360;
    if (a2 < 0) a2 += 360;
    // Clamp to protractor range 0-180, pick the pair in upper semicircle
    // Use the raw atan2 angles relative to positive X axis for SVG arc drawing
    let deg1 = Math.atan2(-dir1.dy, dir1.dx) * (180 / Math.PI);
    let deg2 = Math.atan2(-dir2.dy, dir2.dx) * (180 / Math.PI);
    // Clamp to 0-180 range (protractor semicircle)
    deg1 = Math.max(0, Math.min(180, deg1));
    deg2 = Math.max(0, Math.min(180, deg2));
    // Ensure startDeg < endDeg
    const startDeg = Math.min(deg1, deg2);
    const endDeg = Math.max(deg1, deg2);
    
    return { angle: Math.round(angle * 10) / 10, startDeg, endDeg };
  }, [worldCenter, strokes, zoomDisplay]);

  const measuredAngle = angleData?.angle ?? null;

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

  // Generate degree tick marks for the semicircle
  const ticks: JSX.Element[] = [];
  for (let deg = 0; deg <= 180; deg++) {
    const rad = (deg * Math.PI) / 180;
    const is10 = deg % 10 === 0;
    const is5 = deg % 5 === 0;
    const outerR = PROTRACTOR_RADIUS - 2;
    const innerR = is10 ? PROTRACTOR_RADIUS - 20 : is5 ? PROTRACTOR_RADIUS - 14 : PROTRACTOR_RADIUS - 8;
    const cx = PROTRACTOR_RADIUS;
    const cy = PROTRACTOR_RADIUS;
    const x1 = cx + innerR * Math.cos(Math.PI - rad);
    const y1 = cy - innerR * Math.sin(Math.PI - rad);
    const x2 = cx + outerR * Math.cos(Math.PI - rad);
    const y2 = cy - outerR * Math.sin(Math.PI - rad);
    ticks.push(
      <line key={`t${deg}`} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="rgba(60,55,45,0.5)" strokeWidth={is10 ? 0.8 : 0.4} />
    );
    if (is10) {
      const labelR = PROTRACTOR_RADIUS - 26;
      const lx = cx + labelR * Math.cos(Math.PI - rad);
      const ly = cy - labelR * Math.sin(Math.PI - rad);
      ticks.push(
        <text key={`l${deg}`} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
          fontSize="7" fill="rgba(60,55,45,0.7)" fontFamily="system-ui">
          {deg}
        </text>
      );
    }
  }

  return (
    <div
      ref={ref}
      className="absolute z-30 select-none"
      style={{
        left: position.x, top: position.y,
        width: PROTRACTOR_DIAMETER, height: PROTRACTOR_RADIUS + 4,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: '50% 100%',
        cursor: 'grab', touchAction: 'none',
      }}
      onPointerDown={handleDragStart}
      onPointerMove={handleDragMove}
      onPointerUp={handleDragEnd}
      onPointerCancel={handleDragEnd}
    >
      <svg width={PROTRACTOR_DIAMETER} height={PROTRACTOR_RADIUS + 4} className="absolute inset-0">
        <path
          d={`M 0 ${PROTRACTOR_RADIUS} A ${PROTRACTOR_RADIUS} ${PROTRACTOR_RADIUS} 0 0 1 ${PROTRACTOR_DIAMETER} ${PROTRACTOR_RADIUS} L 0 ${PROTRACTOR_RADIUS} Z`}
          fill="rgba(255,255,255,0.35)" stroke="rgba(180,175,160,0.4)" strokeWidth="1"
          style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.12))' }}
        />
        <path
          d={`M ${PROTRACTOR_RADIUS - 40} ${PROTRACTOR_RADIUS} A 40 40 0 0 1 ${PROTRACTOR_RADIUS + 40} ${PROTRACTOR_RADIUS} L ${PROTRACTOR_RADIUS - 40} ${PROTRACTOR_RADIUS} Z`}
          fill="rgba(255,255,255,0.15)" stroke="rgba(180,175,160,0.25)" strokeWidth="0.5"
        />
        <path
          d={`M 4 ${PROTRACTOR_RADIUS} A ${PROTRACTOR_RADIUS - 4} ${PROTRACTOR_RADIUS - 4} 0 0 1 ${PROTRACTOR_DIAMETER - 4} ${PROTRACTOR_RADIUS}`}
          fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2"
        />
        <circle cx={PROTRACTOR_RADIUS} cy={PROTRACTOR_RADIUS} r="2.5" fill="rgba(59,130,246,0.7)" />
        <line x1={PROTRACTOR_RADIUS - 6} y1={PROTRACTOR_RADIUS} x2={PROTRACTOR_RADIUS + 6} y2={PROTRACTOR_RADIUS}
          stroke="rgba(59,130,246,0.5)" strokeWidth="0.7" />
        <line x1={PROTRACTOR_RADIUS} y1={PROTRACTOR_RADIUS - 6} x2={PROTRACTOR_RADIUS} y2={PROTRACTOR_RADIUS + 2}
          stroke="rgba(59,130,246,0.5)" strokeWidth="0.7" />
        <line x1="6" y1={PROTRACTOR_RADIUS} x2={PROTRACTOR_DIAMETER - 6} y2={PROTRACTOR_RADIUS}
          stroke="rgba(59,130,246,0.5)" strokeWidth="1.5" />
        {ticks}
        {/* Colored angle arc */}
        {angleData && (() => {
          const cx = PROTRACTOR_RADIUS;
          const cy = PROTRACTOR_RADIUS;
          const arcR = 50; // radius of the colored arc
          const { startDeg, endDeg, angle } = angleData;
          // Convert protractor degrees to SVG coordinates
          // Protractor 0° is at left (π), 180° at right (0)
          const startRad = (Math.PI - startDeg * Math.PI / 180);
          const endRad = (Math.PI - endDeg * Math.PI / 180);
          const x1 = cx + arcR * Math.cos(endRad);
          const y1 = cy - arcR * Math.sin(endRad);
          const x2 = cx + arcR * Math.cos(startRad);
          const y2 = cy - arcR * Math.sin(startRad);
          const largeArc = (endDeg - startDeg) > 180 ? 1 : 0;
          // Color based on angle: green for acute, orange for right, red for obtuse
          const color = angle <= 89 ? 'rgba(34,197,94,0.6)' : angle <= 91 ? 'rgba(59,130,246,0.7)' : 'rgba(249,115,22,0.6)';
          const fillColor = angle <= 89 ? 'rgba(34,197,94,0.12)' : angle <= 91 ? 'rgba(59,130,246,0.15)' : 'rgba(249,115,22,0.12)';
          return (
            <>
              {/* Filled wedge */}
              <path
                d={`M ${cx} ${cy} L ${x1} ${y1} A ${arcR} ${arcR} 0 ${largeArc} 0 ${x2} ${y2} Z`}
                fill={fillColor}
              />
              {/* Arc stroke */}
              <path
                d={`M ${x1} ${y1} A ${arcR} ${arcR} 0 ${largeArc} 0 ${x2} ${y2}`}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Direction lines from center to arc endpoints */}
              <line x1={cx} y1={cy} x2={x1} y2={y1} stroke={color} strokeWidth="1" strokeDasharray="3 2" />
              <line x1={cx} y1={cy} x2={x2} y2={y2} stroke={color} strokeWidth="1" strokeDasharray="3 2" />
            </>
          );
        })()}
      </svg>

      {/* Angle measurement display */}
      {measuredAngle !== null && (
        <div
          className="absolute flex items-center justify-center pointer-events-none"
          style={{
            left: PROTRACTOR_RADIUS - 28,
            top: PROTRACTOR_RADIUS - 44,
            width: 56,
            height: 24,
          }}
        >
          <div
            className="rounded-md px-2 py-0.5 text-center font-mono font-bold"
            style={{
              fontSize: '11px',
              background: 'rgba(59,130,246,0.85)',
              color: 'white',
              boxShadow: '0 2px 8px rgba(59,130,246,0.4)',
              letterSpacing: '0.5px',
            }}
          >
            {measuredAngle}°
          </div>
        </div>
      )}

      {/* Rotate handle */}
      <div
        className="absolute -right-5 top-1/2 w-5 h-5 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing"
        style={{ background: 'rgba(59,130,246,0.8)', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}
        onPointerDown={handleRotateStart}
      >
        <RotateCw className="h-3 w-3 text-white" strokeWidth={2.5} />
      </div>

      {/* Close button */}
      <div
        className="absolute -right-1 -top-3 w-4 h-4 rounded-full flex items-center justify-center cursor-pointer"
        style={{ background: 'rgba(239,68,68,0.85)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
        onPointerDown={(e) => { e.stopPropagation(); onClose(); }}
      >
        <X className="h-2.5 w-2.5 text-white" strokeWidth={3} />
      </div>
    </div>
  );
});

CanvasProtractor.displayName = 'CanvasProtractor';
