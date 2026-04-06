import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Tarea, Proyecto, Perfil } from '@/lib/types';
import { StatusDot } from '@/components/StatusDot';
import { UserAvatar } from '@/components/UserAvatar';
import { useNavigate } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';

export default function MyTasksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);

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

  const grouped = useMemo(() => {
    const map = new Map<string, Tarea[]>();
    tareas.forEach(t => {
      if (!map.has(t.proyecto_id)) map.set(t.proyecto_id, []);
      map.get(t.proyecto_id)!.push(t);
    });
    return map;
  }, [tareas]);

  const getProject = (id: string) => proyectos.find(p => p.id === id);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold text-foreground mb-6">Mis Tareas</h1>

      {tareas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ClipboardList className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">No tienes tareas asignadas</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([proyectoId, tasks]) => {
            const proyecto = getProject(proyectoId);
            return (
              <div key={proyectoId}>
                <button
                  onClick={() => navigate(`/proyecto/${proyectoId}`)}
                  className="flex items-center gap-2 mb-2 hover:opacity-80 transition-opacity"
                >
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: proyecto?.color || '#666' }} />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {proyecto?.nombre || 'Proyecto'}
                  </span>
                </button>
                <div className="space-y-0.5">
                  {tasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => navigate(`/proyecto/${task.proyecto_id}`)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors text-left"
                    >
                      <StatusDot estado={task.estado} size="md" />
                      <span className="text-sm text-foreground flex-1 truncate">{task.titulo}</span>
                      {task.fecha_limite && (
                        <span className="text-[11px] text-muted-foreground">{new Date(task.fecha_limite).toLocaleDateString('es')}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
