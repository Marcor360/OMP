# OMP Suite

**Organization, Ministry & Programs**

OMP Suite es una aplicación multiplataforma para la organización interna de congregaciones. Su objetivo es centralizar en una sola plataforma la administración de usuarios, reuniones, asignaciones, limpieza, predicación, territorios, eventos, notificaciones, organigrama, permisos, planes, pagos y configuración por congregación.

OMP Suite está diseñado para funcionar en:

* Web.
* Android.
* iOS mediante Expo.
* Teléfonos.
* Tabletas.
* Escritorio mediante React Native Web.

> **Aviso importante:** OMP Suite no es una aplicación oficial de JW.ORG, no está afiliada, respaldada ni aprobada por ninguna entidad oficial de los Testigos de Jehová. Es una herramienta tecnológica independiente de uso privado.

---

## Índice

1. Estado actual.
2. Evaluación funcional.
3. Objetivo del producto.
4. Problemas que resuelve.
5. Plataformas soportadas.
6. Stack tecnológico.
7. Arquitectura.
8. Estructura del repositorio.
9. Navegación y autenticación.
10. Seguridad, roles y permisos.
11. Módulos funcionales.
12. Organigrama congregacional.
13. Billing y suscripciones.
14. Precios vigentes.
15. Valor comercial del proyecto.
16. Costos tecnológicos.
17. Costos y comisiones Stripe.
18. Costos acumulados durante cuatro meses.
19. Firebase y Google Cloud.
20. Cache y rendimiento.
21. Notificaciones.
22. Modelo de datos.
23. Variables de entorno y secrets.
24. Instalación y comandos.
25. Builds y despliegues.
26. Testing y CI.
27. Estado funcional por módulo.
28. Riesgos técnicos conocidos.
29. Requisitos para producción.
30. Roadmap.
31. Convenciones de desarrollo.
32. Nota final.

---

# Estado Actual Del Proyecto

| Dato                                | Estado                                             |
| ----------------------------------- | -------------------------------------------------- |
| Nombre                              | OMP Suite                                          |
| Repositorio                         | `Marcor360/OMP`                                    |
| Versión declarada                   | `1.13.3`                                           |
| Último mensaje de versión observado | `1.15.2`                                           |
| Tiempo de desarrollo acumulado      | Aproximadamente cuatro meses                       |
| Estado                              | Beta avanzada funcional                            |
| Plataforma principal                | Expo / React Native                                |
| Backend                             | Firebase                                           |
| Pagos                               | Stripe Billing                                     |
| Notificaciones                      | Expo Notifications y Firebase Admin Messaging      |
| Seguridad                           | Firestore Rules, Cloud Functions, roles y permisos |
| Modelo comercial                    | Suscripción mensual por congregación               |
| Unidad de cobro                     | Congregación, no usuario individual                |

## Estado De Versión

Actualmente existe una diferencia que debe resolverse antes del siguiente release:

```text
package.json:       1.13.3
app.json:           1.13.3
iOS buildNumber:    1.13.3
Android versionCode: 11303
README:             1.13.3
Último commit:      mensaje 1.15.2
```

El mensaje del commit no debe considerarse automáticamente la versión oficial. Antes del siguiente build se debe decidir si la versión real es `1.13.3`, `1.15.2` u otra, y sincronizar todos los archivos.

---

# Evaluación Funcional

OMP Suite ya no debe tratarse como una demostración o prototipo visual. Tiene una base técnica real, módulos operativos, backend serverless, reglas de seguridad, billing, notificaciones, cache, tests y procesos automatizados.

## Clasificación Actual

| Área                                 | Evaluación |
| ------------------------------------ | ---------- |
| Arquitectura                         | 8.5/10     |
| Funcionalidad implementada           | 8/10       |
| Backend                              | 8.5/10     |
| Seguridad y permisos                 | 7/10       |
| Calidad y testing                    | 7.5/10     |
| Experiencia multiplataforma          | 7.5/10     |
| Preparación comercial                | 7/10       |
| Preparación completa para producción | 6.5/10     |

## Veredicto

> OMP Suite es un producto funcional para pruebas controladas y primeras congregaciones, pero sigue en fase de estabilización antes de una distribución comercial amplia.

Esto significa:

* Los flujos principales existen.
* El frontend está conectado al backend.
* Las operaciones sensibles pasan por Cloud Functions.
* Firestore Rules protegen los datos.
* Stripe está implementado.
* Existen pruebas automatizadas.
* Existe CI.
* Hay documentación técnica.
* Todavía deben cerrarse inconsistencias de permisos, pruebas reales externas y detalles de escalabilidad.

---

# Objetivo De OMP Suite

OMP Suite busca reemplazar procesos fragmentados que normalmente se manejan mediante:

* hojas de cálculo;
* grupos de mensajería;
* documentos separados;
* notas manuales;
* listas impresas;
* archivos privados;
* mensajes individuales;
* procesos dependientes de una sola persona.

El producto centraliza la información en una plataforma estructurada, segura y accesible desde distintos dispositivos.

## Objetivos Principales

* Reducir errores administrativos.
* Ahorrar tiempo en la organización semanal.
* Centralizar información por congregación.
* Evitar datos duplicados.
* Separar responsabilidades.
* Controlar quién puede consultar o modificar cada módulo.
* Mantener historial operativo.
* Facilitar la comunicación.
* Mejorar la experiencia móvil.
* Proteger información sensible.
* Automatizar tareas repetitivas.
* Reducir lecturas innecesarias en Firestore.
* Facilitar el mantenimiento técnico.
* Preparar el sistema para crecer.
* Mantener un precio accesible.

---

# Problemas Que Resuelve

OMP ayuda a resolver:

