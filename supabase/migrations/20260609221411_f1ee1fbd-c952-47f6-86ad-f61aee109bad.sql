
-- Fix 1: Restrict INSERT on miembros_conversacion. RPCs (SECURITY DEFINER) handle legitimate inserts.
DROP POLICY IF EXISTS "Insertar miembros conversacion" ON public.miembros_conversacion;
DROP POLICY IF EXISTS "miembros_conversacion_insert" ON public.miembros_conversacion;
DROP POLICY IF EXISTS "Miembros pueden agregar a otros" ON public.miembros_conversacion;
DROP POLICY IF EXISTS "Usuarios pueden unirse" ON public.miembros_conversacion;

CREATE POLICY "Solo el creador puede agregar miembros directamente"
ON public.miembros_conversacion
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversaciones c
    WHERE c.id = conversacion_id AND c.creado_por = auth.uid()
  )
);

-- Fix 2: chat_mensajes DELETE requires current project membership
DROP POLICY IF EXISTS "Autores pueden eliminar sus mensajes" ON public.chat_mensajes;
DROP POLICY IF EXISTS "chat_mensajes_delete" ON public.chat_mensajes;
DROP POLICY IF EXISTS "Autor puede eliminar mensaje" ON public.chat_mensajes;

CREATE POLICY "Autores miembros pueden eliminar sus mensajes"
ON public.chat_mensajes
FOR DELETE
TO authenticated
USING (
  auth.uid() = autor_id
  AND public.is_project_member(auth.uid(), proyecto_id)
);

-- Fix 3: Add DELETE policy on conversaciones for creator
CREATE POLICY "Creador puede eliminar conversacion"
ON public.conversaciones
FOR DELETE
TO authenticated
USING (creado_por = auth.uid());

-- Fix 4: Revoke EXECUTE from anon/public on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_project_owner(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.crear_proyecto(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.buscar_usuario_por_email(text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.crear_grupo(text, uuid[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.crear_chat_directo(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.es_miembro_conversacion(uuid, uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_proyecto(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_usuario_por_email(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_grupo(text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_chat_directo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_miembro_conversacion(uuid, uuid) TO authenticated;
