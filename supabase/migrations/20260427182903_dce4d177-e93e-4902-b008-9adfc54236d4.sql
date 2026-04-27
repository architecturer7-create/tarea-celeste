-- Tabla de partidas (categorías de planos) por proyecto
CREATE TABLE public.partidas_planos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id uuid NOT NULL,
  nombre text NOT NULL,
  color text NOT NULL DEFAULT '#6366F1',
  orden integer NOT NULL DEFAULT 0,
  creado_por uuid NOT NULL,
  fecha_creacion timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_partidas_proyecto ON public.partidas_planos(proyecto_id);

ALTER TABLE public.partidas_planos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view partidas" ON public.partidas_planos
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), proyecto_id));

CREATE POLICY "Members create partidas" ON public.partidas_planos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(auth.uid(), proyecto_id) AND auth.uid() = creado_por);

CREATE POLICY "Members update partidas" ON public.partidas_planos
  FOR UPDATE TO authenticated
  USING (public.is_project_member(auth.uid(), proyecto_id));

CREATE POLICY "Members delete partidas" ON public.partidas_planos
  FOR DELETE TO authenticated
  USING (public.is_project_member(auth.uid(), proyecto_id));

-- Tabla de planos
CREATE TABLE public.planos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id uuid NOT NULL,
  partida_id uuid NOT NULL REFERENCES public.partidas_planos(id) ON DELETE CASCADE,
  codigo text NOT NULL DEFAULT '',
  nombre text NOT NULL,
  entregado boolean NOT NULL DEFAULT false,
  fecha_entrega timestamptz,
  notas text,
  creado_por uuid NOT NULL,
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  fecha_actualizacion timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_planos_proyecto ON public.planos(proyecto_id);
CREATE INDEX idx_planos_partida ON public.planos(partida_id);

ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view planos" ON public.planos
  FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), proyecto_id));

CREATE POLICY "Members create planos" ON public.planos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(auth.uid(), proyecto_id) AND auth.uid() = creado_por);

CREATE POLICY "Members update planos" ON public.planos
  FOR UPDATE TO authenticated
  USING (public.is_project_member(auth.uid(), proyecto_id));

CREATE POLICY "Members delete planos" ON public.planos
  FOR DELETE TO authenticated
  USING (public.is_project_member(auth.uid(), proyecto_id));

CREATE TRIGGER planos_update_fecha
  BEFORE UPDATE ON public.planos
  FOR EACH ROW EXECUTE FUNCTION public.update_fecha_actualizacion();

ALTER PUBLICATION supabase_realtime ADD TABLE public.partidas_planos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.planos;