
-- 1) Tighten perfiles SELECT to own row only
DROP POLICY IF EXISTS "Users can view own or co-member profiles" ON public.perfiles;
CREATE POLICY "Users can view own profile"
ON public.perfiles
FOR SELECT
USING (auth.uid() = user_id);

-- 2) Public-safe view (no email) accessible to co-members of project or conversation
CREATE OR REPLACE VIEW public.perfiles_publicos
WITH (security_invoker = false) AS
SELECT p.id, p.user_id, p.nombre, p.avatar_url, p.color_avatar, p.created_at
FROM public.perfiles p
WHERE p.user_id = auth.uid()
   OR EXISTS (
     SELECT 1 FROM public.miembros_proyecto m1
     JOIN public.miembros_proyecto m2 ON m1.proyecto_id = m2.proyecto_id
     WHERE m1.usuario_id = auth.uid() AND m2.usuario_id = p.user_id
   )
   OR EXISTS (
     SELECT 1 FROM public.miembros_conversacion c1
     JOIN public.miembros_conversacion c2 ON c1.conversacion_id = c2.conversacion_id
     WHERE c1.usuario_id = auth.uid() AND c2.usuario_id = p.user_id
   );

GRANT SELECT ON public.perfiles_publicos TO authenticated;

-- 3) Harden miembros_conversacion INSERT to require an existing perfil
DROP POLICY IF EXISTS "Creador puede agregar miembros" ON public.miembros_conversacion;
CREATE POLICY "Creador puede agregar miembros"
ON public.miembros_conversacion
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversaciones c
    WHERE c.id = miembros_conversacion.conversacion_id
      AND c.creado_por = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.user_id = miembros_conversacion.usuario_id
  )
);
