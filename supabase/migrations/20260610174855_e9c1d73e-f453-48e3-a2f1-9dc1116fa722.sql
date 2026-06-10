-- 1. Remove weaker DELETE policy on chat_mensajes (keeps the project-member-scoped one)
DROP POLICY IF EXISTS "Authors can delete own messages" ON public.chat_mensajes;

-- 2. Replace permissive member-insert policy on miembros_conversacion
DROP POLICY IF EXISTS "Insertar miembros en mis conversaciones" ON public.miembros_conversacion;
DROP POLICY IF EXISTS "Solo el creador puede agregar miembros directamente" ON public.miembros_conversacion;

CREATE POLICY "Usuarios pueden unirse a si mismos"
ON public.miembros_conversacion
FOR INSERT
TO authenticated
WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Creador puede agregar miembros"
ON public.miembros_conversacion
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversaciones c
    WHERE c.id = miembros_conversacion.conversacion_id
      AND c.creado_por = auth.uid()
  )
);

-- 3. Revoke public/anon execute on internal trigger function
REVOKE EXECUTE ON FUNCTION public.actualizar_fecha_ultimo_mensaje() FROM PUBLIC, anon, authenticated;
