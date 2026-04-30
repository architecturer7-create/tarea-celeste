-- Limpiar datos previos (estructura cambia radicalmente)
DELETE FROM public.timeline_partidas;

-- Quitar columnas que ahora vienen de partidas_planos
ALTER TABLE public.timeline_partidas
  DROP COLUMN IF EXISTS nombre,
  DROP COLUMN IF EXISTS seccion,
  DROP COLUMN IF EXISTS color,
  DROP COLUMN IF EXISTS orden;

-- Agregar referencia a partida (1 a 1)
ALTER TABLE public.timeline_partidas
  ADD COLUMN partida_id uuid NOT NULL;

-- Una partida = una fila en el timeline
ALTER TABLE public.timeline_partidas
  ADD CONSTRAINT timeline_partidas_partida_unique UNIQUE (partida_id);

CREATE INDEX IF NOT EXISTS idx_timeline_partidas_proyecto ON public.timeline_partidas(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_timeline_partidas_partida ON public.timeline_partidas(partida_id);

-- Trigger: al borrar una partida de Sheets, se borra su fila de timeline
CREATE OR REPLACE FUNCTION public.delete_timeline_on_partida_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.timeline_partidas WHERE partida_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_timeline_on_partida_delete ON public.partidas_planos;
CREATE TRIGGER trg_delete_timeline_on_partida_delete
BEFORE DELETE ON public.partidas_planos
FOR EACH ROW
EXECUTE FUNCTION public.delete_timeline_on_partida_delete();