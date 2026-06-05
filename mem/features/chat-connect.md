---
name: Chat Connect
description: Pestaña Connect en cada proyecto con chat interno en tiempo real y envío de archivos en formato original
type: feature
---
- Tabla `chat_mensajes` con RLS por miembro de proyecto; DELETE solo autor.
- Realtime habilitado en `chat_mensajes`.
- Bucket privado `chat-archivos` organizado por `{proyecto_id}/{uuid}.ext`; descarga vía signed URL.
- UI en `src/components/ConnectView.tsx`. Burbujas con gradiente primary→negro para mensajes propios.