* usuarios dispersos en diferentes archivos;
* falta de una fuente única de verdad;
* asignaciones duplicadas;
* asignaciones incompatibles;
* reuniones creadas sin revisión;
* conflictos con discursos externos;
* poca claridad sobre responsabilidades;
* falta de control por congregación;
* limpieza gestionada manualmente;
* acomodadores y micrófonos manejados fuera del sistema;
* dificultad para visualizar el organigrama;
* cobros sin integración automatizada;
* notificaciones no centralizadas;
* poca trazabilidad;
* dependencia de una sola computadora;
* falta de permisos granulares;
* falta de historial de pagos;
* exceso de lecturas Firestore;
* errores técnicos mostrados directamente al usuario;
* navegación móvil inconsistente.

---

# Plataformas Soportadas

## Web

La versión web utiliza Expo Web y React Native Web.

Está pensada para:

* administradores;
* coordinadores;
* secretarios;
* encargados de módulos;
* usuarios que prefieren trabajar desde computadora;
* tareas administrativas de mayor tamaño.

El build web se genera mediante:

```bash
npm run build:web
```

Firebase Hosting está deshabilitado en la configuración actual. El resultado debe publicarse en el host externo configurado para OMP.

## Android

Android es una plataforma principal.

El proyecto incluye:

* identificador `com.marcor360.omp`;
* iconos adaptativos;
* permisos de notificaciones;
* vibración;
* bloqueo de permisos innecesarios;
* soporte para development build;
* soporte para release;
* compatibilidad con EAS Build.

## iOS

El proyecto está preparado para iOS mediante Expo.

Incluye:

* soporte para tabletas;
* background mode para notificaciones;
* descripción de permisos;
* build number;
* integración con Expo Notifications.

La preparación técnica no sustituye una prueba real. Antes de declarar soporte de producción se debe validar:

* instalación física;
* recepción de notificaciones;
* navegación;
* login;
* deep links;
* Stripe Checkout;
* Customer Portal;
* rendimiento;
* App Store submission.

---

# Stack Tecnológico

## Frontend

* Expo SDK 54.
* React 19.
* React Native 0.81.
* React Native Web.
* TypeScript.
* Expo Router.
* React Navigation.
* NativeWind.
* Tailwind CSS.
* AsyncStorage.
* Expo Notifications.
* Expo Image.
* Expo Haptics.
* Expo Linking.
* Expo Web Browser.
* Expo Splash Screen.
* React Native Reanimated.
* React Native Gesture Handler.
* React Native Safe Area Context.
* React Native Screens.
* React Native SVG.
* Ionicons.

## Backend

* Firebase Authentication.
* Cloud Firestore.
* Cloud Functions for Firebase.
* Firebase Admin SDK.
* Firebase Admin Messaging.
* Firestore Rules.
* Firestore Indexes.
* Firebase Functions Secrets.
* Stripe Billing.
* Stripe Checkout.
* Stripe Customer Portal.
* Stripe Webhooks.
* Expo Server SDK.
* Funciones programadas.
* Triggers Firestore.

## Calidad

* ESLint.
* TypeScript.
* Jest.
* Jest Expo.
* Firebase Rules Unit Testing.
* Firebase Emulator Suite.
* GitHub Actions.
* Tests de Cloud Functions.
* Tests frontend.
* Tests de Firestore Rules.

---

# Arquitectura General

OMP utiliza una arquitectura por capas.

```text
Interfaz
   ↓
Pantallas y componentes
   ↓
Hooks y casos de uso
   ↓
Servicios y repositorios
   ↓
Firebase SDK / Callable Functions
   ↓
Firestore Rules / Cloud Functions
   ↓
Firestore, Authentication, Stripe y notificaciones
```

## Principios Arquitectónicos

* Las pantallas no deben contener toda la lógica.
* Los servicios deben concentrar acceso a datos.
* Las operaciones sensibles deben pasar por backend.
* Firestore Rules deben proteger incluso si la UI falla.
* `congregationId` debe aislar todos los datos.
* Stripe Webhook debe ser la fuente de verdad de pago.
* Los permisos deben calcularse de manera consistente.
* Los módulos deben compartir utilidades cuando resuelven el mismo problema.
* Los datos sensibles no deben depender del cache.
* La lógica debe poder probarse de forma aislada.

---

# Estructura Del Repositorio

```text
app/
├── (auth)/                  Rutas públicas
├── (protected)/             Rutas autenticadas
│   ├── (tabs)/              Navegación principal
│   ├── users/
│   ├── meetings/
│   ├── assignments/
│   ├── cleaning/
│   ├── preaching/
│   ├── territories/
│   ├── billing/
│   ├── notifications/
│   └── settings/
├── _layout.tsx
└── language-setup.tsx

src/
├── components/              UI reutilizable
├── context/                 Auth, usuario, tema y toast
├── hooks/                   Hooks compartidos
├── i18n/                    Traducciones
├── lib/firebase/            Inicialización Firebase
├── modules/                 Módulos de dominio
├── screens/                 Pantallas principales
├── services/                Servicios y repositorios
├── styles/                  Tema y diseño
├── types/                   Tipos y DTOs
└── utils/                   Utilidades y permisos

functions/
├── src/
│   ├── billing/
│   ├── config/
│   ├── maintenance/
│   ├── modules/
│   ├── organization/
│   ├── users/
│   └── index.ts
├── scripts/
└── package.json

docs/                        Documentación técnica
firestore.rules              Seguridad Firestore
firestore.indexes.json       Índices
firebase.json                Configuración Firebase
.github/workflows/ci.yml     Integración continua
```

---

# Navegación Y Autenticación

OMP usa Expo Router.

## Grupos De Rutas

```text
app/(auth)/                  Login y recuperación
app/(protected)/             Contenido con sesión
app/(protected)/(tabs)/      Módulos principales
```

## Flujo De Entrada

