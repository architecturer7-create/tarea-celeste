-- Fix self-referencing RLS on miembros_proyecto SELECT
DROP POLICY IF EXISTS "Members can view project members" ON public.miembros_proyecto;

CREATE POLICY "Members can view project members" ON public.miembros_proyecto
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR EXISTS (
    SELECT 1 FROM miembros_proyecto mp2
    WHERE mp2.proyecto_id = miembros_proyecto.proyecto_id 
    AND mp2.usuario_id = auth.uid()
    AND mp2.id != miembros_proyecto.id
  ));