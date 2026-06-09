
## Objetivo
Ajustar la app para que se vea pulida y cómoda en iPhone 17 (viewport ~402×874, Dynamic Island, gesture bar), corrigiendo problemas detectados al revisar la versión móvil.

## Problemas detectados (en preview móvil 402px)

1. **Pestañas de sección del proyecto** (Tareas / Sheets / Timeline / Miro / Connect) se aprietan; el badge de no leídos en "Connect" desborda hacia la derecha y, con proyectos largos, se rompe la línea.
2. **Filtros de estado** (Pendiente / En progreso / Bloqueada / Completada) hacen wrap a 2 líneas y "En progreso" parte en dos.
3. **Contadores** (Total / Completadas / En progreso / Bloqueadas) compiten con las pastillas en la misma fila → wrap caótico.
4. **Header del proyecto**: avatares + invitar + toggle lista/kanban + nombre del proyecto saturan la fila a 390–402px.
5. **Tipografías muy pequeñas** (10–11px) en contadores, fechas y prioridades → poco legibles en iPhone 17.
6. **Targets táctiles pequeños** (iconos w-3.5 h-3.5, botones p-1.5) por debajo del mínimo recomendado de 44px de Apple.
7. **Safe area superior**: hoy se respeta con `env(safe-area-inset-top)` pero el header tiene `h-10` y queda muy pegado a la Dynamic Island; conviene un mínimo extra.
8. **FAB de crear tarea** queda demasiado cerca de la tab bar inferior cuando hay safe-area-inset-bottom (gesture bar).
9. **Vistas Sheets / Timeline / Connect**: revisar padding lateral y scroll horizontal a 402px.
10. **Modales** (`CreateTaskModal`, `TaskDetailDrawer`, invitar miembro): revisar que no excedan el viewport y respeten safe areas.

## Cambios propuestos

### A. Header global (`src/components/AppLayout.tsx`)
- Subir la altura del header a `h-11` en móvil y aumentar el logo a `w-7 h-7`.
- Aumentar el botón IA y el avatar a `w-8 h-8` para cumplir tap target.
- Aumentar el spacer superior a `max(env(safe-area-inset-top), 8px)` para que no choque con la Dynamic Island.
- Tab bar inferior: subir a `h-14`, iconos `w-5 h-5`, label `text-[10px]`.

### B. Header de proyecto (`src/pages/ProjectDetailPage.tsx`)
- Reorganizar la fila superior: nombre del proyecto + back en una línea; **avatares, invitar y vista lista/kanban** se mueven a una segunda línea en móvil (md: vuelven a inline).
- **Pestañas de sección**: convertir en scroll horizontal (`overflow-x-auto`, `flex-nowrap`, `snap-x`), tamaño `text-xs`, padding `px-3 py-1.5`, y mantener el badge de Connect inline sin romper.
- **Contadores y filtros**: separar en dos filas en móvil (contadores arriba, filtros abajo en scroll horizontal). Subir tipografías a `text-[11px]` / `text-xs`.
- Aumentar iconos del header (back, invitar, toggles) a `w-5 h-5` y padding `p-2`.

### C. Lista de tareas
- Checkbox circular a `w-5 h-5`, avatar `size="sm"` ya OK.
- Pastilla de prioridad a `text-[11px] px-2 py-0.5`.
- Filas con `py-3` para mejor tap target.

### D. FAB y safe-area
- Mover el FAB de crear tarea a `bottom: calc(env(safe-area-inset-bottom) + 72px)` para separarlo de la tab bar inferior en iPhone 17.
- Añadir utilidad `.safe-bottom-tabs` para el contenido principal y respetar gesture bar.

### E. Tab bar inferior y safe area
- Reemplazar el spacer fijo por `padding-bottom: max(env(safe-area-inset-bottom), 0px)` dentro del `<nav>` (no como div extra) para que el fondo siga siendo continuo.
- Header: aplicar el mismo patrón con `padding-top: max(env(safe-area-inset-top), 0px)`.

### F. Vistas internas
- `SheetsView`, `TimelineView`, `ConnectView`: revisar y limitar `px` lateral a `px-3` en móvil; en `TimelineView` envolver la tabla/canvas en `overflow-x-auto` con `min-w-[640px]`.
- `ConnectView`: input de mensaje fijo abajo con `pb-[env(safe-area-inset-bottom)]`.

### G. Modales / Drawers
- `CreateTaskModal` y `TaskDetailDrawer`: `max-h-[90dvh]`, scroll interno, padding inferior con safe area.
- Diálogo de invitar miembro: ancho `w-[calc(100vw-2rem)] max-w-sm`.

## Detalles técnicos
- Solo cambios de UI/CSS (Tailwind) y reorganización JSX. No se toca lógica de negocio, queries ni Supabase.
- Se respeta el design system existente (tokens HSL en `index.css`, no se introducen colores nuevos).
- Se conservan los tamaños desktop (`md:` prefijos) intactos; los ajustes son solo para móvil.

## Archivos a tocar
- `src/components/AppLayout.tsx`
- `src/pages/ProjectDetailPage.tsx`
- `src/components/ConnectView.tsx`
- `src/components/SheetsView.tsx`
- `src/components/TimelineView.tsx`
- `src/components/CreateTaskModal.tsx`
- `src/components/TaskDetailDrawer.tsx`
- `src/index.css` (utilidades de safe-area)

## Verificación
- Capturar screenshots a 402×874 (iPhone 17), 390×844 (iPhone 16) y 768×1024 (iPad) y revisar cada vista (Inicio, Mis Tareas, Proyecto: Tareas / Sheets / Timeline / Miro / Connect, Perfil).
- Confirmar que no haya overflow horizontal y que los tap targets sean ≥40px.
