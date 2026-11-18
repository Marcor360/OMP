# Validación de infraestructura y entregabilidad de OMP

La versión 1.54.3 se subió a la rama `release/1.54.3` en el commit `a131e25`. El trabajo de validación que sigue se realizó sobre esa versión. El proyecto local de pruebas es `demo-omp`. `.firebaserc` declara un proyecto por defecto y carece de alias de staging. La máquina tiene una variable de credenciales de Google, pero eso no identifica un destino de pruebas ni acredita autorización. Los resultados de este informe proceden de recursos locales.

## A. Firebase y persistencia

- `createMeetingByManager` y `ensurePlanningMeetingsByManager` conservan las lecturas y escrituras transaccionales de la corrección de duplicados. El código de la primera usa además el orden explícito del compuesto de traslape. El build de Functions y los casos de creación concurrente se ejecutaron con Firestore local.
- App Check web se inicia con reCAPTCHA v3 cuando hay clave de sitio. El SDK solicita renovación automática. El código actual carga el proveedor de forma asíncrona y continúa si falla la inicialización. Verificar las primeras solicitudes y el registro de fallos es un requisito antes de imponerlo.
- En el estado actual, `criticalCallableOptions` solo se aplica a las cinco callables de gestión de usuarios. La lista de operaciones en `docs/app-check-rollout.md` describe el objetivo gradual. La publicación, las reuniones y el resto de operaciones tienen sus controles de identidad y permisos y requieren una decisión específica de App Check.
- Con `ENFORCE_APPCHECK_CRITICAL_CALLABLES=true` solo en el emulador, una llamada autenticada a `createUserByAdmin` sin encabezado de App Check devuelve HTTP 401. El emulador trata un token sintético como válido por su configuración de verificación e igualmente denegó el acceso por falta del perfil de usuario. La prueba negativa de firma o emisor reales necesita staging. El aviso de descubrimiento persiste porque `firebase-functions` evalúa internamente el parámetro al crear el handler. El rechazo observado confirma que el valor se aplica durante la ejecución local.
- Web inicializa Firestore con IndexedDB y el administrador de persistencia de una pestaña, con degradación a la instancia predeterminada cuando falla. Los repositorios también mantienen memoria y almacenamiento de OMP. Las mutaciones de asignaciones de reunión dependen de Functions y el formulario espera la confirmación de la llamada antes de anunciar éxito. Con la caché recién iniciada, una consulta local sin documentos podía impedir una lectura de servidor y ocultar reuniones disponibles. La consulta se intenta en el servidor cuando el SDK devuelve una caché vacía. Sin conexión se conserva el resultado local como respaldo y la siguiente consulta puede recuperar los datos al volver la red.

## B. Web, hosting y caché

`firebase.json` carece de configuración de Hosting. El exportador web copia la configuración Apache y genera archivos JavaScript y CSS con hash. La inspección del código y de la salida exportada no encontró un service worker registrado.

La regla de Apache ahora envía `Cache-Control: no-cache` para `index.html`. Apache 2.4 local con `mod_headers` y `mod_rewrite` entregó ese encabezado tanto para `/` como para `/assignments/create`. Las dos rutas respondieron con 304 al reenviar el ETag de una respuesta 200. El JavaScript con hash conservó su política anterior y coincidió byte por byte con el export. Una pestaña abierta continúa ejecutando su versión hasta que el usuario recarga o navega a un documento nuevo. Guarda primero los formularios en curso y publica los estáticos antes del HTML. Conserva los estáticos de la versión anterior durante la transición para que las pestañas antiguas todavía puedan cargar los módulos que esperan.

El resultado depende de que el alojamiento aplique `.htaccess` y de cómo el CDN trate el HTML. La revalidación de la navegación y la política para recursos con hash deben verificarse en el dominio autorizado. Una recarga completa sin red queda fuera de las capacidades verificadas.

## C. Notificaciones

