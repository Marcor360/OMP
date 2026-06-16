# OMP Suite

OMP Suite (Organization, Ministry & Programs) es una app multiplataforma para organizacion interna de congregaciones. Permite gestionar usuarios, reuniones, asignaciones, limpieza, predicacion, territorios, notificaciones, organigrama, permisos, planes y configuracion por congregacion.

OMP Suite no es una aplicacion oficial de JW.ORG, no esta afiliada, respaldada ni aprobada por ninguna entidad oficial de los Testigos de Jehova. Es una herramienta independiente de uso privado.

## Estado Actual

- Version actual detectada: `1.0.1` en `package.json` y `app.json`.
- Stack principal: Expo SDK 54, React 19, React Native 0.81, TypeScript, Expo Router, NativeWind y Firebase.
- Plataformas: Android, iOS preparado mediante Expo, y Web con React Native Web.
- Backend: Firebase Authentication, Cloud Firestore, Cloud Functions, Expo Notifications y Firebase Admin Messaging.
- Seguridad: aislamiento por `congregationId`, roles tecnicos, permisos por modulo y operaciones sensibles mediante Cloud Functions.

## Cambios Recientes Aplicados

Esta seccion resume las correcciones de estabilizacion realizadas en la ronda actual del proyecto.

### UX De Creacion Y Edicion De Reuniones

- `src/screens/meetings/MeetingFormScreen.tsx` se reorganizo como flujo guiado por pasos:
  - Semana, tipo de reunion y dia exacto.
  - Datos basicos de la reunion.
  - Programa y asignaciones.
  - Limpieza y modulos sincronizados.
  - Revision final antes de publicar.
- Se mantiene la posibilidad de guardar borrador desde cualquier paso.
- La accion de publicar ahora pasa siempre por una pantalla de revision con resumen de tipo, semana, fecha, lugar, enlace, limpieza, secciones completas, asignaciones faltantes, usuarios bloqueados por salida a discursar y campos controlados por otros modulos.
- Los errores de publicacion se muestran en un panel visual dentro de la pantalla y el formulario hace scroll al inicio para que el usuario los vea.
- El selector de semana/dia muestra mejor la semana seleccionada, el dia exacto y advierte cuando ya existe una reunion del mismo tipo en el rango.
- Los campos controlados por Acomodadores y microfonos explican por que estan bloqueados.
- Se conservaron las integraciones existentes con reuniones, limpieza, publicacion, validacion de fin de semana y discursos externos.

### Planes, Billing Y Limites De Usuarios

- Se unifico el modelo de planes de congregacion con la fuente de billing actual:
  - `omp_80`: 80 usuarios activos.
  - `omp_150`: 120 usuarios activos.
  - `omp_250`: 200 usuarios activos.
- `src/types/congregation-plan.ts` ahora reutiliza los tipos, etiquetas y limites de `src/types/billing.ts`.
- `src/services/congregations/congregations-service.ts` lee primero `congregations/{congregationId}.billing` y usa `/congregations/{congregationId}/private/plan` solo como fallback legacy.
- `functions/src/users.ts` valida capacidad de usuarios activos con los nuevos planes y mantiene compatibilidad con planes antiguos `basic`, `intermediate`, `complete` y limite legacy 70.
- La validacion de capacidad en `createUserByAdmin` consulta hasta `limite + 1` usuarios activos, y los listados de usuarios usan paginacion interna en lugar de un limite fijo de 500.
- Se actualizo la documentacion de planes y billing en:
  - `docs/congregation-plans.md`.
  - `docs/billing-and-subscriptions.md`.

### Migracion Legacy

- Se agrego el script administrativo `functions/scripts/migrate-legacy-plans-and-roles.js`.
- El script corre en dry-run por defecto:

```bash
node functions/scripts/migrate-legacy-plans-and-roles.js
```

- Para aplicar cambios reales requiere `--write` y credenciales administrativas configuradas fuera del repositorio:

```bash
node functions/scripts/migrate-legacy-plans-and-roles.js --write
```

- Normaliza roles legacy:
  - `administrador` -> `admin`.
  - `usuario` -> `user`.
