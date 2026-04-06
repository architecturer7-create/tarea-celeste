CREATE TYPE public.prioridad_tarea AS ENUM ('baja', 'media', 'alta');
ALTER TABLE public.tareas ADD COLUMN prioridad prioridad_tarea NOT NULL DEFAULT 'media';