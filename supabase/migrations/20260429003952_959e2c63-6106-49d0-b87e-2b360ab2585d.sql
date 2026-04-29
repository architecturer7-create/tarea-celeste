CREATE TABLE public.timeline_partidas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id uuid NOT NULL,
  nombre text NOT NULL,
  seccion text NOT NULL DEFAULT 'General',
  fecha_inicio date NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '7 days'),
  responsable_id uuid,
  color text NOT NULL DEFAULT '#6366F1',
  orden integer NOT NULL DEFAULT 0,
  creado_por uuid NOT NULL,
  fecha_creacion timestamp with time zone NOT NULL DEFAULT now(),
  fecha_actualizacion timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.timeline_partidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view timeline" ON public.timeline_partidas
  FOR SELECT TO authenticated
  USING (is_project_member(auth.uid(), proyecto_id));

CREATE POLICY "Members create timeline" ON public.timeline_partidas
  FOR INSERT TO authenticated
  WITH CHECK (is_project_member(auth.uid(), proyecto_id) AND auth.uid() = creado_por);

CREATE POLICY "Members update timeline" ON public.timeline_partidas
  FOR UPDATE TO authenticated
  USING (is_project_member(auth.uid(), proyecto_id));

CREATE POLICY "Members delete timeline" ON public.timeline_partidas
  FOR DELETE TO authenticated
  USING (is_project_member(auth.uid(), proyecto_id));

CREATE TRIGGER update_timeline_partidas_fecha
  BEFORE UPDATE ON public.timeline_partidas
  FOR EACH ROW EXECUTE FUNCTION public.update_fecha_actualizacion();

CREATE INDEX idx_timeline_partidas_proyecto ON public.timeline_partidas(proyecto_id);