-- 1. Lock down SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_miro_on_proyecto_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_timeline_on_partida_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_fecha_actualizacion() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.random_avatar_color() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.crear_proyecto(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_proyecto(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.buscar_usuario_por_email(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_usuario_por_email(text, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_project_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_project_owner(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated;

-- 2. Avatars bucket: remove broad public SELECT listing policy (public bucket flag still serves files directly)
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

CREATE POLICY "Authenticated can view avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

-- 3. Allow users to delete their own avatar files
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Lock down realtime broadcast/presence (we use postgres_changes which is governed by table RLS)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
