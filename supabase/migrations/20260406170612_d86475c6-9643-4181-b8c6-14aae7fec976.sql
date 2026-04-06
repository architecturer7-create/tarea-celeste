CREATE OR REPLACE FUNCTION public.crear_proyecto(_nombre text, _color text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _proyecto_id uuid;
BEGIN
  INSERT INTO public.proyectos (nombre, color, creado_por)
  VALUES (_nombre, _color, auth.uid())
  RETURNING id INTO _proyecto_id;

  INSERT INTO public.miembros_proyecto (proyecto_id, usuario_id, rol)
  VALUES (_proyecto_id, auth.uid(), 'propietario');

  RETURN _proyecto_id;
END;
$$;