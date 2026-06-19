
ALTER TABLE public.tareas ADD COLUMN IF NOT EXISTS imagen_path text;

-- RLS: solo miembros del proyecto al que pertenece la tarea pueden ver/subir/borrar
-- Ruta esperada: <proyecto_id>/<tarea_id>/<archivo>

CREATE POLICY "Miembros pueden ver imagenes de tareas"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'tarea-archivos'
  AND public.is_project_member(auth.uid(), (split_part(name, '/', 1))::uuid)
);

CREATE POLICY "Miembros pueden subir imagenes de tareas"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tarea-archivos'
  AND public.is_project_member(auth.uid(), (split_part(name, '/', 1))::uuid)
);

CREATE POLICY "Miembros pueden actualizar imagenes de tareas"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tarea-archivos'
  AND public.is_project_member(auth.uid(), (split_part(name, '/', 1))::uuid)
);

CREATE POLICY "Miembros pueden borrar imagenes de tareas"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tarea-archivos'
  AND public.is_project_member(auth.uid(), (split_part(name, '/', 1))::uuid)
);
