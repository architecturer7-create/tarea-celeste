## Objetivo
Agregar una nueva pestaña **Connect** después de **Miro** en el detalle del proyecto, con un chat interno entre los miembros del proyecto y soporte para enviar archivos en su formato original.

## Alcance funcional
- Chat por proyecto, accesible solo a miembros (RLS).
- Mensajes de texto en tiempo real (Realtime).
- Envío de archivos adjuntos en formato original (PDF, DWG, imágenes, ZIP, etc.).
- Avatar + nombre + hora del remitente. Burbujas estilo dark futurista (gradientes ya usados).
- Scroll automático al último mensaje, indicador "enviando", borrar mensaje propio.
- Mostrar archivo: imágenes en preview inline, otros tipos como tarjeta con icono + nombre + tamaño + botón descargar.

## Cambios técnicos

### Backend (migración)
1. Tabla `chat_mensajes`:
   - `id uuid PK`, `proyecto_id uuid`, `autor_id uuid`, `contenido text`, `archivo_url text null`, `archivo_nombre text null`, `archivo_tipo text null`, `archivo_tamano bigint null`, `fecha timestamptz default now()`.
2. GRANTs (`authenticated`, `service_role`) + RLS:
   - SELECT/INSERT solo miembros del proyecto (`is_project_member`).
   - DELETE solo autor.
3. `ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_mensajes` + `REPLICA IDENTITY FULL`.
4. Bucket de Storage `chat-archivos` (privado) con políticas:
   - INSERT/SELECT/DELETE restringidos a miembros del proyecto, path = `{proyecto_id}/{uuid}-{filename}`.

### Frontend
1. `src/components/ConnectView.tsx` — nuevo componente con:
   - Lista de mensajes (scrollable), input de texto, botón adjuntar archivo, botón enviar.
   - Suscripción Realtime a `chat_mensajes` filtrada por `proyecto_id`.
   - Upload a bucket `chat-archivos`, luego insert del mensaje con metadata.
2. `src/pages/ProjectDetailPage.tsx` — añadir tab **Connect** después de **Miro**, con icono `MessageCircle` de lucide.
3. `src/lib/types.ts` — tipo `ChatMensaje`.
4. Reutilizar `UserAvatar` y tokens del design system (sin colores hardcoded).

## Notas
- Los archivos viajan vía Signed URLs para descarga.
- Sin límite explícito de tamaño en UI (queda al límite del bucket).
- No se editan mensajes, solo borrar el propio.
