export type EstadoTarea = 'pendiente' | 'en_progreso' | 'bloqueada' | 'completada';
export type RolMiembro = 'propietario' | 'miembro';
export type PrioridadTarea = 'baja' | 'media' | 'alta';

export interface Perfil {
  id: string;
  user_id: string;
  nombre: string;
  email: string;
  color_avatar: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Proyecto {
  id: string;
  nombre: string;
  color: string;
  creado_por: string;
  fecha_creacion: string;
}

export interface MiembroProyecto {
  id: string;
  proyecto_id: string;
  usuario_id: string;
  rol: RolMiembro;
  created_at: string;
}

export interface Tarea {
  id: string;
  proyecto_id: string;
  titulo: string;
  descripcion: string | null;
  estado: EstadoTarea;
  prioridad: PrioridadTarea;
  responsable_id: string | null;
  fecha_inicio: string | null;
  fecha_limite: string | null;
  seccion: string;
  creado_por: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface ActividadTarea {
  id: string;
  tarea_id: string;
  usuario_id: string;
  accion: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  fecha: string;
}

export const ESTADO_CONFIG: Record<EstadoTarea, { label: string; color: string; dotClass: string }> = {
  pendiente: { label: 'Pendiente', color: 'hsl(240, 5%, 75%)', dotClass: 'bg-status-pending' },
  en_progreso: { label: 'En progreso', color: 'hsl(40, 90%, 47%)', dotClass: 'bg-status-progress' },
  bloqueada: { label: 'Bloqueada', color: 'hsl(345, 75%, 62%)', dotClass: 'bg-status-blocked' },
  completada: { label: 'Completada', color: 'hsl(162, 71%, 42%)', dotClass: 'bg-status-completed' },
};

export const PRIORIDAD_CONFIG: Record<PrioridadTarea, { label: string; className: string }> = {
  alta: { label: 'Alta', className: 'bg-destructive/15 text-destructive border-destructive/20' },
  media: { label: 'Media', className: 'bg-accent/50 text-accent-foreground border-accent/30' },
  baja: { label: 'Baja', className: 'bg-muted text-muted-foreground border-border' },
};

export const PROJECT_COLORS = [
  '#E8547A', '#1DB88E', '#F0A500', '#6366F1',
  '#EC4899', '#14B8A6', '#F97316', '#8B5CF6',
];
