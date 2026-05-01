CREATE TABLE public.proyecto_miro (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id uuid NOT NULL UNIQUE,
  miro_url text NOT NULL,
  miro_board_id text NOT NULL,
  actualizado_por uuid NOT NULL,
  fecha_actualizacion timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proyecto_miro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view miro"
  ON public.proyecto_miro FOR SELECT
  TO authenticated
  USING (public.is_project_member(auth.uid(), proyecto_id));

CREATE POLICY "Owners insert miro"
  ON public.proyecto_miro FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_owner(auth.uid(), proyecto_id) AND auth.uid() = actualizado_por);

CREATE POLICY "Owners update miro"
  ON public.proyecto_miro FOR UPDATE
  TO authenticated
  USING (public.is_project_owner(auth.uid(), proyecto_id))
  WITH CHECK (public.is_project_owner(auth.uid(), proyecto_id));

CREATE POLICY "Owners delete miro"
  ON public.proyecto_miro FOR DELETE
  TO authenticated
  USING (public.is_project_owner(auth.uid(), proyecto_id));

CREATE TRIGGER update_proyecto_miro_fecha
  BEFORE UPDATE ON public.proyecto_miro
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fecha_actualizacion();

CREATE OR REPLACE FUNCTION public.delete_miro_on_proyecto_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.proyecto_miro WHERE proyecto_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_delete_miro_on_proyecto_delete
  BEFORE DELETE ON public.proyectos
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_miro_on_proyecto_delete();