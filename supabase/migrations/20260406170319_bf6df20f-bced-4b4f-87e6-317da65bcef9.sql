-- Fix 1: RLS policies on proyectos reference wrong column (miembros_proyecto.id instead of proyectos.id)
DROP POLICY IF EXISTS "Members can view projects" ON public.proyectos;
DROP POLICY IF EXISTS "Owner can update project" ON public.proyectos;
DROP POLICY IF EXISTS "Owner can delete project" ON public.proyectos;

CREATE POLICY "Members can view projects" ON public.proyectos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM miembros_proyecto mp
    WHERE mp.proyecto_id = proyectos.id AND mp.usuario_id = auth.uid()
  ));

CREATE POLICY "Owner can update project" ON public.proyectos
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM miembros_proyecto mp
    WHERE mp.proyecto_id = proyectos.id AND mp.usuario_id = auth.uid() AND mp.rol = 'propietario'
  ));

CREATE POLICY "Owner can delete project" ON public.proyectos
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM miembros_proyecto mp
    WHERE mp.proyecto_id = proyectos.id AND mp.usuario_id = auth.uid() AND mp.rol = 'propietario'
  ));

-- Fix 2: Create the missing trigger for auto-creating profiles on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();