import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Tarea, Proyecto, Perfil } from '@/lib/types';
import { PRIORIDAD_CONFIG } from '@/lib/types';
import { StatusDot } from '@/components/StatusDot';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, ChevronRight, Trash2 } from 'lucide-react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { toast } from 'sonner';

export default function MyTasksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [tRes, pRes, pfRes] = await Promise.all([
        supabase.from('tareas').select('*').eq('responsable_id', user.id).order('fecha_creacion', { ascending: false }),
        supabase.from('proyectos').select('*'),
        supabase.from('perfiles').select('*'),
      ]);
      if (tRes.data) setTareas(tRes.data as unknown as Tarea[]);
      if (pRes.data) setProyectos(pRes.data as unknown as Proyecto[]);
      if (pfRes.data) setPerfiles(pfRes.data as unknown as Perfil[]);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const activeTareas = useMemo(() => tareas.filter(t => t.estado !== 'completada'), [tareas]);
  const completedTareas = useMemo(() => tareas.filter(t => t.estado === 'completada'), [tareas]);

  const groupTasks = (tasks: Tarea[]) => {
    const map = new Map<string, Tarea[]>();
    tasks.forEach(t => {
      if (!map.has(t.proyecto_id)) map.set(t.proyecto_id, []);
      map.get(t.proyecto_id)!.push(t);
    });
    return map;
  };

  const activeGrouped = useMemo(() => groupTasks(activeTareas), [activeTareas]);
  const completedGrouped = useMemo(() => groupTasks(completedTareas), [completedTareas]);

  const getProject = (id: string) => proyectos.find(p => p.id === id);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase.from('tareas').delete().eq('id', taskId);
    if (error) {
      toast.error('Error al eliminar la tarea');
    } else {
      toast.success('Tarea eliminada');
      setTareas(prev => prev.filter(t => t.id !== taskId));
    }
  };

  const renderTaskGroup = (proyectoId: string, tasks: Tarea[], completed = false) => {
    const proyecto = getProject(proyectoId);
    return (
      <div key={proyectoId}>
        <button
          onClick={() => navigate(`/proyecto/${proyectoId}`)}
          className="flex items-center gap-2 mb-1.5 hover:opacity-80 transition-opacity"
        >
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: proyecto?.color || '#666' }} />
          <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {proyecto?.nombre || 'Proyecto'}
          </span>
        </button>
        <div className="space-y-0.5">
          {tasks.map(task => {
            const taskButton = (
              <button
                onClick={() => navigate(`/proyecto/${task.proyecto_id}`)}
                className="w-full flex items-center gap-2 md:gap-3 px-2 md:px-3 py-2 md:py-2.5 rounded-md hover:bg-muted/50 transition-colors text-left"
              >
                <StatusDot estado={task.estado} size="md" />
                <span className={`text-xs md:text-sm flex-1 truncate ${completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{task.titulo}</span>
                <span className={`shrink-0 px-1.5 md:px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-medium border ${PRIORIDAD_CONFIG[task.prioridad].className}`}>
                  {PRIORIDAD_CONFIG[task.prioridad].label}
                </span>
                {task.fecha_limite && (
                  <span className="text-[10px] md:text-[11px] text-muted-foreground">{new Date(task.fecha_limite).toLocaleDateString('es')}</span>
                )}
              </button>
            );

            if (!completed) return <div key={task.id}>{taskButton}</div>;

            return (
              <ContextMenu key={task.id}>
                <ContextMenuTrigger asChild>
                  <div>{taskButton}</div>
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
      </div>
    );
  };

  return (
    <div className="p-3 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-lg md:text-xl font-semibold text-foreground mb-4 md:mb-6">Mis Tareas</h1>

      {tareas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ClipboardList className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">No tienes tareas asignadas</p>
        </div>
      ) : (
        <div className="space-y-4 md:space-y-6">
          {/* Active tasks */}
          {Array.from(activeGrouped.entries()).map(([proyectoId, tasks]) =>
            renderTaskGroup(proyectoId, tasks)
          )}

          {/* Completed tasks collapsible */}
          {completedTareas.length > 0 && (
            <div className="pt-2 border-t border-border/50">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 px-1 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showCompleted ? 'rotate-90' : ''}`} />
                <span>Completadas</span>
                <span className="text-[10px] text-muted-foreground/60">{completedTareas.length}</span>
              </button>
              {showCompleted && (
                <div className="space-y-4 mt-1">
                  {Array.from(completedGrouped.entries()).map(([proyectoId, tasks]) =>
                    renderTaskGroup(proyectoId, tasks, true)
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
