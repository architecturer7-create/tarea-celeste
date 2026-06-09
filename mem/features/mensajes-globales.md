---
name: Mensajes globales
description: Sección Mensajes con chats 1-a-1, grupos libres entre usuarios, y vista de chats de proyecto en una bandeja unificada
type: feature
---
- Tablas `conversaciones` (tipo directo/grupo), `miembros_conversacion` (con `fecha_ultima_lectura`), `mensajes_conversacion`. Realtime habilitado en las tres.
- RPCs `crear_chat_directo(_otro_usuario_id)` (idempotente para 1-a-1) y `crear_grupo(_nombre, _miembros uuid[])`.
- RLS vía `es_miembro_conversacion(_user_id, _conv_id)` SECURITY DEFINER.
- UI: `src/pages/MessagesPage.tsx` (bandeja unificada que mezcla conversaciones + chats de proyecto desde `chat_mensajes`), `src/pages/ConversationPage.tsx`, modales `NewChatModal` / `NewGroupModal`.
- Tab "Mensajes" añadido en `AppLayout`. El Connect del proyecto (`ConnectView`) sigue intacto.