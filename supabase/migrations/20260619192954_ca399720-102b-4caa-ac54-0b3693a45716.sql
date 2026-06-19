
-- Remove the security-definer view (linter flagged it); use column-level grants instead.
DROP VIEW IF EXISTS public.perfiles_publicos;

-- Restore co-member visibility (non-email columns are protected via column GRANTs below).
DROP POLICY IF EXISTS "Users can view own profile" ON public.perfiles;
CREATE POLICY "Users can view own or co-member profiles"
ON public.perfiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.miembros_proyecto m1
    JOIN public.miembros_proyecto m2 ON m1.proyecto_id = m2.proyecto_id
    WHERE m1.usuario_id = auth.uid() AND m2.usuario_id = perfiles.user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.miembros_conversacion c1
    JOIN public.miembros_conversacion c2 ON c1.conversacion_id = c2.conversacion_id
    WHERE c1.usuario_id = auth.uid() AND c2.usuario_id = perfiles.user_id
  )
);

-- Hide the email column from client reads. ProfilePage uses auth.user().email for the signed-in user.
REVOKE SELECT ON public.perfiles FROM authenticated, anon;
GRANT SELECT (id, user_id, nombre, avatar_url, color_avatar, created_at) ON public.perfiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.perfiles TO authenticated;
GRANT ALL ON public.perfiles TO service_role;
