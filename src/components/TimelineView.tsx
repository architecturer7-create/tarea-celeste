import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/UserAvatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Partida {
  id: string;
  nombre: string;
  color: string;
  orden: number;
}

interface TimelineRow {
  id: string;
  partida_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  responsable_id: string | null;
}

interface MiembroPerfil {
  user_id: string;
  nombre: string;
  color_avatar: string;
  avatar_url: string | null;
}

type Zoom = 'dia' | 'semana' | 'mes';
const ZOOM_PX: Record<Zoom, number> = { dia: 32, semana: 12, mes: 4 };

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

export default function TimelineView({ proyectoId }: { proyectoId: string }) {
  const { user } = useAuth();
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [miembros, setMiembros] = useState<MiembroPerfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState<Zoom>('dia');
  const [editingId, setEditingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchAll = useCallback(async () => {
    const [pa, ti, mb] = await Promise.all([
      supabase.from('partidas_planos').select('id, nombre, color, orden').eq('proyecto_id', proyectoId).order('orden'),
      supabase.from('timeline_partidas').select('id, partida_id, fecha_inicio, fecha_fin, responsable_id').eq('proyecto_id', proyectoId),
      supabase.from('miembros_proyecto').select('usuario_id').eq('proyecto_id', proyectoId),
    ]);
    const partidasData = (pa.data || []) as Partida[];
    const rowsData = (ti.data || []) as TimelineRow[];
    setPartidas(partidasData);

    // Auto-create missing rows for existing partidas
    const existingIds = new Set(rowsData.map(r => r.partida_id));
    const missing = partidasData.filter(p => !existingIds.has(p.id));
    if (missing.length > 0 && user) {
      const today = new Date(); today.setUTCHours(0, 0, 0, 0);
      const inserts = missing.map(p => ({
        proyecto_id: proyectoId,
        partida_id: p.id,
        fecha_inicio: toISODate(today),
        fecha_fin: toISODate(addDays(today, 7)),
        responsable_id: null,
        creado_por: user.id,
      }));
      const { data: inserted } = await supabase.from('timeline_partidas').insert(inserts).select('id, partida_id, fecha_inicio, fecha_fin, responsable_id');
      setRows([...rowsData, ...((inserted || []) as TimelineRow[])]);
    } else {
      setRows(rowsData);
    }

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
  }, [proyectoId, user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime: refresh when partidas o timeline cambian
  useEffect(() => {
    const ch = supabase.channel(`timeline-${proyectoId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timeline_partidas', filter: `proyecto_id=eq.${proyectoId}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partidas_planos', filter: `proyecto_id=eq.${proyectoId}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [proyectoId, fetchAll]);

  // Build display items joining partidas with rows
  const items = useMemo(() => {
    const rowMap = new Map(rows.map(r => [r.partida_id, r]));
    return partidas
      .map(p => {
        const r = rowMap.get(p.id);
        if (!r) return null;
        return {
          rowId: r.id,
          partidaId: p.id,
          nombre: p.nombre,
          partidaColor: p.color,
          fecha_inicio: r.fecha_inicio,
          fecha_fin: r.fecha_fin,
          responsable_id: r.responsable_id,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [partidas, rows]);

  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
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

  const todayOffset = useMemo(() => {
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    return diffDays(rangeStart, today) * dayPx;
  }, [rangeStart, dayPx]);

  const weekStartOffset = useMemo(() => {
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    // Lunes de la semana actual (getUTCDay: 0=Dom..6=Sab)
    const dow = today.getUTCDay();
    const diffToMonday = (dow === 0 ? -6 : 1 - dow);
    const monday = addDays(today, diffToMonday);
    return diffDays(rangeStart, monday) * dayPx;
  }, [rangeStart, dayPx]);

  const scrollToCurrentWeek = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, weekStartOffset - 40);
    }
  }, [weekStartOffset]);

  useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, weekStartOffset - 40);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, zoom]);

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
    rowId: string;
    mode: 'move' | 'resize-l' | 'resize-r';
    startX: number;
    origStart: Date;
    origEnd: Date;
  } | null>(null);

  const onMouseDownBar = (e: React.MouseEvent, item: { rowId: string; fecha_inicio: string; fecha_fin: string }, mode: 'move' | 'resize-l' | 'resize-r') => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      rowId: item.rowId,
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
    setRows(prev => prev.map(r => {
      if (r.id !== drag.rowId) return r;
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
      return { ...r, fecha_inicio: toISODate(s), fecha_fin: toISODate(en) };
    }));
  }, [dayPx]);

  const onMouseUp = useCallback(async () => {
    const drag = dragRef.current;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (!drag) return;
    const row = rows.find(r => r.id === drag.rowId);
    dragRef.current = null;
    if (!row) return;
    if (row.fecha_inicio === toISODate(drag.origStart) && row.fecha_fin === toISODate(drag.origEnd)) return;
    const { error } = await supabase
      .from('timeline_partidas')
      .update({ fecha_inicio: row.fecha_inicio, fecha_fin: row.fecha_fin })
      .eq('id', drag.rowId);
    if (error) toast.error('No se pudo actualizar');
  }, [rows]);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const updateResponsable = async (rowId: string, userId: string | null) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, responsable_id: userId } : r));
    const { error } = await supabase.from('timeline_partidas').update({ responsable_id: userId }).eq('id', rowId);
    if (error) toast.error('Error al asignar responsable');
  };

  const scrollByDays = (n: number) => {
    if (scrollRef.current) scrollRef.current.scrollLeft += n * dayPx;
  };
  const goToToday = () => {
    scrollToCurrentWeek();
  };

  // --- Pan con click izquierdo sobre el fondo ---
  const panRef = useRef<{ startX: number; startScroll: number } | null>(null);
  const onPanStart = (e: React.MouseEvent) => {
    // Solo botón izquierdo y solo si no estamos sobre una barra (las barras paran propagación con stopPropagation en mousedown)
    if (e.button !== 0) return;
    if (!scrollRef.current) return;
    panRef.current = { startX: e.clientX, startScroll: scrollRef.current.scrollLeft };
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  };
  const onPanMove = useCallback((e: MouseEvent) => {
    const pan = panRef.current;
    if (!pan || !scrollRef.current) return;
    scrollRef.current.scrollLeft = pan.startScroll - (e.clientX - pan.startX);
  }, []);
  const onPanEnd = useCallback(() => {
    if (!panRef.current) return;
    panRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);
  useEffect(() => {
    window.addEventListener('mousemove', onPanMove);
    window.addEventListener('mouseup', onPanEnd);
    return () => {
      window.removeEventListener('mousemove', onPanMove);
      window.removeEventListener('mouseup', onPanEnd);
    };
  }, [onPanMove, onPanEnd]);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const ROW_H = 36;
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
            {items.length === 0 && (
              <div className="p-6 text-center text-muted-foreground text-xs">
                No hay partidas. Crea partidas en la pestaña Sheets para verlas aquí.
              </div>
            )}
            {items.map(item => {
              const responsable = miembros.find(m => m.user_id === item.responsable_id);
              return (
                <div
                  key={item.rowId}
                  className="px-3 flex items-center gap-2 hover:bg-muted/30 group"
                  style={{ height: ROW_H }}
                >
                  <div className="w-1.5 h-5 rounded-sm shrink-0" style={{ background: item.partidaColor }} />
                  <span className="text-xs text-foreground truncate flex-1">{item.nombre}</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="shrink-0">
                        {responsable ? (
                          <UserAvatar nombre={responsable.nombre} color={responsable.color_avatar} avatarUrl={responsable.avatar_url} size="sm" />
                        ) : (
                          <div className="w-6 h-6 rounded-full border border-dashed border-border hover:border-foreground/40 transition-colors" />
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-1 bg-popover border border-border" align="end">
                      <button
                        onClick={() => updateResponsable(item.rowId, null)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-muted-foreground hover:bg-muted"
                      >
                        <div className="w-6 h-6 rounded-full border border-dashed border-border" />
                        Sin asignar
                      </button>
                      {miembros.map(m => (
                        <button
                          key={m.user_id}
                          onClick={() => updateResponsable(item.rowId, m.user_id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-foreground hover:bg-muted"
                        >
                          <UserAvatar nombre={m.nombre} color={m.color_avatar} avatarUrl={m.avatar_url} size="sm" />
                          {m.nombre}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                </div>
              );
            })}
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
          onMouseDown={onPanStart}
          style={{ cursor: 'ew-resize' }}
        >
          <div style={{ width: totalWidth, position: 'relative' }}>
            {/* Header */}
            <div className="sticky top-0 z-20 bg-background border-b border-border" style={{ height: 52 }}>
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

            {/* Grid + bars */}
            <div className="relative">
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

              {todayOffset >= 0 && todayOffset <= totalWidth && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-primary/70 pointer-events-none z-10"
                  style={{ left: todayOffset }}
                >
                  <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-primary" />
                </div>
              )}

              {items.map(item => {
                const start = toDate(item.fecha_inicio);
                const end = toDate(item.fecha_fin);
                const offset = diffDays(rangeStart, start) * dayPx;
                const width = Math.max(dayPx, (diffDays(start, end) + 1) * dayPx);
                const responsable = miembros.find(m => m.user_id === item.responsable_id);
                const barColor = responsable?.color_avatar || item.partidaColor;
                return (
                  <div key={item.rowId} className="relative" style={{ height: ROW_H }}>
                    <div
                      className="absolute top-1/2 -translate-y-1/2 rounded-md flex items-center px-2 group select-none"
                      style={{
                        left: offset,
                        width,
                        height: 22,
                        background: `linear-gradient(90deg, ${barColor}EE, ${barColor}99)`,
                        boxShadow: `0 0 0 1px ${barColor}40, 0 2px 8px ${barColor}30`,
                        cursor: 'grab',
                      }}
                      onMouseDown={(e) => onMouseDownBar(e, item, 'move')}
                      title={`${item.nombre} · ${item.fecha_inicio} → ${item.fecha_fin}`}
                    >
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-foreground/20 rounded-l-md"
                        onMouseDown={(e) => onMouseDownBar(e, item, 'resize-l')}
                      />
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
          </div>
        </div>
      </div>
    </div>
  );
}