import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, Pencil, Square, Circle as CircleIcon, ArrowUpRight, Undo2, Trash2, Check, Loader2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

type Tool = 'pen' | 'rect' | 'circle' | 'arrow';

interface Stroke {
  tool: Tool;
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

interface Props {
  imageFile: File;
  onCancel: () => void;
  onConfirm: (file: File) => void | Promise<void>;
}

const COLORS = ['#FF3B30', '#FFCC00', '#34C759', '#0A84FF', '#FFFFFF', '#000000'];

export default function ScreenshotAnnotator({ imageFile, onCancel, onConfirm }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number }>({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const zoomRef = useRef(zoom);
  const panStateRef = useRef(pan);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panStateRef.current = pan; }, [pan]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !size.w || !size.h) return;

    const measure = () => {
      const rect = container.getBoundingClientRect();
      const maxW = Math.max(rect.width - 16, 0);
      const maxH = Math.max(rect.height - 16, 0);
      if (!maxW || !maxH) return;
      const ratio = Math.min(maxW / size.w, maxH / size.h, 1);
      setDisplaySize({
        w: Math.round(size.w * ratio),
        h: Math.round(size.h * ratio),
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [size.w, size.h]);

  // Attach a non-passive wheel listener so preventDefault works and zoom is reliable.
  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const handler = (e: WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inside) return;

      e.preventDefault();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const z = zoomRef.current;
      const newZoom = Math.max(1, Math.min(8, z * factor));
      if (newZoom === z) return;
      const ratio = newZoom / z;
      const p = panStateRef.current;
      setPan({ x: cx - (cx - p.x) * ratio, y: cy - (cy - p.y) * ratio });
      setZoom(newZoom);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [displaySize.w, displaySize.h]);

  useEffect(() => {
    const url = URL.createObjectURL(imageFile);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    const c = canvasRef.current; const img = imgRef.current;
    if (!c || !img || !size.w) return;
    c.width = size.w; c.height = size.h;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const all = current ? [...strokes, current] : strokes;
    for (const s of all) drawStroke(ctx, s);
  }, [strokes, current, size]);

  function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pts = s.points;
    if (pts.length < 1) return;
    if (s.tool === 'pen') {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    } else if (s.tool === 'rect' && pts.length >= 2) {
      const a = pts[0], b = pts[pts.length - 1];
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    } else if (s.tool === 'circle' && pts.length >= 2) {
      const a = pts[0], b = pts[pts.length - 1];
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (s.tool === 'arrow' && pts.length >= 2) {
      const a = pts[0], b = pts[pts.length - 1];
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const head = Math.max(12, s.width * 4);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - head * Math.cos(ang - Math.PI / 6), b.y - head * Math.sin(ang - Math.PI / 6));
      ctx.lineTo(b.x - head * Math.cos(ang + Math.PI / 6), b.y - head * Math.sin(ang + Math.PI / 6));
      ctx.closePath(); ctx.fill();
    }
  }

