import { useState, useEffect } from 'react';
import { Plus, FolderOpen, Trash2, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Proyecto, Tarea, MiembroProyecto, Perfil } from '@/lib/types';
import { ESTADO_CONFIG, PROJECT_COLORS } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';
import { useNavigate } from 'react-router-dom';

export default function ProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [miembros, setMiembros] = useState<MiembroProyecto[]>([]);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const fetchData = async () => {
    if (!user) return;
    const [pRes, tRes, mRes, pfRes] = await Promise.all([
      supabase.from('proyectos').select('*').order('fecha_creacion', { ascending: false }),
      supabase.from('tareas').select('*'),
      supabase.from('miembros_proyecto').select('*'),
      supabase.from('perfiles').select('*'),
    ]);
    if (pRes.data) setProyectos(pRes.data as unknown as Proyecto[]);
    if (tRes.data) setTareas(tRes.data as unknown as Tarea[]);
    if (mRes.data) setMiembros(mRes.data as unknown as MiembroProyecto[]);
    if (pfRes.data) setPerfiles(pfRes.data as unknown as Perfil[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newName.trim()) return;

    const { data, error } = await supabase.rpc('crear_proyecto', {
      _nombre: newName.trim(),
      _color: newColor,
    });

    if (!error && data) {
      setNewName('');
      setShowCreate(false);
      fetchData();
    }
  };

  const deleteProject = async () => {
    if (!deleteTarget) return;
    await supabase.from('tareas').delete().eq('proyecto_id', deleteTarget);
    await supabase.from('miembros_proyecto').delete().eq('proyecto_id', deleteTarget);
    await supabase.from('proyectos').delete().eq('id', deleteTarget);
    setDeleteTarget(null);
    fetchData();
  };

  const renameProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !editName.trim()) return;
    await supabase.from('proyectos').update({ nombre: editName.trim() }).eq('id', editTarget);
    setEditTarget(null);
    fetchData();
  };

  const getTaskCounts = (proyectoId: string) => {
    const projectTasks = tareas.filter(t => t.proyecto_id === proyectoId);
    return {
      total: projectTasks.length,
      pendiente: projectTasks.filter(t => t.estado === 'pendiente').length,
      en_progreso: projectTasks.filter(t => t.estado === 'en_progreso').length,
      bloqueada: projectTasks.filter(t => t.estado === 'bloqueada').length,
      completada: projectTasks.filter(t => t.estado === 'completada').length,
    };
  };

  const getProjectMembers = (proyectoId: string) => {
    return miembros
      .filter(m => m.proyecto_id === proyectoId)
      .map(m => perfiles.find(p => p.user_id === m.usuario_id))
      .filter(Boolean) as Perfil[];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h1 className="text-lg md:text-xl font-semibold text-foreground">Proyectos</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 h-7 md:h-8 px-2.5 md:px-3 rounded-md bg-primary text-primary-foreground text-xs md:text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span className="hidden sm:inline">Nuevo proyecto</span>
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-panel rounded-lg p-6 w-full max-w-md animate-fade-in">
            <h3 className="text-base font-medium text-foreground mb-4">Nuevo proyecto</h3>
            <form onSubmit={createProject} className="space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Nombre</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  autoFocus
                  className="w-full h-10 px-3 rounded-md bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Nombre del proyecto"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Color</label>
                <div className="flex gap-2">
                  {PROJECT_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={`w-8 h-8 rounded-md transition-all ${newColor === c ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project list */}
      {proyectos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FolderOpen className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">No tienes proyectos aún</p>
          <p className="text-xs mt-1">Crea tu primer proyecto para comenzar</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {proyectos.map(p => {
            const counts = getTaskCounts(p.id);
            const members = getProjectMembers(p.id);
            return (
              <button
                key={p.id}
                onClick={() => navigate(`/proyecto/${p.id}`)}
                className="glass-panel rounded-lg p-3 md:p-4 text-left hover:border-border/80 transition-colors group border-0"
              >
                <div className="flex items-center gap-2 mb-2 md:mb-3">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm" style={{ backgroundColor: p.color }} />
                  <span className="text-xs md:text-sm font-medium text-foreground truncate flex-1">{p.nombre}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditName(p.nombre); setEditTarget(p.id); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all p-1"
                    title="Editar nombre"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(p.id); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 -mr-1"
                    title="Eliminar proyecto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-x-2 md:gap-x-3 gap-y-1 text-[10px] md:text-[11px] text-muted-foreground mb-2 md:mb-3">
                  <span>{counts.total} total</span>
                  {counts.completada > 0 && <span className="text-status-completed">{counts.completada} completadas</span>}
                  {counts.en_progreso > 0 && <span className="text-status-progress">{counts.en_progreso} en progreso</span>}
                  {counts.bloqueada > 0 && <span className="text-status-blocked">{counts.bloqueada} bloqueadas</span>}
                </div>
                <div className="flex -space-x-1.5">
                  {members.slice(0, 5).map(m => (
                    <UserAvatar key={m.user_id} nombre={m.nombre} color={m.color_avatar} size="sm" />
                  ))}
                  {members.length > 5 && (
                    <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                      +{members.length - 5}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-panel rounded-lg p-6 w-full max-w-sm animate-fade-in">
            <h3 className="text-base font-medium text-foreground mb-2">Eliminar proyecto</h3>
            <p className="text-sm text-muted-foreground mb-4">¿Estás seguro? Se eliminarán todas las tareas y miembros del proyecto. Esta acción no se puede deshacer.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="h-9 px-4 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
              <button onClick={deleteProject} className="h-9 px-4 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-panel rounded-lg p-6 w-full max-w-sm animate-fade-in">
            <h3 className="text-base font-medium text-foreground mb-4">Renombrar proyecto</h3>
            <form onSubmit={renameProject} className="space-y-4">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                autoFocus
                className="w-full h-10 px-3 rounded-md bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setEditTarget(null)} className="h-9 px-4 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
                <button type="submit" className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
