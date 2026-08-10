<div align="center">

# OMP Suite

### Organization, Ministry & Programs

Aplicación multiplataforma para la organización interna, administración y coordinación operativa de congregaciones.

`Web` · `Android` · `iOS` · `Expo` · `React Native` · `Firebase` · `Stripe`

**Versión actual:** `1.36.1`

**Estado:** beta avanzada en estabilización

**Última actualización:** 9 de agosto de 2026

</div>

> [!IMPORTANT]
> OMP Suite es una herramienta tecnológica independiente. No es una aplicación oficial de JW.ORG ni está afiliada, respaldada, patrocinada o aprobada por ninguna entidad oficial de los Testigos de Jehová.

## Contenido

- [Descripción](#descripción)
- [Estado actual](#estado-actual)
- [Funciones principales](#funciones-principales)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura y seguridad](#arquitectura-y-seguridad)
- [Modelo de datos](#modelo-de-datos)
- [Planes y facturación](#planes-y-facturación)
- [Internacionalización](#internacionalización)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Instalación](#instalación)
- [Variables y secretos](#variables-y-secretos)
- [Comandos](#comandos)
- [Pruebas e integración continua](#pruebas-e-integración-continua)
- [Builds y despliegues](#builds-y-despliegues)
- [Versionado](#versionado)
- [Notificaciones](#notificaciones)
- [Cache y costos de Firestore](#cache-y-costos-de-firestore)
- [Estado de producción](#estado-de-producción)
- [Documentación](#documentación)
- [Licencia y uso](#licencia-y-uso)

## Descripción

OMP centraliza tareas que normalmente quedan repartidas entre documentos, mensajes y herramientas aisladas. La aplicación comparte una base de código entre Web, Android e iOS y usa Firebase como plataforma de identidad, datos y backend privilegiado.

El producto administra información por congregación. Toda operación congregacional debe quedar aislada mediante `congregationId`; no se permiten consultas globales salvo flujos superadministrativos explícitos y protegidos.

## Estado actual

| Dato | Valor |
| --- | --- |
| Nombre | OMP Suite |
| Versión pública | `1.36.1` |
| Android `versionCode` | `13601` |
| Android package | `com.marcor360.omp` |
| iOS bundle identifier | `com.marcor360.omp` |
| Plataformas | Web, Android e iOS |
| Estado | Beta avanzada |
| Cliente | Expo / React Native |
| Backend | Firebase Cloud Functions |
| Base de datos | Cloud Firestore |
| Autenticación | Firebase Authentication |
| Pagos | Stripe Billing |
| CI | GitHub Actions |

La versión visible proviene de `app.json → expo.version`. `package.json`, `package-lock.json`, `app.json` y la configuración nativa Android deben actualizarse juntos en cada release.

## Funciones principales

### Usuarios y congregaciones

- inicio de sesión y rutas protegidas;
- perfiles, estados y pertenencia a congregación;
- creación, actualización, desactivación y eliminación mediante Cloud Functions;
- roles técnicos `admin`, `supervisor` y `user`;
- privilegios organizativos separados de los roles técnicos;
- permisos por departamento y responsabilidad;
- límites de usuarios activos según el plan contratado.

### Reuniones y asignaciones

- reuniones entre semana, de fin de semana y otros eventos;
- borradores, publicación y administración protegida;
- asignaciones vinculadas a reuniones o independientes;
- filtros por fecha, categoría, subtipo, persona, estado y congregación;
- discursos externos, estados y detección de conflictos;
- sincronización de responsabilidades relacionadas.

### Limpieza

- grupos estándar o familiares;
- integrantes válidos de la misma congregación;
- alta, edición, desactivación y eliminación controladas;
- programa de limpieza por rango de reuniones;
- borradores, publicación y sincronización;
- tarjeta de próximas responsabilidades personales;
- cache local de datos consultados con frecuencia.

### Hospitalidad, micrófonos y lectores

- planificación por reunión;
- roles de acomodación, micrófonos, lectores y responsabilidades relacionadas;
- publicación y sustituciones autorizadas;
- prevención de duplicados y conflictos;
- sincronización con reuniones.

### Predicación y territorios

- informes mensuales según permisos;
- horas para usuarios compatibles con el flujo de pioneros;
- panel administrativo de enviados, faltantes, horas, estudios y cursos;
- contador personal local, separado de los informes remotos;
- catálogo, edición y asignación de territorios;
- recordatorios y mantenimiento programado.

### Dashboard, eventos y organización

- resumen por congregación;
- próximas reuniones y asignaciones pendientes;
- eventos y avisos;
- organigrama generado desde asignaciones de servicio;
- navegación y tarjetas condicionadas por permisos;
- anuncios internos del sistema.

### Configuración y seguridad local

- tema claro, oscuro o del sistema;
- selección de idioma;
- perfil y datos de la aplicación;
- bloqueo por inactividad;
- autenticación biométrica cuando el dispositivo la soporta;
- cierre de sesión y limpieza de estado local sensible.

## Stack tecnológico

Las versiones siguientes se obtienen de los manifiestos actuales del repositorio.

### Aplicación

| Tecnología | Versión |
| --- | --- |
| Expo | SDK `57` (`~57.0.11`) |
| React | `19.2.3` |
| React Native | `0.86.2` |
| React Native Web | `~0.21.0` |
| Expo Router | `^57.0.11` |
| TypeScript | `~6.0.3` |
| Firebase Web SDK | `^12.17.1` |
| NativeWind | `^4.2.6` |
| Tailwind CSS | `^3.4.17` |
| React Navigation | `^7.3.15` |
| Reanimated | `4.5.1` |
| AsyncStorage | `2.2.0` |

La aplicación tiene activados `typedRoutes` y React Compiler.

### Backend

| Tecnología | Versión o uso |
| --- | --- |
| Node.js | `22` |
| Firebase Functions | `^7.3.2` |
| Firebase Admin | `^14.2.0` |
| Stripe SDK | `^22.4.0` |
| Expo Server SDK | `^6.1.0` |
| TypeScript de Functions | `~5.9.2` |

### Infraestructura

- Firebase Authentication;
- Cloud Firestore;
- Cloud Functions de segunda generación;
- Firebase Admin Messaging;
- Expo Notifications;
- Stripe Checkout, Customer Portal y Webhooks;
- GitHub Actions;
- EAS Build;
- Firestore Emulator para pruebas de reglas.

## Arquitectura y seguridad

```text
Expo Router / pantallas
        ↓
Componentes, contextos y hooks
        ↓
Servicios y módulos de dominio
        ↓
Repositorios / Firebase SDK / Callable Functions
        ↓
Firestore Rules y Cloud Functions
        ↓
Authentication / Firestore / Stripe / Push
```

### Principios

1. La interfaz controla visibilidad y experiencia, pero no es la defensa definitiva.
2. Firestore Rules y Cloud Functions validan identidad, congregación, rol y permiso.
3. `/users/{uid}` es la fuente real de rol, estado activo y congregación.
4. Los privilegios organizativos no conceden automáticamente roles técnicos.
5. Los asistentes de departamento no reciben acceso global.
6. Las operaciones sensibles de usuarios, reuniones, billing y notificaciones permanecen en backend.
7. `dashboardSummary` es de solo lectura para clientes.
8. Los documentos de `/system` no son escribibles desde el cliente.
9. Los tokens push pertenecen al usuario autenticado.
10. Los usuarios no pueden cambiar por sí mismos `role`, `isActive` o `congregationId`.

## Modelo de datos

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
/congregations/{congregationId}/outgoingTalks/{outgoingTalkId}
/congregations/{congregationId}/changeLogs/{changeLogId}
/congregations/{congregationId}/notifications/{notificationId}
/congregations/{congregationId}/preachingReports/{monthId}/submissions/{userId}
/dashboardSummary/{congregationId}
/system/{docId}
```

Las reglas fuente viven en `rules_src/`; `firestore.rules` es el artefacto generado. No debe editarse manualmente.

## Planes y facturación

Los planes limitan usuarios activos, no funciones.

| Plan | Usuarios activos | Precio mensual configurado |
| --- | ---: | ---: |
| `OMP 80` (`omp_80`) | 80 | 70 MXN |
| `OMP 150` (`omp_150`) | 150 | 120 MXN |
| `OMP 250` (`omp_250`) | 250 | 200 MXN |

La facturación pertenece a la congregación, no al usuario individual. El backend valida capacidad y permisos; Stripe Webhook sincroniza el estado real del pago.

Estados contemplados incluyen `active`, `trialing`, `past_due`, `payment_action_required`, `unpaid`, `canceled`, `incomplete`, `exempt` y `disabled`.

Parámetros actuales del backend:

- día de facturación: primero de cada mes;
- periodo de gracia: 5 días;
- historial de billing: retención de 365 días;
- región de Functions: `us-central1`.

Los precios y comisiones externas deben verificarse antes de cada publicación comercial. La referencia técnica completa está en [docs/billing-and-subscriptions.md](docs/billing-and-subscriptions.md).

## Internacionalización

Idiomas seleccionables:

- español (`es`);
- inglés (`en`);
- francés (`fr`);
- árabe (`ar`);
- hindi (`hi`);
- chino mandarín (`zh`).

Español e inglés contienen los locales completos. Francés, árabe, hindi y chino son traducciones parciales que heredan el locale inglés como fallback.

`AppTranslationKey` se deriva del locale español. Una llamada con una clave literal inexistente falla durante el typecheck.

## Estructura del repositorio

```text
app/                         Rutas de Expo Router
  (auth)/                    Rutas públicas
  (protected)/               Rutas autenticadas
  (protected)/(tabs)/        Pestañas principales
src/
  components/                Componentes reutilizables
  context/                   Estado transversal
  features/                  Funciones verticales
  hooks/                     Hooks compartidos
  i18n/                      Resolución y locales
  lib/firebase/              Inicialización de Firebase
  modules/                   Dominios funcionales
  screens/                   Pantallas principales
  services/                  Servicios y repositorios
  styles/                    Tema y colores
  types/                     Tipos y DTO
  utils/                     Utilidades puras
functions/                   Firebase Cloud Functions
rules_src/                   Fuentes modulares de reglas
docs/                        Documentación técnica
android/                     Proyecto nativo Android
firestore.rules              Reglas generadas
firestore.indexes.json       Índices de Firestore
firebase.json                Emuladores, Functions y Firestore
eas.json                     Perfiles de EAS
```

## Instalación

### Requisitos

- Node.js 22;
- npm;
- Java 21 para pruebas del emulador y builds Android;
- Android Studio/SDK para compilación Android local;
- Firebase CLI para emuladores y despliegues;
- cuenta Expo/EAS para builds remotos;
- Xcode y macOS para builds iOS locales.

### Dependencias

```bash
npm ci
npm ci --prefix functions
```

### Desarrollo

```bash
npm start
npm run web
npm run android
npm run ios
```

No debe usarse Expo Go como validación final de notificaciones push. Utiliza un development build o release.

## Variables y secretos

### Cliente Expo

El cliente lee estas variables públicas durante el build:

```dotenv
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY=
EXPO_PUBLIC_FIRESTORE_DEBUG=0
```

Las variables `EXPO_PUBLIC_*` forman parte del bundle y no deben contener secretos.

### Secrets de Cloud Functions

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_OMP_80
STRIPE_PRICE_OMP_150
STRIPE_PRICE_OMP_250
APP_BILLING_RETURN_URL
```

Configúralos con Firebase Secrets. Nunca confirmes `.env`, keystores, certificados, credenciales o archivos de logs.

## Comandos

### Aplicación

| Comando | Acción |
| --- | --- |
| `npm start` | Inicia Expo |
| `npm run web` | Inicia Web en desarrollo |
| `npm run android` | Ejecuta Android nativo |
| `npm run android:release` | Ejecuta variante release Android |
| `npm run ios` | Ejecuta iOS nativo |
| `npm run build:web` | Exporta Web a `dist/` y copia `.htaccess` |
| `npm run preview:web` | Sirve `dist/` como SPA |
| `npm run lint` | Ejecuta ESLint |
| `npm test` | Ejecuta Jest |
| `npm run test:watch` | Jest en modo watch |
| `npm run test:coverage` | Genera cobertura |
| `npm run validate` | Validación integral del repositorio |

### Firestore y despliegue

| Comando | Acción |
| --- | --- |
| `npm run build:rules` | Genera `firestore.rules` |
| `npm run check:rules` | Verifica que las reglas generadas estén actualizadas |
| `npm run test:rules` | Prueba reglas con Firestore Emulator |
| `npm run check:indexes` | Valida índices `collectionGroup` |
| `npm run deploy:rules` | Despliega reglas e índices |
| `npm run deploy:functions` | Despliega Functions |
| `npm run deploy:all` | Despliega reglas, índices y Functions |

### Functions

| Comando | Acción |
| --- | --- |
| `npm --prefix functions run lint` | Lint de backend |
| `npm --prefix functions run build` | Compila backend |
| `npm --prefix functions test -- --runInBand` | Pruebas de backend |
| `npm --prefix functions run serve` | Emulador de Functions |
| `npm --prefix functions run shell` | Firebase Functions Shell |
| `npm --prefix functions run logs` | Consulta logs |

## Pruebas e integración continua

Validación local recomendada:

```bash
npm ci
npm ci --prefix functions
npm run validate
npm run test:rules
npm run build:web
```

`npm run validate` ejecuta:

1. validación de índices;
2. lint de la aplicación;
3. TypeScript de la aplicación;
4. pruebas Jest de la aplicación;
5. lint de Functions;
6. build de Functions;
7. pruebas de Functions;
8. Expo Doctor.

GitHub Actions define tres trabajos:

- aplicación: instalación, lint, typecheck, pruebas, Expo Doctor y build web;
- Functions: instalación, lint, build y pruebas;
- Firestore Rules: Java 21, validación de índices, reglas generadas y pruebas de emulador.

## Builds y despliegues

### Android AAB local

Desde la carpeta `android`:

```powershell
cd A:\OMP\android
.\gradlew.bat clean
.\gradlew.bat bundleRelease
```

Salida:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

La firma release usa propiedades `MYAPP_UPLOAD_*` en el `gradle.properties` personal del desarrollador. Si no están configuradas, Gradle cae a la firma debug; ese artefacto no debe publicarse en Play Store.

### EAS

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest build --platform ios --profile production
```

Perfiles disponibles:

- `development`: development client, distribución interna;
- `preview`: distribución interna y APK Android;
- `production`: build de tienda con incremento remoto automático.

`eas.json` usa `appVersionSource: remote`. Antes de publicar, comprueba que el número remoto de EAS no retroceda respecto al `versionCode` o `buildNumber` esperado.

### Web

```bash
npm run build:web
npm run preview:web
```

El resultado queda en `dist/`. `firebase.json` no configura Firebase Hosting; el despliegue web debe realizarse en el hosting externo elegido para el proyecto.

## Versionado

OMP usa SemVer para la versión pública:

```text
MAJOR.MINOR.PATCH
```

- `MAJOR`: cambios incompatibles o una nueva generación del producto;
- `MINOR`: funciones nuevas compatibles;
- `PATCH`: correcciones compatibles.

Estado de la versión `1.36.1`:

```text
package.json:                    1.36.1
package-lock.json:               1.36.1
app.json → expo.version:         1.36.1
app.json → ios.buildNumber:      1.36.1
app.json → android.versionCode:  13601
android versionName:             1.36.1
android versionCode:             13601
```

Los nombres de lanzamiento son opcionales y no reemplazan la versión técnica. Pueden usarse en notas de release con el formato `OMP 1.36.1 — Nombre`.

## Notificaciones

OMP combina:

- notificaciones internas en Firestore;
- tokens en `/users/{uid}/pushTokens`;
- Expo Notifications en el cliente;
- Expo Server SDK y Firebase Admin Messaging en backend;
- canales Android;
- navegación interna mediante enlaces permitidos;
- limpieza de tokens inválidos y datos antiguos.

Reglas operativas:

- solicitar permiso después de explicar su utilidad;
- segmentar siempre por congregación;
- no enviar a usuarios de otra congregación;
- desactivar tokens que respondan `DeviceNotRegistered`;
- probar en development build y release sobre dispositivos físicos.

## Cache y costos de Firestore

El proyecto usa AsyncStorage y capas de cache/repositorios. Para controlar lecturas:

- priorizar estrategias cache-first;
- reservar `onSnapshot` para datos realmente en tiempo real;
- evitar listeners duplicados;
- limpiar suscripciones al desmontar;
- usar guardas single-flight para solicitudes simultáneas;
- invalidar cache después de escrituras;
- usar `dashboardSummary` en lugar de descargar colecciones completas;
- filtrar siempre por `congregationId`.

## Estado de producción

La aplicación está en beta avanzada. El código contiene flujos productivos, pero una publicación amplia requiere evidencia operativa adicional.

### Antes de cada release

- [ ] confirmar versión y números de build;
- [ ] ejecutar `npm run validate`;
- [ ] ejecutar `npm run test:rules`;
- [ ] generar y revisar el build web;
- [ ] generar AAB/IPA con firma de producción;
- [ ] probar Android, iOS y Web;
- [ ] validar autenticación y rutas protegidas;
- [ ] probar notificaciones en dispositivos físicos;
- [ ] verificar Stripe Checkout, Portal y Webhook en el ambiente correcto;
- [ ] revisar Rules, índices y permisos;
- [ ] comprobar que no se incluyan secretos ni artefactos generados.

### Riesgos y trabajo pendiente

- QA físico completo de push en Android e iOS;
- validación end-to-end de billing en cada ambiente;
- App Check nativo;
- observabilidad centralizada y alertas;
- estrategia de backups y restauración probada;
- auditorías periódicas de Firestore Rules;
- pruebas de navegación y componentes visuales;
- mantener sincronizados código, documentación y notas de release.

## Documentación

| Documento | Tema |
| --- | --- |
| [architecture.md](docs/architecture.md) | Arquitectura general |
| [permissions-model.md](docs/permissions-model.md) | Modelo de permisos |
| [permissions-matrix.md](docs/permissions-matrix.md) | Matriz de acceso |
| [firestore-security.md](docs/firestore-security.md) | Seguridad de Firestore |
| [billing-and-subscriptions.md](docs/billing-and-subscriptions.md) | Billing y Stripe |
| [congregation-plans.md](docs/congregation-plans.md) | Planes y límites |
| [deployment.md](docs/deployment.md) | Despliegue general |
| [deployment-mobile.md](docs/deployment-mobile.md) | Builds móviles |
| [notifications.md](docs/notifications.md) | Arquitectura de notificaciones |
| [qa-notifications.md](docs/qa-notifications.md) | QA de push |
| [qa-mobile-navigation.md](docs/qa-mobile-navigation.md) | QA móvil |
| [app-check-rollout.md](docs/app-check-rollout.md) | Despliegue de App Check |
| [cache-strategy.md](docs/cache-strategy.md) | Estrategia de cache |
| [testing.md](docs/testing.md) | Estrategia de pruebas |
| [predeploy-validation.md](docs/predeploy-validation.md) | Checklist previo al despliegue |
| [ux-guidelines.md](docs/ux-guidelines.md) | Guías de interfaz |
| [refactor-plan.md](docs/refactor-plan.md) | Plan técnico de refactorización |
| [private-use-policy.md](docs/private-use-policy.md) | Política de uso privado |

## Convenciones de contribución

- usar Conventional Commits;
- mantener cambios pequeños y enfocados;
- no mezclar migraciones, seguridad y cambios visuales sin necesidad;
- no editar `firestore.rules` directamente;
- acompañar cambios de autorización con pruebas;
- actualizar documentación y versión cuando corresponda;
- no confirmar `.env`, certificados, keystores, credenciales, logs o builds.

Ejemplos:

```text
feat(cleaning): add schedule filters
fix(i18n): add missing translation keys
test(functions): cover meeting cleanup
docs(readme): refresh release information
```

## Licencia y uso

La visibilidad del repositorio no concede por sí sola una licencia de uso, redistribución, reventa o publicación de aplicaciones derivadas. Mientras no exista un archivo `LICENSE` explícito, todos los derechos permanecen reservados.

OMP Suite debe presentarse siempre como una herramienta independiente y nunca como una aplicación oficial o afiliada a JW.ORG.
