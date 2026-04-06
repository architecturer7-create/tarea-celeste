-- Create enums
CREATE TYPE public.estado_tarea AS ENUM ('pendiente', 'en_progreso', 'bloqueada', 'completada');
CREATE TYPE public.rol_miembro AS ENUM ('propietario', 'miembro');

-- Avatar color palette function
CREATE OR REPLACE FUNCTION public.random_avatar_color()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT (ARRAY['#E8547A','#1DB88E','#F0A500','#6366F1','#EC4899','#14B8A6','#F97316','#8B5CF6'])[floor(random() * 8 + 1)::int];
$$;

-- Profiles table
CREATE TABLE public.perfiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  color_avatar TEXT NOT NULL DEFAULT public.random_avatar_color(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.perfiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.perfiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.perfiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Projects table
CREATE TABLE public.proyectos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#E8547A',
  creado_por UUID NOT NULL REFERENCES auth.users(id),
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.proyectos ENABLE ROW LEVEL SECURITY;

-- Project members table
CREATE TABLE public.miembros_proyecto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol public.rol_miembro NOT NULL DEFAULT 'miembro',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(proyecto_id, usuario_id)
);
ALTER TABLE public.miembros_proyecto ENABLE ROW LEVEL SECURITY;

-- RLS for projects
CREATE POLICY "Members can view projects" ON public.proyectos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.miembros_proyecto WHERE proyecto_id = id AND usuario_id = auth.uid()));
CREATE POLICY "Authenticated users can create projects" ON public.proyectos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creado_por);
CREATE POLICY "Owner can update project" ON public.proyectos FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.miembros_proyecto WHERE proyecto_id = id AND usuario_id = auth.uid() AND rol = 'propietario'));
CREATE POLICY "Owner can delete project" ON public.proyectos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.miembros_proyecto WHERE proyecto_id = id AND usuario_id = auth.uid() AND rol = 'propietario'));

-- RLS for project members
CREATE POLICY "Members can view project members" ON public.miembros_proyecto FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.miembros_proyecto mp WHERE mp.proyecto_id = miembros_proyecto.proyecto_id AND mp.usuario_id = auth.uid()));
CREATE POLICY "Owner can add members" ON public.miembros_proyecto FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.miembros_proyecto mp WHERE mp.proyecto_id = miembros_proyecto.proyecto_id AND mp.usuario_id = auth.uid() AND mp.rol = 'propietario') OR auth.uid() = usuario_id);
CREATE POLICY "Owner can remove members" ON public.miembros_proyecto FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.miembros_proyecto mp WHERE mp.proyecto_id = miembros_proyecto.proyecto_id AND mp.usuario_id = auth.uid() AND mp.rol = 'propietario'));

-- Tasks table
CREATE TABLE public.tareas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  estado public.estado_tarea NOT NULL DEFAULT 'pendiente',
  responsable_id UUID REFERENCES auth.users(id),
  fecha_inicio DATE,
  fecha_limite DATE,
  seccion TEXT DEFAULT 'General',
  creado_por UUID NOT NULL REFERENCES auth.users(id),
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tasks" ON public.tareas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.miembros_proyecto WHERE proyecto_id = tareas.proyecto_id AND usuario_id = auth.uid()));
CREATE POLICY "Members can create tasks" ON public.tareas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.miembros_proyecto WHERE proyecto_id = tareas.proyecto_id AND usuario_id = auth.uid()));
CREATE POLICY "Members can update tasks" ON public.tareas FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.miembros_proyecto WHERE proyecto_id = tareas.proyecto_id AND usuario_id = auth.uid()));
CREATE POLICY "Members can delete tasks" ON public.tareas FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.miembros_proyecto WHERE proyecto_id = tareas.proyecto_id AND usuario_id = auth.uid()));

-- Task activity log
CREATE TABLE public.actividad_tareas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tarea_id UUID NOT NULL REFERENCES public.tareas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  accion TEXT NOT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.actividad_tareas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view task activity" ON public.actividad_tareas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tareas t JOIN public.miembros_proyecto mp ON mp.proyecto_id = t.proyecto_id WHERE t.id = tarea_id AND mp.usuario_id = auth.uid()));
CREATE POLICY "Members can log task activity" ON public.actividad_tareas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfiles (user_id, nombre, email, color_avatar)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.email,
    public.random_avatar_color()
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION public.update_fecha_actualizacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.fecha_actualizacion = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_tareas_timestamp
  BEFORE UPDATE ON public.tareas
  FOR EACH ROW EXECUTE FUNCTION public.update_fecha_actualizacion();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tareas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.miembros_proyecto;

-- Indexes
CREATE INDEX idx_tareas_proyecto ON public.tareas(proyecto_id);
CREATE INDEX idx_tareas_responsable ON public.tareas(responsable_id);
CREATE INDEX idx_tareas_estado ON public.tareas(estado);
CREATE INDEX idx_miembros_usuario ON public.miembros_proyecto(usuario_id);
CREATE INDEX idx_miembros_proyecto ON public.miembros_proyecto(proyecto_id);