- Normaliza planes legacy:
  - `basic` / 70 -> `omp_80`.
  - `intermediate` / 120 -> `omp_150`.
  - `complete` / 200 -> `omp_250`.

### Usuarios Y Errores `internal`

- `src/services/users/users-service.ts` ahora hace fallback seguro a consulta Firestore cuando la Cloud Function `listUsersForCurrentCongregation` falla por errores temporales o internos:
  - `internal`.
  - `unavailable`.
  - `deadline-exceeded`.
  - `not-found`.
  - `unimplemented`.
- El fallback sigue pasando por Firestore Rules, por lo que no abre acceso fuera de los permisos reales.
- `src/screens/users/UsersListScreen.tsx` ahora muestra accion de reintento cuando ocurre un error al cargar usuarios.
- `src/lib/firebase/errors.ts` evita mostrar mensajes crudos como `internal` y los convierte en mensajes humanos.

### Cache Persistente Y Cache-First

- Se agrego cache persistente controlado con AsyncStorage en `src/services/repositories/persistent-cache.ts`.
- `src/services/repositories/firestore-cache-first.ts` ahora lee en capas:
  - memoria de sesion;
  - cache persistente AsyncStorage;
  - cache local de Firestore;
  - servidor Firestore.
- El cache persistente usa ciclo anual del 1 de septiembre al 31 de agosto y se limpia automaticamente si cambia el ciclo.
- El cache persistente esta acotado a 300 entradas y 250 KB por entrada para evitar crecimiento indefinido.
- La metadata guarda `schemaVersion`; si cambia el esquema, se reinicia solo el cache persistente de OMP.
- Logout limpia cache de sesion y cache persistente sin romper el cierre de sesion si AsyncStorage falla.
- El cambio de congregacion limpia el cache de la congregacion anterior para evitar mezclar datos.
- Lecturas sensibles como billing/plan usan `persist: false`; el cache no es autoridad para permisos, pagos ni seguridad.
- Se agrego documentacion en `docs/cache-strategy.md` y un ejemplo de pruebas en `docs/persistent-cache.test.ts.example`.

### Organigrama

- `src/modules/organization/components/OrganizationChart.tsx` ya no dispara un error no capturado si falla la carga de usuarios activos para editar el organigrama.
- La pantalla muestra `ErrorState` con mensaje claro y opcion de reintento.
- Los errores de permisos se distinguen de otros errores Firestore para orientar mejor el diagnostico.

### Planeacion Operativa De Reuniones

- Se agrego una capa comun de planeacion para evitar duplicar logica entre reuniones, limpieza, acomodadores/microfonos y discursos externos:
  - `src/utils/dates/date-key.ts`.
  - `src/services/planning/operational-planning-service.ts`.
  - `src/services/planning/planning-conflict-service.ts`.
- Acomodadores y microfonos ahora cuentan con:
  - Tipos dedicados en `src/types/hospitality-microphones.ts`.
  - Servicio Firestore en `src/services/hospitality-microphones/hospitality-microphones-service.ts`.
  - Pantalla propia en `src/modules/assignments/screens/HospitalityMicrophonesScheduleScreen.tsx`.
  - Ruta protegida `/(protected)/assignments/hospitality-microphones`.
  - Publicacion segura mediante Cloud Function `publishHospitalityScheduleByManager`.
- Limpieza ahora cuenta con:
  - Tipos dedicados en `src/types/cleaning-schedule.ts`.
  - Servicio Firestore en `src/services/cleaning/cleaning-schedule-service.ts`.
  - Pantalla propia en `src/modules/cleaning/screens/CleaningScheduleScreen.tsx`.
  - Ruta protegida `/(protected)/cleaning/schedule`.
  - Publicacion segura mediante Cloud Function `publishCleaningScheduleByManager`.
- Las reuniones importan datos publicados de planeacion:
  - Limpieza publicada.
  - Acomodadores/microfonos publicados.
  - Lectores controlados por el modulo de acomodadores/microfonos.
