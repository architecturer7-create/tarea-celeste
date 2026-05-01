# Embeber Miro en cada proyecto

Una nueva pestaña **Miro** dentro de cada proyecto, junto a Tareas / Sheets / Timeline, donde se muestra un tablero de Miro embebido a pantalla completa. Cada proyecto tiene **un único tablero**, y **solo el propietario** puede configurarlo o cambiarlo.

## Cómo se verá

```text
[Tareas] [Sheets] [Timeline] [Miro]
┌─────────────────────────────────────┐
│                                     │
│      Tablero de Miro embebido       │
│      (iframe a pantalla completa)   │
│                                     │
└─────────────────────────────────────┘
```

Si aún no hay tablero configurado:
- **Propietario** → ve un input para pegar el enlace de Miro y un botón "Guardar".
- **Miembro** → ve un mensaje "El propietario aún no ha configurado un tablero de Miro".

Una vez configurado, el propietario puede en cualquier momento "Cambiar enlace" o "Quitar tablero" desde un botón discreto en la esquina superior.

## Cómo funciona el embed

Miro permite embeber un tablero con un iframe apuntando a:
```
https://miro.com/app/live-embed/{boardId}/?embedMode=view_only_without_ui
```

El usuario solo tendrá que pegar el enlace normal del tablero (`https://miro.com/app/board/<boardId>/...` o el "Embed link" que da Miro desde Share → Embed). La app extraerá el `boardId` y construirá la URL de embed automáticamente.

**Modo de visualización:** se usará el embed live para que, si el usuario tiene sesión en Miro y permisos, pueda interactuar (mover, hacer zoom, editar). Si no tiene sesión o el tablero no es público, verá únicamente la vista de solo lectura. Esto es comportamiento estándar de Miro y no requiere API key.

## Cambios técnicos

### Base de datos
Nueva tabla `proyecto_miro`:
- `id` uuid PK
- `proyecto_id` uuid (único — un tablero por proyecto)
- `miro_url` text (enlace original pegado)
- `miro_board_id` text (extraído)
- `actualizado_por` uuid
- `fecha_actualizacion` timestamptz

RLS:
- **SELECT**: cualquier miembro del proyecto (`is_project_member`).
- **INSERT / UPDATE / DELETE**: solo el propietario (`is_project_owner`).

Trigger para borrar la fila si se borra el proyecto (cascade lógico vía función, siguiendo el patrón actual del proyecto que evita FKs duras).

### Frontend
- `src/components/MiroView.tsx` (nuevo): contiene el iframe, el input de configuración para el propietario, y los botones de cambiar/quitar.
- `src/pages/ProjectDetailPage.tsx`: añadir `'miro'` al estado `section` y un botón más en la barra de pestañas con icono (`SquareDashedKanban` o similar de Lucide).
- Helper `parseMiroBoardId(url)` que acepta tanto enlaces `https://miro.com/app/board/<id>/...` como los enlaces de embed que da Miro, y devuelve el `boardId`. Si no se puede extraer, mostrar error con `toast`.
- El iframe se monta con `allow="fullscreen; clipboard-read; clipboard-write"` y ocupa todo el alto disponible respetando los safe-area insets.

### Permisos en UI
- Determinar si el usuario es propietario consultando `miembros_proyecto` (ya cargado en `ProjectDetailPage`) — si su `rol === 'propietario'`, mostrar controles de edición; si no, solo el iframe o el mensaje de "no configurado".

## Notas
- No se requiere API key de Miro ni connector externo: el embed live es público y gratuito.
- Funciona en navegador y dentro de la PWA / Capacitor.
- Si Miro bloquea el embed por configuración del tablero (tablero privado del equipo sin permiso de embed), se mostrará el mensaje propio de Miro dentro del iframe — no podemos sobrescribirlo, pero añadiremos un texto pequeño debajo: "Si no ves el tablero, asegúrate de que en Miro está habilitado 'Anyone with the link can view' o 'Embed'."
