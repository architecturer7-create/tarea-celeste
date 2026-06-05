
CREATE POLICY "Members can view chat files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-archivos'
    AND public.is_project_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Members can upload chat files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-archivos'
    AND public.is_project_member(auth.uid(), (storage.foldername(name))[1]::uuid)
    AND owner = auth.uid()
  );

CREATE POLICY "Owners can delete own chat files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-archivos'
    AND owner = auth.uid()
  );
