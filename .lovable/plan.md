## Añadir imagen / recorte de pantalla a la información de la tarea

En el panel de detalle de cada tarea aparecerá una sección "Imagen" con:

- **Vista previa** de la imagen ya guardada (si existe). Click → se abre en el visor con zoom (el mismo lightbox del chat).
- Botón **Adjuntar** con menú: "Imagen" (subir archivo) o "Capturar pantalla" (usa la captura del navegador y abre el editor con marcadores, idéntico al chat).
- Botón **Eliminar imagen** para quitar la actual.
- Mientras no guardes la tarea verás un preview del archivo nuevo seleccionado; al guardar se sube y reemplaza la anterior.

## Cambios técnicos

- Backend: ya está hecho — se añadió la columna `imagen_path` en `tareas`, se creó el bucket privado `tarea-archivos` y se aplicaron políticas para que solo los miembros del proyecto puedan ver/subir/borrar imágenes de las tareas de ese proyecto. Ruta de almacenamiento: `<proyecto_id>/<tarea_id>/<uuid>.<ext>`.
- Frontend: editar `src/components/TaskDetailDrawer.tsx` para integrar:
  - `ChatAttachControls` (ya existe) para los botones de adjuntar / capturar.
  - `ScreenshotAnnotator` (ya existe) para añadir marcas a la captura.
  - `ImageLightbox` (ya existe) para abrir la imagen con zoom.
  - Subida con `supabase.storage.from('tarea-archivos').upload(...)` y borrado de la anterior al reemplazar.
- No se toca `CreateTaskModal` en esta primera versión: la imagen se añade desde el detalle después de crear la tarea (más simple y suficiente). Si lo prefieres también lo añado al crear.

## Archivos a editar

- `src/components/TaskDetailDrawer.tsx` (única edición de UI).

## Limitaciones

- Una sola imagen por tarea (la nueva reemplaza a la anterior). Si quieres varias adjuntas, lo trato como una segunda iteración con una tabla `tareas_archivos`.