- Las builds nativas compatibles registran el token Expo en `users/{uid}/pushTokens` tras comprobar permisos. El listener de rotación solicita otro token Expo y se desmonta con la sesión. El backend deduplica los envíos, maneja recibos y desactiva tokens marcados `DeviceNotRegistered`. La navegación desde la notificación valida una ruta admitida y considera la congregación activa.
- **Riesgo de privacidad para pruebas con cuentas reales.** El cierre de sesión borra estado y notificaciones entregadas, pero `removePushToken` es un no-op y el cierre no desvincula el token de esa instalación. Un cambio de usuario puede dejar el token anterior activo mientras el nuevo se registra. La rotación tampoco invalida explícitamente el documento anterior. El comportamiento de entrega después de esos cambios queda pendiente de comprobación física y corrección coordinada.
- Para cerrar el riesgo, usar dos cuentas sintéticas, dos dispositivos y builds de desarrollo registradas en staging. Probar primer plano, segundo plano y proceso cerrado. Abrir una notificación desde cada estado. Cambiar el token nativo y comprobar el documento nuevo y la retirada del anterior. Cerrar sesión y cambiar de cuenta con y sin red. Enviar un aviso sintético a cada cuenta y verificar que el otro dispositivo legítimo sigue recibiendo y que la instalación desvinculada queda excluida. La revocación debe afectar a la instalación, con reintentos seguros ante falta de conexión. La expiración reportada por Expo complementa esa revocación.

## D. Android e iOS

La introspección de Expo evalúa los plugins para Android e iOS. El manifiesto local usa `1.54.3`, Android `15403` e iOS `1.54.3`; EAS administra la numeración remota de tienda. Android declara vibración y notificaciones. La compilación de producción requiere `GOOGLE_SERVICES_JSON` y el perfil correspondiente. La instancia carece de SDK Android/Gradle configurado, Xcode y dispositivos físicos. Quedan pendientes AAB, compilación iOS, instalación y ejecución nativa. Los clientes nativos del SDK JS todavía carecen de atestación integrada. El diseño y las pruebas pendientes se describen en `docs/app-check-native-implementation.md`.

Con un equipo de pruebas, configura Google Services y los registros Firebase de staging. Ejecuta `npm run android` con Android SDK y un dispositivo de prueba. Para iOS usa `npm run ios` en macOS con Xcode y perfiles autorizados para el dispositivo. Verifica la instalación, la apertura, el inicio de sesión y las notificaciones por separado. La regeneración del AAB requiere el perfil de EAS autorizado, firma y el archivo de Google Services del destino. Confirma la cuenta, el entorno y la versión remota de EAS antes de construir y distribuir.

## E. UX y accesibilidad

El calendario compartido tenía controles de icono sin nombre y celdas que anunciaban solo un número. Los controles ahora exponen nombre localizado, fecha completa, selección y disponibilidad. El fondo sigue cerrando por toque y pierde el foco de teclado. El botón de fecha del formulario se identifica como control de selección, y el botón de guardar expone el estado ocupado y deshabilitado. Una prueba de componente verifica los nombres, los límites y la selección.

La validación de teclado se centró en el formulario prioritario de asignaciones, a tamaño de pantalla móvil. La elegibilidad de participantes y la búsqueda se cubren en las suites de la app. La revisión completa con lectores de pantalla, matrices de tamaño, contraste y módulos secundarios queda pendiente.

## F. Resultados

| Área | Estado inicial | Cambios | Pruebas | Estado final |
|---|---|---|---|---|
| Functions y Firestore | Correcciones de concurrencia e índices en el repositorio | Validación sobre 1.54.3 | Lint y build de Functions, 354 pruebas con Firestore, 91 pruebas de reglas, 21 grupos de campos y 4 compuestos | Verificado localmente |
| App Check | Aviso de descubrimiento y cobertura nativa pendiente | Se ejercitó el parámetro en el emulador | Rechazo del encabezado ausente; limitación de tokens sintéticos comprobada | Atestación real pendiente |
| Hosting | Reescritura SPA sin revalidación explícita del HTML | Encabezado para `index.html` | Apache local, ruta raíz, ruta interna y JS con hash | Verificado en Apache local |
| App | Calendario con controles sin etiquetas | Etiquetas y estados accesibles | Lint, tipos y 328 pruebas de Jest, incluidas regresiones del calendario y de la caché | Verificado localmente |
| Expo | Compatibilidad SDK 57 | Validación de versión 1.54.3 | Build web, Expo Doctor 21/21 e introspección de iOS y Android | Verificación estática y web |
| Navegador y desconexión | Dos recorridos de sesión existentes | Teclado en pantalla estrecha, borrador local y prueba de escritura con corte de red | 5 pruebas de Playwright aprobadas. El envío interrumpido mostró error y dejó cero documentos. El reintento confirmado creó un único documento. | Verificado en Chromium y emuladores |