1. Inicialización de tema.
2. Inicialización de traducciones.
3. Inicialización de cache persistente.
4. Onboarding de idioma.
5. Carga de Authentication.
6. Recuperación del perfil Firestore.
7. Validación de usuario activo.
8. Validación de congregación.
9. Validación de bloqueo.
10. Redirección segura.

## Navegación Protegida

La aplicación comprueba:

* sesión activa;
* usuario de Firebase Authentication;
* perfil en `/users/{uid}`;
* congregación asignada;
* estado activo;
* acceso de congregación;
* mantenimiento;
* permisos;
* rutas permitidas;
* estado de billing para escrituras administrativas.

## Navegación Móvil

En pantallas menores a 768 px:

* se utiliza menú lateral móvil;
* se oculta la barra de tabs inferior;
* las rutas secundarias deben usar `PageHeader`;
* las rutas profundas deben incluir `showBack`;
* se debe definir `fallbackRoute` cuando sea necesario.

---

# Seguridad

La seguridad real no depende únicamente de ocultar botones.

OMP aplica seguridad en:

1. Interfaz.
2. Funciones de permisos.
3. Firestore Rules.
4. Cloud Functions.
5. Validaciones de Stripe.
6. Validaciones por congregación.

## Principios Obligatorios

* Todo dato protegido requiere autenticación.
* Cada usuario pertenece a una congregación.
* No se deben mezclar datos de congregaciones.
* Los usuarios comunes no pueden cambiar su rol.
* Los usuarios comunes no pueden cambiar su congregación.
* Los usuarios comunes no pueden elevar sus propios permisos.
* Las operaciones sensibles deben pasar por Functions.
* Los secrets nunca deben exponerse al cliente.
* Firestore Rules deben validar lecturas y escrituras.
* Billing debe validarse en backend.
* Las reglas no deben confiar en etiquetas visuales.
* Los datos de `/system` no deben ser escribibles desde cliente.

---

# Roles, Permisos Y Responsabilidades

## Roles Técnicos

```ts
type UserRole = 'admin' | 'supervisor' | 'user';
```

| Rol          | Descripción                       |
| ------------ | --------------------------------- |
| `admin`      | Administrador técnico             |
| `supervisor` | Supervisor con permisos delegados |
| `user`       | Usuario normal                    |

Los valores `administrador` y `usuario` continúan aceptándose temporalmente como datos legacy. No deben generarse en documentos nuevos.

## Separación Conceptual

### `role`

Nivel técnico general.

### `permissions`

Acciones permitidas por módulo.

### `serviceAssignments`

Responsabilidades de servicio.

### `privileges`

Condiciones funcionales, por ejemplo:

* anciano;
* siervo ministerial;
* precursor regular;
* precursor auxiliar.

### `responsibilities`

Responsabilidades adicionales.

## Acciones De Permiso

```ts
type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'manage'
  | 'approve'
  | 'export';
```

## Departamentos De Permiso

```text
usuarios
reuniones
limpieza
departments
predicacion
tesoreria
pagos
configuracion
avisos
asignaciones
acomodadores_microfonos
organigrama
```

## Asignaciones De Servicio

```text
coordinador
secretario
encargado
auxiliar
apoyo
```

Departamentos posibles:

```text
coordinacion
secretaria
limpieza
literatura
tesoreria
mantenimiento
discursos
reuniones
predicacion
territorios
asignaciones
hospitalidad
usuarios
configuracion
audio_video
acomodadores_microfonos
```

---

# Módulos Funcionales

## Usuarios

Incluye:

* creación;
* listado;
* edición;
* actualización de contraseña;
* activación;
* desactivación;
* eliminación;
* roles;
* permisos;
* privilegios;
* responsabilidades;
* cargos de servicio;
* límite de usuarios por plan;
* paginación;
* fallback de lectura;
* errores humanos;
* protección de usuarios del sistema.

Operaciones principales:

```text
createUserByAdmin
listUsersForCurrentCongregation
updateUserByAdmin
updateUserPasswordByAdmin
disableUserByAdmin
deleteUserByAdmin
```

## Reuniones

Incluye:

* reuniones entre semana;
* reuniones de fin de semana;
* creación;
* edición;
* eliminación;
* borradores;
* publicación;
* revisión final;
* lugar;
* enlaces;
* programa;
* asignaciones;
* limpieza;
* lectores;
* acomodadores;
* micrófonos;
* detección de reuniones duplicadas;
* integración con discursos externos;
* notificaciones;
* recordatorios.

## Asignaciones

Incluye:

* creación;
* edición;
* consulta;
* integración con reuniones;
* validación de conflictos;
* asignaciones de participantes;
* control de responsables;
* integración con acomodadores y micrófonos.

## Discursos Externos

Incluye:

* creación;
* actualización;
* cancelación;
* marcado como completado;
* congregación destino;
* fecha;
* participante;
* conflicto con reunión de fin de semana.

## Eventos Y Avisos

Incluye:

* eventos especiales;
* visita del superintendente;
* asambleas;
* conmemoración;
* reuniones especiales;
* capacitación;
* notificación de cambios;
* limpieza programada de eventos antiguos.

## Limpieza

Incluye:

* grupos;
* integrantes;
* usuarios elegibles;
* calendario;
* borradores;
* publicación;
* integración con reuniones;
* sincronización backend;
* permisos de encargado;
* IDs deterministas.

Funciones:

```text
createCleaningGroupByManager
listCleaningGroupsForCurrentUser
publishCleaningScheduleByManager
```

## Acomodadores, Micrófonos Y Lectores

Incluye:

* responsables;
* auxiliares;
* planificación;
* fechas;
* publicación;
* sincronización con reuniones;
* protección de campos administrados por el módulo;
* permisos específicos.

Función:

```text
publishHospitalityScheduleByManager
```

## Predicación

Incluye:

* reportes;
* grupos;
* responsables;
* permisos;
* información por congregación;
* estructura para aprobación y exportación.

## Territorios

Incluye:

* catálogo;
* creación;
* edición;
* desactivación;
* asignaciones mensuales;
* responsables;
* auxiliares;
* limpieza programada;
* recordatorios;
* permisos por acción.

## Notificaciones

Incluye:

* notificaciones internas;
* tokens push;
* Expo Push;
* Firebase Admin Messaging;
* segmentación por congregación;
* notificaciones de asignaciones;
* notificaciones de reuniones;
* recordatorios;
* limpieza de notificaciones antiguas;
* migración de notificaciones legacy.

## Dashboard

Incluye:

* resumen por congregación;
* actualización manual;
* actualización programada;
* tarjetas navegables;
* guardas de permisos;
* próximos eventos;
* reuniones;
* accesos rápidos.

## Configuración

Incluye:

* cuenta;
* perfil;
* tema;
* idioma;
* estado del plan;
* facturación;
* navegación a módulos administrativos;
* información de la aplicación.

## Contador De Horas

Existe un módulo de servicio del campo local que funciona sin Firebase para operaciones personales del usuario.

---

# Organigrama Congregacional

El organigrama usa como fuente principal:

```text
/users/{uid}.serviceAssignments
```

A partir de los usuarios activos se genera una proyección en:

```text
/congregations/{congregationId}/departments
/congregations/{congregationId}/departmentAssignments
```

## Flujo Automático

Cuando cambia un usuario, el trigger revisa:

* `serviceAssignments`;
* `servicePosition`;
* `serviceDepartment`;
* `isActive`;
* `displayName`;
* `email`;
* `congregationId`;
* `role`.

Si cambia un campo relevante, se regenera la proyección.

## Generación Manual

La función:

```text
regenerateOrgChart
```

puede ejecutarse por:

* coordinador;
* secretario;
* root admin;
* primary admin;
* usuarios protegidos del sistema.

## Capacidades

* crea departamentos faltantes;
* crea asignaciones nuevas;
* actualiza asignaciones existentes;
* desactiva asignaciones eliminadas;
* usa IDs deterministas;
* detecta más de un coordinador;
* detecta más de un secretario;
* conserva compatibilidad legacy;
* soporta vista móvil;
* soporta vista escritorio;
* muestra advertencias.

## Regla De Acceso

Todos los usuarios activos con congregación pueden visualizar el organigrama.

La administración está limitada a:

* coordinador;
* secretario;
* usuarios protegidos del sistema.

---

# Billing Y Suscripciones

OMP cobra por congregación.

No se cobra por cada usuario individual. El plan define el máximo de usuarios activos de una congregación.

## Planes Vigentes

| Plan      | Usuarios activos | Precio mensual |
| --------- | ---------------- | -------------- |
| `omp_80`  | 80               | **70 MXN**     |
| `omp_150` | 150              | **120 MXN**    |
| `omp_250` | 250              | **200 MXN**    |

## Regla De Precios

En esta actualización:

* no se incrementan precios;
* no se crean nuevos Price IDs;
* no se modifican suscripciones;
* no se cambian los secrets;
* no se cambian constantes de billing;
* nuevas congregaciones usan los precios actuales.

## Componentes De Billing

```text
createStripeCheckoutSession
createStripePortalSession
getStripeBillingUsage
stripeWebhook
sendBillingPaymentReminders
scheduledBillingHistoryCleanup
setBillingExemptionByRootAdmin
```

## Flujo De Pago

1. El usuario autorizado entra a billing.
2. La aplicación obtiene el uso activo.
3. El usuario selecciona un plan.
4. Se llama a `createStripeCheckoutSession`.
5. La Function valida usuario, congregación y permisos.
6. Se crea o reutiliza el cliente Stripe.
7. Stripe Checkout procesa el pago.
8. Stripe redirige a la aplicación.
9. Stripe Webhook recibe el evento.
10. Firestore se actualiza.
11. La aplicación muestra el estado real.

La pantalla `/billing/success` no es la fuente definitiva de pago. La fuente de verdad es Firestore después de procesar el webhook.

## Estados

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

## Periodo De Gracia

Los estados:

```text
past_due
payment_action_required
incomplete
```

pueden disponer de cinco días de gracia.

Después del periodo de gracia, las escrituras administrativas pueden restringirse.

## Exenciones

Una congregación puede tener:

```ts
billingExemption: {
  exempt: boolean;
  reason?: string;
  grantedBy?: string;
  grantedAt?: Timestamp;
  expiresAt?: Timestamp | null;
}
```

Una congregación exenta:

* no inicia Checkout;
* no se restringe por falta de pago;
* no recibe recordatorios;
* conserva un límite de usuarios;
* muestra estado `exempt`.

---

# Por Qué Se Cobra

OMP no es una página estática. Es una plataforma con costos técnicos y humanos continuos.

La suscripción ayuda a cubrir:

## Desarrollo

* análisis;
* arquitectura;
* frontend;
* backend;
* diseño;
* refactors;
* nuevas funciones;
* corrección de errores;
* documentación;
* testing;
* despliegues.

## Infraestructura

* dominio;
* host;
* Firebase;
* Google Cloud;
* Firestore;
* Cloud Functions;
* tráfico;
* almacenamiento;
* secrets;
* notificaciones.

## Pagos

* Stripe Billing;
* Checkout;
* Portal;
* Webhook;
* historial;
* recordatorios;
* comisión por transacción.

## Seguridad

* reglas;
* validaciones;
* mantenimiento de permisos;
* protección por congregación;
* revisión de accesos;
* actualización de dependencias.

## Soporte

* solución de errores;
* ayuda a administradores;
* revisión de datos;
* mantenimiento;
* validación de builds;
* compatibilidad con nuevas versiones.

---

# Valor Comercial Del Proyecto

OMP no debe valorarse como una plantilla ni como un sitio web básico.

Incluye:

* una aplicación multiplataforma;
* backend serverless;
* autenticación;
* permisos;
* Firestore Rules;
* Cloud Functions;
* pagos;
* notificaciones;
* módulos operativos;
* sincronizaciones;
* pruebas;
* CI;
* documentación.

## Valor Estimado

| Escenario                                | Valor estimado            |
| ---------------------------------------- | ------------------------- |
| Desarrollo conservador                   | 350,000–650,000 MXN       |
| Valor realista por alcance actual        | **650,000–1,200,000 MXN** |
| Agencia con diseño, QA, DevOps y soporte | 1,200,000–2,000,000+ MXN  |

Este rango es una estimación interna, no un avalúo contable ni una cotización vinculante.

Como referencia externa, Upwork publica un rango histórico típico de **24–45 USD por hora** para desarrolladores React Native y aclara que la tarifa real depende de la negociación.

## Horas Estimadas

| Área                               | Horas   |
| ---------------------------------- | ------- |
| Análisis y arquitectura            | 60–120  |
| UX/UI                              | 80–160  |
| Frontend Expo / React Native / Web | 220–420 |
| Firebase y servicios               | 120–240 |
| Cloud Functions                    | 140–280 |
| Firestore Rules                    | 80–180  |
| Stripe                             | 70–140  |
| Notificaciones                     | 40–90   |
| Cache y rendimiento                | 50–120  |
| QA y correcciones                  | 100–220 |
| Documentación                      | 40–100  |

Rango total:

```text
Estimación conservadora: 700–900 horas
Estimación realista:     900–1,400 horas
Equipo formal/agencia:   1,400–2,000+ horas
```

## Diferencia Entre Valor Y Suscripción

```text
Valor estimado del sistema:
650,000–1,200,000 MXN

Precio pagado por congregación:
70, 120 o 200 MXN al mes
```

Una congregación no paga el costo completo de desarrollo. El modelo distribuye mantenimiento y operación entre varias congregaciones.

---

# Costos Tecnológicos

Los costos se dividen en:

* costos confirmados mediante factura;
* costos variables;
* costos potenciales;
* estimaciones operativas.

El repositorio no contiene facturas. Por lo tanto, el README no debe declarar como pagado un monto que no esté respaldado.

## Costos Fijos O Periódicos

| Concepto                | Frecuencia             | Estado                        |
| ----------------------- | ---------------------- | ----------------------------- |
| Dominio `ompsuite.com`  | Anual                  | Registrar factura real        |
| Hosting web externo     | Mensual/anual          | Registrar proveedor y factura |
| Firebase / Google Cloud | Mensual por consumo    | Variable                      |
| Expo EAS                | Mensual o uso gratuito | Según plan                    |
| Apple Developer Program | Anual                  | Solo si se publica en iOS     |
| Google Play Console     | Registro/publicación   | Solo si se publica            |
| Herramientas de diseño  | Variable               | Registrar si existen          |
| Monitoreo               | Variable               | Registrar si existe           |
| Soporte técnico         | Continuo               | Tiempo humano                 |

## Referencias Externas

Expo publica actualmente:

* plan Free: 0 USD/mes;
* plan Starter: 19 USD/mes más uso;
* plan Production: 199 USD/mes más uso.

El plan gratuito incluye hasta 15 builds Android y 15 builds iOS según la página vigente.

Apple publica una membresía de Apple Developer Program de 99 USD por año, o su equivalente local.

Estos precios pueden cambiar. Antes de registrar un gasto se debe usar la factura real.

---

# Firebase Y Google Cloud

Firebase puede operar inicialmente dentro de cuotas sin costo, pero requiere monitoreo.

La página oficial de Firebase muestra para Cloud Firestore Standard una cuota sin costo que incluye, entre otros:

* 1 GiB almacenado;
* 10 GiB/mes de egreso;
* 20,000 escrituras por día;
* 50,000 lecturas por día;
* 20,000 eliminaciones por día.

Estas cuotas pueden cambiar y se aplican a nivel de proyecto.

## Factores Que Generan Costo

* lecturas;
* escrituras;
* eliminaciones;
* almacenamiento;
* tráfico;
* ejecuciones de Functions;
* CPU;
* memoria;
* logs;
* builds;
* consultas repetidas;
* listeners;
* crecimiento de usuarios.

## Controles Implementados

* cache en memoria;
* cache persistente;
* cache-first;
* invalidación;
* consultas count;
* paginación;
* limpieza programada;
* evitar listeners duplicados;
* aislamiento por congregación.

---

# Stripe Y Comisiones

Stripe publica para México una tarifa estándar de:

```text
3.6% + 3 MXN
```

por transacción exitosa con tarjeta nacional. Las tarifas publicadas excluyen IVA y pueden aplicar cargos adicionales para tarjetas internacionales o conversión de moneda.

## Cálculo Mensual Aproximado

| Plan      | Cobro      | Comisión aproximada | Neto aproximado |
| --------- | ---------- | ------------------- | --------------- |
| `omp_80`  | 70.00 MXN  | 5.52 MXN            | 64.48 MXN       |
| `omp_150` | 120.00 MXN | 7.32 MXN            | 112.68 MXN      |
| `omp_250` | 200.00 MXN | 10.20 MXN           | 189.80 MXN      |

Cálculo:

```text
70 × 3.6% + 3   = 5.52
120 × 3.6% + 3  = 7.32
200 × 3.6% + 3  = 10.20
```

## Acumulado Por Cuatro Meses

| Plan      | Cobrado    | Comisión aproximada | Neto aproximado |
| --------- | ---------- | ------------------- | --------------- |
| `omp_80`  | 280.00 MXN | 22.08 MXN           | 257.92 MXN      |
| `omp_150` | 480.00 MXN | 29.28 MXN           | 450.72 MXN      |
| `omp_250` | 800.00 MXN | 40.80 MXN           | 759.20 MXN      |