  function getPos(e: React.PointerEvent): { x: number; y: number } {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * c.width,
      y: ((e.clientY - rect.top) / rect.height) * c.height,
    };
  }

  const onDown = (e: React.PointerEvent) => {
    if (e.button === 1 || e.button === 2 || (e.pointerType === 'touch' && e.isPrimary === false)) {
      panRef.current = { active: true, startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y };
      (e.target as Element).setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = getPos(e);
    setCurrent({ tool, color, width: Math.max(3, Math.round(size.w / 400)), points: [p] });
  };
  const onMove = (e: React.PointerEvent) => {
    if (panRef.current.active) {
      setPan({ x: panRef.current.origX + (e.clientX - panRef.current.startX), y: panRef.current.origY + (e.clientY - panRef.current.startY) });
      return;
    }
    if (!current) return;
    const p = getPos(e);
    if (tool === 'pen') setCurrent({ ...current, points: [...current.points, p] });
    else setCurrent({ ...current, points: [current.points[0], p] });
  };
  const onUp = () => {
    if (panRef.current.active) { panRef.current.active = false; return; }
    if (current) { setStrokes(prev => [...prev, current]); setCurrent(null); }
  };

  const resetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const zoomIn = () => {
    const nz = Math.min(8, zoom * 1.25);
    setPan(prev => ({ x: prev.x * (nz / zoom), y: prev.y * (nz / zoom) }));
    setZoom(nz);
  };
  const zoomOut = () => {
    const nz = Math.max(1, zoom / 1.25);
    setPan(prev => ({ x: prev.x * (nz / zoom), y: prev.y * (nz / zoom) }));
    setZoom(nz);
  };

  const undo = () => setStrokes(prev => prev.slice(0, -1));
  const clear = () => setStrokes([]);

  const confirm = async () => {
    const c = canvasRef.current; if (!c) return;
    setSaving(true);
    try {
      const blob: Blob = await new Promise((res, rej) =>
        c.toBlob(b => (b ? res(b) : rej(new Error('blob'))), 'image/png', 0.92)!,
      );
      const baseName = imageFile.name.replace(/\.[^.]+$/, '') || 'captura';
      const file = new File([blob], `${baseName}-anotada.png`, { type: 'image/png' });
      await onConfirm(file);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10">
        <button onClick={onCancel} className="p-2 text-white/80 hover:text-white" aria-label="Cancelar"><X className="w-5 h-5" /></button>
        <div className="text-sm text-white/80">Anotar imagen</div>
        <button onClick={confirm} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Enviar
        </button>
      </div>
      <div
        ref={containerRef}
        className="flex-1 min-h-0 flex items-center justify-center overflow-hidden p-2 relative"
        onContextMenu={(e) => e.preventDefault()}
      >
        {size.w > 0 ? (
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className="touch-none bg-white shadow-2xl"
            style={{
              width: displaySize.w || undefined,
              height: displaySize.h || undefined,
              aspectRatio: `${size.w} / ${size.h}`,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              cursor: zoom > 1 ? 'grab' : 'crosshair',
            }}
          />
        ) : (
          <Loader2 className="w-6 h-6 text-white/60 animate-spin" />
        )}
        {zoom > 1 && (
          <div className="absolute top-2 right-2 text-[10px] text-white/70 bg-black/40 px-2 py-1 rounded">{Math.round(zoom * 100)}%</div>
        )}
      </div>
      <div className="border-t border-white/10 p-2 flex items-center justify-center gap-2 flex-wrap">
        <div className="flex gap-1">
          <ToolBtn active={tool==='pen'} onClick={() => setTool('pen')} title="Lápiz"><Pencil className="w-4 h-4" /></ToolBtn>
          <ToolBtn active={tool==='rect'} onClick={() => setTool('rect')} title="Rectángulo"><Square className="w-4 h-4" /></ToolBtn>
          <ToolBtn active={tool==='circle'} onClick={() => setTool('circle')} title="Círculo"><CircleIcon className="w-4 h-4" /></ToolBtn>
          <ToolBtn active={tool==='arrow'} onClick={() => setTool('arrow')} title="Flecha"><ArrowUpRight className="w-4 h-4" /></ToolBtn>
        </div>
        <div className="flex gap-1 px-2 border-l border-white/10">
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} aria-label={c}
              className={`w-6 h-6 rounded-full border ${color===c ? 'ring-2 ring-white' : 'border-white/20'}`}
              style={{ background: c }} />
          ))}
        </div>
        <div className="flex gap-1 pl-2 border-l border-white/10">
          <ToolBtn onClick={zoomOut} title="Alejar"><ZoomOut className="w-4 h-4" /></ToolBtn>
          <ToolBtn onClick={zoomIn} title="Acercar"><ZoomIn className="w-4 h-4" /></ToolBtn>
          <ToolBtn onClick={resetZoom} title="Ajustar"><Maximize2 className="w-4 h-4" /></ToolBtn>
        </div>
        <div className="flex gap-1 pl-2 border-l border-white/10">
          <ToolBtn onClick={undo} title="Deshacer"><Undo2 className="w-4 h-4" /></ToolBtn>
          <ToolBtn onClick={clear} title="Limpiar"><Trash2 className="w-4 h-4" /></ToolBtn>
        </div>
      </div>
    </div>
  );
}

function ToolBtn({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={`h-9 w-9 flex items-center justify-center rounded-md border transition-colors ${
        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
      }`}>
      {children}
    </button>
  );
}