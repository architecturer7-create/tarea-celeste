CREATE OR REPLACE FUNCTION public.duplicar_proyecto(
  _proyecto_id uuid,
  _nombre text,
  _incluir_tareas boolean DEFAULT true,
  _incluir_planos boolean DEFAULT true,
  _incluir_timeline boolean DEFAULT true,
  _incluir_miembros boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _nuevo_id uuid;
  _color text;
  _map jsonb := '{}'::jsonb;
  _p record;
  _nueva_partida uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF NOT is_project_member(_me, _proyecto_id) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _nombre IS NULL OR length(trim(_nombre)) = 0 THEN RAISE EXCEPTION 'Nombre requerido'; END IF;

  SELECT color INTO _color FROM public.proyectos WHERE id = _proyecto_id;

  INSERT INTO public.proyectos (nombre, color, creado_por)
  VALUES (trim(_nombre), COALESCE(_color, '#6366F1'), _me)
  RETURNING id INTO _nuevo_id;

  INSERT INTO public.miembros_proyecto (proyecto_id, usuario_id, rol)
  VALUES (_nuevo_id, _me, 'propietario');

  IF _incluir_miembros THEN
    INSERT INTO public.miembros_proyecto (proyecto_id, usuario_id, rol)
    SELECT _nuevo_id, mp.usuario_id, 'miembro'::rol_miembro
    FROM public.miembros_proyecto mp
    WHERE mp.proyecto_id = _proyecto_id AND mp.usuario_id <> _me;
  END IF;

  -- partidas (siempre que se copien planos o timeline)
  IF _incluir_planos OR _incluir_timeline THEN
    FOR _p IN SELECT * FROM public.partidas_planos WHERE proyecto_id = _proyecto_id ORDER BY orden LOOP
      INSERT INTO public.partidas_planos (proyecto_id, nombre, color, orden, creado_por)
      VALUES (_nuevo_id, _p.nombre, _p.color, _p.orden, _me)
      RETURNING id INTO _nueva_partida;
      _map := _map || jsonb_build_object(_p.id::text, _nueva_partida::text);
    END LOOP;
  END IF;

  IF _incluir_planos THEN
    INSERT INTO public.planos (proyecto_id, partida_id, codigo, nombre, entregado, notas, creado_por, responsable_id, pre_entrega, finalizado)
    SELECT _nuevo_id, (_map->>pl.partida_id::text)::uuid, pl.codigo, pl.nombre, false, pl.notas, _me,
           CASE WHEN _incluir_miembros THEN pl.responsable_id ELSE NULL END, false, false
    FROM public.planos pl
    WHERE pl.proyecto_id = _proyecto_id AND _map ? pl.partida_id::text;
  END IF;

  IF _incluir_timeline THEN
    INSERT INTO public.timeline_partidas (proyecto_id, partida_id, fecha_inicio, fecha_fin, responsable_id, creado_por)
    SELECT _nuevo_id, (_map->>tp.partida_id::text)::uuid, tp.fecha_inicio, tp.fecha_fin,
           CASE WHEN _incluir_miembros THEN tp.responsable_id ELSE NULL END, _me
    FROM public.timeline_partidas tp
    WHERE tp.proyecto_id = _proyecto_id AND _map ? tp.partida_id::text;
  END IF;

  IF _incluir_tareas THEN
    INSERT INTO public.tareas (proyecto_id, titulo, descripcion, estado, prioridad, responsable_id, fecha_inicio, fecha_limite, seccion, creado_por)
    SELECT _nuevo_id, t.titulo, t.descripcion, 'pendiente'::estado_tarea, t.prioridad,
           CASE WHEN _incluir_miembros THEN t.responsable_id ELSE NULL END,
           t.fecha_inicio, t.fecha_limite, t.seccion, _me
    FROM public.tareas t
    WHERE t.proyecto_id = _proyecto_id;
  END IF;

  RETURN _nuevo_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.duplicar_proyecto(uuid, text, boolean, boolean, boolean, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.duplicar_proyecto(uuid, text, boolean, boolean, boolean, boolean) TO authenticated;