import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, List, Columns, Plus, UserPlus, X, Check, ChevronRight, FileText, ListChecks, CalendarRange, SquareDashedKanban, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Proyecto, Tarea, MiembroProyecto, Perfil, EstadoTarea } from '@/lib/types';
import { ESTADO_CONFIG, PRIORIDAD_CONFIG } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';
import { StatusDot } from '@/components/StatusDot';
import TaskDetailDrawer from '@/components/TaskDetailDrawer';
import KanbanBoard from '@/components/KanbanBoard';
import CreateTaskModal from '@/components/CreateTaskModal';
import SheetsView from '@/components/SheetsView';
import TimelineView from '@/components/TimelineView';
import MiroView from '@/components/MiroView';
import MiroTabButton from '@/components/MiroTabButton';
import ConnectView from '@/components/ConnectView';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [miembros, setMiembros] = useState<MiembroProyecto[]>([]);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [section, setSection] = useState<'tareas' | 'sheets' | 'timeline' | 'miro' | 'connect'>('tareas');
  const [miroActiveId, setMiroActiveId] = useState<string | null>(null);
  const [miroAction, setMiroAction] = useState<'create' | null>(null);
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

  const isOwner = useMemo(() => {
    if (!user) return false;
    return miembros.some(m => m.usuario_id === user.id && m.rol === 'propietario');
  }, [miembros, user]);

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

  const removeMember = async (usuarioId: string) => {
    if (!id) return;
    if (usuarioId === user?.id) {
      toast.error('No puedes eliminarte a ti mismo');
      return;
    }
    const member = miembros.find(m => m.usuario_id === usuarioId);
    if (member?.rol === 'propietario') {
      toast.error('No se puede eliminar al propietario');
      return;
    }
    const { error } = await supabase
      .from('miembros_proyecto')
      .delete()
      .eq('proyecto_id', id)
      .eq('usuario_id', usuarioId);
    if (error) {
      toast.error('Error al eliminar miembro');
    } else {
      toast.success('Miembro eliminado');
      fetchData();
    }
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase.from('tareas').delete().eq('id', taskId);
    if (error) {
      toast.error('Error al eliminar la tarea');
    } else {
      toast.success('Tarea eliminada');
      fetchData();
    }
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
      <div className="border-b border-border px-3 md:px-4 py-2 md:py-3 space-y-2 md:space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
            <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-sm" style={{ backgroundColor: proyecto.color }} />
            <span className="text-xs md:text-sm font-medium text-foreground">{proyecto.nombre}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5 mr-2">
              {memberProfiles.slice(0, 4).map(p => (
                <UserAvatar
                  key={p.user_id}
                  nombre={p.nombre}
                  color={p.color_avatar}
                  avatarUrl={p.avatar_url}
                  size="sm"
                  className={`cursor-pointer transition-all ${filterResponsable === p.user_id ? 'ring-2 ring-primary' : ''}`}
                />
              ))}
            </div>
            <button onClick={() => setShowInvite(true)} className="text-muted-foreground hover:text-foreground transition-colors">
              <UserPlus className="w-4 h-4" />
            </button>
            {section === 'tareas' && (
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
            )}
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex items-center gap-1 -mx-1">
          <button
            onClick={() => setSection('tareas')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] md:text-xs transition-colors ${
              section === 'tareas' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" /> Tareas
          </button>
          <button
            onClick={() => setSection('sheets')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] md:text-xs transition-colors ${
              section === 'sheets' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Sheets
          </button>
          <button
            onClick={() => setSection('timeline')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] md:text-xs transition-colors ${
              section === 'timeline' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5" /> Timeline
          </button>
          <MiroTabButton
            proyectoId={id!}
            isOwner={isOwner}
            isActive={section === 'miro'}
            activeBoardId={miroActiveId}
            onOpenBoard={(boardId) => {
              setSection('miro');
              if (boardId) setMiroActiveId(boardId);
            }}
            onCreate={() => {
              setSection('miro');
              setMiroAction('create');
            }}
          />
        </div>

        {/* Counters and filters */}
        {section === 'tareas' && (
        <div className="flex items-center justify-between flex-wrap gap-1.5 md:gap-2">
          <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-[11px] text-muted-foreground">
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
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {section === 'sheets' ? (
          <SheetsView proyectoId={id!} />
        ) : section === 'timeline' ? (
          <TimelineView proyectoId={id!} />
        ) : section === 'miro' ? (
          <MiroView
            proyectoId={id!}
            isOwner={isOwner}
            externalActiveId={miroActiveId}
            externalAction={miroAction}
            onExternalConsumed={() => { setMiroActiveId(null); setMiroAction(null); }}
          />
        ) : view === 'list' ? (
          <div className="h-full overflow-y-auto p-3 md:p-4">
            {activeTareas.length === 0 && completedTareas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <p className="text-sm">Sin tareas</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Active tasks by section */}
                {Array.from(secciones.entries()).map(([seccion, tasks]) => (
                  <div key={seccion}>
                    <h3 className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 md:mb-2 px-1">{seccion}</h3>
                    <div className="space-y-0.5">
                      {tasks.map(task => {
                        const responsable = getProfile(task.responsable_id);
                        return (
                          <div
                            key={task.id}
                            className="w-full flex items-center gap-2 md:gap-3 px-2 md:px-3 py-2 md:py-2.5 rounded-md hover:bg-muted/50 transition-colors text-left group"
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'completada'); }}
                              className="w-4 h-4 md:w-5 md:h-5 rounded-full border border-muted-foreground/40 flex items-center justify-center shrink-0 hover:border-status-completed hover:bg-status-completed/20 transition-colors"
                              title="Marcar completada"
                            >
                              <Check className="w-2.5 h-2.5 md:w-3 md:h-3 text-transparent group-hover:text-muted-foreground/40" />
                            </button>
                            <button
                              onClick={() => setSelectedTask(task)}
                              className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 text-left"
                            >
                              {responsable && (
                                <UserAvatar nombre={responsable.nombre} color={responsable.color_avatar} avatarUrl={responsable.avatar_url} size="sm" />
                              )}
                              <span className="text-xs md:text-sm text-foreground flex-1 truncate">{task.titulo}</span>
                              <span className={`shrink-0 px-1.5 md:px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-medium border ${PRIORIDAD_CONFIG[task.prioridad].className}`}>
                                {PRIORIDAD_CONFIG[task.prioridad].label}
                              </span>
                              {task.fecha_limite && (
                                <span className="text-[10px] md:text-[11px] text-muted-foreground">{new Date(task.fecha_limite).toLocaleDateString('es')}</span>
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
                          <ContextMenu key={task.id}>
                            <ContextMenuTrigger asChild>
                              <div
                                className="w-full flex items-center gap-2 md:gap-3 px-2 md:px-3 py-2 md:py-2.5 rounded-md hover:bg-muted/50 transition-colors text-left group"
                              >
                                <button
                                  onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'pendiente'); }}
                                  className="w-4 h-4 md:w-5 md:h-5 rounded-full border border-status-completed bg-status-completed/20 flex items-center justify-center shrink-0 hover:bg-transparent hover:border-muted-foreground/40 transition-colors"
                                  title="Desmarcar completada"
                                >
                                  <Check className="w-2.5 h-2.5 md:w-3 md:h-3 text-status-completed" />
                                </button>
                                <button
                                  onClick={() => setSelectedTask(task)}
                                  className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 text-left"
                                >
                                  {responsable && (
                                    <UserAvatar nombre={responsable.nombre} color={responsable.color_avatar} avatarUrl={responsable.avatar_url} size="sm" />
                                  )}
                                  <span className="text-xs md:text-sm text-muted-foreground flex-1 truncate line-through">{task.titulo}</span>
                                  <span className={`shrink-0 px-1.5 md:px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-medium border ${PRIORIDAD_CONFIG[task.prioridad].className}`}>
                                    {PRIORIDAD_CONFIG[task.prioridad].label}
                                  </span>
                                  {task.fecha_limite && (
                                    <span className="text-[10px] md:text-[11px] text-muted-foreground/60">{new Date(task.fecha_limite).toLocaleDateString('es')}</span>
                                  )}
                                </button>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem
                                onClick={() => deleteTask(task.id)}
                                className="text-destructive focus:text-destructive focus:bg-muted"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                Eliminar tarea
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
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
        {section === 'tareas' && (
        <button
          onClick={() => setShowCreateTask(true)}
          className="fixed bottom-20 right-3 md:absolute md:bottom-4 md:right-4 w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg glow-primary hover:opacity-90 transition-opacity z-20 safe-bottom-fab"
        >
          <Plus className="w-5 h-5" />
        </button>
        )}
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
            <h3 className="text-base font-medium text-foreground mb-4">Miembros del proyecto</h3>

            <div className="space-y-1.5 mb-4 max-h-64 overflow-y-auto">
              {memberProfiles.map(p => {
                const member = miembros.find(m => m.usuario_id === p.user_id);
                const esPropietario = member?.rol === 'propietario';
                const esYo = p.user_id === user?.id;
                return (
                  <div key={p.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50">
                    <UserAvatar nombre={p.nombre} color={p.color_avatar} avatarUrl={p.avatar_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">{p.nombre}{esYo && ' (tú)'}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{esPropietario ? 'Propietario' : 'Miembro'}</p>
                    </div>
                    {isOwner && !esPropietario && !esYo && (
                      <button
                        type="button"
                        onClick={() => removeMember(p.user_id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                        title="Eliminar miembro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                autoFocus
                className="w-full h-10 px-3 rounded-md bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Invitar por email…"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowInvite(false)} className="h-9 px-4 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors">Cerrar</button>
                <button type="submit" disabled={!inviteEmail.trim()} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">Invitar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