Estos montos representan una suscripción individual mantenida durante cuatro meses.

No incluyen:

* IVA sobre comisiones;
* tarjetas internacionales;
* conversión;
* disputas;
* reembolsos;
* promociones;
* periodos parciales.

---

# Costos Acumulados Durante Cuatro Meses

Sin facturas no se puede declarar el costo exacto pagado.

Se puede mantener una estimación provisional:

| Concepto                            | Estimación de cuatro meses   |
| ----------------------------------- | ---------------------------- |
| Dominio anual prorrateado           | 70–235 MXN                   |
| Dominio anual completo              | 200–700 MXN                  |
| Hosting externo                     | 0–1,600 MXN                  |
| Firebase / Google Cloud en uso bajo | 0–1,200 MXN                  |
| Expo Free                           | 0 MXN                        |
| Expo Starter durante cuatro meses   | 76 USD más uso               |
| Stripe `omp_80`                     | 22.08 MXN de comisión aprox. |
| Stripe `omp_150`                    | 29.28 MXN de comisión aprox. |
| Stripe `omp_250`                    | 40.80 MXN de comisión aprox. |

## Estimación Global Provisional

```text
Escenario mínimo:
500–3,500 MXN + comisiones

Escenario con servicios pagados:
3,500–20,000+ MXN
```

Estos rangos no sustituyen las facturas.

## Registro De Gastos Reales

| Fecha     | Proveedor    | Concepto          | Monto     | Moneda  | Periodo       | Comprobante |
| --------- | ------------ | ----------------- | --------- | ------- | ------------- | ----------- |
| Pendiente | Registrador  | Dominio           | Pendiente | MXN/USD | Anual         | Pendiente   |
| Pendiente | Hosting      | Web               | Pendiente | MXN/USD | Mensual/anual | Pendiente   |
| Pendiente | Google Cloud | Firebase          | Pendiente | MXN/USD | Mensual       | Pendiente   |
| Pendiente | Stripe       | Comisiones        | Variable  | MXN     | Transacción   | Dashboard   |
| Pendiente | Expo         | EAS               | Pendiente | USD     | Mensual       | Pendiente   |
| Pendiente | Apple        | Developer Program | Pendiente | USD     | Anual         | Pendiente   |
| Pendiente | Google       | Play Console      | Pendiente | USD     | Registro      | Pendiente   |
| Pendiente | Otro         | Herramientas      | Pendiente | MXN/USD | Variable      | Pendiente   |

---

# Cache Y Rendimiento

OMP utiliza una estrategia cache-first.

## Capas

1. Memoria de sesión.
2. AsyncStorage.
3. Cache local de Firestore.
4. Servidor Firestore.

## Reglas

* Billing no debe usar cache persistente como fuente de verdad.
* Los permisos no deben depender del cache.
* Se debe invalidar después de escribir.
* Logout debe limpiar cache.
* Cambiar de congregación debe limpiar datos anteriores.
* El cache debe incluir `schemaVersion`.
* Se debe limitar el tamaño.
* No se deben mantener listeners innecesarios.

## Ciclo

El cache persistente utiliza un ciclo anual del 1 de septiembre al 31 de agosto.

---

# Notificaciones

OMP utiliza:

* notificaciones internas;
* Expo Push Tokens;
* Firebase Admin Messaging;
* Expo Server SDK;
* canales Android;
* triggers Firestore.

## Flujo

1. El usuario inicia sesión.
2. La app solicita permiso.
3. Obtiene el token.
4. Guarda el token asociado al usuario.
5. Backend crea una notificación.
6. Trigger procesa la notificación.
7. Se envía push.
8. La app abre la ruta asociada.

## Reglas

* No probar únicamente con Expo Go.
* Probar en development build o release.
* Eliminar tokens inválidos.
* Segmentar por congregación.
* Respetar preferencias.
* No incluir información sensible innecesaria.

---

# Modelo De Datos Principal

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

## Regla Central

> Todo documento de una congregación debe estar asociado y protegido mediante `congregationId`.

---

# Variables De Entorno

Crear:

```bash
cp .env.example .env
```

Variables públicas:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

Las variables `EXPO_PUBLIC_*` son visibles en el cliente.

No colocar secretos privados en ellas.

---

# Secrets De Functions

```bash
npx -y firebase-tools@latest functions:secrets:set STRIPE_SECRET_KEY
npx -y firebase-tools@latest functions:secrets:set STRIPE_WEBHOOK_SECRET
npx -y firebase-tools@latest functions:secrets:set STRIPE_PRICE_OMP_80
npx -y firebase-tools@latest functions:secrets:set STRIPE_PRICE_OMP_150
npx -y firebase-tools@latest functions:secrets:set STRIPE_PRICE_OMP_250
npx -y firebase-tools@latest functions:secrets:set APP_BILLING_RETURN_URL
```

## Price IDs De Sandbox Documentados

```env
STRIPE_PRICE_OMP_80=price_1Tfr4rBNusNy7pYKEQ7ACpWM
STRIPE_PRICE_OMP_150=price_1Tf4rBNusNy7pYKXPJFlhLwo
STRIPE_PRICE_OMP_250=price_1Tfr4rBNusNy7pYKS7XQFqWA
```

No cambiar estos IDs mientras:

* pertenezcan al sandbox correcto;
* correspondan a los montos actuales;
* no se cambien los precios.

---

# Archivos Sensibles

No subir:

```text
.env
.env.*
serviceAccountKey.json
*-service-account.json
*.jks
*.keystore
*.p8
*.p12
*.key
*.mobileprovision
*.aab
*.apk
*.zip
dist/
web-build/
.cache/
logs
```

---

# Instalación

## Requisitos

* Node.js 22.
* npm.
* Firebase CLI.
* Java 17 para el emulador.
* Android Studio para Android local.
* Xcode para iOS local.
* EAS CLI para builds remotos.

