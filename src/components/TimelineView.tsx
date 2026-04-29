import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Trash2, ZoomIn, ZoomOut, Pencil, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { UserAvatar } from '@/components/UserAvatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface TimelinePartida {
  id: string;
  proyecto_id: string;
  nombre: string;
  seccion: string;
  fecha_inicio: string;
  fecha_fin: string;
  responsable_id: string | null;
  color: string;
  orden: number;
}

interface MiembroPerfil {
  user_id: string;
  nombre: string;
  color_avatar: string;
  avatar_url: string | null;
}

type Zoom = 'dia' | 'semana' | 'mes';

const ZOOM_PX: Record<Zoom, number> = {
  dia: 32,
  semana: 12,
  mes: 4,
};

// --- date helpers (UTC, day-precision) ---
const DAY_MS = 24 * 60 * 60 * 1000;
const toDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const toISODate = (d: Date) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
};
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
const diffDays = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY_MS);
const startOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

const MES_ABR = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

const SECCIONES_DEFAULT = ['Anteproyecto', 'Proyecto Ejecutivo', 'Planos Constructivos', 'Coordinación', 'Ingenierías', 'General'];

export default function TimelineView({ proyectoId }: { proyectoId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<TimelinePartida[]>([]);
  const [miembros, setMiembros] = useState<MiembroPerfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState<Zoom>('dia');
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<TimelinePartida | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // form state
  const [fNombre, setFNombre] = useState('');
  const [fSeccion, setFSeccion] = useState('General');
  const [fSeccionCustom, setFSeccionCustom] = useState('');
  const [fInicio, setFInicio] = useState(toISODate(new Date()));
  const [fFin, setFFin] = useState(toISODate(addDays(new Date(), 7)));
  const [fResp, setFResp] = useState<string | null>(null);

  const fetchData = async () => {
    const [it, mb] = await Promise.all([
      supabase.from('timeline_partidas').select('*').eq('proyecto_id', proyectoId).order('orden'),
      supabase.from('miembros_proyecto').select('usuario_id').eq('proyecto_id', proyectoId),
    ]);
    if (it.data) setItems(it.data as TimelinePartida[]);
    if (mb.data && mb.data.length > 0) {
      const ids = mb.data.map((m: any) => m.usuario_id);
      const { data: pf } = await supabase
        .from('perfiles')
        .select('user_id, nombre, color_avatar, avatar_url')
        .in('user_id', ids);
      if (pf) setMiembros(pf as MiembroPerfil[]);
    } else {
      setMiembros([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [proyectoId]);

  useEffect(() => {
    const ch = supabase.channel(`timeline-${proyectoId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timeline_partidas', filter: `proyecto_id=eq.${proyectoId}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [proyectoId]);

  // Compute timeline range: from earliest start - 14 days to latest end + 30 days, with sane defaults
  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    let min = addDays(today, -7);
    let max = addDays(today, 60);
    items.forEach(i => {
      const s = toDate(i.fecha_inicio);
      const e = toDate(i.fecha_fin);
      if (s < min) min = s;
      if (e > max) max = e;
    });
    min = addDays(startOfMonth(min), -2);
    max = addDays(max, 14);
    return { rangeStart: min, rangeEnd: max, totalDays: diffDays(min, max) + 1 };
  }, [items]);

  const dayPx = ZOOM_PX[zoom];
  const totalWidth = totalDays * dayPx;

  // Group by seccion preserving order of first appearance, plus default order
  const grouped = useMemo(() => {
    const map = new Map<string, TimelinePartida[]>();
    items.forEach(i => {
      const sec = i.seccion || 'General';
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(i);
    });
    return Array.from(map.entries());
  }, [items]);

  // Today line position
  const todayOffset = useMemo(() => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return diffDays(rangeStart, today) * dayPx;
  }, [rangeStart, dayPx]);

  // Auto-scroll to today on mount
  useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, todayOffset - 200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, zoom]);

  // Header rows: months and days
  const headerRows = useMemo(() => {
    const months: { label: string; offset: number; width: number }[] = [];
    const days: { label: string; offset: number; isWeekend: boolean; isToday: boolean; isFirst: boolean }[] = [];
    const today = toISODate(new Date());
    let cursor = new Date(rangeStart);
    let monthStartIdx = 0;
    let monthLabel = `${MES_ABR[cursor.getUTCMonth()]} ${String(cursor.getUTCFullYear()).slice(-2)}`;
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(rangeStart, i);
      const dow = d.getUTCDay();
      const iso = toISODate(d);
      days.push({
        label: String(d.getUTCDate()),
        offset: i * dayPx,
        isWeekend: dow === 0 || dow === 6,
        isToday: iso === today,
        isFirst: d.getUTCDate() === 1,
      });
      if (d.getUTCDate() === 1 && i > 0) {
        months.push({ label: monthLabel, offset: monthStartIdx * dayPx, width: (i - monthStartIdx) * dayPx });
        monthStartIdx = i;
        monthLabel = `${MES_ABR[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}`;
      }
    }
    months.push({ label: monthLabel, offset: monthStartIdx * dayPx, width: (totalDays - monthStartIdx) * dayPx });
    return { months, days };
  }, [rangeStart, totalDays, dayPx]);

  // --- Drag/Resize ---
  const dragRef = useRef<{
    id: string;
    mode: 'move' | 'resize-l' | 'resize-r';
    startX: number;
    origStart: Date;
    origEnd: Date;
  } | null>(null);

  const onMouseDownBar = (e: React.MouseEvent, item: TimelinePartida, mode: 'move' | 'resize-l' | 'resize-r') => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      id: item.id,
      mode,
      startX: e.clientX,
      origStart: toDate(item.fecha_inicio),
      origEnd: toDate(item.fecha_fin),
    };
    document.body.style.cursor = mode === 'move' ? 'grabbing' : 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const deltaPx = e.clientX - drag.startX;
    const deltaDays = Math.round(deltaPx / dayPx);
    setItems(prev => prev.map(it => {
      if (it.id !== drag.id) return it;
      let s = drag.origStart, en = drag.origEnd;
      if (drag.mode === 'move') {
        s = addDays(drag.origStart, deltaDays);
        en = addDays(drag.origEnd, deltaDays);
      } else if (drag.mode === 'resize-l') {
        s = addDays(drag.origStart, deltaDays);
        if (s >= en) s = addDays(en, -1);
      } else {
        en = addDays(drag.origEnd, deltaDays);
        if (en <= s) en = addDays(s, 1);
      }
      return { ...it, fecha_inicio: toISODate(s), fecha_fin: toISODate(en) };
    }));
  }, [dayPx]);

  const onMouseUp = useCallback(async () => {
    const drag = dragRef.current;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (!drag) return;
    const item = items.find(i => i.id === drag.id);
    dragRef.current = null;
    if (!item) return;
    if (item.fecha_inicio === toISODate(drag.origStart) && item.fecha_fin === toISODate(drag.origEnd)) return;
    const { error } = await supabase
      .from('timeline_partidas')
      .update({ fecha_inicio: item.fecha_inicio, fecha_fin: item.fecha_fin })
      .eq('id', drag.id);
    if (error) toast.error('No se pudo actualizar');
  }, [items]);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // --- CRUD ---
  const resetForm = () => {
    setFNombre('');
    setFSeccion('General');
    setFSeccionCustom('');
    const t = new Date(); t.setUTCHours(0, 0, 0, 0);
    setFInicio(toISODate(t));
    setFFin(toISODate(addDays(t, 7)));
    setFResp(null);
  };

  const openCreate = () => {
    resetForm();
    setEditing(null);
    setShowNew(true);
  };

  const openEdit = (item: TimelinePartida) => {
    setEditing(item);
    setFNombre(item.nombre);
    if (SECCIONES_DEFAULT.includes(item.seccion)) {
      setFSeccion(item.seccion);
      setFSeccionCustom('');
    } else {
      setFSeccion('__custom__');
      setFSeccionCustom(item.seccion);
    }
    setFInicio(item.fecha_inicio);
    setFFin(item.fecha_fin);
    setFResp(item.responsable_id);
    setShowNew(true);
  };

  const handleSave = async () => {
    if (!fNombre.trim() || !user) return;
    const seccionFinal = fSeccion === '__custom__' ? (fSeccionCustom.trim() || 'General') : fSeccion;
    const responsable = miembros.find(m => m.user_id === fResp);
    const color = responsable?.color_avatar || '#6366F1';
    if (editing) {
      const { error } = await supabase
        .from('timeline_partidas')
        .update({
          nombre: fNombre.trim(),
          seccion: seccionFinal,
          fecha_inicio: fInicio,
          fecha_fin: fFin,
          responsable_id: fResp,
          color,
        })
        .eq('id', editing.id);
      if (error) { toast.error('Error al guardar'); return; }
      toast.success('Partida actualizada');
    } else {
      const maxOrden = items.reduce((m, i) => Math.max(m, i.orden), -1);
      const { error } = await supabase
        .from('timeline_partidas')
        .insert({
          proyecto_id: proyectoId,
          nombre: fNombre.trim(),
          seccion: seccionFinal,
          fecha_inicio: fInicio,
          fecha_fin: fFin,
          responsable_id: fResp,
          color,
          orden: maxOrden + 1,
          creado_por: user.id,
        });
      if (error) { toast.error('Error al crear'); return; }
      toast.success('Partida creada');
    }
    setShowNew(false);
    setEditing(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('timeline_partidas').delete().eq('id', id);
    if (error) { toast.error('Error al eliminar'); return; }
    toast.success('Partida eliminada');
    fetchData();
  };

  const scrollByDays = (n: number) => {
    if (scrollRef.current) scrollRef.current.scrollLeft += n * dayPx;
  };

  const goToToday = () => {
    if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, todayOffset - 200);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const ROW_H = 36;
  const SECTION_H = 28;
  const SIDE_W = 240;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1.5">
          <button onClick={() => scrollByDays(-14)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft className="w-3.5 h-3.5" /></button>
          <button onClick={goToToday} className="px-2.5 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Hoy</button>
          <button onClick={() => scrollByDays(14)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><ChevronRight className="w-3.5 h-3.5" /></button>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            {(['dia', 'semana', 'mes'] as Zoom[]).map(z => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                  zoom === z ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {z === 'dia' ? 'Día' : z === 'semana' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3 h-3" /> Partida
          </button>
        </div>
      </div>

      {/* Gantt body */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left side panel */}
        <div className="shrink-0 border-r border-border bg-background" style={{ width: SIDE_W }}>
          <div className="h-[52px] border-b border-border flex items-end px-3 pb-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Partida</span>
          </div>
          <div className="overflow-y-auto" style={{ height: 'calc(100% - 52px)' }} id="timeline-side-scroll">
            {grouped.length === 0 && (
              <div className="p-6 text-center text-muted-foreground text-xs">
                Sin partidas. Crea la primera con el botón "+ Partida".
              </div>
            )}
            {grouped.map(([seccion, list]) => (
              <div key={seccion}>
                <div
                  className="px-3 flex items-center text-[10px] font-medium text-muted-foreground/80 uppercase tracking-widest"
                  style={{ height: SECTION_H }}
                >
                  {seccion}
                </div>
                {list.map(item => {
                  const responsable = miembros.find(m => m.user_id === item.responsable_id);
                  return (
                    <ContextMenu key={item.id}>
                      <ContextMenuTrigger asChild>
                        <div
                          className="px-3 flex items-center gap-2 hover:bg-muted/30 cursor-pointer group"
                          style={{ height: ROW_H }}
                          onClick={() => openEdit(item)}
                        >
                          {responsable ? (
                            <UserAvatar nombre={responsable.nombre} color={responsable.color_avatar} avatarUrl={responsable.avatar_url} size="sm" />
                          ) : (
                            <div className="w-6 h-6 rounded-full border border-dashed border-border" />
                          )}
                          <span className="text-xs text-foreground truncate flex-1">{item.nombre}</span>
                          <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => openEdit(item)}>
                          <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleDelete(item.id)} className="text-destructive focus:text-destructive">
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Eliminar
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Right scrollable timeline */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto relative"
          onScroll={(e) => {
            const side = document.getElementById('timeline-side-scroll');
            if (side) side.scrollTop = (e.target as HTMLDivElement).scrollTop;
          }}
        >
          <div style={{ width: totalWidth, position: 'relative' }}>
            {/* Header */}
            <div className="sticky top-0 z-20 bg-background border-b border-border" style={{ height: 52 }}>
              {/* Months row */}
              <div className="relative" style={{ height: 24 }}>
                {headerRows.months.map((m, i) => (
                  <div
                    key={i}
                    className="absolute top-0 flex items-center justify-center text-[10px] font-semibold text-muted-foreground uppercase tracking-widest border-r border-border/50"
                    style={{ left: m.offset, width: m.width, height: 24 }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
              {/* Days row */}
              <div className="relative" style={{ height: 28 }}>
                {headerRows.days.map((d, i) => (
                  <div
                    key={i}
                    className={`absolute top-0 flex items-center justify-center text-[10px] ${
                      d.isToday ? 'text-foreground font-bold' : d.isWeekend ? 'text-muted-foreground/40' : 'text-muted-foreground/70'
                    }`}
                    style={{ left: d.offset, width: dayPx, height: 28 }}
                  >
                    {dayPx >= 20 ? d.label : (d.isFirst ? d.label : '')}
                  </div>
                ))}
              </div>
            </div>

            {/* Grid background + bars */}
            <div className="relative">
              {/* vertical day lines */}
              <div className="absolute inset-0 pointer-events-none">
                {headerRows.days.map((d, i) => (
                  <div
                    key={i}
                    className={`absolute top-0 bottom-0 ${
                      d.isFirst ? 'border-l border-border/50' : d.isWeekend ? 'bg-muted/20' : ''
                    }`}
                    style={{ left: d.offset, width: dayPx }}
                  />
                ))}
              </div>

              {/* Today line */}
              {todayOffset >= 0 && todayOffset <= totalWidth && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-primary/70 pointer-events-none z-10"
                  style={{ left: todayOffset }}
                >
                  <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-primary" />
                </div>
              )}

              {/* Rows */}
              {grouped.map(([seccion, list]) => (
                <div key={seccion}>
                  <div className="relative bg-muted/10" style={{ height: SECTION_H }} />
                  {list.map(item => {
                    const start = toDate(item.fecha_inicio);
                    const end = toDate(item.fecha_fin);
                    const offset = diffDays(rangeStart, start) * dayPx;
                    const width = Math.max(dayPx, (diffDays(start, end) + 1) * dayPx);
                    return (
                      <div key={item.id} className="relative" style={{ height: ROW_H }}>
                        <div
                          className="absolute top-1/2 -translate-y-1/2 rounded-md flex items-center px-2 group select-none"
                          style={{
                            left: offset,
                            width,
                            height: 22,
                            background: `linear-gradient(90deg, ${item.color}EE, ${item.color}99)`,
                            boxShadow: `0 0 0 1px ${item.color}40, 0 2px 8px ${item.color}30`,
                            cursor: 'grab',
                          }}
                          onMouseDown={(e) => onMouseDownBar(e, item, 'move')}
                          onDoubleClick={() => openEdit(item)}
                          title={`${item.nombre} · ${item.fecha_inicio} → ${item.fecha_fin}`}
                        >
                          {/* Left handle */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-foreground/20 rounded-l-md"
                            onMouseDown={(e) => onMouseDownBar(e, item, 'resize-l')}
                          />
                          {/* Right handle */}
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-foreground/20 rounded-r-md"
                            onMouseDown={(e) => onMouseDownBar(e, item, 'resize-r')}
                          />
                          <div className="w-1.5 h-1.5 rounded-full bg-white/90 shrink-0 mr-1.5" />
                          <span className="text-[11px] font-medium text-white truncate pointer-events-none">
                            {item.nombre}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Create / Edit modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setShowNew(false)}>
          <div className="glass-panel rounded-lg p-5 w-full max-w-md animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium text-foreground">{editing ? 'Editar partida' : 'Nueva partida'}</h3>
              <button onClick={() => setShowNew(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Nombre</label>
                <input
                  value={fNombre}
                  onChange={e => setFNombre(e.target.value)}
                  autoFocus
                  className="mt-1 w-full h-9 px-3 rounded-md bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Planos Carpintería"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Sección</label>
                <select
                  value={fSeccion}
                  onChange={e => setFSeccion(e.target.value)}
                  className="mt-1 w-full h-9 px-3 rounded-md bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {SECCIONES_DEFAULT.map(s => <option key={s} value={s}>{s}</option>)}
                  <option value="__custom__">+ Otra…</option>
                </select>
                {fSeccion === '__custom__' && (
                  <input
                    value={fSeccionCustom}
                    onChange={e => setFSeccionCustom(e.target.value)}
                    className="mt-2 w-full h-9 px-3 rounded-md bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Nombre de la sección"
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Inicio</label>
                  <input
                    type="date"
                    value={fInicio}
                    onChange={e => setFInicio(e.target.value)}
                    className="mt-1 w-full h-9 px-3 rounded-md bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Fin</label>
                  <input
                    type="date"
                    value={fFin}
                    onChange={e => setFFin(e.target.value)}
                    className="mt-1 w-full h-9 px-3 rounded-md bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Responsable</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="mt-1 w-full h-9 px-3 rounded-md bg-muted border border-border text-sm text-foreground flex items-center gap-2 hover:bg-muted/70 transition-colors">
                      {(() => {
                        const r = miembros.find(m => m.user_id === fResp);
                        return r ? (
                          <>
                            <UserAvatar nombre={r.nombre} color={r.color_avatar} avatarUrl={r.avatar_url} size="sm" />
                            <span>{r.nombre}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Sin asignar</span>
                        );
                      })()}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-1 bg-popover border border-border" align="start">
                    <button
                      onClick={() => setFResp(null)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-muted-foreground hover:bg-muted"
                    >
                      <div className="w-6 h-6 rounded-full border border-dashed border-border" />
                      Sin asignar
                    </button>
                    {miembros.map(m => (
                      <button
                        key={m.user_id}
                        onClick={() => setFResp(m.user_id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-foreground hover:bg-muted"
                      >
                        <UserAvatar nombre={m.nombre} color={m.color_avatar} avatarUrl={m.avatar_url} size="sm" />
                        {m.nombre}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                {editing && (
                  <button onClick={() => { handleDelete(editing.id); setShowNew(false); }} className="h-9 px-3 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors mr-auto">
                    Eliminar
                  </button>
                )}
                <button onClick={() => setShowNew(false)} className="h-9 px-4 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
                <button onClick={handleSave} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                  {editing ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}