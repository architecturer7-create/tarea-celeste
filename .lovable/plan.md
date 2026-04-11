

## Situación actual

La app **ya abrió en Xcode y cargó en el simulador/dispositivo**. Los errores que ves en la consola de Xcode son normales durante desarrollo:

- **`RTIInputSystemClient`** — ruido interno de iOS con el teclado virtual. Ignorable.
- **`UIScene lifecycle`** — advertencia de Apple para futuras versiones. No afecta ahora.
- **`window.Capacitor.triggerEvent` undefined`** — esto pasa porque la app está cargando desde la URL remota de Lovable (live-reload), donde el bridge nativo de Capacitor no se inyecta completamente. Es esperado en modo desarrollo.

## Qué sigue: subir a TestFlight

Ahora necesitas preparar el build de producción (sin live-reload) y subirlo a Apple.

### Pasos

1. **Quitar la URL de live-reload** del `capacitor.config.ts` — comentar o eliminar el bloque `server.url` para que la app use los archivos locales del `dist/`.

2. **Rebuild y sync** — en tu terminal, desde la carpeta `tarea-celeste`:
   ```bash
   npm run build
   npx cap sync ios
   ```

3. **Configurar firma en Xcode**:
   - Abrir el proyecto iOS: `npx cap open ios`
   - En Xcode, seleccionar el target "App"
   - Ir a "Signing & Capabilities"
   - Seleccionar tu **Team** (tu cuenta de Apple Developer, $99/año)
   - Cambiar el **Bundle Identifier** si es necesario

4. **Crear el Archive**:
   - En Xcode: **Product → Destination → Any iOS Device**
   - Luego: **Product → Archive**
   - Cuando termine, se abre el Organizer

5. **Subir a TestFlight**:
   - En el Organizer, click **Distribute App**
   - Seleccionar **App Store Connect**
   - Seguir el wizard y subir

6. **En App Store Connect** (appstoreconnect.apple.com):
   - El build aparecerá en ~15 min
   - Ir a tu app → TestFlight → agregar testers
   - Los testers reciben invitación por email para instalar via la app TestFlight

### Requisitos previos
- Cuenta de Apple Developer Program ($99/año) — sin esto no puedes firmar ni subir
- Crear el App ID en App Store Connect antes de subir

### Cambios de código necesarios
Solo un cambio: modificar `capacitor.config.ts` para quitar el `server.url` en producción.