## Dependencias

```bash
npm install
npm --prefix functions install
```

## Inicio

```bash
npm run start
```

## Web

```bash
npm run web
```

## Android

```bash
npm run android
```

## iOS

```bash
npm run ios
```

---

# Comandos

| Comando                    | Acción                     |
| -------------------------- | -------------------------- |
| `npm run start`            | Inicia Expo                |
| `npm run android`          | Ejecuta Android            |
| `npm run android:release`  | Ejecuta release Android    |
| `npm run ios`              | Ejecuta iOS                |
| `npm run web`              | Ejecuta Web                |
| `npm run build:web`        | Exporta Web                |
| `npm run preview:web`      | Previsualiza Web           |
| `npm run lint`             | Ejecuta ESLint             |
| `npm test`                 | Ejecuta Jest               |
| `npm run test:coverage`    | Cobertura                  |
| `npm run test:rules`       | Prueba Firestore Rules     |
| `npm run validate`         | Validación integral        |
| `npm run deploy:rules`     | Despliega reglas e índices |
| `npm run deploy:functions` | Despliega Functions        |
| `npm run deploy:all`       | Despliegue completo        |

---

# Validación

```bash
npm run validate
```

Incluye:

```text
Expo lint
TypeScript
Tests frontend
Functions lint
Functions build
Functions tests
```

Las reglas se ejecutan por separado:

```bash
npm run test:rules
```

---

# Integración Continua

GitHub Actions ejecuta tres trabajos:

## Aplicación

```text
npm ci
npm run lint
npx tsc --noEmit
npm test -- --runInBand
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
instalación Java 17
descarga del emulador
npm run test:rules
```

No se debe declarar un release listo si alguno falla.

---

# Build Android

## Desarrollo

```bash
npm run android
```

## Release Local

```bash
npm run android:release
```

## EAS

```bash
npm install -g eas-cli
eas login
eas build --platform android
```

Antes de generar AAB:

* sincronizar versión;
* actualizar versionCode;
* ejecutar `npm run validate`;
* ejecutar `npm run test:rules`;
* probar notificaciones;
* probar Stripe;
* revisar permisos.

---

# Build Web

```bash
npm run build:web
npm run preview:web
```

El resultado se genera en:

```text
dist/
```

Debe publicarse en el host externo configurado.

---

# Estado Funcional Por Módulo

| Módulo                    | Estado                                |
| ------------------------- | ------------------------------------- |
| Login                     | Funcional                             |
| Rutas protegidas          | Funcional                             |
| Onboarding de idioma      | Funcional                             |
| Tema                      | Funcional                             |
| Usuarios                  | Funcional con corrección pendiente    |
| Reuniones                 | Funcional                             |
| Asignaciones              | Funcional                             |
| Discursos externos        | Funcional                             |
| Eventos                   | Funcional                             |
| Limpieza                  | Funcional                             |
| Acomodadores y micrófonos | Funcional con inconsistencia de Rules |
| Predicación               | Funcional, requiere QA completo       |
| Territorios               | Funcional, requiere QA completo       |
| Organigrama móvil         | Funcional                             |
| Organigrama escritorio    | Funcional con límite de profundidad   |
| Dashboard                 | Funcional                             |
| Configuración             | Funcional                             |
| Notificaciones internas   | Funcional                             |
| Push notifications        | Implementadas; validar dispositivos   |
| Stripe Checkout           | Implementado; validar ambiente        |
| Customer Portal           | Implementado; validar ambiente        |
| Stripe Webhook            | Implementado; validar ambiente        |
| Web                       | Funcional                             |
| Android                   | Funcional en desarrollo/build         |
| iOS                       | Preparado; falta QA real              |
| CI                        | Configurado                           |
| Firestore Rules tests     | Configurados                          |

---

# Riesgos Técnicos Conocidos

## Prioridad Crítica

### Permiso `acomodadores_microfonos`

El frontend acepta:

```text
acomodadores_microfonos
```

pero `validUserPermissions()` en Firestore Rules todavía no incluye esa clave en su lista `hasOnly()`.

Posible consecuencia:

* crear o editar un usuario con ese permiso puede ser rechazado.

Corrección requerida:

```text
Agregar 'acomodadores_microfonos' en validUserPermissions().
Agregar su validación con validPermissionActions().
Agregar tests de Firestore Rules.
```

---

## Prioridad Alta

### Sincronización De Versión

Definir una versión única y actualizar:

```text
package.json
app.json
ios.buildNumber
android.versionCode
README.md
release notes
```

### Batch Del Organigrama

La reconciliación usa un único `WriteBatch`.

Una congregación grande puede generar demasiadas operaciones.

Solución:

* dividir en lotes;
* usar tamaño seguro;
* confirmar cada lote;
* registrar progreso;
* manejar fallos parciales.

### QA De Stripe

Validar:

* secret key;
* webhook secret;
* Price IDs;
* Checkout;
* Portal;
* webhook;
* renovación;
* pago fallido;
* gracia;
* exención;
* historial.

---

## Prioridad Media

### Organigrama Desktop

La vista escritorio no es recursiva en profundidad ilimitada.

Debe crearse un render recursivo para cualquier nivel.

### Estado De Proyección

El trigger automático solo registra fallos en logs.

Agregar:

```text
organizationProjectionStatus
lastProjectionAt
lastProjectionError
lastSuccessfulProjectionAt
```

### Coordinador Y Secretario Duplicados

La generación toma el primero por nombre.

Debe bloquearse la creación de:

* dos coordinadores activos;
* dos secretarios activos.

### Roles Legacy

Las Rules todavía aceptan:

```text
administrador
usuario
```

Después de migrar Firestore deben eliminarse.

### Placeholder Del Sistema

Eliminar referencias como:

```text
tu_correo@gmail.com
```

de las reglas o sustituirlas por mecanismos de identidad seguros.

