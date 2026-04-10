import { useMemo } from 'react';
import type { Tarea, EstadoTarea, Perfil } from '@/lib/types';
import { ESTADO_CONFIG } from '@/lib/types';
import { UserAvatar } from '@/components/UserAvatar';
import { StatusDot } from '@/components/StatusDot';

interface Props {
  tareas: Tarea[];
  perfiles: Perfil[];
  onTaskClick: (tarea: Tarea) => void;
  onStatusChange: (taskId: string, newStatus: EstadoTarea) => void;
}

const COLUMNS: EstadoTarea[] = ['pendiente', 'en_progreso', 'bloqueada', 'completada'];

export default function KanbanBoard({ tareas, perfiles, onTaskClick, onStatusChange }: Props) {
  const columns = useMemo(() => {
    const map: Record<EstadoTarea, Tarea[]> = {
      pendiente: [], en_progreso: [], bloqueada: [], completada: [],
    };
    tareas.forEach(t => map[t.estado].push(t));
    return map;
  }, [tareas]);

  const getProfile = (userId: string | null) => perfiles.find(p => p.user_id === userId);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDrop = (e: React.DragEvent, status: EstadoTarea) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) onStatusChange(taskId, status);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="h-full overflow-x-auto p-4">
      <div className="flex gap-3 h-full min-w-[800px]">
        {COLUMNS.map(col => (
          <div
            key={col}
            className="flex-1 flex flex-col min-w-[200px]"
            onDrop={(e) => handleDrop(e, col)}
            onDragOver={handleDragOver}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 px-2 py-2 mb-2">
              <StatusDot estado={col} size="md" />
              <span className="text-xs font-medium text-muted-foreground">{ESTADO_CONFIG[col].label}</span>
              <span className="text-[10px] text-muted-foreground/60 ml-auto">{columns[col].length}</span>
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-1.5 overflow-y-auto">
              {columns[col].map(task => {
                const responsable = getProfile(task.responsable_id);
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onClick={() => onTaskClick(task)}
                    className="glass-panel rounded-md p-3 cursor-pointer hover:border-border/60 transition-colors"
                  >
                    <p className="text-sm text-foreground mb-2 line-clamp-2">{task.titulo}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {responsable && (
                          <UserAvatar nombre={responsable.nombre} color={responsable.color_avatar} avatarUrl={responsable.avatar_url} size="sm" />
                        )}
                      </div>
                      {task.fecha_limite && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(task.fecha_limite).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