- La sincronizacion hacia reuniones actualiza solo los campos controlados por cada modulo y conserva las secciones no relacionadas.
- Los items de limpieza y acomodadores/microfonos usan IDs deterministas por fecha/tipo/rol para evitar duplicados al guardar borradores.
- Los discursos externos ahora validan conflicto contra asignaciones de reuniones de fin de semana antes de programarse.

### Firestore Rules, Indices Y Functions

- `firestore.rules` incluye validaciones para:
  - `cleaningSchedules`.
  - `hospitalitySchedules`.
  - Items de cada schedule.
  - Modelo real de reuniones con compatibilidad legacy.
- `firestore.indexes.json` incluye indices para reuniones, discursos externos y schedules publicados.
- `functions/src/planning-schedules.ts` centraliza la publicacion segura y sincronizacion desde backend.
- `functions/src/outgoing-talks.ts` bloquea conflictos de discursos externos con asignaciones de fin de semana.

### Validacion Ejecutada

Se ejecuto la validacion completa:

```bash
npm run validate
```

Resultado:

- Lint de Expo: correcto.
- TypeScript app: correcto.
- Lint de Cloud Functions: correcto.
- Build de Cloud Functions: correcto.
- Tests de Cloud Functions: 75 pruebas correctas.

### Nota De Seguridad Pendiente

No se endurecieron todavia las reglas de `firestore.rules` para bloquear completamente valores legacy. Primero debe ejecutarse y verificarse la migracion real de roles y planes en Firestore. Despues de confirmar que no quedan valores antiguos, se pueden ajustar reglas y validaciones para aceptar solo los valores modernos.

## Inicio Rapido

Requisitos:

- Node.js compatible con Expo SDK 54.
- npm.
- Firebase CLI mediante `npx -y firebase-tools@latest`.
- Android Studio para Android local.
- EAS CLI para builds reales.

Instalar dependencias:

```bash
npm install
npm --prefix functions install
```

Crear variables locales:

```bash
cp .env.example .env
```

Iniciar Expo:

```bash
npm run start
```

Ejecutar Android:

```bash
npm run android
```

Ejecutar Web:

```bash
npm run web
```

Validar proyecto:

```bash
npm run validate
```

## Guia Tecnica

La documentacion larga vive en `docs/`:

- `docs/architecture.md`: arquitectura general, limites de carpetas y flujo cliente/backend.
- `docs/permissions-model.md`: modelo formal de roles, permisos, privilegios y responsabilidades.
- `docs/firestore-security.md`: criterios de seguridad para reglas, datos y operaciones sensibles.
- `docs/billing-and-subscriptions.md`: planes, limites, cobros y flujo pendiente.
- `docs/deployment.md`: comandos de Firebase, Functions, Android y Web.
- `docs/notifications.md`: tokens push, notificaciones internas y pruebas reales.
- `docs/ux-guidelines.md`: navegacion movil, estados vacios, errores y dashboard por perfil.
- `docs/cache-strategy.md`: cache en memoria, cache persistente, ciclo anual e invalidacion.
- `docs/testing.md`: estrategia de pruebas frontend, Functions y Firestore Rules.
- `docs/predeploy-validation.md`: checklist de validacion antes de publicar.
- `docs/deployment-mobile.md`: guia movil con EAS.
- `docs/congregation-plans.md`: modelo actual de planes por congregacion.

## Stack Obligatorio

No migrar estas piezas sin aprobacion explicita:

- Expo SDK 54.
- React 19 y React Native 0.81.
- TypeScript.
- Expo Router.
- NativeWind / Tailwind CSS.
- Firebase Authentication.
- Cloud Firestore.
- Firebase Cloud Functions.
- Expo Notifications y Firebase Admin Messaging.
- AsyncStorage y cache local.
- React Native Web mediante Expo.

## Estructura Del Repositorio