---

# Requisitos Para Producción

OMP podrá declararse estable cuando cumpla:

## Código

* [ ] `npm run validate` pasa.
* [ ] `npm run test:rules` pasa.
* [ ] CI está verde.
* [ ] No hay errores TypeScript.
* [ ] No hay errores ESLint.
* [ ] Functions compilan.
* [ ] Tests críticos pasan.

## Seguridad

* [ ] `acomodadores_microfonos` corregido.
* [ ] Roles legacy migrados.
* [ ] Placeholder eliminado.
* [ ] Rules auditadas.
* [ ] Secrets rotados.
* [ ] No hay credenciales en Git.
* [ ] App Check planificado.

## Billing

* [ ] Sandbox probado.
* [ ] Live mode probado.
* [ ] Webhook desplegado.
* [ ] Portal configurado.
* [ ] Price IDs confirmados.
* [ ] Pago exitoso probado.
* [ ] Pago fallido probado.
* [ ] Gracia probada.
* [ ] Exención probada.
* [ ] Renovación probada.

## Plataformas

* [ ] Web probado.
* [ ] Android development build probado.
* [ ] Android release probado.
* [ ] iOS físico probado.
* [ ] Navegación móvil auditada.
* [ ] Deep links probados.
* [ ] Push notifications probadas.

## Datos

* [ ] Migración legacy ejecutada.
* [ ] Backups definidos.
* [ ] Índices desplegados.
* [ ] Organigrama validado.
* [ ] Datos duplicados revisados.
* [ ] Costos monitoreados.

---

# Roadmap

## Fase 1 — Base Técnica

**Estado:** completada.

* Expo Router.
* Authentication.
* Firestore.
* Functions.
* rutas protegidas;
* roles;
* permisos;
* documentación inicial.

## Fase 2 — Módulos

**Estado:** avanzada.

* usuarios;
* reuniones;
* asignaciones;
* limpieza;
* hospitalidad;
* discursos;
* predicación;
* territorios;
* notificaciones;
* organigrama;
* dashboard.

## Fase 3 — Billing

**Estado:** implementado, pendiente de QA integral.

* planes;
* límites;
* Checkout;
* Portal;
* Webhook;
* historial;
* recordatorios;
* exenciones.

## Fase 4 — Estabilización

**Estado:** actual.

* corregir permisos;
* sincronizar versión;
* mejorar organigrama;
* dividir batches;
* aumentar cobertura;
* probar servicios externos;
* revisar navegación.

## Fase 5 — Producción

* builds oficiales;
* monitoreo;
* Stripe live;
* soporte;
* backups;
* App Check;
* métricas;
* publicación.

## Fase 6 — Escalamiento

* panel superadmin;
* auditoría;
* métricas por congregación;
* costos;
* reportes;
* observabilidad;
* administración avanzada;
* soporte multi-congregación.

---

# Documentación Técnica

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

---

# Convención De Commits

```text
feat: nueva funcionalidad
fix: corrección
docs: documentación
test: pruebas
refactor: reestructuración
chore: mantenimiento
ci: integración continua
```

Ejemplos:

```text
fix(rules): aceptar permiso acomodadores_microfonos
refactor(org-chart): dividir reconciliacion en batches
docs(readme): actualizar estado funcional
test(rules): cubrir permisos de hospitalidad
chore(version): sincronizar version 1.15.2
```

---

# Flujo Git Recomendado

```bash
git checkout -b fix/permissions-hospitality
npm run validate
npm run test:rules
git status --short
git add .
git commit -m "fix(rules): align hospitality permissions"
git push
```

Mantener cambios enfocados.

No mezclar en un mismo commit:

* reglas;
* refactors masivos;
* diseño;
* billing;
* navegación;
* documentación;

salvo que sean parte del mismo objetivo.

---

# Checklist Antes De PR

* [ ] Alcance definido.
* [ ] No hay secrets.
* [ ] No hay builds.
* [ ] No se cambiaron precios.
* [ ] No se cambiaron Price IDs.
* [ ] Lint pasa.
* [ ] TypeScript pasa.
* [ ] Tests pasan.
* [ ] Rules tests pasan.
* [ ] Documentación actualizada.
* [ ] Cambios de versión sincronizados.
* [ ] Capturas o pasos QA incluidos.

---

# Política De Precios

Los precios vigentes se mantienen:

```text
OMP 80:  70 MXN/mes
OMP 150: 120 MXN/mes
OMP 250: 200 MXN/mes
```

No modificar sin una decisión comercial explícita.

Cualquier cambio futuro requiere:

1. decisión comercial;
2. nuevos Prices en Stripe;
3. estrategia para clientes existentes;
4. actualización frontend;
5. actualización backend;
6. actualización de documentación;
7. pruebas;
8. comunicación previa.

---

# Conclusión

OMP Suite es una plataforma funcional con una arquitectura sólida y un alcance superior al de un prototipo.

Actualmente cuenta con:

* frontend multiplataforma;
* backend Firebase;
* Cloud Functions;
* reglas de seguridad;
* permisos;
* billing;
* notificaciones;
* módulos operativos;
* cache;
* CI;
* testing;
* documentación.

Su valor comercial estimado es considerablemente mayor que la suscripción mensual. Los precios bajos buscan distribuir el costo de infraestructura, mantenimiento y desarrollo continuo entre varias congregaciones.

La prioridad inmediata no es agregar decenas de funciones nuevas. Es cerrar las diferencias actuales:

1. permiso `acomodadores_microfonos`;
2. sincronización de versión;
3. batches del organigrama;
4. QA real de Stripe;
5. QA de notificaciones;
6. pruebas físicas Android e iOS;
7. eliminación de compatibilidad legacy cuando la migración termine.

Después de cerrar esos puntos, OMP puede clasificarse como una versión comercial estable y preparada para una adopción más amplia.
