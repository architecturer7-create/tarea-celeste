CREATE POLICY "Only owners can update members"
ON public.miembros_proyecto
FOR UPDATE
TO authenticated
USING (is_project_owner(auth.uid(), proyecto_id))
WITH CHECK (is_project_owner(auth.uid(), proyecto_id));