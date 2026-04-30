import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Trash2, Check, ChevronRight, FolderPlus, X, GripVertical, Pencil, UserCircle2, Copy, FolderInput, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { PROJECT_COLORS } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Partida {
  id: string;
  proyecto_id: string;
  nombre: string;
  color: string;
  orden: number;
}

interface Plano {
  id: string;
  proyecto_id: string;
  partida_id: string;
  codigo: string;
  nombre: string;
  entregado: boolean;
  responsable_id?: string | null;
}

interface MiembroPerfil {
  user_id: string;
  nombre: string;
  color_avatar: string;
  avatar_url: string | null;
}

export default function SheetsView({ proyectoId }: { proyectoId: string }) {
  const { user } = useAuth();
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [miembros, setMiembros] = useState<MiembroPerfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPartida, setShowNewPartida] = useState(false);
  const [newPartidaNombre, setNewPartidaNombre] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newCodigo, setNewCodigo] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newResponsable, setNewResponsable] = useState<string | null>(null);
  const [editingPlano, setEditingPlano] = useState<string | null>(null);
  const [editCodigo, setEditCodigo] = useState('');
  const [editNombre, setEditNombre] = useState('');
  const [editResponsable, setEditResponsable] = useState<string | null>(null);
  const [dragPartida, setDragPartida] = useState<string | null>(null);
  const [dragOverPartida, setDragOverPartida] = useState<string | null>(null);
  const [selectedPlanos, setSelectedPlanos] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    const [pa, pl, mb] = await Promise.all([
      supabase.from('partidas_planos').select('*').eq('proyecto_id', proyectoId).order('orden'),
      supabase.from('planos').select('*').eq('proyecto_id', proyectoId).order('fecha_creacion'),
      supabase.from('miembros_proyecto').select('usuario_id').eq('proyecto_id', proyectoId),
    ]);
    if (pa.data) setPartidas(pa.data as Partida[]);
    if (pl.data) setPlanos(pl.data as Plano[]);
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
    const ch = supabase.channel(`sheets-${proyectoId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partidas_planos', filter: `proyecto_id=eq.${proyectoId}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planos', filter: `proyecto_id=eq.${proyectoId}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [proyectoId]);

  const stats = useMemo(() => {
    const total = planos.length;
    const done = planos.filter(p => p.entregado).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, pct, pending: total - done };
  }, [planos]);

  const planosByPartida = useMemo(() => {
    const map = new Map<string, Plano[]>();
    planos.forEach(p => {
      if (!map.has(p.partida_id)) map.set(p.partida_id, []);
      map.get(p.partida_id)!.push(p);
    });
    return map;
  }, [planos]);

  const createPartida = async () => {
    if (!newPartidaNombre.trim() || !user) return;
    const color = PROJECT_COLORS[partidas.length % PROJECT_COLORS.length];
    const { error } = await supabase.from('partidas_planos').insert({
      proyecto_id: proyectoId,
      nombre: newPartidaNombre.trim(),
      color,
      orden: partidas.length,
      creado_por: user.id,
    });
    if (error) toast.error('Error al crear partida');
    else {
      setNewPartidaNombre('');
      setShowNewPartida(false);
      fetchData();
    }
  };

  const deletePartida = async (id: string) => {
    const { error } = await supabase.from('partidas_planos').delete().eq('id', id);
    if (error) toast.error('Error al eliminar partida');
    else { toast.success('Partida eliminada'); fetchData(); }
  };

  const addPlano = async (partidaId: string) => {
    if (!newNombre.trim() || !user) return;
    const { error } = await supabase.from('planos').insert({
      proyecto_id: proyectoId,
      partida_id: partidaId,
      codigo: newCodigo.trim(),
      nombre: newNombre.trim(),
      responsable_id: newResponsable,
      creado_por: user.id,
    });
    if (error) toast.error('Error al añadir plano');
    else {
      setNewCodigo(''); setNewNombre(''); setNewResponsable(null); setAddingTo(null);
      fetchData();
    }
  };

  const togglePlano = async (p: Plano) => {
    const next = !p.entregado;
    await supabase.from('planos').update({
      entregado: next,
      fecha_entrega: next ? new Date().toISOString() : null,
    }).eq('id', p.id);
    fetchData();
  };

  const deletePlano = async (id: string) => {
    await supabase.from('planos').delete().eq('id', id);
    toast.success('Plano eliminado');
    fetchData();
  };

  const duplicatePlano = async (p: Plano) => {
    if (!user) return;
    const { data, error } = await supabase.from('planos').insert({
      proyecto_id: p.proyecto_id,
      partida_id: p.partida_id,
      codigo: p.codigo ? `${p.codigo}-copia` : '',
      nombre: `${p.nombre} (copia)`,
      responsable_id: p.responsable_id ?? null,
      creado_por: user.id,
    }).select().single();
    if (error || !data) { toast.error('Error al duplicar'); return; }
    toast.success('Plano duplicado');
    await fetchData();
    // open inline edit on the new copy
    setEditingPlano((data as Plano).id);
    setEditCodigo((data as Plano).codigo || '');
    setEditNombre((data as Plano).nombre);
    setEditResponsable((data as Plano).responsable_id ?? null);
  };

  const movePlanoToPartida = async (planoId: string, partidaId: string) => {
    const { error } = await supabase.from('planos').update({ partida_id: partidaId }).eq('id', planoId);
    if (error) toast.error('Error al mover');
    else { toast.success('Plano movido'); fetchData(); }
  };

  const togglePlanoSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPlanos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedPlanos(new Set());

  const bulkAssignResponsable = async (responsableId: string | null) => {
    if (selectedPlanos.size === 0) return;
    const ids = Array.from(selectedPlanos);
    const { error } = await supabase.from('planos').update({ responsable_id: responsableId }).in('id', ids);
    if (error) toast.error('Error al asignar');
    else {
      toast.success(`${ids.length} plano(s) actualizado(s)`);
      clearSelection();
      fetchData();
    }
  };

  const bulkMoveToPartida = async (partidaId: string) => {
    if (selectedPlanos.size === 0) return;
    const ids = Array.from(selectedPlanos);
    const { error } = await supabase.from('planos').update({ partida_id: partidaId }).in('id', ids);
    if (error) toast.error('Error al mover');
    else {
      toast.success(`${ids.length} plano(s) movido(s)`);
      clearSelection();
      fetchData();
    }
  };

  const bulkDelete = async () => {
    if (selectedPlanos.size === 0) return;
    const ids = Array.from(selectedPlanos);
    const { error } = await supabase.from('planos').delete().in('id', ids);
    if (error) toast.error('Error al eliminar');
    else {
      toast.success(`${ids.length} plano(s) eliminado(s)`);
      clearSelection();
      fetchData();
    }
  };

  const startEditPlano = (p: Plano) => {
    setEditingPlano(p.id);
    setEditCodigo(p.codigo || '');
    setEditNombre(p.nombre);
    setEditResponsable(p.responsable_id ?? null);
  };

  const saveEditPlano = async (id: string) => {
    if (!editNombre.trim()) return;
    await supabase.from('planos').update({
      codigo: editCodigo.trim(),
      nombre: editNombre.trim(),
      responsable_id: editResponsable,
    }).eq('id', id);
    setEditingPlano(null);
    fetchData();
  };

  const reorderPartidas = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const ordered = [...partidas];
    const fromIdx = ordered.findIndex(p => p.id === sourceId);
    const toIdx = ordered.findIndex(p => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, moved);
    setPartidas(ordered);
    await Promise.all(ordered.map((p, i) =>
      supabase.from('partidas_planos').update({ orden: i }).eq('id', p.id)
    ));
    fetchData();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="h-full overflow-y-auto p-3 md:p-4 space-y-4">
      {/* Bulk actions bar */}
      {selectedPlanos.size > 0 && (
        <div className="sticky top-0 z-20 flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/40 bg-primary/10 backdrop-blur">
          <span className="text-xs font-medium text-foreground">
            {selectedPlanos.size} seleccionado(s)
          </span>
          <div className="flex-1" />
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-background border border-border hover:bg-muted transition-colors">
                <Users className="w-3 h-3" /> Asignar responsable
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1 bg-popover border-border" align="end">
              <button
                onClick={() => bulkAssignResponsable(null)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors text-muted-foreground"
              >
                <div className="w-6 h-6 rounded-full border border-dashed border-border flex items-center justify-center">
                  <X className="w-3 h-3" />
                </div>
                Sin asignar
              </button>
              {miembros.map(m => (
                <button
                  key={m.user_id}
                  onClick={() => bulkAssignResponsable(m.user_id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors text-muted-foreground"
                >
                  <UserAvatar nombre={m.nombre} color={m.color_avatar} avatarUrl={m.avatar_url} size="sm" />
                  <span className="truncate">{m.nombre}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-background border border-border hover:bg-muted transition-colors">
                <FolderInput className="w-3 h-3" /> Mover a partida
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1 bg-popover border-border" align="end">
              {partidas.map(pa => (
                <button
                  key={pa.id}
                  onClick={() => bulkMoveToPartida(pa.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors text-muted-foreground"
                >
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: pa.color }} />
                  <span className="truncate">{pa.nombre}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <button
            onClick={bulkDelete}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-background border border-border text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Eliminar
          </button>
          <button
            onClick={clearSelection}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Progreso general */}
      <div className="rounded-lg border border-border bg-card/40 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-foreground">Avance general</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {stats.done} de {stats.total} planos entregados · {stats.pending} pendientes
            </p>
          </div>
          <div className="text-2xl font-semibold text-foreground tabular-nums">{stats.pct}%</div>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-status-completed transition-all duration-500"
            style={{ width: `${stats.pct}%` }}
          />
        </div>
        {/* Barras por partida */}
        {partidas.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2">
            {partidas.map(pa => {
              const list = planosByPartida.get(pa.id) || [];
              const done = list.filter(p => p.entregado).length;
              const pct = list.length === 0 ? 0 : Math.round((done / list.length) * 100);
              return (
                <div key={pa.id} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: pa.color }} />
                      <span className="text-muted-foreground truncate">{pa.nombre}</span>
                    </div>
                    <span className="text-muted-foreground tabular-nums">{done}/{list.length}</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(to right, ${pa.color}, ${pa.color}66)`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Partidas */}
      <div className="space-y-3">
        {partidas.length === 0 && !showNewPartida && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm mb-3">No hay partidas todavía</p>
            <button
              onClick={() => setShowNewPartida(true)}
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors flex items-center gap-1.5"
            >
              <FolderPlus className="w-3.5 h-3.5" /> Crear partida
            </button>
          </div>
        )}

        {partidas.map(pa => {
          const list = planosByPartida.get(pa.id) || [];
          const isCollapsed = collapsed[pa.id];
          const done = list.filter(p => p.entregado).length;
          const paPct = list.length === 0 ? 0 : Math.round((done / list.length) * 100);
          return (
            <div
              key={pa.id}
              draggable
              onDragStart={() => setDragPartida(pa.id)}
              onDragOver={(e) => { e.preventDefault(); setDragOverPartida(pa.id); }}
              onDragLeave={() => setDragOverPartida(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (dragPartida) reorderPartidas(dragPartida, pa.id);
                setDragPartida(null);
                setDragOverPartida(null);
              }}
              onDragEnd={() => { setDragPartida(null); setDragOverPartida(null); }}
              className={`rounded-lg border border-border overflow-hidden transition-all ${
                dragOverPartida === pa.id && dragPartida !== pa.id ? 'border-primary/60 ring-1 ring-primary/30' : ''
              } ${dragPartida === pa.id ? 'opacity-50' : ''}`}
            >
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div className="relative bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div
                      className="absolute inset-y-0 left-0 pointer-events-none transition-all duration-500"
                      style={{
                        width: `${paPct}%`,
                        background: `linear-gradient(to right, ${pa.color}55, ${pa.color}10)`,
                      }}
                    />
                    <button
                      onClick={() => setCollapsed(c => ({ ...c, [pa.id]: !c[pa.id] }))}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left relative z-10"
                    >
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 cursor-grab active:cursor-grabbing shrink-0" />
                      <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${!isCollapsed ? 'rotate-90' : ''}`} />
                      <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: pa.color }} />
                      <span className="text-xs md:text-sm font-medium text-foreground flex-1">{pa.nombre}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{done}/{list.length}</span>
                    </button>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => deletePartida(pa.id)} className="text-destructive focus:text-destructive focus:bg-muted">
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Eliminar partida
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>

              {!isCollapsed && (
                <div>
                  {list.map(plano => (
                    <ContextMenu key={plano.id}>
                      <ContextMenuTrigger asChild>
                        <div className="group flex items-center gap-2 md:gap-3 px-3 py-2 hover:bg-muted/30 transition-colors">
                          <button
                            onClick={() => togglePlano(plano)}
                            className={`w-4 h-4 md:w-5 md:h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                              plano.entregado
                                ? 'border-status-completed bg-status-completed/20'
                                : 'border-muted-foreground/40 hover:border-status-completed hover:bg-status-completed/10'
                            }`}
                          >
                            {plano.entregado && <Check className="w-2.5 h-2.5 md:w-3 md:h-3 text-status-completed" />}
                          </button>
                          {editingPlano === plano.id ? (
                            <>
                              <input
                                autoFocus
                                value={editCodigo}
                                onChange={e => setEditCodigo(e.target.value)}
                                placeholder="Código"
                                className="w-24 bg-background border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                              />
                              <input
                                value={editNombre}
                                onChange={e => setEditNombre(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveEditPlano(plano.id); if (e.key === 'Escape') setEditingPlano(null); }}
                                className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                              />
                              <ResponsablePicker
                                miembros={miembros}
                                value={editResponsable}
                                onChange={setEditResponsable}
                              />
                              <button onClick={() => saveEditPlano(plano.id)} className="text-primary hover:text-primary/80 p-1">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setEditingPlano(null)} className="text-muted-foreground hover:text-foreground p-1">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              {plano.codigo && (
                                <span className={`text-[10px] md:text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted shrink-0 ${plano.entregado ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                                  {plano.codigo}
                                </span>
                              )}
                              <span className={`text-xs md:text-sm flex-1 truncate ${plano.entregado ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                {plano.nombre}
                              </span>
                              <button
                                onClick={() => startEditPlano(plano)}
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity p-1"
                                title="Editar plano"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              {(() => {
                                const r = miembros.find(m => m.user_id === plano.responsable_id);
                                return r ? (
                                  <UserAvatar
                                    nombre={r.nombre}
                                    color={r.color_avatar}
                                    avatarUrl={r.avatar_url}
                                    size="sm"
                                    className="ml-auto shrink-0"
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded-full border border-dashed border-border ml-auto shrink-0" title="Sin asignar" />
                                );
                              })()}
                            </>
                          )}
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => startEditPlano(plano)} className="focus:bg-muted">
                          <Pencil className="w-3.5 h-3.5 mr-2" /> Editar plano
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => deletePlano(plano.id)} className="text-destructive focus:text-destructive focus:bg-muted">
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Eliminar plano
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}

                  {addingTo === pa.id ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/20">
                      <input
                        autoFocus
                        value={newCodigo}
                        onChange={e => setNewCodigo(e.target.value)}
                        placeholder="Código"
                        className="w-24 bg-background border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                      />
                      <input
                        value={newNombre}
                        onChange={e => setNewNombre(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addPlano(pa.id); if (e.key === 'Escape') { setAddingTo(null); setNewCodigo(''); setNewNombre(''); setNewResponsable(null); } }}
                        placeholder="Nombre del plano"
                        className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                      <ResponsablePicker
                        miembros={miembros}
                        value={newResponsable}
                        onChange={setNewResponsable}
                      />
                      <button onClick={() => addPlano(pa.id)} className="text-primary hover:text-primary/80 p-1">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setAddingTo(null); setNewCodigo(''); setNewNombre(''); setNewResponsable(null); }} className="text-muted-foreground hover:text-foreground p-1">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingTo(pa.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Añadir plano
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Nueva partida */}
        {showNewPartida ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20">
            <FolderPlus className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={newPartidaNombre}
              onChange={e => setNewPartidaNombre(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createPartida(); if (e.key === 'Escape') { setShowNewPartida(false); setNewPartidaNombre(''); } }}
              placeholder="Ej. Arquitectónicos, Instalaciones, Cancelería"
              className="flex-1 bg-transparent text-xs md:text-sm text-foreground focus:outline-none"
            />
            <button onClick={createPartida} className="text-primary hover:text-primary/80 p-1">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => { setShowNewPartida(false); setNewPartidaNombre(''); }} className="text-muted-foreground hover:text-foreground p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : partidas.length > 0 && (
          <button
            onClick={() => setShowNewPartida(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg hover:bg-muted/20 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" /> Nueva partida
          </button>
        )}
      </div>
    </div>
  );
}

function ResponsablePicker({
  miembros,
  value,
  onChange,
}: {
  miembros: MiembroPerfil[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const selected = miembros.find(m => m.user_id === value) || null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="shrink-0 rounded-full hover:opacity-80 transition-opacity"
          title={selected ? `Asignado: ${selected.nombre}` : 'Asignar responsable'}
        >
          {selected ? (
            <UserAvatar
              nombre={selected.nombre}
              color={selected.color_avatar}
              avatarUrl={selected.avatar_url}
              size="sm"
            />
          ) : (
            <div className="w-6 h-6 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground">
              <UserCircle2 className="w-3.5 h-3.5" />
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1 bg-popover border-border" align="end">
        <button
          onClick={() => onChange(null)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors ${value === null ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          <div className="w-6 h-6 rounded-full border border-dashed border-border flex items-center justify-center">
            <X className="w-3 h-3" />
          </div>
          Sin asignar
        </button>
        {miembros.map(m => (
          <button
            key={m.user_id}
            onClick={() => onChange(m.user_id)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors ${value === m.user_id ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            <UserAvatar nombre={m.nombre} color={m.color_avatar} avatarUrl={m.avatar_url} size="sm" />
            <span className="truncate">{m.nombre}</span>
            {value === m.user_id && <Check className="w-3 h-3 ml-auto text-primary" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
