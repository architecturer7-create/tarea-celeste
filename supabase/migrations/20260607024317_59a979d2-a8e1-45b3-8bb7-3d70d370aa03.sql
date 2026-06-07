-- Revoke EXECUTE from anon/PUBLIC on all SECURITY DEFINER functions in public schema.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_miro_on_proyecto_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_timeline_on_partida_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crear_proyecto(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.buscar_usuario_por_email(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_project_owner(uuid, uuid) FROM PUBLIC, anon;

-- Keep EXECUTE only where strictly needed.
GRANT EXECUTE ON FUNCTION public.crear_proyecto(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_usuario_por_email(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_owner(uuid, uuid) TO authenticated;