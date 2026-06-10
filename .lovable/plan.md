# Notificaciones globales de mensajes

Objetivo: que desde cualquier pantalla de la app el usuario vea (1) un contador global de mensajes no leídos en la pestaña **Mensajes**, y (2) un toast emergente cuando llegue un mensaje nuevo, que al tocarlo abra la conversación correspondiente.

## Alcance

Cubre los 3 tipos de chat que ya existen:
- Chats directos 1-a-1 (`mensajes_conversacion` tipo `directo`)
- Grupos personalizados (`mensajes_conversacion` tipo `grupo`)
- Connect de cada proyecto (`chat_mensajes`)

No incluye notificaciones push del sistema operativo (eso ya existe aparte vía `send-push`). Esto es solo dentro de la app abierta.

## 1. Badge global en la pestaña "Mensajes"

- Nuevo hook `useGlobalUnread()` montado en `AppLayout` (vive mientras la app está abierta).
- Calcula no leídos sumando:
  - **Conversaciones globales:** para cada conversación donde soy miembro, cuenta mensajes con `fecha > miembros_conversacion.fecha_ultima_lectura` y `autor_id <> yo`.
  - **Connect de proyectos:** para cada proyecto donde soy miembro, cuenta `chat_mensajes` con `fecha > last_seen_local` y `autor_id <> yo` (reusa el `localStorage` que ya usa `useUnreadChat`).
- Se actualiza en tiempo real suscribiéndose a `INSERT` en `mensajes_conversacion` y `chat_mensajes` mediante un canal Realtime único.
- Cuando estás dentro de una conversación, esa conversación deja de contar (la página ya marca como leído).
- El badge se muestra como punto rojo con número (máx. "9+") junto al ícono "Mensajes" en la barra inferior (móvil) y en la nav superior (desktop) dentro de `AppLayout.tsx`.

## 2. Toast emergente con navegación

- En el mismo hook, cuando llegue un `INSERT` nuevo:
  - Ignorar si el autor soy yo.
  - Ignorar si ya estoy viendo esa conversación (ruta actual `/mensajes/:id` o `/proyecto/:id?tab=connect`).
  - Resolver nombre del remitente y vista previa del mensaje (primeros ~80 caracteres).
  - Mostrar `toast()` de **sonner** con título (nombre del chat o remitente), descripción (preview) y acción "Ver" que navega a:
    - `/mensajes/<conversacion_id>` para chats directos/grupos
    - `/proyecto/<proyecto_id>?tab=connect` para Connect
  - Tocar el cuerpo del toast también navega (handler en `onClick`).
- Para evitar spam, agrupar: si llegan varios mensajes de la misma conversación en <5 s, se actualiza el mismo toast en vez de apilar varios.

## Cambios técnicos

- **Nuevos archivos:**
  - `src/hooks/useGlobalUnread.ts` — suscripciones Realtime + cálculo global + emisión de toasts.
- **Archivos editados:**
  - `src/components/AppLayout.tsx` — montar el hook, renderizar badge en el tab "Mensajes" (móvil y desktop).
  - `src/pages/ConversationPage.tsx` — exponer "estoy viendo X" vía el pathname (ya lo hace; basta con leer `useLocation` desde el hook, sin cambios reales).
  - `src/hooks/useUnreadChat.ts` — exportar helper para listar proyectos con `last_seen` (opcional, puede quedar autoincluido en el nuevo hook).
- **Migración Supabase:** habilitar Realtime para `mensajes_conversacion` y `chat_mensajes` (añadirlas a `supabase_realtime` publication si no lo están).

## Consideraciones

- El hook solo corre cuando hay sesión iniciada (chequea `useAuth().user`).
- Las suscripciones se limpian al desmontar o al cerrar sesión.
- RLS ya filtra: el cliente solo recibe eventos de conversaciones donde es miembro y de proyectos donde pertenece.
- Idioma: textos del toast en español ("Nuevo mensaje", "Ver", etc.).
