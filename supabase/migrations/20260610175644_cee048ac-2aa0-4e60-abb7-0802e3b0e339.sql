
ALTER TABLE public.mensajes_conversacion
  ADD COLUMN IF NOT EXISTS archivo_path text,
  ADD COLUMN IF NOT EXISTS archivo_nombre text,
  ADD COLUMN IF NOT EXISTS archivo_tipo text,
  ADD COLUMN IF NOT EXISTS archivo_tamano bigint,
  ALTER COLUMN contenido DROP NOT NULL;

ALTER TABLE public.mensajes_conversacion
  ADD CONSTRAINT mensajes_conversacion_contenido_o_archivo
  CHECK (
    (contenido IS NOT NULL AND length(trim(contenido)) > 0)
    OR archivo_path IS NOT NULL
  );

CREATE POLICY "Members can view conv files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'conversacion-archivos'
    AND public.es_miembro_conversacion(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Members can upload conv files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'conversacion-archivos'
    AND public.es_miembro_conversacion(auth.uid(), (storage.foldername(name))[1]::uuid)
    AND owner = auth.uid()
  );

CREATE POLICY "Owners can delete own conv files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'conversacion-archivos'
    AND owner = auth.uid()
  );