Para ejecutar el flujo local, instala Chromium con `./node_modules/.bin/playwright install chromium`, compila Functions con `npm --prefix functions run build` y ejecuta `npm run test:e2e`. En esta instancia se usó el Chromium del sistema con una configuración temporal de Playwright. Firebase CLI 15 requiere excluir las variables del proxy del proceso de emuladores locales aquí. Descarga primero el emulador por la ruta de red normal y limita el comando al proyecto `demo-omp`.

## G. Operaciones externas

1. **Identificar staging.** Obtener el ID de Firebase y la URL web de pruebas del propietario. Verificar los roles de lectura de Firebase, Firestore y Logs Explorer. Para publicar se requiere autorización explícita, permisos de despliegue de Functions y acceso a las identidades de ejecución y compilación. Revisar el artefacto previo y anotarlo antes del cambio, junto con la configuración de App Check y versiones de clientes.
2. **Inventario de solo lectura.** Con `OMP_STAGING_PROJECT` definido y validado, usar `./node_modules/.bin/firebase functions:list --project "$OMP_STAGING_PROJECT"` y `./node_modules/.bin/firebase firestore:indexes --project "$OMP_STAGING_PROJECT"`. Comprobar los dos nombres de función, la región y el compuesto de traslape habilitado. Verificar registro y métricas de App Check en Firebase Console.
3. **Despliegue limitado cuando esté autorizado.** Ejecutar `npm --prefix functions run build` y luego `./node_modules/.bin/firebase deploy --project "$OMP_STAGING_PROJECT" --only functions:createMeetingByManager,functions:ensurePlanningMeetingsByManager`. Usar los índices y reglas validados en el [informe de Firestore](seguimiento-firestore-dependencias-2026-11-18.md). Realizar escrituras concurrentes con datos sintéticos y verificar un único registro, sus asignaciones y los contadores. En Logs Explorer filtrar `resource.type="cloud_run_revision"` por el par de servicios observado realmente en ese proyecto. Revisar errores, latencia y reintentos con permisos de lectura de logs.
4. **Web e infraestructura de distribución.** Con `OMP_STAGING_WEB_URL` autorizado, ejecutar `curl --fail -sSI "$OMP_STAGING_WEB_URL/"` y repetir con una ruta interna y un recurso con hash de ese HTML. Abrir una pestaña en la versión anterior y guardar cambios del formulario antes de recargar. Confirmar que los recursos antiguos siguen disponibles después de publicar y que la navegación nueva obtiene los hashes nuevos.
5. **Reversión.** Si la versión nueva falla, redirigir el host de pruebas al artefacto anterior completo y revertir solo las funciones afectadas con un checkout del commit anterior verificado y el mismo comando de despliegue limitado. Repetir las consultas de inventario y las pruebas sintéticas. Mantener índices válidos hasta que se revise su retirada y verificar la política de App Check antes de cualquier cambio en su imposición.

## H. Riesgos pendientes

- Revocación por instalación al cambiar de cuenta y prueba de Push real en los tres estados de ejecución.
- Atestación nativa, verificación de firma de App Check y revisión de las solicitudes iniciales de web en staging.
- Caché del CDN, métricas y estado de índices remotos, instalación nativa y AAB.
- Seguridad de datos en desconexión prolongada y conflictos de edición concurrente. Las comprobaciones locales solo cubren los escenarios descritos.
