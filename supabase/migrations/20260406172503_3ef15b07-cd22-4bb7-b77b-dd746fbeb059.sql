
-- 1. Fix miembros_proyecto INSERT policy: remove self-join clause
DROP POLICY IF EXISTS "Owner can add members" ON public.miembros_proyecto;
CREATE POLICY "Owner can add members" ON public.miembros_proyecto
  FOR INSERT TO authenticated
  WITH CHECK (is_project_owner(auth.uid(), proyecto_id));

-- 2. Fix actividad_tareas INSERT policy: add project membership check
DROP POLICY IF EXISTS "Members can log task activity" ON public.actividad_tareas;
CREATE POLICY "Members can log task activity" ON public.actividad_tareas
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = usuario_id
    AND EXISTS (
      SELECT 1 FROM tareas t
      WHERE t.id = tarea_id
        AND is_project_member(auth.uid(), t.proyecto_id)
    )
  );

-- 3. Restrict perfiles SELECT to co-project-members + own profile
DROP POLICY IF EXISTS "Users can view all profiles" ON public.perfiles;
CREATE POLICY "Users can view own or co-member profiles" ON public.perfiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.miembros_proyecto m1
      JOIN public.miembros_proyecto m2 ON m1.proyecto_id = m2.proyecto_id
      WHERE m1.usuario_id = auth.uid()
        AND m2.usuario_id = perfiles.user_id
    )
  );

-- 4. Create secure RPC for invite-by-email lookup (so we don't need broad profile access)
CREATE OR REPLACE FUNCTION public.buscar_usuario_por_email(_email text, _proyecto_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  -- Only project owners can look up users by email
  IF NOT is_project_owner(auth.uid(), _proyecto_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT user_id INTO _user_id
  FROM public.perfiles
  WHERE email = _email
  LIMIT 1;

  RETURN _user_id;
END;
$$;
