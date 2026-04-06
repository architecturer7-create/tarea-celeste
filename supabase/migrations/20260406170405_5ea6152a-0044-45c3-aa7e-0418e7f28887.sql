-- Create security definer function to check project membership without recursion
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _proyecto_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.miembros_proyecto
    WHERE usuario_id = _user_id AND proyecto_id = _proyecto_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_project_owner(_user_id uuid, _proyecto_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.miembros_proyecto
    WHERE usuario_id = _user_id AND proyecto_id = _proyecto_id AND rol = 'propietario'
  )
$$;

-- Fix miembros_proyecto policies using security definer
DROP POLICY IF EXISTS "Members can view project members" ON public.miembros_proyecto;
DROP POLICY IF EXISTS "Owner can add members" ON public.miembros_proyecto;
DROP POLICY IF EXISTS "Owner can remove members" ON public.miembros_proyecto;

CREATE POLICY "Members can view project members" ON public.miembros_proyecto
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), proyecto_id));

CREATE POLICY "Owner can add members" ON public.miembros_proyecto
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(auth.uid(), proyecto_id) OR auth.uid() = usuario_id);

CREATE POLICY "Owner can remove members" ON public.miembros_proyecto
  FOR DELETE TO authenticated
  USING (public.is_project_owner(auth.uid(), proyecto_id));

-- Fix proyectos policies to use security definer too
DROP POLICY IF EXISTS "Members can view projects" ON public.proyectos;
DROP POLICY IF EXISTS "Owner can update project" ON public.proyectos;
DROP POLICY IF EXISTS "Owner can delete project" ON public.proyectos;

CREATE POLICY "Members can view projects" ON public.proyectos
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), id));

CREATE POLICY "Owner can update project" ON public.proyectos
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(auth.uid(), id));

CREATE POLICY "Owner can delete project" ON public.proyectos
  FOR DELETE TO authenticated
  USING (public.is_project_owner(auth.uid(), id));

-- Fix tareas policies to use security definer
DROP POLICY IF EXISTS "Members can view tasks" ON public.tareas;
DROP POLICY IF EXISTS "Members can create tasks" ON public.tareas;
DROP POLICY IF EXISTS "Members can update tasks" ON public.tareas;
DROP POLICY IF EXISTS "Members can delete tasks" ON public.tareas;

CREATE POLICY "Members can view tasks" ON public.tareas
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), proyecto_id));

CREATE POLICY "Members can create tasks" ON public.tareas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(auth.uid(), proyecto_id));

CREATE POLICY "Members can update tasks" ON public.tareas
  FOR UPDATE TO authenticated
  USING (public.is_project_member(auth.uid(), proyecto_id));

CREATE POLICY "Members can delete tasks" ON public.tareas
  FOR DELETE TO authenticated
  USING (public.is_project_member(auth.uid(), proyecto_id));

-- Fix actividad_tareas SELECT policy
DROP POLICY IF EXISTS "Members can view task activity" ON public.actividad_tareas;

CREATE POLICY "Members can view task activity" ON public.actividad_tareas
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tareas t
    WHERE t.id = actividad_tareas.tarea_id
    AND public.is_project_member(auth.uid(), t.proyecto_id)
  ));