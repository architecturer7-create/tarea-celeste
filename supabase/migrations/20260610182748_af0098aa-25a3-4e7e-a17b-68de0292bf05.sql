
DROP POLICY IF EXISTS "Usuarios pueden unirse a si mismos" ON public.miembros_conversacion;

CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);
