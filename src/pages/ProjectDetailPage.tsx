import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, List, Columns, Plus, UserPlus, X, Check, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Proyecto, Tarea, MiembroProyecto, Perfil, EstadoTarea } from '@/lib/types';
import { ESTADO_CONFIG } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';
import { StatusDot } from '@/components/StatusDot';
import TaskDetailDrawer from '@/components/TaskDetailDrawer';
import KanbanBoard from '@/components/KanbanBoard';
import CreateTaskModal from '@/components/CreateTaskModal';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [miembros, setMiembros] = useState<MiembroProyecto[]>([]);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [selectedTask, setSelectedTask] = useState<Tarea | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [filterEstado, setFilterEstado] = useState<EstadoTarea | null>(null);
  const [filterResponsable, setFilterResponsable] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!id) return;
    const [pRes, tRes, mRes, pfRes] = await Promise.all([
      supabase.from('proyectos').select('*').eq('id', id).single(),
      supabase.from('tareas').select('*').eq('proyecto_id', id).order('fecha_creacion', { ascending: false }),
      supabase.from('miembros_proyecto').select('*').eq('proyecto_id', id),
      supabase.from('perfiles').select('*'),
    ]);
    if (pRes.data) setProyecto(pRes.data as unknown as Proyecto);
    if (tRes.data) setTareas(tRes.data as unknown as Tarea[]);
    if (mRes.data) setMiembros(mRes.data as unknown as MiembroProyecto[]);
    if (pfRes.data) setPerfiles(pfRes.data as unknown as Perfil[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]);

  // Realtime subscription
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`project-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas', filter: `proyecto_id=eq.${id}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'miembros_proyecto', filter: `proyecto_id=eq.${id}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const filteredTareas = useMemo(() => {
    let result = tareas;
    if (filterEstado) result = result.filter(t => t.estado === filterEstado);
    if (filterResponsable) result = result.filter(t => t.responsable_id === filterResponsable);
    return result;
  }, [tareas, filterEstado, filterResponsable]);

  const activeTareas = useMemo(() => filteredTareas.filter(t => t.estado !== 'completada'), [filteredTareas]);
  const completedTareas = useMemo(() => filteredTareas.filter(t => t.estado === 'completada'), [filteredTareas]);

  const secciones = useMemo(() => {
    const map = new Map<string, Tarea[]>();
    activeTareas.forEach(t => {
      const sec = t.seccion || 'General';
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(t);
    });
    return map;
  }, [activeTareas]);

  const [showCompleted, setShowCompleted] = useState(false);

  const counts = useMemo(() => ({
    total: tareas.length,
    completada: tareas.filter(t => t.estado === 'completada').length,
    en_progreso: tareas.filter(t => t.estado === 'en_progreso').length,
    bloqueada: tareas.filter(t => t.estado === 'bloqueada').length,
  }), [tareas]);

  const memberProfiles = useMemo(() => {
    return miembros
      .map(m => perfiles.find(p => p.user_id === m.usuario_id))
      .filter(Boolean) as Perfil[];
  }, [miembros, perfiles]);

  const getProfile = (userId: string | null) => perfiles.find(p => p.user_id === userId);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !inviteEmail.trim()) return;
    const { data: userId, error } = await supabase.rpc('buscar_usuario_por_email', {
      _email: inviteEmail.trim(),
      _proyecto_id: id,
    });
    if (userId && !error) {
      await supabase.from('miembros_proyecto').insert({
        proyecto_id: id,
        usuario_id: userId as string,
        rol: 'miembro' as const,
      });
      setInviteEmail('');
      setShowInvite(false);
      fetchData();
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: EstadoTarea) => {
    await supabase.from('tareas').update({ estado: newStatus }).eq('id', taskId);
    fetchData();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!proyecto) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Proyecto no encontrado</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Project header */}
      <div className="border-b border-border px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: proyecto.color }} />
            <span className="text-sm font-medium text-foreground">{proyecto.nombre}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5 mr-2">
              {memberProfiles.slice(0, 4).map(p => (
                <UserAvatar
                  key={p.user_id}
                  nombre={p.nombre}
                  color={p.color_avatar}
                  size="sm"
                  className={`cursor-pointer transition-all ${filterResponsable === p.user_id ? 'ring-2 ring-primary' : ''}`}
                />
              ))}
            </div>
            <button onClick={() => setShowInvite(true)} className="text-muted-foreground hover:text-foreground transition-colors">
              <UserPlus className="w-4 h-4" />
            </button>
            <div className="flex items-center border border-border rounded-md overflow-hidden ml-2">
              <button
                onClick={() => setView('list')}
                className={`p-1.5 transition-colors ${view === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('kanban')}
                className={`p-1.5 transition-colors ${view === 'kanban' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Columns className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Counters and filters */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>{counts.total} Total</span>
            <span className="text-status-completed">{counts.completada} Completadas</span>
            <span className="text-status-progress">{counts.en_progreso} En progreso</span>
            <span className="text-status-blocked">{counts.bloqueada} Bloqueadas</span>
          </div>
          <div className="flex items-center gap-1.5">
            {(Object.keys(ESTADO_CONFIG) as EstadoTarea[]).map(estado => (
              <button
                key={estado}
                onClick={() => setFilterEstado(filterEstado === estado ? null : estado)}
                className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                  filterEstado === estado
                    ? 'border-foreground/20 text-foreground bg-muted'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <StatusDot estado={estado} showLabel />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {view === 'list' ? (
          <div className="h-full overflow-y-auto p-4">
            {activeTareas.length === 0 && completedTareas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <p className="text-sm">Sin tareas</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Active tasks by section */}
                {Array.from(secciones.entries()).map(([seccion, tasks]) => (
                  <div key={seccion}>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">{seccion}</h3>
                    <div className="space-y-0.5">
                      {tasks.map(task => {
                        const responsable = getProfile(task.responsable_id);
                        return (
                          <div
                            key={task.id}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors text-left group"
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'completada'); }}
                              className="w-5 h-5 rounded-full border border-muted-foreground/40 flex items-center justify-center shrink-0 hover:border-status-completed hover:bg-status-completed/20 transition-colors"
                              title="Marcar completada"
                            >
                              <Check className="w-3 h-3 text-transparent group-hover:text-muted-foreground/40" />
                            </button>
                            <button
                              onClick={() => setSelectedTask(task)}
                              className="flex items-center gap-3 flex-1 min-w-0 text-left"
                            >
                              {responsable && (
                                <UserAvatar nombre={responsable.nombre} color={responsable.color_avatar} size="sm" />
                              )}
                              <span className="text-sm text-foreground flex-1 truncate">{task.titulo}</span>
                              {task.fecha_limite && (
                                <span className="text-[11px] text-muted-foreground">{new Date(task.fecha_limite).toLocaleDateString('es')}</span>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Completed tasks collapsible */}
                {completedTareas.length > 0 && (
                  <div className="pt-2 border-t border-border/50">
                    <button
                      onClick={() => setShowCompleted(!showCompleted)}
                      className="flex items-center gap-2 px-1 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
                    >
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showCompleted ? 'rotate-90' : ''}`} />
                      <span>Tareas completadas</span>
                      <span className="text-[10px] text-muted-foreground/60">{completedTareas.length}</span>
                    </button>
                    {showCompleted && (
                      <div className="space-y-0.5 mt-1">
                        {completedTareas.map(task => {
                          const responsable = getProfile(task.responsable_id);
                          return (
                            <div
                              key={task.id}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors text-left group"
                            >
                              <button
                                onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'pendiente'); }}
                                className="w-5 h-5 rounded-full border border-status-completed bg-status-completed/20 flex items-center justify-center shrink-0 hover:bg-transparent hover:border-muted-foreground/40 transition-colors"
                                title="Desmarcar completada"
                              >
                                <Check className="w-3 h-3 text-status-completed" />
                              </button>
                              <button
                                onClick={() => setSelectedTask(task)}
                                className="flex items-center gap-3 flex-1 min-w-0"
                              >
                                {responsable && (
                                  <UserAvatar nombre={responsable.nombre} color={responsable.color_avatar} size="sm" />
                                )}
                                <span className="text-sm text-muted-foreground flex-1 truncate line-through">{task.titulo}</span>
                                {task.fecha_limite && (
                                  <span className="text-[11px] text-muted-foreground/60">{new Date(task.fecha_limite).toLocaleDateString('es')}</span>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <KanbanBoard
            tareas={filteredTareas}
            perfiles={perfiles}
            onTaskClick={setSelectedTask}
            onStatusChange={updateTaskStatus}
          />
        )}

        {/* FAB */}
        <button
          onClick={() => setShowCreateTask(true)}
          className="fixed bottom-20 right-4 md:absolute md:bottom-4 md:right-4 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg glow-primary hover:opacity-90 transition-opacity z-20"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Task detail drawer */}
      {selectedTask && (
        <TaskDetailDrawer
          tarea={selectedTask}
          perfiles={perfiles}
          miembros={miembros}
          onClose={() => { setSelectedTask(null); fetchData(); }}
          onUpdate={fetchData}
        />
      )}

      {/* Create task modal */}
      {showCreateTask && id && (
        <CreateTaskModal
          proyectoId={id}
          miembros={miembros}
          perfiles={perfiles}
          onClose={() => setShowCreateTask(false)}
          onCreated={() => { setShowCreateTask(false); fetchData(); }}
        />
      )}

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-panel rounded-lg p-6 w-full max-w-sm animate-fade-in">
            <h3 className="text-base font-medium text-foreground mb-4">Invitar miembro</h3>
            <form onSubmit={handleInvite} className="space-y-4">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                autoFocus
                className="w-full h-10 px-3 rounded-md bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="email@ejemplo.com"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowInvite(false)} className="h-9 px-4 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
                <button type="submit" className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Invitar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
