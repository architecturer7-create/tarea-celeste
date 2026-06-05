
CREATE TABLE public.chat_mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL,
  autor_id uuid NOT NULL,
  contenido text NOT NULL DEFAULT '',
  archivo_path text,
  archivo_nombre text,
  archivo_tipo text,
  archivo_tamano bigint,
  fecha timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_mensajes_proyecto_fecha ON public.chat_mensajes(proyecto_id, fecha);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_mensajes TO authenticated;
GRANT ALL ON public.chat_mensajes TO service_role;

ALTER TABLE public.chat_mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view chat"
  ON public.chat_mensajes FOR SELECT
  TO authenticated
  USING (public.is_project_member(auth.uid(), proyecto_id));

CREATE POLICY "Members can send chat"
  ON public.chat_mensajes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_member(auth.uid(), proyecto_id) AND auth.uid() = autor_id);

CREATE POLICY "Authors can delete own messages"
  ON public.chat_mensajes FOR DELETE
  TO authenticated
  USING (auth.uid() = autor_id);

ALTER TABLE public.chat_mensajes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_mensajes;
