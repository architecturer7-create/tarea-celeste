import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Trash2, Check, ChevronRight, FolderPlus, X, GripVertical, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { PROJECT_COLORS } from '@/lib/types';

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
}

export default function SheetsView({ proyectoId }: { proyectoId: string }) {
  const { user } = useAuth();
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPartida, setShowNewPartida] = useState(false);
  const [newPartidaNombre, setNewPartidaNombre] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newCodigo, setNewCodigo] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [editingPlano, setEditingPlano] = useState<string | null>(null);
  const [editCodigo, setEditCodigo] = useState('');
  const [editNombre, setEditNombre] = useState('');
  const [dragPartida, setDragPartida] = useState<string | null>(null);
  const [dragOverPartida, setDragOverPartida] = useState<string | null>(null);

  const fetchData = async () => {
    const [pa, pl] = await Promise.all([
      supabase.from('partidas_planos').select('*').eq('proyecto_id', proyectoId).order('orden'),
      supabase.from('planos').select('*').eq('proyecto_id', proyectoId).order('fecha_creacion'),
    ]);
    if (pa.data) setPartidas(pa.data as Partida[]);
    if (pl.data) setPlanos(pl.data as Plano[]);
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
      creado_por: user.id,
    });
    if (error) toast.error('Error al añadir plano');
    else {
      setNewCodigo(''); setNewNombre(''); setAddingTo(null);
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

  const startEditPlano = (p: Plano) => {
    setEditingPlano(p.id);
    setEditCodigo(p.codigo || '');
    setEditNombre(p.nombre);
  };

  const saveEditPlano = async (id: string) => {
    if (!editNombre.trim()) return;
    await supabase.from('planos').update({
      codigo: editCodigo.trim(),
      nombre: editNombre.trim(),
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
                        onKeyDown={e => { if (e.key === 'Enter') addPlano(pa.id); if (e.key === 'Escape') { setAddingTo(null); setNewCodigo(''); setNewNombre(''); } }}
                        placeholder="Nombre del plano"
                        className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                      <button onClick={() => addPlano(pa.id)} className="text-primary hover:text-primary/80 p-1">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setAddingTo(null); setNewCodigo(''); setNewNombre(''); }} className="text-muted-foreground hover:text-foreground p-1">
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
