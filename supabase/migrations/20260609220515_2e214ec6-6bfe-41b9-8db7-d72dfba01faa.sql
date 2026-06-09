
CREATE TABLE public.conversaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('directo','grupo')),
  nombre text,
  creado_por uuid NOT NULL,
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  fecha_ultimo_mensaje timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversaciones TO authenticated;
GRANT ALL ON public.conversaciones TO service_role;
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.miembros_conversacion (
  conversacion_id uuid NOT NULL REFERENCES public.conversaciones(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  fecha_union timestamptz NOT NULL DEFAULT now(),
  fecha_ultima_lectura timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversacion_id, usuario_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.miembros_conversacion TO authenticated;
GRANT ALL ON public.miembros_conversacion TO service_role;
ALTER TABLE public.miembros_conversacion ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mensajes_conversacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id uuid NOT NULL REFERENCES public.conversaciones(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL,
  contenido text NOT NULL,
  fecha timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensajes_conversacion TO authenticated;
GRANT ALL ON public.mensajes_conversacion TO service_role;
ALTER TABLE public.mensajes_conversacion ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_mensajes_convers_fecha ON public.mensajes_conversacion(conversacion_id, fecha DESC);
CREATE INDEX idx_miembros_convers_usuario ON public.miembros_conversacion(usuario_id);

CREATE OR REPLACE FUNCTION public.es_miembro_conversacion(_user_id uuid, _conv_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.miembros_conversacion WHERE usuario_id = _user_id AND conversacion_id = _conv_id)
$$;

CREATE POLICY "Ver conversaciones donde soy miembro" ON public.conversaciones
  FOR SELECT TO authenticated USING (public.es_miembro_conversacion(auth.uid(), id));
CREATE POLICY "Crear conversaciones propias" ON public.conversaciones
  FOR INSERT TO authenticated WITH CHECK (creado_por = auth.uid());
CREATE POLICY "Actualizar conversaciones si soy miembro" ON public.conversaciones
  FOR UPDATE TO authenticated USING (public.es_miembro_conversacion(auth.uid(), id));

CREATE POLICY "Ver miembros de mis conversaciones" ON public.miembros_conversacion
  FOR SELECT TO authenticated USING (public.es_miembro_conversacion(auth.uid(), conversacion_id));
CREATE POLICY "Insertar miembros en mis conversaciones" ON public.miembros_conversacion
  FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid() OR public.es_miembro_conversacion(auth.uid(), conversacion_id));
CREATE POLICY "Actualizar mi propia lectura" ON public.miembros_conversacion
  FOR UPDATE TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY "Salir de mis conversaciones" ON public.miembros_conversacion
  FOR DELETE TO authenticated USING (usuario_id = auth.uid());

CREATE POLICY "Ver mensajes de mis conversaciones" ON public.mensajes_conversacion
  FOR SELECT TO authenticated USING (public.es_miembro_conversacion(auth.uid(), conversacion_id));
CREATE POLICY "Enviar mensajes en mis conversaciones" ON public.mensajes_conversacion
  FOR INSERT TO authenticated WITH CHECK (autor_id = auth.uid() AND public.es_miembro_conversacion(auth.uid(), conversacion_id));
CREATE POLICY "Borrar mis mensajes" ON public.mensajes_conversacion
  FOR DELETE TO authenticated USING (autor_id = auth.uid());

CREATE OR REPLACE FUNCTION public.actualizar_fecha_ultimo_mensaje()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversaciones SET fecha_ultimo_mensaje = NEW.fecha WHERE id = NEW.conversacion_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_actualizar_ultimo_mensaje
AFTER INSERT ON public.mensajes_conversacion
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_ultimo_mensaje();

CREATE OR REPLACE FUNCTION public.crear_chat_directo(_otro_usuario_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _conv_id uuid; _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _otro_usuario_id = _me THEN RAISE EXCEPTION 'No puedes crear un chat contigo mismo'; END IF;

  SELECT c.id INTO _conv_id FROM public.conversaciones c
  WHERE c.tipo = 'directo'
    AND EXISTS (SELECT 1 FROM public.miembros_conversacion m1 WHERE m1.conversacion_id = c.id AND m1.usuario_id = _me)
    AND EXISTS (SELECT 1 FROM public.miembros_conversacion m2 WHERE m2.conversacion_id = c.id AND m2.usuario_id = _otro_usuario_id)
    AND (SELECT COUNT(*) FROM public.miembros_conversacion m WHERE m.conversacion_id = c.id) = 2
  LIMIT 1;

  IF _conv_id IS NOT NULL THEN RETURN _conv_id; END IF;

  INSERT INTO public.conversaciones (tipo, creado_por) VALUES ('directo', _me) RETURNING id INTO _conv_id;
  INSERT INTO public.miembros_conversacion (conversacion_id, usuario_id)
  VALUES (_conv_id, _me), (_conv_id, _otro_usuario_id);
  RETURN _conv_id;
END; $$;

CREATE OR REPLACE FUNCTION public.crear_grupo(_nombre text, _miembros uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _conv_id uuid; _me uuid := auth.uid(); _uid uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _nombre IS NULL OR length(trim(_nombre)) = 0 THEN RAISE EXCEPTION 'Nombre requerido'; END IF;

  INSERT INTO public.conversaciones (tipo, nombre, creado_por) VALUES ('grupo', trim(_nombre), _me) RETURNING id INTO _conv_id;
  INSERT INTO public.miembros_conversacion (conversacion_id, usuario_id) VALUES (_conv_id, _me) ON CONFLICT DO NOTHING;

  IF _miembros IS NOT NULL THEN
    FOREACH _uid IN ARRAY _miembros LOOP
      IF _uid <> _me THEN
        INSERT INTO public.miembros_conversacion (conversacion_id, usuario_id) VALUES (_conv_id, _uid) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN _conv_id;
END; $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.mensajes_conversacion;
ALTER PUBLICATION supabase_realtime ADD TABLE public.miembros_conversacion;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversaciones;