```text
app/                         Rutas Expo Router
app/(auth)/                  Pantallas publicas
app/(protected)/             Pantallas autenticadas
app/(protected)/(tabs)/      Tabs principales
src/components/              UI reusable
src/screens/                 Pantallas principales
src/services/                Servicios, repositorios y Firebase
src/modules/                 Modulos de dominio
src/types/                   Tipos y DTOs
src/i18n/                    Traducciones
src/lib/firebase/            Inicializacion y refs Firebase
src/utils/                   Utilidades puras
functions/                   Cloud Functions
docs/                        Documentacion tecnica
firestore.rules              Reglas reales de seguridad
firestore.indexes.json       Indices Firestore
```

## Scripts Principales

App:

```bash
npm run start
npm run android
npm run android:release
npm run ios
npm run web
npm run build:web
npm run preview:web
npm run lint
npm run validate
```

Cloud Functions:

```bash
npm --prefix functions run lint
npm --prefix functions run build
npm --prefix functions test
npm --prefix functions run serve
npm --prefix functions run deploy
npm --prefix functions run logs
```

Firebase:

```bash
npx -y firebase-tools@latest --version
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use
npx -y firebase-tools@latest emulators:start
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes
npx -y firebase-tools@latest deploy --only functions
npx -y firebase-tools@latest deploy --only hosting
npx -y firebase-tools@latest deploy
```

## Build Android

Desarrollo local:

```bash
npm run android
```

Release local:

```bash
npm run android:release
```

Build recomendado con EAS:

```bash
npm install -g eas-cli
eas login
eas build --platform android
```

Despues de cambios de version o permisos, actualizar juntos `package.json`, `app.json`, `android.versionName` y `android.versionCode` cuando exista carpeta nativa, y generar un nuevo AAB.

## Build Web

```bash
npm run build:web
npm run preview:web
```

Deploy web:

```bash
npx -y firebase-tools@latest deploy --only hosting
```

## Variables De Entorno

Crear `.env` local a partir de `.env.example`:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

Las variables `EXPO_PUBLIC_*` se exponen al cliente. No guardar secretos en ellas.

## Archivos Sensibles

No subir:

- `.env`
- `.env.*`, salvo `.env.example`
- `serviceAccountKey.json`
- `*-service-account.json`
- `*.jks`
- `*.keystore`
- `*.p8`
- `*.p12`
- `*.key`
- `*.mobileprovision`
- logs de Firebase, Expo o npm
- builds generados como `.aab`, `.apk`, `dist/`, `web-build/` o zips

## Modelo De Datos

Rutas principales:

```text
/users/{uid}
/users/{uid}/pushTokens/{tokenDocId}
/congregations/{congregationId}
/congregations/{congregationId}/persons/{personId}
/congregations/{congregationId}/meetings/{meetingId}
/congregations/{congregationId}/meetings/{meetingId}/assignments/{assignmentId}
/congregations/{congregationId}/assignments/{assignmentId}
/congregations/{congregationId}/cleaningGroups/{groupId}
/congregations/{congregationId}/cleaningSchedules/{scheduleId}
/congregations/{congregationId}/cleaningSchedules/{scheduleId}/items/{itemId}
/congregations/{congregationId}/hospitalitySchedules/{scheduleId}
/congregations/{congregationId}/hospitalitySchedules/{scheduleId}/items/{itemId}
/congregations/{congregationId}/outgoingTalks/{outgoingTalkId}
/congregations/{congregationId}/changeLogs/{changeLogId}
/congregations/{congregationId}/notifications/{notificationId}
/congregations/{congregationId}/preachingReports/{monthId}/submissions/{userId}
/dashboardSummary/{congregationId}
/system/{docId}
```

Regla central: todo dato de congregacion debe estar aislado por `congregationId`. No hacer consultas globales salvo flujos superadmin protegidos.

## Roles Y Permisos

Roles tecnicos internos permitidos:

```ts
type UserRole = 'admin' | 'supervisor' | 'user';
```

Etiquetas de interfaz:

- `admin`: Administrador.
- `supervisor`: Supervisor.
- `user`: Usuario.

No usar `administrador` ni `usuario` como valores internos nuevos. Esos valores solo deben tratarse como legacy durante migracion controlada.

Separacion conceptual:

- `role`: nivel general dentro del sistema.
- `permissions`: acciones tecnicas permitidas por modulo.
- `privileges`: condiciones internas de la congregacion.
- `serviceAssignments`: responsabilidades por departamento.
- `responsibilities`: marcadores funcionales especiales.

## Seguridad

Principios obligatorios:

- Todo dato protegido requiere autenticacion.
- `/users/{uid}` es la fuente real de rol, estado activo y congregacion.
- La UI puede ocultar acciones, pero Firestore Rules o Cloud Functions deben aplicar la seguridad real.
- Usuarios comunes no pueden cambiar su rol, estado activo ni congregacion.
- Operaciones sensibles deben pasar por Cloud Functions.
- `dashboardSummary` es de lectura para clientes.
- `/system/{docId}` no debe ser escribible desde cliente.
- Push tokens pertenecen al usuario autenticado.

Operaciones sensibles:

- Crear usuarios.
- Editar roles.
- Cambiar permisos.
- Desactivar usuarios.
- Eliminar usuarios.
- Cambiar plan.
- Registrar pagos.
- Activar o desactivar congregaciones.

## Costos Firestore

- Preferir cache-first cuando sea posible.
- Evitar `onSnapshot` salvo que la vista necesite tiempo real.
- No montar listeners duplicados.
- Limpiar listeners al desmontar.
- Usar single-flight para solicitudes concurrentes.
- Invalidar cache despues de crear, editar, publicar o eliminar.
- No leer colecciones completas cuando baste un resumen.
- Filtrar siempre por `congregationId`.

## Notificaciones

OMP usa Expo Notifications, Firebase Admin Messaging, tokens por usuario en `/users/{uid}/pushTokens` y notificaciones internas en Firestore.

Reglas:

- No usar Expo Go como prueba final de push.
- Probar en development build o release.
- Pedir permiso con explicacion previa.
- Mantener canales Android.
- Desactivar tokens invalidos si Expo devuelve `DeviceNotRegistered`.
- Segmentar siempre por congregacion.

## Flujo Git

Rama recomendada:

```bash
git checkout -b feature/nombre-corto
```

Antes de abrir PR:

```bash
npm run validate
git status --short
```

Convencion de commits:

- `feat: agregar gestion de territorios`
- `fix: corregir permisos de limpieza`
- `docs: actualizar guia de despliegue`
- `test: cubrir reglas de usuarios`
- `refactor: separar permisos de usuarios`
- `chore: actualizar dependencias`

Mantener commits enfocados. No mezclar refactors, reglas y cambios visuales si no son parte del mismo objetivo.

## Checklist Antes De Produccion

- `npm run validate` pasa completo.
- Firestore Rules revisadas para usuarios activo/inactivo, otra congregacion, admin, supervisor y usuario normal.
- Indices necesarios estan desplegados.
- Cloud Functions compiladas y desplegadas.
- Acciones sensibles pasan por Functions.
- Variables de entorno configuradas por ambiente.
- No hay secretos ni builds generados en Git.
- Version actualizada en archivos requeridos.
- Android probado en development build o release.
- Web probado con `npm run build:web` y `npm run preview:web`.
- Notificaciones probadas fuera de Expo Go.
- i18n actualizado en espanol e ingles si hubo texto nuevo.
- Estados vacios y errores humanos revisados.

## Roadmap De Estabilizacion

Fase 1:

- README tecnico completo.
- `.env.example`.
- `.gitignore` reforzado.
- Encoding de `firestore.rules`.
- Documentacion base en `docs/`.

Fase 2:

- Migrar roles legacy en Firestore.
- Endurecer reglas para aceptar solo `admin`, `supervisor`, `user`.
- Limpiar permisos legacy y labels usados como seguridad.
- Agregar pruebas de Firestore Rules.

Fase 3:

- Navegacion movil consistente.
- Estados vacios profesionales.
- Errores humanos.
- Dashboard por tipo de usuario.

Fase 4:

- Flujo de cobro completo.
- Historial de pagos.
- Alertas de vencimiento.
- Stripe Billing con exenciones administradas.

Fase 5:

- Tests frontend.
- Tests de permisos.
- Tests de navegacion.
- Cobertura para Functions criticas.
