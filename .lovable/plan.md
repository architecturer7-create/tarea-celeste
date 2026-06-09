
# Plan — Mensajes globales (Fase 1 / MVP)

## Objetivo
Nueva sección **Mensajes** en el menú principal (junto a Inicio, Mis Tareas, Perfil) tipo LINE/WhatsApp, con:
- Chats 1‑a‑1 entre cualquier par de usuarios registrados.
- Grupos creados libremente con cualquier usuario registrado.
- Los chats de proyecto (Connect actual) aparecen también en esta bandeja como conversación "de proyecto", para enterarse sin entrar al proyecto.
- El Connect dentro del proyecto sigue funcionando exactamente igual (misma tabla, mismos mensajes).

## Alcance Fase 1
Incluye:
- Lista unificada de conversaciones (1‑a‑1, grupos, proyectos) ordenada por último mensaje, con preview, hora y contador de no leídos.
- Apertura de conversación: mensajes en tiempo real, envío de texto, autoscroll, burbujas estilo Connect actual.
- Crear chat 1‑a‑1: buscador de usuarios por nombre/email.
- Crear grupo: nombre + selección múltiple de miembros, salir del grupo, renombrar (solo creador).
- Contador de no leídos por conversación y badge global en la pestaña.
- Los chats de proyecto se muestran con el color/nombre del proyecto y al abrirlos navegan al Connect del proyecto (reutilizando lo ya hecho), sin duplicar UI.

No incluye (fases siguientes): adjuntos en chats globales, reacciones, edición, indicador "escribiendo…", llamadas, búsqueda dentro de chat, notificaciones push (se puede sumar luego usando la infra ya existente).

## Cambios de datos (backend)

Tablas nuevas en `public`:

1. `conversaciones`
   - `id`, `tipo` (`directo` | `grupo`), `nombre` (solo grupos), `creado_por`, `fecha_creacion`, `fecha_ultimo_mensaje`.
2. `miembros_conversacion`
   - `conversacion_id`, `usuario_id`, `fecha_union`, `fecha_ultima_lectura`. PK compuesta.
3. `mensajes_conversacion`
   - `id`, `conversacion_id`, `autor_id`, `contenido`, `fecha`.

Reglas:
- RLS estricta: solo miembros de la conversación leen/escriben sus mensajes.
- Función `es_miembro_conversacion(_user, _conv)` SECURITY DEFINER para evitar recursión.
- RPC `crear_chat_directo(_otro_usuario_id)` que devuelve la conversación existente o crea una nueva (evita duplicados de 1‑a‑1).
- RPC `crear_grupo(_nombre, _miembros uuid[])` que crea la conversación + inserta miembros + añade al creador.
- Trigger en `mensajes_conversacion` que actualiza `fecha_ultimo_mensaje` de la conversación.
- `ALTER PUBLICATION supabase_realtime ADD TABLE` para `mensajes_conversacion` y `miembros_conversacion`.
- GRANTs `SELECT/INSERT/UPDATE/DELETE` a `authenticated` y `ALL` a `service_role` en las tres tablas.

Bandeja unificada (sin tabla adicional):
- La lista combina en el cliente:
  - Conversaciones donde el usuario es miembro (`miembros_conversacion`).
  - Proyectos donde el usuario es miembro (`miembros_proyecto`) — para mostrar el Connect del proyecto.
- Para los proyectos se reutiliza `chat_mensajes` (último mensaje + no leídos basados en el `localStorage` ya usado por `useUnreadChat`).

## Cambios de frontend

Rutas nuevas en `src/App.tsx`:
- `/mensajes` → `MessagesPage` (lista).
- `/mensajes/:conversacionId` → `ConversationPage` (chat 1‑a‑1 o grupo).
- Los proyectos no necesitan ruta nueva: desde la lista se navega a `/proyecto/:id` y se abre el tab Connect.

Nuevos archivos:
- `src/pages/MessagesPage.tsx` — bandeja unificada con tabs opcionales (Todos / Directos / Grupos / Proyectos) o lista única ordenada.
- `src/pages/ConversationPage.tsx` — vista de chat reutilizando estilo de `ConnectView`.
- `src/components/NewChatModal.tsx` — crear 1‑a‑1 (buscador de usuarios).
- `src/components/NewGroupModal.tsx` — crear grupo (nombre + multi‑select).
- `src/hooks/useConversations.ts` — fetch + realtime de conversaciones del usuario.
- `src/hooks/useConversationMessages.ts` — fetch + realtime de mensajes y marcar como leído (actualizando `fecha_ultima_lectura`).
- `src/hooks/useGlobalUnread.ts` — agrega no leídos de todas las conversaciones + chats de proyecto para el badge global.

Cambios en archivos existentes:
- `src/components/AppLayout.tsx`: añadir tab "Mensajes" (icono `MessageCircle`) en nav desktop y bottom nav móvil, con badge de no leídos global.
- (Opcional menor) Sin cambios en `ConnectView.tsx`.

## UX
- Lista: avatar (UserAvatar para directos, iniciales/grupo para grupos, color del proyecto para Connect), nombre, preview del último mensaje, hora relativa, contador no leídos.
- Conversación: header con nombre + miembros (en grupo), burbujas idénticas a Connect, input fijo abajo, safe‑area iOS.
- Crear: FAB "+" en `MessagesPage` con dos opciones (Nuevo chat / Nuevo grupo).
- Idioma: todo en español. Estética dark futurista existente.

## Riesgos / consideraciones
- Bandeja unificada hace dos queries (conversaciones + proyectos) y las mezcla en cliente — sencillo y suficiente para el volumen actual.
- No leídos de proyectos siguen viviendo en `localStorage` (consistente con lo actual); migrar a server side queda para fase 2.
- RLS de mensajes_conversacion usa función security definer para evitar recursión con `miembros_conversacion`.

## Entregable Fase 1
Sección Mensajes operativa con 1‑a‑1, grupos, vista de chats de proyecto en la misma bandeja, realtime, contador global, sin tocar el Connect actual.
