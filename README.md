<div align="center">

# OMP Suite

### Organization, Ministry & Programs

**Plataforma multiplataforma para la organización interna, administración y coordinación operativa de congregaciones.**

`Web` · `Android` · `iOS` · `Expo` · `React Native` · `Firebase` · `Stripe`

---

**Versión actual:** `1.31.2`
**Estado:** Beta avanzada en estabilización para producción
**Última actualización del documento:** 31 de julio de 2026
**Repositorio principal:** `Marcor360/OMP`

</div>

> [!IMPORTANT]
> OMP Suite no es una aplicación oficial de JW.ORG y no está afiliada, respaldada, patrocinada ni aprobada por ninguna entidad oficial de los Testigos de Jehová. Es una herramienta tecnológica independiente, desarrollada para uso organizativo privado.

---

## Índice

1. [Descripción general](#descripción-general)
2. [Estado actual](#estado-actual)
3. [Objetivo del producto](#objetivo-del-producto)
4. [Problemas que resuelve](#problemas-que-resuelve)
5. [Plataformas soportadas](#plataformas-soportadas)
6. [Módulos funcionales](#módulos-funcionales)
7. [Arquitectura](#arquitectura)
8. [Stack tecnológico](#stack-tecnológico)
9. [Estructura del repositorio](#estructura-del-repositorio)
10. [Navegación y autenticación](#navegación-y-autenticación)
11. [Roles, permisos y seguridad](#roles-permisos-y-seguridad)
12. [Modelo de datos](#modelo-de-datos)
13. [Cache y rendimiento](#cache-y-rendimiento)
14. [Notificaciones](#notificaciones)
15. [Billing y suscripciones](#billing-y-suscripciones)
16. [Planes y precios](#planes-y-precios)
17. [Por qué se cobra](#por-qué-se-cobra)
18. [Inversión y horas de desarrollo](#inversión-y-horas-de-desarrollo)
19. [Valor estimado del proyecto](#valor-estimado-del-proyecto)
20. [Costos tecnológicos](#costos-tecnológicos)
21. [Comisiones de Stripe](#comisiones-de-stripe)
22. [Instalación](#instalación)
23. [Variables de entorno](#variables-de-entorno)
24. [Secrets de Cloud Functions](#secrets-de-cloud-functions)
25. [Comandos principales](#comandos-principales)
26. [Desarrollo local y emuladores](#desarrollo-local-y-emuladores)
27. [Testing y validación](#testing-y-validación)
28. [Integración continua](#integración-continua)
29. [Builds y despliegues](#builds-y-despliegues)
30. [Estado funcional por módulo](#estado-funcional-por-módulo)
31. [Riesgos y deuda técnica](#riesgos-y-deuda-técnica)
32. [Requisitos para producción](#requisitos-para-producción)
33. [Roadmap](#roadmap)
34. [Convenciones de desarrollo](#convenciones-de-desarrollo)
35. [Documentación técnica](#documentación-técnica)
36. [Licencia y uso](#licencia-y-uso)

---

# Descripción general

OMP Suite es una aplicación multiplataforma diseñada para centralizar la organización interna de una congregación en una sola plataforma.

El sistema permite administrar:

* usuarios;
* perfiles;
* roles;
* permisos;
* privilegios;
* responsabilidades;
* reuniones;
* asignaciones;
* discursos externos;
* limpieza;
* hospitalidad;
* acomodadores;
* micrófonos;
* lectores;
* predicación;
* territorios;
* eventos;
* notificaciones;
* organigrama congregacional;
* configuración;
* planes;
* suscripciones;
* pagos;
* restricciones administrativas;
* historial operativo.

OMP combina una aplicación cliente desarrollada con Expo y React Native con un backend serverless basado en Firebase, Cloud Functions, Firestore Rules, Stripe Billing y servicios de notificaciones.

---

# Estado actual

| Dato                 | Estado                                            |
| -------------------- | ------------------------------------------------- |
| Nombre               | OMP Suite                                         |
| Significado          | Organization, Ministry & Programs                 |
| Repositorio          | `Marcor360/OMP`                                   |
| Versión visible      | `1.31.2`                                          |
| Fuente de versión    | `app.json` → `expo.version`                       |
| Estado               | Beta avanzada                                     |
| Fase actual          | Estabilización y QA para producción               |
| Desarrollo acumulado | Aproximadamente cuatro meses de trabajo intensivo |
| Plataforma principal | Expo / React Native                               |
| Backend              | Firebase                                          |
| Base de datos        | Cloud Firestore                                   |
| Autenticación        | Firebase Authentication                           |
| Backend privilegiado | Cloud Functions                                   |
| Pagos                | Stripe Billing                                    |
| Notificaciones       | Expo Notifications y Firebase Admin Messaging     |
| Modelo comercial     | Suscripción mensual por congregación              |
| Unidad de cobro      | Congregación                                      |
| Idiomas              | Español e inglés                                  |
| Tema                 | Claro, oscuro y automático                        |
| Plataformas          | Web, Android e iOS                                |

## Estado de versión

La versión visible de OMP se obtiene desde:

```text
app.json → expo.version
```

Estado actual:

```text
package.json:        1.31.2
app.json:            1.31.2
versión visible:     1.31.2
EAS build numbers:   gestionados remotamente
```

Los números de compilación de Android e iOS no sustituyen la versión pública de la aplicación.

EAS utiliza:

```json
{
  "cli": {
    "appVersionSource": "remote"
  }
}
```

Esto permite administrar `versionCode` y `buildNumber` desde EAS sin modificar la versión comercial visible.

## Clasificación del producto

OMP ya no debe considerarse:

* una demostración;
* una maqueta;
* una plantilla;
* un sitio web estático;
* un prototipo únicamente visual.

Actualmente dispone de:

* frontend multiplataforma;
* backend operativo;
* modelo de datos real;
* autenticación;
* autorización;
* Firestore Rules;
* Cloud Functions;
* billing;
* notificaciones;
* cache;
* pruebas automatizadas;
* integración continua;
* documentación técnica;
* procesos de build y despliegue.

OMP puede utilizarse en pruebas controladas y pilotos internos. Antes de una distribución comercial amplia deben completarse las validaciones de producción descritas en este documento.

---

# Objetivo del producto

OMP busca reemplazar procesos administrativos fragmentados por una fuente centralizada de información.

Los objetivos principales son:

* centralizar la información de cada congregación;
* reducir errores administrativos;
* reducir duplicación de datos;
* disminuir dependencia de documentos separados;
* mejorar la organización semanal;
* controlar quién puede consultar o modificar información;
* automatizar tareas repetitivas;
* mejorar la trazabilidad;
* facilitar la comunicación;
* mejorar la experiencia móvil;
* proporcionar acceso desde distintos dispositivos;
* proteger información sensible;
* mantener historial operativo;
* optimizar lecturas de Firestore;
* preparar la plataforma para crecer;
* mantener un costo accesible para cada congregación.

---

# Problemas que resuelve

OMP ayuda a reducir o eliminar:

* usuarios administrados en archivos separados;
* asignaciones duplicadas;
* asignaciones incompatibles;
* reuniones creadas sin control central;
* conflictos con discursos externos;
* grupos de limpieza administrados manualmente;
* planificación de acomodadores y micrófonos fuera del sistema;
* territorios administrados en hojas independientes;
* poca claridad sobre responsabilidades;
* permisos informales o ambiguos;
* falta de aislamiento entre congregaciones;
* notificaciones dispersas;
* ausencia de historial;
* dependencia de una sola computadora;
* dependencia de una sola persona;
* mensajes individuales repetitivos;
* exceso de consultas a Firestore;
* errores técnicos mostrados directamente al usuario;
* diferencias de navegación entre web y móvil;
* cobros gestionados manualmente;
* falta de límites de usuarios por plan.

---

# Plataformas soportadas

## Web

La aplicación web utiliza:

* Expo Web;
* React Native Web;
* Metro;
* salida estática de página única;
* estilos compartidos con Android e iOS.

La versión web está orientada principalmente a:

* administradores;
* coordinadores;
* secretarios;
* encargados de departamentos;
* auxiliares;
* usuarios que realizan tareas administrativas extensas;
* equipos que prefieren trabajar desde computadora.

Comandos:

```bash
npm run web
npm run build:web
npm run preview:web
```

El build se genera en:

```text
dist/
```

Firebase Hosting no está configurado en el repositorio actual. El build web debe publicarse en el hosting externo configurado para `ompsuite.com`.

## Android

Android es una plataforma principal del proyecto.

Configuración principal:

```text
Package: com.marcor360.omp
```

Incluye:

* icono adaptativo;
* icono monocromático;
* splash screen;
* soporte de notificaciones;
* vibración;
* manejo del teclado;
* development builds;
* release builds;
* EAS Build;
* bloqueo explícito de permisos innecesarios.

## iOS

El proyecto está preparado técnicamente para iOS mediante Expo y EAS.

Incluye:

* identificador `com.marcor360.omp`;
* soporte para iPhone;
* soporte para iPad;
* notificaciones;
* background mode para notificaciones remotas;
* configuración de privacidad;
* builds remotos mediante EAS.

La preparación del código no sustituye las pruebas físicas. Antes de publicar en App Store deben validarse:

* instalación;
* autenticación;
* navegación;
* permisos;
* notificaciones;
* deep links;
* Stripe Checkout;
* Customer Portal;
* rendimiento;
* revisión de App Store.

---

# Módulos funcionales

## Usuarios

Permite:

* crear usuarios desde Cloud Functions;
* editar perfiles;
* cambiar contraseña mediante administración autorizada;
* activar o desactivar usuarios;
* eliminar usuarios;
* asignar roles;
* asignar permisos;
* asignar privilegios;
* asignar responsabilidades;
* relacionar usuarios con una congregación;
* relacionar usuarios con departamentos;
* controlar límites de usuarios activos;
* paginar usuarios;
* consultar usuarios asignables.

Las acciones administrativas sensibles no dependen únicamente del cliente.

## Reuniones

Incluye:

* reuniones entre semana;
* reuniones de fin de semana;
* creación;
* edición;
* eliminación;
* publicación;
* borradores;
* secciones;
* participantes;
* asignaciones;
* limpieza relacionada;
* hospitalidad;
* sincronización;
* recordatorios;
* control de publicación.

## Asignaciones

Incluye:

* asignaciones independientes;
* asignaciones relacionadas con reuniones;
* usuarios asignados;
* responsables;
* estados;
* fechas;
* prioridades;
* categorías;
* vencimientos;
* notificaciones;
* edición;
* cancelación;
* finalización.

## Discursos externos

Permite:

* registrar discursos;
* registrar oradores;
* asignar fechas;
* controlar estados;
* cancelar;
* completar;
* detectar conflictos;
* emitir notificaciones.

## Eventos

Permite administrar:

* conmemoración;
* asambleas;
* visitas;
* reuniones especiales;
* capacitaciones;
* reuniones anuales;
* eventos internos;
* fechas;
* ubicaciones;
* responsables;
* notificaciones de cambios;
* limpieza programada de registros antiguos.

## Limpieza

Incluye:

* grupos de limpieza;
* integrantes;
* responsables;
* elegibilidad;
* alta y baja de integrantes;
* planificación;
* generación de calendarios;
* publicación;
* sincronización con reuniones;
* cache de usuarios asignables;
* control de permisos;
* Cloud Functions para operaciones administrativas.

Funciones principales:

```text
createCleaningGroupByManager
updateCleaningGroupByManager
addCleaningGroupMembersByManager
removeCleaningGroupMemberByManager
deactivateCleaningGroupByManager
deleteCleaningGroupByManager
publishCleaningScheduleByManager
```

## Acomodadores, micrófonos y lectores

Incluye:

* presidente;
* acomodadores;
* puerta;
* auditorio;
* micrófono 1;
* micrófono 2;
* micrófono 3 opcional;
* acomodador adicional opcional;
* lectores;
* audio y video;
* responsables;
* auxiliares;
* planificación;
* publicación;
* sustituciones;
* sincronización con reuniones;
* relleno de slots nativos de lector;
* prevención de duplicados;
* permisos específicos mediante `acomodadores_microfonos`.

Funciones principales:

```text
publishHospitalityScheduleByManager
substituteHospitalityAssignmentByManager
```

## Predicación

Incluye:

* reportes;
* grupos;
* responsables;
* auxiliares;
* permisos;
* aprobación;
* exportación;
* información por congregación;
* historial por periodo.

## Territorios

Incluye:

* catálogo de territorios;
* creación;
* edición;
* desactivación;
* asignaciones mensuales;
* responsables;
* auxiliares;
* permisos granulares;
* recordatorios;
* limpieza programada;
* historial.

## Organigrama congregacional

El organigrama se genera a partir de las asignaciones de servicio de los usuarios.

Fuente principal:

```text
/users/{uid}.serviceAssignments
```

Proyección:

```text
/congregations/{congregationId}/departments
/congregations/{congregationId}/departmentAssignments
```

Incluye:

* departamentos;
* responsables;
* auxiliares;
* jerarquías;
* vista móvil;
* vista de escritorio;
* regeneración manual;
* reconciliación automática;
* IDs deterministas;
* detección de duplicados;
* desactivación de asignaciones eliminadas.

## Dashboard

Incluye:

* resumen por congregación;
* métricas;
* próximas reuniones;
* asignaciones pendientes;
* asignaciones vencidas;
* eventos;
* limpieza;
* predicación;
* organigrama;
* accesos rápidos;
* tarjetas condicionadas por permisos;
* actualización manual;
* actualización al recuperar el foco;
* resumen precalculado;
* fallback de lectura semanal.

## Notificaciones

Incluye:

* notificaciones internas;
* notificaciones push;
* tokens por usuario;
* preferencias;
* recordatorios;
* avisos de asignaciones;
* avisos de reuniones;
* avisos de eventos;
* enlaces internos;
* limpieza de tokens inválidos;
* limpieza programada;
* compatibilidad con migraciones anteriores.

## Configuración

Incluye:

* perfil;
* cuenta;
* idioma;
* tema;
* versión;
* información de la aplicación;
* plan;
* facturación;
* accesos administrativos;
* cierre de sesión.

## Contador personal de horas

OMP incluye un módulo local para el registro personal de actividad de servicio del campo.

Este módulo:

* funciona localmente;
* no depende de Firebase;
* no representa las horas de desarrollo del proyecto;
* pertenece exclusivamente a la información personal del usuario.

---

# Arquitectura

OMP utiliza una arquitectura cliente-servidor serverless, organizada por capas.

```text
Interfaz de usuario
        ↓
Rutas y pantallas
        ↓
Componentes y hooks
        ↓
Servicios y casos de uso
        ↓
Repositorios / Firebase SDK / Callable Functions
        ↓
Firestore Rules / Cloud Functions
        ↓
Firestore / Authentication / Stripe / Push
```

## Principios arquitectónicos

1. Las rutas deben permanecer ligeras.
2. Las pantallas no deben concentrar toda la lógica.
3. El acceso a datos debe pasar por servicios o repositorios.
4. La interfaz puede ocultar acciones, pero no representa la defensa principal.
5. Firestore Rules debe proteger la información aunque la interfaz falle.
6. Las operaciones privilegiadas deben pasar por Cloud Functions.
7. Todo dato congregacional debe aislarse mediante `congregationId`.
8. Stripe Webhook debe ser la fuente de verdad de los pagos.
9. Los permisos deben calcularse de forma consistente.
10. Los datos sensibles no deben depender del cache.
11. Después de una escritura se debe invalidar el cache relacionado.
12. La lógica crítica debe poder probarse sin renderizar una pantalla.
13. No deben realizarse consultas globales salvo en flujos superadmin protegidos.

## Separación de responsabilidades

### Cliente

Responsable de:

* interfaz;
* formularios;
* navegación;
* estados de carga;
* estados vacíos;
* mensajes de error;
* visibilidad de módulos;
* cache;
* interacción con Firebase;
* llamadas a Functions.

### Firestore Rules

Responsables de:

* autenticación;
* pertenencia a congregación;
* aislamiento de datos;
* validación de forma;
* validación de campos;
* protección de roles;
* protección de permisos;
* control de lectura y escritura.

### Cloud Functions

Responsables de:

* creación administrativa de usuarios;
* modificación de campos sensibles;
* sincronizaciones;
* billing;
* Stripe;
* webhooks;
* notificaciones;
* mantenimiento;
* tareas programadas;
* proyecciones;
* operaciones que requieren Firebase Admin SDK.

---

# Stack tecnológico

## Frontend

| Tecnología                   | Versión o función  |
| ---------------------------- | ------------------ |
| Expo                         | SDK `54.0.36`      |
| React                        | `19.1.0`           |
| React Native                 | `0.81.5`           |
| React Native Web             | `0.21`             |
| TypeScript                   | `5.9`              |
| Expo Router                  | `6.0`              |
| React Navigation             | `7`                |
| NativeWind                   | `4.2`              |
| Tailwind CSS                 | `3.4`              |
| Firebase Web SDK             | `12.11`            |
| AsyncStorage                 | Persistencia local |
| Expo Notifications           | Notificaciones     |
| Expo Image                   | Imágenes           |
| Expo Linking                 | Deep links         |
| Expo Web Browser             | Checkout y portal  |
| React Native Reanimated      | Animaciones        |
| React Native Gesture Handler | Gestos             |
| React Native SVG             | Gráficos e iconos  |
| Ionicons                     | Iconografía        |

El proyecto utiliza:

```json
{
  "typedRoutes": true,
  "reactCompiler": true
}
```

## Backend

| Tecnología                   | Función                   |
| ---------------------------- | ------------------------- |
| Node.js 22                   | Runtime de Functions      |
| Firebase Authentication      | Identidad                 |
| Cloud Firestore              | Base de datos             |
| Cloud Functions for Firebase | Backend                   |
| Firebase Admin SDK           | Operaciones privilegiadas |
| Firebase Admin Messaging     | Mensajería                |
| Firestore Rules              | Seguridad                 |
| Firestore Indexes            | Consultas                 |
| Firebase Emulator Suite      | Pruebas locales           |
| Firebase Secrets             | Secretos                  |
| Stripe                       | Pagos                     |
| Stripe Billing               | Suscripciones             |
| Stripe Checkout              | Alta de suscripción       |
| Stripe Customer Portal       | Gestión de suscripción    |
| Stripe Webhooks              | Sincronización de pagos   |
| Expo Server SDK              | Push notifications        |

## Calidad y automatización

* ESLint;
* TypeScript estricto;
* Jest;
* Jest Expo;
* ts-jest;
* Firebase Rules Unit Testing;
* Firebase Emulator Suite;
* Expo Doctor;
* GitHub Actions;
* Husky;
* Commitlint;
* Conventional Commits.

---

# Estructura del repositorio

```text
OMP/
├── app/
│   ├── (auth)/
│   ├── (protected)/
│   │   ├── (tabs)/
│   │   ├── assignments/
│   │   ├── billing/
│   │   ├── cleaning/
│   │   ├── events/
│   │   ├── meetings/
│   │   ├── notifications/
│   │   ├── preaching/
│   │   ├── settings/
│   │   ├── territories/
│   │   └── users/
│   ├── _layout.tsx
│   └── language-setup.tsx
│
├── src/
│   ├── components/
│   ├── config/
│   ├── context/
│   ├── features/
│   ├── hooks/
│   ├── i18n/
│   ├── lib/
│   │   └── firebase/
│   ├── modules/
│   ├── screens/
│   ├── services/
│   ├── styles/
│   ├── types/
│   └── utils/
│
├── functions/
│   ├── src/
│   │   ├── billing/
│   │   ├── config/
│   │   ├── maintenance/
│   │   ├── modules/
│   │   ├── organization/
│   │   ├── shared/
│   │   ├── users/
│   │   └── index.ts
│   ├── scripts/
│   ├── package.json
│   └── tsconfig.json
│
├── rules_src/
│   ├── manifest.json
│   └── *.rules
│
├── firestore-rules/
├── docs/
├── scripts/
├── assets/
├── public/
├── .github/
│   └── workflows/
├── app.json
├── eas.json
├── firebase.json
├── firestore.indexes.json
├── firestore.rules
├── package.json
└── tsconfig.json
```

## Convención de carpetas

* `app/`: rutas de Expo Router.
* `src/screens/`: pantallas de alto nivel.
* `src/components/`: componentes reutilizables.
* `src/modules/`: dominios funcionales.
* `src/features/`: funcionalidades transversales aún en migración.
* `src/services/`: acceso a servicios, Firebase y repositorios.
* `src/context/`: estado global.
* `src/hooks/`: comportamiento reutilizable.
* `src/types/`: contratos TypeScript.
* `src/utils/`: utilidades puras y permisos.
* `functions/`: backend.
* `rules_src/`: fuente modular de Firestore Rules.
* `docs/`: documentación técnica.

---

# Navegación y autenticación

OMP utiliza Expo Router.

## Grupos de rutas

```text
app/(auth)/
```

Rutas públicas:

* login;
* recuperación;
* autenticación.

```text
app/(protected)/
```

Rutas protegidas:

* dashboard;
* reuniones;
* asignaciones;
* usuarios;
* limpieza;
* predicación;
* territorios;
* billing;
* notificaciones;
* configuración;
* organigrama.

## Flujo de arranque

1. Se inicializa el tema.
2. Se inicializa el cache persistente.
3. Se inicializan las traducciones.
4. Se comprueba el onboarding de idioma.
5. Firebase restaura la sesión.
6. Se obtiene el perfil del usuario.
7. Se valida el estado de la congregación.
8. Se calcula la navegación disponible.
9. Se configuran notificaciones.
10. Se renderiza la zona protegida.

## Control de sesión

OMP mantiene un control de inactividad basado en tiempo real transcurrido.

Configuración actual:

```text
Inactividad máxima:       15 minutos
Advertencia previa:       60 segundos
Persistencia de actividad: AsyncStorage
Comprobación periódica:   60 segundos
```

El control contempla:

* actividad en navegador;
* múltiples pestañas;
* cambio de visibilidad;
* suspensión móvil;
* retorno desde segundo plano;
* cierre manual;
* limpieza de sesión;
* limpieza de cache.

---

# Roles, permisos y seguridad

## Roles técnicos

Los únicos roles técnicos canónicos son:

```ts
type UserRole = 'admin' | 'supervisor' | 'user';
```

No deben crearse nuevos documentos utilizando:

```text
administrador
usuario
```

Las entradas históricas pueden normalizarse en procesos controlados, pero Firestore Rules no debe aceptar aliases legacy en nuevas escrituras.

## Separación conceptual

| Campo                   | Propósito                               |
| ----------------------- | --------------------------------------- |
| `role`                  | Nivel técnico general                   |
| `permissions`           | Acciones permitidas por módulo          |
| `privileges`            | Condiciones internas del usuario        |
| `serviceAssignments`    | Responsabilidades por departamento      |
| `serviceAssignmentKeys` | Índice normalizado de responsabilidades |
| `responsibilities`      | Marcadores funcionales especiales       |

## Departamentos con permisos

```text
usuarios
reuniones
limpieza
departments
organigrama
predicacion
tesoreria
pagos
configuracion
avisos
asignaciones
acomodadores_microfonos
```

## Acciones disponibles

```text
view
create
edit
delete
manage
approve
export
```

Territorios añade:

```text
assign
```

## Defensa por capas

OMP aplica seguridad en tres niveles:

### Interfaz

Controla:

* visibilidad;
* navegación;
* botones;
* acciones disponibles;
* mensajes de acceso denegado.

### Firestore Rules

Controla:

* autenticación;
* estado activo;
* congregación;
* forma de los documentos;
* campos permitidos;
* roles;
* permisos;
* lectura;
* escritura.

### Cloud Functions

Controla:

* identidad;
* perfil;
* congregación;
* permisos;
* payloads;
* operaciones privilegiadas;
* integridad del proceso.

## Firestore Rules modulares

`firestore.rules` es un artefacto generado.

La fuente real está en:

```text
rules_src/
```

El manifest se encuentra en:

```text
rules_src/manifest.json
```

Para generar:

```bash
npm run build:rules
```

Para comprobar que nadie editó el archivo generado manualmente:

```bash
npm run check:rules
```

El proceso también detecta módulos `.rules` que no estén declarados en el manifest.

## App Check

App Check está preparado para web mediante reCAPTCHA v3.

Variable:

```env
EXPO_PUBLIC_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY=
```

Estado:

* Web: implementación disponible.
* Android: implementación nativa pendiente.
* iOS: implementación nativa pendiente.
* Enforcement: debe activarse después de validar tráfico real.

## Configuración Firebase segura

En desarrollo pueden utilizarse valores de fallback.

En producción, si faltan variables de entorno obligatorias, la aplicación falla explícitamente en lugar de conectarse silenciosamente al proyecto de desarrollo.

---

# Modelo de datos

## Colecciones principales

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
/congregations/{congregationId}/departments/{departmentId}
/congregations/{congregationId}/departmentAssignments/{assignmentId}
/congregations/{congregationId}/notifications/{notificationId}
/congregations/{congregationId}/changeLogs/{changeLogId}
/congregations/{congregationId}/preachingReports/{monthId}/submissions/{userId}
/congregations/{congregationId}/billingHistory/{stripeEventId}

/dashboardSummary/{congregationId}
/system/{docId}
/superAdmins/{uid}
```

## Regla central

> Todo dato perteneciente a una congregación debe estar asociado, consultado y protegido mediante `congregationId`.

No se deben realizar consultas de todas las congregaciones desde módulos normales.

Los flujos globales deben limitarse al panel superadmin y estar protegidos mediante backend y Rules.

---

# Cache y rendimiento

OMP utiliza una estrategia `cache-first` para reducir latencia y lecturas innecesarias.

## Capas

1. Memoria de sesión.
2. AsyncStorage.
3. Cache persistente de Firestore en web.
4. Servidor Firestore.

## Principios

* No usar cache como fuente de verdad para billing.
* No usar cache como fuente definitiva de permisos.
* Invalidar después de crear, editar, eliminar o publicar.
* Limpiar el cache al cerrar sesión.
* Limpiar datos al cambiar de congregación.
* Asociar las claves de cache con `congregationId`.
* Utilizar `schemaVersion`.
* Aplicar TTL.
* Limitar el tamaño.
* Evitar listeners duplicados.
* Cancelar listeners al desmontar.
* Evitar solicitudes concurrentes duplicadas.
* Usar consultas `count()` cuando solo se necesita un total.
* Usar paginación cuando la colección puede crecer.
* Utilizar resúmenes precalculados para dashboards.

## Ciclo del cache persistente

El cache local utiliza un ciclo operativo anual:

```text
Inicio: 1 de septiembre
Fin:    31 de agosto
```

---

# Notificaciones

OMP utiliza:

* Expo Notifications;
* Expo Push Tokens;
* Firebase Admin Messaging;
* Expo Server SDK;
* notificaciones internas en Firestore;
* canales Android;
* triggers;
* funciones programadas.

## Flujo

1. El usuario inicia sesión.
2. La aplicación explica por qué necesita permiso.
3. El usuario concede permiso.
4. Se obtiene el token.
5. El token se registra para el usuario.
6. El backend crea una notificación.
7. El trigger procesa el documento.
8. Se envía el push.
9. La aplicación recibe la interacción.
10. Se valida la ruta interna.
11. Se abre el módulo correspondiente.

## Reglas

* No utilizar Expo Go como prueba final.
* Probar en development build o release.
* Eliminar tokens inválidos.
* Respetar las preferencias del usuario.
* Segmentar por congregación.
* Evitar información sensible innecesaria.
* Validar las rutas mediante allowlist.
* No aceptar rutas de autenticación como deep links de notificación.
* Auditar todos los listeners antes de cada release.

---

# Billing y suscripciones

OMP utiliza un modelo de suscripción mensual por congregación.

No se cobra una suscripción individual por cada usuario. Cada plan determina el máximo de usuarios activos permitidos dentro de una congregación.

## Componentes

```text
createStripeCheckoutSession
createStripePortalSession
getStripeBillingUsage
stripeWebhook
sendBillingPaymentReminders
scheduledBillingHistoryCleanup
setBillingExemptionByRootAdmin
```

## Flujo de alta

1. El usuario autorizado abre Billing.
2. La aplicación consulta el número de usuarios activos.
3. El usuario selecciona un plan.
4. Se llama a `createStripeCheckoutSession`.
5. La Function valida autenticación.
6. La Function valida congregación.
7. La Function valida permisos.
8. Se crea o reutiliza el cliente de Stripe.
9. Se crea una sesión de Checkout.
10. Stripe procesa el pago.
11. Stripe redirige a OMP.
12. Stripe Webhook recibe el evento.
13. Firestore se actualiza.
14. La aplicación muestra el estado almacenado.

La ruta de éxito no representa por sí sola una confirmación de pago.

La fuente de verdad es:

```text
Stripe Webhook → Cloud Function → Firestore
```

## Estados de billing

```text
disabled
checkout_pending
active
trialing
past_due
payment_action_required
unpaid
canceled
incomplete
incomplete_expired
exempt
```

## Periodo de gracia

Los estados siguientes pueden disponer de un periodo de gracia de cinco días:

```text
past_due
payment_action_required
incomplete
```

Después del periodo de gracia, OMP puede restringir escrituras administrativas sin bloquear necesariamente toda la lectura de información.

## Exenciones

Una congregación puede quedar exenta de cobro.

Ejemplo conceptual:

```ts
billingExemption: {
  exempt: true,
  reason: 'Motivo administrativo',
  grantedBy: 'uid',
  grantedAt: Timestamp,
  expiresAt: Timestamp | null
}
```

Una congregación exenta:

* no inicia Checkout;
* no se restringe por falta de pago;
* no recibe recordatorios de pago;
* conserva un límite de usuarios;
* muestra el estado `exempt`.

---

# Planes y precios

| Plan      | Límite de usuarios activos | Precio mensual |
| --------- | -------------------------- | -------------- |
| `omp_80`  | 80                         | **70 MXN**     |
| `omp_150` | 150                        | **120 MXN**    |
| `omp_250` | 250                        | **200 MXN**    |

## Lookup keys

```text
omp_80
omp_150
omp_250
```

## Política de precios

Los precios vigentes son:

```text
OMP 80:   70 MXN al mes
OMP 150: 120 MXN al mes
OMP 250: 200 MXN al mes
```

El precio:

* se cobra por congregación;
* incluye el uso del plan correspondiente;
* contempla el procesamiento mediante Stripe;
* no añade una comisión separada de Stripe al cliente;
* distribuye el mantenimiento entre múltiples congregaciones.

Stripe descuenta sus comisiones del ingreso recibido por OMP.

Los Price IDs:

* son específicos de cada ambiente;
* deben configurarse mediante Secrets;
* no deben escribirse directamente en el frontend;
* no deben reutilizarse entre sandbox y producción sin validación.

Un cambio futuro de precios requiere:

1. decisión comercial;
2. creación de nuevos Prices;
3. estrategia para suscripciones existentes;
4. actualización de configuración;
5. actualización de frontend;
6. actualización de backend;
7. actualización de documentación;
8. pruebas;
9. comunicación previa.

---

# Por qué se cobra

OMP no es una página estática. Es una plataforma que genera costos técnicos, operativos y humanos continuos.

La suscripción ayuda a cubrir:

## Desarrollo

* análisis;
* planificación;
* arquitectura;
* frontend;
* backend;
* UX/UI;
* refactors;
* nuevas funciones;
* corrección de errores;
* testing;
* documentación;
* builds;
* despliegues.

## Infraestructura

* dominio;
* hosting;
* Firebase;
* Google Cloud;
* Firestore;
* Cloud Functions;
* almacenamiento;
* tráfico;
* logs;
* secrets;
* notificaciones;
* builds remotos.

## Pagos

* Stripe Payments;
* Stripe Billing;
* Checkout;
* Customer Portal;
* Webhooks;
* historial;
* recordatorios;
* comisiones;
* atención de pagos fallidos;
* conciliación.

## Seguridad

* Firestore Rules;
* validación de payloads;
* auditoría de permisos;
* aislamiento por congregación;
* protección de datos;
* rotación de secretos;
* actualización de dependencias;
* revisión de accesos.

## Soporte y operación

* atención de errores;
* asistencia a administradores;
* revisión de datos;
* mantenimiento;
* compatibilidad con nuevas versiones;
* monitoreo;
* QA de builds;
* recuperación ante fallos.

---

# Inversión y horas de desarrollo

El repositorio no incluye un sistema formal de control de horas. Por ello, las cifras siguientes son estimaciones técnicas y no registros laborales certificados.

El número de commits no debe utilizarse como equivalente directo de tiempo invertido.

## Estimación de trabajo directo

| Área                                    | Horas estimadas     |
| --------------------------------------- | ------------------- |
| Investigación y definición del producto | 35–60               |
| Arquitectura y modelo de datos          | 45–75               |
| UX/UI y sistema visual                  | 45–80               |
| Frontend Expo, React Native y Web       | 180–260             |
| Firebase, repositorios y cache          | 90–140              |
| Cloud Functions e integraciones         | 90–140              |
| Firestore Rules y permisos              | 55–90               |
| Stripe y billing                        | 35–55               |
| Notificaciones                          | 25–45               |
| Testing, CI, QA y correcciones          | 80–130              |
| Documentación y despliegues             | 40–65               |
| **Total estimado**                      | **720–1,140 horas** |

## Interpretación

```text
Estimación de trabajo directo:
720–1,140 horas

Esfuerzo de reemplazo sin contexto acumulado:
1,000–1,600 horas

Equipo formal con gestión, QA y DevOps:
1,400–2,200+ horas
```

Estas horas incluyen trabajo de:

* producto;
* programación;
* arquitectura;
* diseño;
* seguridad;
* investigación;
* integración;
* pruebas;
* corrección;
* documentación;
* despliegue.

No incluyen necesariamente:

* soporte futuro;
* mantenimiento de varios años;
* atención comercial;
* capacitación;
* diseño de marca;
* contabilidad;
* aspectos legales;
* publicación en tiendas;
* operación a gran escala.

---

# Valor estimado del proyecto

OMP no debe valorarse como una plantilla o sitio web básico.

El proyecto contiene:

* aplicación multiplataforma;
* backend serverless;
* autenticación;
* roles;
* permisos;
* reglas de seguridad;
* funciones administrativas;
* pagos recurrentes;
* webhooks;
* notificaciones;
* cache;
* módulos operativos;
* automatizaciones;
* mantenimiento programado;
* tests;
* CI;
* documentación.

## Estimación interna

| Escenario                                         | Valor estimado            |
| ------------------------------------------------- | ------------------------- |
| Desarrollo conservador                            | 350,000–650,000 MXN       |
| Valor realista por alcance actual                 | **650,000–1,200,000 MXN** |
| Agencia con diseño, gestión, QA, DevOps y soporte | 1,200,000–2,000,000+ MXN  |

Este rango:

* es una estimación interna;
* no es un avalúo contable;
* no es una cotización vinculante;
* no representa el gasto efectivo pagado;
* no representa el precio de venta obligatorio;
* puede cambiar conforme aumente el alcance.

## Diferencia entre valor y suscripción

```text
Valor técnico estimado:
650,000–1,200,000 MXN

Suscripción por congregación:
70, 120 o 200 MXN al mes
```

Una congregación no paga el costo completo del desarrollo. El modelo distribuye los costos de mantenimiento, infraestructura y evolución entre varias congregaciones.

---

# Costos tecnológicos

Los costos deben separarse en:

1. gasto efectivo;
2. costo variable;
3. costo potencial;
4. valor del tiempo humano.

El repositorio no contiene facturas. No debe declararse como pagado un importe que no esté respaldado por un comprobante.

## Costos operativos

| Concepto                | Frecuencia                | Comportamiento                                 |
| ----------------------- | ------------------------- | ---------------------------------------------- |
| Dominio `ompsuite.com`  | Anual                     | Fijo                                           |
| Hosting web externo     | Mensual o anual           | Depende del proveedor                          |
| Firebase / Google Cloud | Mensual                   | Variable por uso                               |
| Firestore               | Mensual                   | Lecturas, escrituras, almacenamiento y tráfico |
| Cloud Functions         | Mensual                   | Invocaciones, CPU, memoria y red               |
| Expo EAS                | Mensual o por consumo     | Según plan y builds                            |
| Apple Developer Program | Anual                     | Necesario para distribución iOS                |
| Google Play Console     | Registro y publicación    | Necesario para Android público                 |
| Stripe                  | Por transacción y volumen | Variable                                       |
| Monitoreo               | Mensual o por consumo     | Pendiente de implementación formal             |
| Soporte                 | Continuo                  | Tiempo humano                                  |
| Diseño y herramientas   | Variable                  | Según servicios contratados                    |

## Registro recomendado de gastos reales

| Fecha     | Proveedor    | Concepto          | Monto     | Moneda  | Periodo       | Comprobante |
| --------- | ------------ | ----------------- | --------- | ------- | ------------- | ----------- |
| Pendiente | Registrador  | Dominio           | Pendiente | MXN/USD | Anual         | Pendiente   |
| Pendiente | Hosting      | Web               | Pendiente | MXN/USD | Mensual/anual | Pendiente   |
| Pendiente | Google Cloud | Firebase          | Variable  | MXN     | Mensual       | Dashboard   |
| Pendiente | Stripe       | Comisiones        | Variable  | MXN     | Mensual       | Dashboard   |
| Pendiente | Expo         | EAS               | Pendiente | USD     | Mensual       | Pendiente   |
| Pendiente | Apple        | Developer Program | Pendiente | USD     | Anual         | Pendiente   |
| Pendiente | Google       | Play Console      | Pendiente | USD     | Registro      | Pendiente   |
| Pendiente | Otro         | Herramientas      | Pendiente | MXN/USD | Variable      | Pendiente   |

---

# Comisiones de Stripe

Como referencia estándar para México, el cálculo puede incluir:

```text
Stripe Payments:
3.6% + 3 MXN por tarjeta nacional

Stripe Billing:
0.7% del volumen procesado por Billing
```

Estas tarifas:

* pueden cambiar;
* excluyen IVA;
* pueden variar según la cuenta;
* pueden aumentar con tarjetas internacionales;
* pueden aumentar por conversión de moneda;
* pueden incluir costos por disputas;
* deben verificarse en el Dashboard de Stripe.

## Estimación por plan

| Plan      | Precio     | Payments aprox. | Billing aprox. | Comisión total aprox. | Neto aprox. |
| --------- | ---------- | --------------- | -------------- | --------------------- | ----------- |
| `omp_80`  | 70.00 MXN  | 5.52 MXN        | 0.49 MXN       | 6.01 MXN              | 63.99 MXN   |
| `omp_150` | 120.00 MXN | 7.32 MXN        | 0.84 MXN       | 8.16 MXN              | 111.84 MXN  |
| `omp_250` | 200.00 MXN | 10.20 MXN       | 1.40 MXN       | 11.60 MXN             | 188.40 MXN  |

Los importes anteriores no incluyen:

* IVA;
* tarjetas internacionales;
* conversión de moneda;
* disputas;
* contracargos;
* reembolsos;
* descuentos;
* promociones;
* tarifas personalizadas;
* otros productos de Stripe.

El cliente paga el precio publicado del plan. La comisión se descuenta del ingreso recibido por OMP.

---

# Instalación

## Requisitos

* Node.js 22;
* npm;
* Git;
* Java 21 para Firestore Emulator;
* Firebase CLI;
* Expo CLI mediante `npx expo`;
* Android Studio para desarrollo Android;
* Xcode para desarrollo iOS;
* EAS CLI para builds remotos;
* una cuenta Firebase autorizada;
* acceso al proyecto EAS correspondiente.

## Clonar el repositorio

```bash
git clone https://github.com/Marcor360/OMP.git
cd OMP
```

## Instalar dependencias de la aplicación

Para una instalación reproducible basada en el lockfile:

```bash
npm ci
```

Durante desarrollo también puede utilizarse:

```bash
npm install
```

## Instalar dependencias de Functions

```bash
npm ci --prefix functions
```

o:

```bash
npm --prefix functions install
```

## Crear variables locales

```bash
cp .env.example .env
```

Completar las variables necesarias antes de iniciar.

## Iniciar Expo

```bash
npm run start
```

## Iniciar web

```bash
npm run web
```

## Iniciar Android

```bash
npm run android
```

## Iniciar iOS

```bash
npm run ios
```

---

# Variables de entorno

Archivo:

```text
.env
```

Ejemplo:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=

EXPO_PUBLIC_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY=
```

## Consideraciones

Las variables con prefijo:

```text
EXPO_PUBLIC_
```

son visibles en el cliente.

No deben contener:

* claves secretas de Stripe;
* claves privadas;
* service accounts;
* webhook secrets;
* tokens administrativos;
* contraseñas;
* credenciales privadas.

La configuración pública de Firebase no sustituye Firestore Rules ni App Check.

---

# Secrets de Cloud Functions

Configurar mediante Firebase Secrets:

```bash
npx firebase-tools functions:secrets:set STRIPE_SECRET_KEY
npx firebase-tools functions:secrets:set STRIPE_WEBHOOK_SECRET
npx firebase-tools functions:secrets:set STRIPE_PRICE_OMP_80
npx firebase-tools functions:secrets:set STRIPE_PRICE_OMP_150
npx firebase-tools functions:secrets:set STRIPE_PRICE_OMP_250
npx firebase-tools functions:secrets:set APP_BILLING_RETURN_URL
```

## Reglas

* No colocar secrets en `.env` público.
* No colocar secrets en el frontend.
* No confirmar secrets en Git.
* No reutilizar claves de prueba en producción.
* No mezclar Price IDs de distintos sandboxes.
* Rotar claves comprometidas.
* Validar el webhook secret después de desplegar.
* Confirmar que los Prices correspondan al producto y moneda correctos.

---

# Archivos sensibles

No deben subirse al repositorio:

```text
.env
.env.*
serviceAccountKey.json
*-service-account.json
*.jks
*.keystore
*.p8
*.p12
*.pem
*.key
*.mobileprovision
*.aab
*.apk
*.zip
dist/
web-build/
.cache/
tmp/
logs
```

La única excepción permitida para variables es:

```text
.env.example
```

sin valores privados.

---

# Comandos principales

## Aplicación

| Comando                    | Acción                      |
| -------------------------- | --------------------------- |
| `npm run start`            | Inicia Expo                 |
| `npm run android`          | Ejecuta Android             |
| `npm run android:release`  | Ejecuta Android release     |
| `npm run ios`              | Ejecuta iOS                 |
| `npm run web`              | Ejecuta web                 |
| `npm run build:web`        | Genera el build web         |
| `npm run preview:web`      | Previsualiza `dist/`        |
| `npm run lint`             | Ejecuta ESLint              |
| `npm test`                 | Ejecuta Jest                |
| `npm run test:watch`       | Ejecuta Jest en watch       |
| `npm run test:coverage`    | Genera cobertura            |
| `npm run validate`         | Ejecuta validación integral |
| `npm run build:rules`      | Genera Firestore Rules      |
| `npm run check:rules`      | Comprueba el artefacto      |
| `npm run test:rules`       | Ejecuta pruebas de Rules    |
| `npm run check:indexes`    | Valida índices              |
| `npm run deploy:rules`     | Despliega Rules e índices   |
| `npm run deploy:functions` | Despliega Functions         |
| `npm run deploy:all`       | Despliega Rules y Functions |

## Cloud Functions

| Comando                             | Acción                |
| ----------------------------------- | --------------------- |
| `npm --prefix functions run lint`   | Lint                  |
| `npm --prefix functions run build`  | Compila TypeScript    |
| `npm --prefix functions test`       | Ejecuta pruebas       |
| `npm --prefix functions run serve`  | Emulador de Functions |
| `npm --prefix functions run shell`  | Functions Shell       |
| `npm --prefix functions run deploy` | Despliega Functions   |
| `npm --prefix functions run logs`   | Consulta logs         |

---

# Desarrollo local y emuladores

## Iniciar emuladores

```bash
npx firebase-tools emulators:start
```

Puertos configurados:

```text
Firebase Auth: 9099
Firestore:     9085
```

## Ejecutar pruebas de Firestore Rules

```bash
npm run test:rules
```

Este comando:

1. genera las reglas;
2. inicia Firestore Emulator;
3. ejecuta Jest;
4. cierra el emulador.

## Comprobar reglas generadas

```bash
npm run check:rules
```

## Regenerar reglas

```bash
npm run build:rules
```

Nunca editar `firestore.rules` directamente.

Editar:

```text
rules_src/*.rules
```

---

# Testing y validación

## Validación integral

```bash
npm run validate
```

Incluye:

```text
Validación de índices
ESLint de la aplicación
TypeScript de la aplicación
Tests de la aplicación
Lint de Functions
Build de Functions
Tests de Functions
Expo Doctor
```

Las pruebas de Firestore Rules se ejecutan de forma separada:

```bash
npm run test:rules
```

## Validación recomendada antes de release

```bash
npm ci
npm ci --prefix functions
npm run validate
npm run test:rules
npm run build:web
```

## Áreas cubiertas

La cobertura automatizada incluye casos relacionados con:

* planes;
* límites;
* permisos;
* roles;
* asignaciones de servicio;
* cache;
* fechas;
* Functions;
* billing;
* reglas;
* usuarios;
* hospitalidad;
* lectores;
* territorios;
* eventos;
* Stripe;
* notificaciones.

## Áreas que deben seguir ampliándose

* componentes `.tsx`;
* navegación;
* deep links;
* rutas protegidas;
* estados visuales;
* formularios;
* errores;
* permisos contractuales entre frontend, Functions y Rules;
* billing end-to-end;
* notificaciones en dispositivos;
* regresión multiplataforma.

---

# Integración continua

GitHub Actions ejecuta tres trabajos.

## Aplicación

```text
npm ci
npm run lint
npx tsc --noEmit
npm test -- --runInBand
npx expo-doctor
npm run build:web
```

## Functions

```text
npm ci --prefix functions
npm --prefix functions run lint
npm --prefix functions run build
npm --prefix functions test -- --runInBand
```

## Firestore Rules

```text
npm ci
Java 21
validación de índices
verificación de rules_src
descarga de Firestore Emulator
npm run test:rules
```

## Política de release

No debe publicarse una versión cuando:

* CI falla;
* TypeScript falla;
* ESLint falla;
* Functions no compilan;
* los tests fallan;
* Expo Doctor reporta incompatibilidades críticas;
* el build web falla;
* Rules y `rules_src` no coinciden;
* las pruebas del emulador fallan.

Se recomienda proteger `main` y exigir los checks de CI antes de integrar cambios.

---

# Builds y despliegues

## Android local

Desarrollo:

```bash
npm run android
```

Release local:

```bash
npm run android:release
```

## Android con EAS

```bash
npm install -g eas-cli
eas login
eas build --platform android
```

## iOS con EAS

```bash
npm install -g eas-cli
eas login
eas build --platform ios
```

## Build web

```bash
npm run build:web
```

Previsualización:

```bash
npm run preview:web
```

Resultado:

```text
dist/
```

## Desplegar Rules e índices

```bash
npm run deploy:rules
```

## Desplegar Functions

```bash
npm run deploy:functions
```

## Despliegue combinado

```bash
npm run deploy:all
```

## Antes de desplegar

* comprobar la rama;
* actualizar versión;
* ejecutar validación;
* ejecutar pruebas de Rules;
* confirmar ambiente Firebase;
* confirmar ambiente Stripe;
* revisar secrets;
* revisar Price IDs;
* revisar índices;
* revisar permisos;
* revisar cambios de base de datos;
* validar URLs de retorno;
* validar notificaciones;
* comprobar que no existan archivos sensibles.

---

# Estado funcional por módulo

| Módulo                    | Estado actual                                          |
| ------------------------- | ------------------------------------------------------ |
| Login                     | Funcional                                              |
| Recuperación de sesión    | Funcional                                              |
| Rutas protegidas          | Funcional                                              |
| Onboarding de idioma      | Funcional                                              |
| Tema                      | Funcional                                              |
| Localización de fechas    | Centralizada                                           |
| Usuarios                  | Funcional                                              |
| Roles canónicos           | Implementados                                          |
| Permisos                  | Funcionales, requieren pruebas contractuales continuas |
| Reuniones                 | Funcional                                              |
| Asignaciones              | Funcional                                              |
| Discursos externos        | Funcional                                              |
| Eventos                   | Funcional                                              |
| Limpieza                  | Funcional                                              |
| Acomodadores y micrófonos | Funcional                                              |
| Lectores                  | Sincronización implementada                            |
| Predicación               | Funcional, requiere QA completo                        |
| Territorios               | Funcional, requiere QA completo                        |
| Organigrama móvil         | Funcional                                              |
| Organigrama escritorio    | Funcional con mejoras pendientes                       |
| Dashboard                 | Funcional                                              |
| Configuración             | Funcional                                              |
| Notificaciones internas   | Funcional                                              |
| Push notifications        | Implementadas, falta validación física completa        |
| Deep links                | Allowlist implementada; auditoría integral pendiente   |
| Stripe Checkout           | Implementado, pendiente de QA integral                 |
| Customer Portal           | Implementado, pendiente de QA integral                 |
| Stripe Webhook            | Implementado, pendiente de QA integral                 |
| Exenciones                | Implementadas                                          |
| Restricción por pago      | Implementada                                           |
| Web                       | Funcional                                              |
| Android                   | Funcional en desarrollo y builds                       |
| iOS                       | Preparado, falta QA físico                             |
| CI                        | Configurado                                            |
| Firestore Rules tests     | Configurados                                           |
| App Check web             | Implementado de forma opcional                         |
| App Check nativo          | Pendiente                                              |

---

# Riesgos y deuda técnica

## Prioridad alta

### QA de Stripe

Debe validarse:

* sandbox correcto;
* claves;
* webhook secret;
* Prices;
* Checkout;
* Portal;
* webhook;
* alta;
* renovación;
* cambio de estado;
* pago fallido;
* periodo de gracia;
* cancelación;
* exención;
* historial;
* modo live.

### QA de notificaciones

Debe probarse:

* Android físico;
* iOS físico;
* development build;
* release;
* aplicación abierta;
* aplicación en segundo plano;
* aplicación cerrada;
* tokens inválidos;
* preferencias;
* enlaces permitidos;
* enlaces bloqueados.

### Batches del organigrama

La reconciliación debe mantenerse dentro de los límites seguros de Firestore.

Mejoras recomendadas:

* dividir operaciones;
* controlar el tamaño del lote;
* registrar progreso;
* manejar errores parciales;
* registrar estado de proyección;
* permitir reintentos seguros.

## Prioridad media

### Organigrama de escritorio

La vista de escritorio debe soportar niveles recursivos sin depender de una profundidad fija.

### Estado de proyección

Agregar información como:

```text
organizationProjectionStatus
lastProjectionAt
lastProjectionError
lastSuccessfulProjectionAt
```

### Coordinador y secretario duplicados

Debe impedirse o administrarse explícitamente la existencia de:

* dos coordinadores activos principales;
* dos secretarios activos principales.

### App Check nativo

Implementar protección para:

* Android;
* iOS.

### Observabilidad

Agregar una solución formal para:

* errores del cliente;
* errores de Functions;
* fallos de webhooks;
* métricas;
* trazas;
* alertas.

### Backups

Definir:

* frecuencia;
* retención;
* recuperación;
* responsables;
* pruebas de restauración.

### Modelos duplicados

Continuar unificando modelos históricos y actuales, especialmente en asignaciones y permisos.

### Archivos centrales grandes

Continuar separando:

* autenticación;
* inactividad;
* permisos;
* dashboard;
* servicios de dominio.

### Sincronización documental

La versión, el estado de los módulos y los riesgos deben actualizarse en el mismo release que el código.

---

# Requisitos para producción

OMP podrá clasificarse como estable para producción cuando se complete el siguiente checklist.

## Código

* [x] `npm run validate` pasa.
* [x] `npm run test:rules` pasa.
* [x] `npm run build:web` pasa.
* [x] CI está verde.
* [ ] No existen errores TypeScript.
* [ ] No existen errores ESLint.
* [ ] Expo Doctor no reporta problemas críticos.
* [ ] Functions compilan.
* [ ] Tests críticos pasan.

## Seguridad

* [ ] Rules auditadas.
* [ ] Permisos contractuales probados.
* [ ] Roles legacy migrados.
* [ ] Secrets rotados cuando corresponda.
* [ ] No existen credenciales en Git.
* [ ] App Check web validado.
* [ ] Plan de App Check nativo definido.
* [ ] Deep links auditados.
* [ ] Rutas internas restringidas mediante allowlist.

## Billing

* [x] Sandbox probado.
* [x] Live mode probado.
* [x] Webhook desplegado.
* [x] Webhook secret validado.
* [ ] Portal configurado.
* [ ] Price IDs confirmados.
* [ ] Pago exitoso probado.
* [ ] Pago fallido probado.
* [ ] Renovación probada.
* [ ] Cancelación probada.
* [ ] Gracia probada.
* [ ] Exención probada.
* [ ] Historial validado.
* [ ] Comisiones reales revisadas.

## Plataformas

* [x] Web probado.
* [x] Android development build probado.
* [x] Android release probado.
* [ ] iOS físico probado.
* [x] Navegación móvil auditada.
* [x] Navegación web auditada.
* [x] Deep links probados.
* [ ] Push notifications probadas.
* [ ] Permisos del sistema revisados.
* [ ] Rendimiento básico medido.

## Datos

* [x] Migraciones ejecutadas.
* [x] Backups definidos.
* [x] Restauración probada.
* [x] Índices desplegados.
* [x] Organigrama validado.
* [x] Datos duplicados revisados.
* [ ] Logs revisados.
* [ ] Costos monitoreados.

## Operación

* [x] Monitoreo configurado.
* [x] Alertas configuradas.
* [x] Proceso de soporte definido.
* [x] Política de incidentes definida.
* [ ] Registro de gastos actualizado.
* [ ] Documentación actualizada.
* [ ] Notas de versión preparadas.

---

# Roadmap

## Fase 1 — Base técnica

**Estado:** completada.

* Expo Router;
* React Native;
* TypeScript;
* Authentication;
* Firestore;
* Cloud Functions;
* rutas protegidas;
* roles;
* permisos;
* documentación inicial.

## Fase 2 — Módulos operativos

**Estado:** avanzada.

* usuarios;
* reuniones;
* asignaciones;
* limpieza;
* hospitalidad;
* lectores;
* discursos;
* eventos;
* predicación;
* territorios;
* notificaciones;
* organigrama;
* dashboard;
* configuración.

## Fase 3 — Billing

**Estado:** implementada, pendiente de QA integral.

* planes;
* límites;
* Checkout;
* Portal;
* Webhook;
* historial;
* recordatorios;
* restricciones;
* periodo de gracia;
* exenciones.

## Fase 4 — Estabilización

**Estado:** actual.

* ampliar pruebas;
* cerrar QA de Stripe;
* cerrar QA de notificaciones;
* probar dispositivos físicos;
* mejorar organigrama;
* dividir batches;
* reducir duplicaciones;
* mejorar observabilidad;
* actualizar documentación.

## Fase 5 — Producción

* builds oficiales;
* Stripe live;
* publicación Android;
* publicación iOS;
* monitoreo;
* backups;
* alertas;
* soporte;
* App Check;
* métricas;
* procedimientos operativos.

## Fase 6 — Escalamiento

* panel superadmin;
* auditoría avanzada;
* métricas por congregación;
* análisis de costos;
* reportes;
* administración avanzada;
* soporte multi-congregación;
* automatización de soporte;
* observabilidad completa;
* procesos de recuperación;
* optimización de Firestore.

---

# Convenciones de desarrollo

## Commits

OMP utiliza Conventional Commits.

```text
feat: nueva funcionalidad
fix: corrección
docs: documentación
test: pruebas
refactor: reestructuración
chore: mantenimiento
ci: integración continua
perf: rendimiento
```

Ejemplos:

```text
feat(cleaning): agregar planificación mensual
fix(rules): alinear permisos de hospitalidad
test(functions): cubrir sincronización de lectores
refactor(auth): separar control de inactividad
docs(readme): actualizar estado de la versión 1.31.2
ci: agregar validación de build web
```

Husky y Commitlint validan la estructura de commits.

## Flujo recomendado

```bash
git checkout main
git pull
git checkout -b feature/nombre-corto
```

Antes de confirmar:

```bash
npm run validate
npm run test:rules
git status --short
```

Confirmar:

```bash
git add .
git commit -m "feat(modulo): descripcion"
git push -u origin feature/nombre-corto
```

## Reglas

* Mantener cambios enfocados.
* No mezclar refactors grandes con cambios de seguridad.
* No mezclar cambios de precios con cambios visuales.
* No editar `firestore.rules` manualmente.
* No colocar lógica privilegiada únicamente en el cliente.
* No confirmar archivos generados innecesarios.
* No confirmar secrets.
* Actualizar pruebas cuando cambie autorización.
* Actualizar documentación cuando cambie arquitectura.
* Actualizar versión y release notes de forma coordinada.

---

# Documentación técnica

La documentación ampliada se encuentra en:

```text
docs/architecture.md
docs/permissions-model.md
docs/permissions-matrix.md
docs/firestore-security.md
docs/billing-and-subscriptions.md
docs/deployment.md
docs/notifications.md
docs/qa-notifications.md
docs/qa-mobile-navigation.md
docs/app-check-rollout.md
docs/refactor-plan.md
docs/ux-guidelines.md
docs/cache-strategy.md
docs/testing.md
docs/predeploy-validation.md
docs/deployment-mobile.md
docs/congregation-plans.md
```

## Documentos principales

| Documento                      | Contenido            |
| ------------------------------ | -------------------- |
| `architecture.md`              | Arquitectura general |
| `permissions-model.md`         | Roles y permisos     |
| `permissions-matrix.md`        | Matriz de acceso     |
| `firestore-security.md`        | Seguridad Firestore  |
| `billing-and-subscriptions.md` | Billing              |
| `deployment.md`                | Despliegues          |
| `notifications.md`             | Notificaciones       |
| `qa-notifications.md`          | QA de push           |
| `qa-mobile-navigation.md`      | QA móvil             |
| `app-check-rollout.md`         | App Check            |
| `cache-strategy.md`            | Cache                |
| `testing.md`                   | Pruebas              |
| `predeploy-validation.md`      | Checklist            |
| `deployment-mobile.md`         | Builds móviles       |
| `congregation-plans.md`        | Planes               |

---

# Licencia y uso

Este repositorio es público, pero no debe asumirse que el código tiene una licencia open source mientras no exista un archivo `LICENSE` que lo declare explícitamente.

Salvo autorización expresa:

* no se concede permiso automático de redistribución;
* no se concede permiso automático de reventa;
* no se concede permiso automático de uso comercial;
* no se concede permiso automático para publicar aplicaciones derivadas;
* las marcas, nombres y activos del proyecto permanecen protegidos.

La disponibilidad pública del código no equivale por sí sola a una licencia de uso.

---

# Nota final

OMP Suite representa una inversión considerable de análisis, arquitectura, programación, seguridad, diseño, pruebas y mantenimiento.

El proyecto cuenta actualmente con:

* aplicación web;
* aplicación Android;
* preparación para iOS;
* backend Firebase;
* Cloud Functions;
* Firestore Rules;
* aislamiento por congregación;
* roles;
* permisos;
* módulos operativos;
* billing;
* notificaciones;
* cache;
* pruebas;
* CI;
* documentación.

La prioridad actual no es incorporar funciones sin control. La prioridad es consolidar:

1. QA de Stripe;
2. QA de notificaciones;
3. pruebas físicas;
4. observabilidad;
5. backups;
6. seguridad;
7. permisos contractuales;
8. rendimiento;
9. estabilidad;
10. documentación.

Después de cerrar estos puntos, OMP podrá avanzar de beta avanzada a una versión comercial estable, monitoreada y preparada para una adopción más amplia.
