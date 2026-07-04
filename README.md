# OMP Suite

OMP Suite —Organization, Ministry & Programs— es una aplicación multiplataforma para la organización interna de congregaciones. Su objetivo es centralizar en una sola plataforma la administración de usuarios, reuniones, asignaciones, limpieza, predicación, territorios, notificaciones, organigrama, permisos, planes, pagos y configuración por congregación.

OMP Suite está pensada para funcionar en:

* Web.
* Android.
* iOS mediante Expo.
* Dispositivos móviles.
* Escritorio mediante React Native Web.

OMP Suite no es una aplicación oficial de JW.ORG, no está afiliada, respaldada ni aprobada por ninguna entidad oficial de los Testigos de Jehová. Es una herramienta independiente de uso privado.

---

## Estado Actual Del Proyecto

* Versión actual: `1.13.3`.
* Tiempo aproximado de desarrollo acumulado: 4 meses de trabajo activo.
* Estado del producto: fase avanzada de estabilización técnica y comercial.
* Plataforma principal: Expo / React Native.
* Navegación: Expo Router.
* Backend: Firebase.
* Cobros: Stripe Billing.
* Notificaciones: Expo Notifications y Firebase Admin Messaging.
* Seguridad: Firestore Rules, roles, permisos y Cloud Functions.
* Modelo comercial: suscripción mensual por congregación.
* Unidad de cobro: congregación, no usuario individual.

OMP Suite ya no debe tratarse como prototipo. Actualmente tiene una base técnica de producto real, con módulos operativos, reglas de seguridad, integración de pagos, backend serverless, documentación técnica y validaciones de despliegue.

---

## Objetivo De OMP Suite

OMP Suite busca resolver un problema común: muchas congregaciones manejan información operativa en hojas de cálculo, chats, notas sueltas, mensajes privados o archivos separados. Esto puede provocar duplicidad de información, errores en asignaciones, poca visibilidad, dificultad para dar seguimiento y dependencia de una sola persona.

OMP centraliza esa operación en una plataforma estructurada.

Objetivos principales:

* Reducir errores administrativos.
* Ahorrar tiempo en la organización semanal.
* Centralizar datos por congregación.
* Proteger la información mediante permisos.
* Dar visibilidad clara a los responsables.
* Evitar duplicidad entre módulos.
* Mejorar la experiencia móvil.
* Mantener historial operativo.
* Facilitar futuras mejoras sin rehacer la arquitectura.
* Mantener un costo accesible para congregaciones.
* Permitir crecimiento técnico sin romper la base actual.

---

## Qué Problemas Resuelve

OMP Suite ayuda a resolver:

* Usuarios dispersos en listas manuales.
* Asignaciones repetidas o mal coordinadas.
* Falta de control sobre quién puede editar cada módulo.
* Reuniones creadas sin revisión suficiente.
* Limpieza y acomodadores manejados fuera del sistema.
* Falta de historial de cambios.
* Notificaciones poco centralizadas.
* Organización de predicación y territorios desconectada.
* Dificultad para visualizar responsabilidades internas.
* Cobros o suscripciones sin integración directa.
* Lecturas innecesarias en Firestore por falta de cache.
* Mala experiencia móvil en pantallas profundas.
* Falta de separación entre usuarios comunes, supervisores y administradores.
* Riesgo de mezclar información entre congregaciones.
* Dificultad para mantener datos actualizados en diferentes dispositivos.

---

## Características Principales

OMP Suite incluye actualmente:

* Autenticación de usuarios.
* Gestión de usuarios por congregación.
* Roles técnicos internos.
* Permisos por módulo.
* Responsabilidades de servicio.
* Reuniones entre semana.
* Reuniones de fin de semana.
* Asignaciones.
* Discursos externos.
* Limpieza.
* Grupos de limpieza.
* Planeación de limpieza.
* Acomodadores y micrófonos.
* Lectores.
* Predicación.
* Territorios.
* Reportes de predicación.
* Organigrama congregacional.
* Notificaciones internas.
* Push notifications.
* Dashboard por congregación.
* Configuración de usuario.
* Configuración por congregación.
* Billing con Stripe.
* Checkout de suscripción.
* Customer Portal.
* Stripe Webhook.
* Historial de pagos.
* Recordatorios de pago.
* Exenciones administrativas de cobro.
* Cache persistente.
* Estrategia cache-first.
* Validaciones de seguridad en frontend.
* Validaciones de seguridad en Firestore Rules.
* Validaciones de seguridad en Cloud Functions.
* Documentación técnica.
* Estructura preparada para builds web, Android e iOS.

---

## Stack Técnico

### Frontend

* Expo SDK 54.
* React 19.
* React Native 0.81.
* TypeScript.
* Expo Router.
* React Native Web.
* NativeWind / Tailwind CSS.
* AsyncStorage.
* Expo Notifications.
* Expo Image.
* Expo Haptics.
* Expo Linking.
* Expo Web Browser.
* React Navigation.
* React Native Reanimated.
* React Native Gesture Handler.
* React Native SVG.

### Backend

* Firebase Authentication.
* Cloud Firestore.
* Firebase Cloud Functions.
* Firebase Admin SDK.
* Firebase Admin Messaging.
* Firestore Rules.
* Firestore Indexes.
* Stripe Billing.
* Stripe Checkout.
* Stripe Customer Portal.
* Stripe Webhooks.
* Firebase Functions Secrets.
* Funciones programadas.
* Procesos de sincronización backend.

### Testing Y Validación

* Jest.
* Jest Expo.
* TypeScript.
* ESLint.
* Firebase Rules Unit Testing.
* Tests frontend.
* Tests de Cloud Functions.
* Pruebas de Firestore Rules mediante emuladores.
* Validación predeploy.
* Build de Cloud Functions.
* Validación de tipos con `tsc --noEmit`.

---

## Plataformas Soportadas

OMP Suite está diseñado como producto multiplataforma.

### Web

La versión web se construye con Expo Web y React Native Web. Está pensada para administradores o usuarios que prefieren trabajar desde escritorio.

### Android

Android es una plataforma principal. La app puede correr localmente con Expo y generar builds mediante EAS o build local.

### iOS

iOS está preparado mediante Expo. El proyecto contempla configuración de permisos, notificaciones y compatibilidad con dispositivos iOS.

---

## Estructura General Del Repositorio

```text
app/                         Rutas Expo Router
app/(auth)/                  Pantallas públicas de autenticación
app/(protected)/             Pantallas autenticadas
app/(protected)/(tabs)/      Tabs principales de la app
src/components/              Componentes UI reutilizables
src/screens/                 Pantallas principales
src/modules/                 Módulos de dominio
src/services/                Servicios, repositorios y acceso a Firebase
src/types/                   Tipos, DTOs y constantes de dominio
src/i18n/                    Traducciones
src/lib/firebase/            Inicialización y referencias Firebase
src/utils/                   Utilidades puras
functions/                   Cloud Functions
docs/                        Documentación técnica
firestore.rules              Reglas reales de seguridad
firestore.indexes.json       Índices Firestore
```

---

## Arquitectura De Navegación

OMP usa Expo Router como sistema principal de navegación.

La aplicación separa rutas públicas y protegidas:

```text
app/(auth)/                  Login, registro y recuperación
app/(protected)/             Rutas que requieren sesión activa
app/(protected)/(tabs)/      Rutas principales visibles en navegación
```

La navegación protegida valida:

* usuario autenticado;
* perfil cargado;
* congregación asignada;
* usuario activo;
* estado de bloqueo;
* permisos;
* estado de billing cuando aplique;
* redirecciones seguras.

En móvil, la aplicación utiliza un menú lateral adaptado para pantallas pequeñas. Las pantallas secundarias deben incluir una flecha de regreso mediante `PageHeader showBack`.

---

## Modelo De Seguridad

La seguridad de OMP no depende únicamente de la interfaz.

La UI puede ocultar botones, pero la seguridad real se aplica en:

* Firestore Rules.
* Cloud Functions.
* Validaciones de permisos.
* Validaciones por congregación.
* Validaciones por usuario activo.
* Validaciones por estado de billing.
* Validaciones de roles.
* Validaciones de responsabilidades.

Principios obligatorios:

* Todo dato protegido requiere autenticación.
* Todo dato de congregación debe estar aislado por `congregationId`.
* Un usuario no debe leer datos de otra congregación.
* Un usuario común no puede cambiar su rol.
* Un usuario común no puede cambiar su congregación.
* Los cambios sensibles deben pasar por Cloud Functions.
* Las reglas de Firestore son la fuente final de seguridad para lecturas y escrituras directas.
* Las operaciones administrativas deben validar permisos en backend.
* Los datos de billing no deben depender solo del cliente.
* Stripe Webhook es la fuente confiable para pagos.
* Las llaves privadas nunca deben estar en el frontend.
* Los secrets deben administrarse desde Firebase Functions Secrets.

---

## Roles Técnicos

Los roles técnicos internos recomendados son:

```ts
type UserRole = 'admin' | 'supervisor' | 'user';
```

Etiquetas visibles:

| Valor técnico | Etiqueta UI   |
| ------------- | ------------- |
| `admin`       | Administrador |
| `supervisor`  | Supervisor    |
| `user`        | Usuario       |

Valores antiguos como `administrador` o `usuario` deben tratarse como legacy y no usarse para datos nuevos.

---

## Separación Entre Role, Permissions Y Service Assignments

OMP separa conceptos que no deben mezclarse.

### `role`

Define el nivel general del usuario dentro del sistema.

Ejemplos:

* `admin`
* `supervisor`
* `user`

### `permissions`

Define acciones técnicas por módulo.

Ejemplos:

* ver usuarios;
* crear usuarios;
* editar reuniones;
* administrar limpieza;
* ver pagos;
* administrar pagos;
* ver organigrama;
* administrar módulos específicos.

### `serviceAssignments`

Define responsabilidades dentro de la congregación.

Ejemplos:

* coordinador;
* secretario;
* encargado de limpieza;
* auxiliar de tesorería;
* encargado de territorios;
* encargado de predicación;
* encargado de reuniones.

### `privileges`

Define condiciones internas o atributos funcionales especiales.

### `responsibilities`

Define marcadores funcionales que pueden activar accesos o comportamientos específicos.

---

## Módulos Principales

### Usuarios

El módulo de usuarios permite administrar personas dentro de una congregación.

Incluye:

* creación de usuarios;
* edición de perfil;
* activación y desactivación;
* control de roles;
* permisos por módulo;
* responsabilidades;
* límite por plan;
* paginación;
* fallback seguro si falla una Cloud Function;
* mensajes de error humanos;
* aislamiento por congregación.

La creación de usuarios activos respeta el límite del plan contratado.

---

### Reuniones

El módulo de reuniones permite crear y administrar reuniones de congregación.

Incluye:

* reuniones entre semana;
* reuniones de fin de semana;
* flujo guiado de creación;
* revisión antes de publicar;
* datos básicos;
* lugar;
* enlace;
* fecha;
* semana;
* programa;
* asignaciones;
* limpieza;
* lectores;
* acomodadores;
* micrófonos;
* integración con módulos publicados;
* validación de duplicados;
* validación de conflictos;
* guardado de borrador;
* publicación controlada.

El formulario de reuniones está diseñado para evitar errores antes de publicar.

---

### Asignaciones

El módulo de asignaciones permite administrar responsabilidades dentro de reuniones.

Incluye:

* asignaciones por reunión;
* validaciones de usuario;
* compatibilidad con reuniones;
* integración con discursos externos;
* control de conflictos;
* usuarios bloqueados por salida a discursar;
* separación entre borradores y datos publicados.

---

### Discursos Externos

El módulo de discursos externos permite registrar salidas a discursar.

Incluye:

* programación de salida;
* usuario asignado;
* fecha;
* congregación destino;
* validación contra reuniones de fin de semana;
* prevención de conflictos;
* integración con planeación operativa.

---

### Limpieza

El módulo de limpieza permite organizar grupos y turnos.

Incluye:

* grupos de limpieza;
* integrantes;
* planeación por fechas;
* publicación de schedule;
* sincronización con reuniones;
* integración con el formulario de reuniones;
* Cloud Function de publicación;
* control de campos sincronizados;
* IDs deterministas para evitar duplicados.

---

### Acomodadores Y Micrófonos

Este módulo permite planear funciones relacionadas con hospitalidad y micrófonos.

Incluye:

* acomodadores;
* micrófonos;
* lectores;
* planeación por fecha;
* publicación controlada;
* sincronización con reuniones;
* Cloud Function propia;
* campos bloqueados cuando ya están controlados por este módulo;
* explicación visual de por qué ciertos campos están bloqueados.

---

### Predicación

El módulo de predicación centraliza información relacionada con actividad de predicación.

Incluye:

* reportes;
* asignaciones relacionadas;
* datos por congregación;
* integración con usuarios;
* estructura preparada para crecimiento.

---

### Territorios

El módulo de territorios permite organizar zonas o registros relacionados con predicación.

Incluye:

* administración de territorios;
* asignaciones;
* estado del territorio;
* datos por congregación;
* control de permisos.

---

### Organigrama Congregacional

El organigrama permite visualizar responsabilidades dentro de la congregación.

Incluye:

* coordinador;
* secretario;
* departamentos operativos;
* responsables;
* auxiliares;
* apoyos;
* vista móvil;
* vista escritorio;
* permisos de visualización;
* permisos de administración;
* carga de usuarios activos para edición;
* manejo de errores;
* estructura jerárquica.

Regla funcional:

* Todo usuario activo con `congregationId` debe poder ver el organigrama.
* La administración debe permanecer limitada a usuarios autorizados, como coordinador, secretario o usuarios con acceso global según reglas definidas.

---

### Notificaciones

OMP tiene dos tipos de notificaciones:

* notificaciones internas en Firestore;
* push notifications mediante Expo Notifications y Firebase Admin Messaging.

Incluye:

* tokens por usuario;
* segmentación por congregación;
* mensajes internos;
* canales Android;
* limpieza de tokens inválidos;
* envío desde backend;
* soporte para notificaciones de reuniones, asignaciones y limpieza.

Las pruebas finales de push no deben hacerse únicamente en Expo Go. Deben validarse en development build o release.

---

### Dashboard

El dashboard resume información relevante para la congregación.

Puede mostrar:

* reuniones próximas;
* asignaciones;
* avisos;
* estado de módulos;
* datos de la congregación;
* indicadores operativos.

Debe evolucionar hacia dashboard por perfil:

* administrador;
* supervisor;
* usuario común;
* encargado de módulo;
* tesorería;
* secretario;
* coordinador.

---

## Billing Y Suscripciones

El cobro de OMP Suite es por congregación, no por usuario individual.

OMP usa Stripe Billing como proveedor principal. No se manejan pagos manuales como flujo principal.

### Planes Vigentes

| Plan      | Usuarios activos incluidos | Precio mensual |
| --------- | -------------------------: | -------------: |
| `omp_80`  |                80 usuarios |         70 MXN |
| `omp_150` |               150 usuarios |        120 MXN |
| `omp_250` |               250 usuarios |        200 MXN |

Los precios no se incrementan en esta actualización.

Estos precios incluyen:

* uso de la plataforma;
* mantenimiento técnico básico;
* actualizaciones continuas;
* infraestructura Firebase;
* Cloud Functions;
* Firestore;
* integración con Stripe;
* procesamiento de pagos;
* notificaciones;
* mejoras de seguridad;
* corrección de errores;
* soporte de evolución del producto.

---

## Valor Comercial Del Proyecto

OMP Suite no debe valorarse como una página web sencilla ni como una plantilla visual. Es una plataforma completa con frontend multiplataforma, backend serverless, base de datos, reglas de seguridad, notificaciones, suscripciones, pagos, permisos, módulos operativos y documentación técnica.

El valor de mercado estimado del proyecto completo, si una empresa, congregación o cliente mandara construirlo desde cero con un desarrollador fullstack senior, agencia o equipo técnico especializado, se estima en:

| Escenario                                              |             Valor estimado |
| ------------------------------------------------------ | -------------------------: |
| Valor conservador del desarrollo                       |      350,000 – 650,000 MXN |
| Valor realista por alcance actual                      |    650,000 – 1,200,000 MXN |
| Valor con agencia, QA, diseño, DevOps y soporte formal | 1,200,000 – 2,000,000+ MXN |

Este valor no representa el precio mensual de uso de OMP. Representa el costo aproximado de producir una plataforma similar desde cero, considerando análisis, diseño, arquitectura, desarrollo, integración, seguridad, pruebas, documentación y despliegue.

---

## Por Qué El Proyecto Tiene Ese Valor

OMP Suite tiene un valor técnico alto porque concentra varias capas de desarrollo que normalmente se cotizan por separado.

### 1. Aplicación Multiplataforma

OMP no es solamente una web. Está construido para funcionar en:

* Web.
* Android.
* iOS.
* Escritorio.
* Dispositivos móviles.

Esto implica arquitectura adaptable, navegación protegida, diseño responsive, compatibilidad móvil y estructura preparada para builds reales.

### 2. Frontend Completo

Incluye:

* Expo SDK 54.
* React 19.
* React Native 0.81.
* TypeScript.
* Expo Router.
* NativeWind.
* React Native Web.
* Componentes reutilizables.
* Pantallas protegidas.
* Estados de carga.
* Estados vacíos.
* Manejo de errores humanos.
* Navegación móvil.
* Menú lateral móvil.
* Formularios complejos.
* Validaciones por módulo.

### 3. Backend Serverless

Incluye:

* Firebase Authentication.
* Cloud Firestore.
* Cloud Functions.
* Firebase Admin SDK.
* Funciones programadas.
* Webhooks.
* Validaciones del lado servidor.
* Procesos de sincronización.
* Acciones administrativas protegidas.

### 4. Seguridad

Incluye:

* aislamiento por `congregationId`;
* usuarios activos/inactivos;
* roles técnicos;
* permisos por módulo;
* responsabilidades de servicio;
* Firestore Rules;
* validaciones en Cloud Functions;
* protección de campos sensibles;
* protección de billing;
* protección de operaciones administrativas.

### 5. Billing Con Stripe

Incluye:

* Stripe Billing.
* Stripe Checkout.
* Stripe Customer Portal.
* Stripe Webhook.
* Historial de pagos.
* Recordatorios de pago.
* Exenciones de cobro.
* Estados de gracia.
* Validación de permisos para pagar.
* Separación entre cliente y llaves privadas.
* Secrets en Firebase Functions.

### 6. Módulos Operativos

OMP incluye módulos que normalmente serían sistemas independientes:

* Usuarios.
* Reuniones.
* Asignaciones.
* Limpieza.
* Grupos de limpieza.
* Acomodadores y micrófonos.
* Lectores.
* Discursos externos.
* Predicación.
* Territorios.
* Reportes.
* Notificaciones.
* Organigrama.
* Billing.
* Dashboard.
* Configuración.

### 7. Cache Y Optimización

Incluye:

* cache en memoria;
* cache persistente con AsyncStorage;
* estrategia cache-first;
* invalidación por ciclo;
* limpieza al cerrar sesión;
* limpieza al cambiar de congregación;
* reducción de lecturas Firestore;
* control de datos sensibles sin cache persistente.

### 8. Documentación Técnica

Incluye documentación para:

* arquitectura;
* permisos;
* matriz de permisos;
* seguridad Firestore;
* billing;
* deployment;
* notificaciones;
* QA móvil;
* App Check;
* cache;
* testing;
* planes por congregación;
* validación predeploy.

---

## Estimación De Horas De Desarrollo

El desarrollo acumulado de OMP representa aproximadamente 4 meses de trabajo activo. Para un proyecto con este alcance, una estimación razonable de horas de mercado sería:

| Área                                   | Horas estimadas |
| -------------------------------------- | --------------: |
| Análisis, arquitectura y planificación |      60 – 120 h |
| Diseño UX/UI y experiencia móvil       |      80 – 160 h |
| Frontend React Native / Expo / Web     |     220 – 420 h |
| Firebase Auth, Firestore y servicios   |     120 – 240 h |
| Cloud Functions y backend seguro       |     140 – 280 h |
| Firestore Rules y permisos             |      80 – 180 h |
| Billing con Stripe                     |      70 – 140 h |
| Notificaciones                         |       40 – 90 h |
| Cache, rendimiento y optimización      |      50 – 120 h |
| Testing, QA y correcciones             |     100 – 220 h |
| Documentación técnica                  |      40 – 100 h |

Total estimado:

```text
Mínimo conservador: 700 – 900 horas
Rango realista: 900 – 1,400 horas
Rango agencia/equipo formal: 1,400 – 2,000+ horas
```

---

## Estimación De Valor Por Hora

Una tarifa de mercado para perfiles relacionados con React Native, Firebase, backend serverless, Stripe y arquitectura fullstack puede variar según experiencia, país, urgencia, agencia, soporte y responsabilidad técnica.

Para valorar OMP se puede usar una referencia conservadora:

```text
Tarifa baja conservadora: 20 – 25 USD/h
Tarifa freelance especializada: 25 – 45 USD/h
Tarifa senior/agencia: 45 – 80+ USD/h
```

Ejemplo de cálculo:

```text
900 h x 25 USD/h = 22,500 USD
1,200 h x 35 USD/h = 42,000 USD
1,500 h x 45 USD/h = 67,500 USD
```

Convertido a MXN de forma aproximada:

```text
22,500 USD ≈ 390,000 MXN
42,000 USD ≈ 735,000 MXN
67,500 USD ≈ 1,180,000 MXN
```

Por eso el valor de mercado recomendado para documentar OMP es:

```text
Valor de mercado estimado: 650,000 – 1,200,000 MXN
```

Este rango es razonable para una plataforma funcional con frontend multiplataforma, backend Firebase, Cloud Functions, reglas de seguridad, Stripe Billing, notificaciones, módulos operativos y documentación técnica.

---

## Diferencia Entre Valor Del Proyecto Y Precio De Suscripción

El valor de mercado del proyecto no significa que cada congregación pague ese monto.

OMP usa un modelo de suscripción mensual accesible:

| Plan      | Usuarios activos | Precio mensual |
| --------- | ---------------: | -------------: |
| `omp_80`  |      80 usuarios |         70 MXN |
| `omp_150` |     150 usuarios |        120 MXN |
| `omp_250` |     250 usuarios |        200 MXN |

Estos precios se mantienen sin incremento.

La suscripción mensual no busca cobrar a una sola congregación el costo completo del desarrollo. Busca distribuir el costo de operación, mantenimiento y evolución entre varias congregaciones con un precio accesible.

---

## Por Qué Se Cobra

OMP requiere cobro porque no es solo una pantalla o una página web estática. Es una plataforma con backend, base de datos, reglas de seguridad, funciones en servidor, integración de pagos, notificaciones, mantenimiento y evolución continua.

El cobro ayuda a cubrir:

### Infraestructura

* dominio;
* hosting;
* Firebase;
* Google Cloud;
* Firestore;
* Cloud Functions;
* Secrets;
* notificaciones;
* almacenamiento;
* tráfico;
* ambientes de prueba.

### Procesamiento De Pagos

* Stripe Billing.
* Stripe Checkout.
* Stripe Customer Portal.
* Webhooks.
* Manejo de facturación.
* Comisiones por transacción.
* Validaciones de pago.
* Historial de eventos.

### Desarrollo

* 4 meses aproximados de desarrollo acumulado.
* Arquitectura multiplataforma.
* Módulos internos.
* Validaciones.
* Refactors.
* Correcciones.
* Diseño móvil.
* Mejoras de rendimiento.
* Testing.
* Seguridad.
* Documentación.

### Mantenimiento

* Actualización de dependencias.
* Corrección de errores.
* Ajustes por cambios en Expo, Firebase o Stripe.
* Revisión de reglas.
* Revisión de permisos.
* Soporte técnico.
* Mejoras de documentación.
* Optimización de costos.

### Seguridad

* Firestore Rules.
* Cloud Functions.
* Aislamiento por congregación.
* Validación de usuarios activos.
* Validación de roles.
* Protección de operaciones sensibles.
* Manejo de secrets.
* Evitar exposición de llaves privadas.

---

## Costos Tecnológicos Del Proyecto

OMP tiene costos tecnológicos directos e indirectos. Algunos son fijos, otros dependen del uso.

### Costos Fijos

| Concepto                   | Tipo                                      |                         Estimación |
| -------------------------- | ----------------------------------------- | ---------------------------------: |
| Dominio `ompsuite.com`     | Anual                                     |                  200 – 700 MXN/año |
| Hosting externo web        | Mensual                                   |                    0 – 400 MXN/mes |
| Cuenta Google Play         | Pago único, si se publica en Play Store   |                      aprox. 25 USD |
| Apple Developer Program    | Anual, si se publica en App Store         |                  aprox. 99 USD/año |
| Expo EAS                   | Opcional                                  | 0 USD, 19 USD/mes o más según plan |
| Herramientas de desarrollo | Variable                                  |                          según uso |
| Certificados SSL           | Normalmente incluido por host o proveedor |                       0 – variable |

### Costos Variables

| Concepto           | Cómo se cobra                                                                  |
| ------------------ | ------------------------------------------------------------------------------ |
| Firebase Firestore | lecturas, escrituras, almacenamiento y egreso después del límite gratuito      |
| Cloud Functions    | invocaciones, CPU, memoria, egreso y build minutes después del límite gratuito |
| Firebase Storage   | almacenamiento, descargas y operaciones si se usa                              |
| Stripe             | comisión por transacción exitosa                                               |
| Hosting externo    | tráfico, almacenamiento o plan contratado                                      |
| Dominio            | renovación anual                                                               |
| EAS Build          | builds incluidos o uso adicional según plan                                    |
| Soporte técnico    | tiempo humano de mantenimiento                                                 |
| Google Cloud       | uso de recursos asociados a Firebase y Functions                               |

---

## Firebase Y Google Cloud

OMP usa Firebase como backend principal. Firebase puede tener uso gratuito en varios servicios, pero en producción debe asumirse que el costo puede crecer con el uso.

Servicios usados o preparados:

* Firebase Authentication.
* Cloud Firestore.
* Cloud Functions.
* Firebase Admin SDK.
* Firebase Admin Messaging.
* Cloud Messaging.
* Firestore Rules.
* Firestore Indexes.
* Secrets de Functions.
* Emuladores para pruebas.

El costo de Firebase depende principalmente de:

* cantidad de usuarios activos;
* cantidad de lecturas Firestore;
* cantidad de escrituras;
* cantidad de funciones ejecutadas;
* tráfico de red;
* almacenamiento;
* notificaciones;
* frecuencia de consultas;
* listeners en tiempo real;
* eficiencia del cache.

OMP incluye una estrategia de cache para reducir lecturas innecesarias y controlar costos.

---

## Stripe

OMP usa Stripe Billing para procesar suscripciones.

Los precios vigentes son:

```text
omp_80  = 70 MXN/mes
omp_150 = 120 MXN/mes
omp_250 = 200 MXN/mes
```

Stripe cobra comisión por pago exitoso. Como referencia de cálculo para tarjetas nacionales en México:

```text
3.6% + 3 MXN por transacción exitosa
```

Estimación de comisión por plan:

| Plan      | Cobro mensual | Comisión Stripe aprox. | Neto aprox. |
| --------- | ------------: | ---------------------: | ----------: |
| `omp_80`  |        70 MXN |               5.52 MXN |   64.48 MXN |
| `omp_150` |       120 MXN |               7.32 MXN |  112.68 MXN |
| `omp_250` |       200 MXN |              10.20 MXN |  189.80 MXN |

Estimación por 4 meses de una congregación:

| Plan      | Total cobrado 4 meses | Comisión Stripe aprox. 4 meses | Neto aprox. 4 meses |
| --------- | --------------------: | -----------------------------: | ------------------: |
| `omp_80`  |               280 MXN |                      22.08 MXN |          257.92 MXN |
| `omp_150` |               480 MXN |                      29.28 MXN |          450.72 MXN |
| `omp_250` |               800 MXN |                      40.80 MXN |          759.20 MXN |

Estos cálculos son aproximados y pueden variar si se usan tarjetas internacionales, conversión de moneda, impuestos, disputas, reembolsos o condiciones especiales de Stripe.

---

## Costo Acumulado De Tecnología Durante 4 Meses

Como el desarrollo lleva aproximadamente 4 meses, se puede documentar el costo tecnológico acumulado de forma estimada.

| Concepto                                             |       Estimación 4 meses |
| ---------------------------------------------------- | -----------------------: |
| Dominio anual prorrateado                            |             70 – 235 MXN |
| Dominio pagado completo anual                        |            200 – 700 MXN |
| Hosting externo web                                  |            0 – 1,600 MXN |
| Firebase / Google Cloud en etapa baja                |            0 – 1,200 MXN |
| Stripe por una suscripción `omp_80` durante 4 meses  |         22.08 MXN aprox. |
| Stripe por una suscripción `omp_150` durante 4 meses |         29.28 MXN aprox. |
| Stripe por una suscripción `omp_250` durante 4 meses |         40.80 MXN aprox. |
| Expo EAS Free                                        |                    0 MXN |
| Expo EAS Starter por 4 meses, si se usa              |            aprox. 76 USD |
| Apple Developer, si se publica en iOS                |               99 USD/año |
| Google Play Console, si se publica en Play Store     | aprox. 25 USD pago único |

Costo acumulado mínimo probable en etapa de desarrollo:

```text
500 – 3,500 MXN aprox. + comisiones Stripe
```

Costo acumulado posible si se usan planes pagados, builds, cuentas de tienda y más tráfico:

```text
3,500 – 20,000+ MXN aprox.
```

Estos rangos deben reemplazarse por facturas reales si ya existen comprobantes de dominio, hosting, Firebase, Google Cloud, Expo, Apple, Google Play o Stripe.

---

## Costos Que Deben Registrarse Internamente

Para tener control financiero real, registrar cada gasto en una tabla interna:

| Fecha     | Proveedor               | Concepto                           |     Monto | Moneda  | Periodo         | Notas                               |
| --------- | ----------------------- | ---------------------------------- | --------: | ------- | --------------- | ----------------------------------- |
| Pendiente | Dominio                 | `ompsuite.com`                     | pendiente | MXN/USD | anual           | registrar factura real              |
| Pendiente | Hosting                 | host externo web                   | pendiente | MXN/USD | mensual/anual   | Firebase Hosting está deshabilitado |
| Pendiente | Firebase / Google Cloud | Firestore, Functions, Secrets      | pendiente | MXN/USD | mensual         | según uso                           |
| Pendiente | Stripe                  | comisiones de pago                 |  variable | MXN     | por transacción | comisión por pago exitoso           |
| Pendiente | Expo                    | EAS Build / Update                 | pendiente | USD     | mensual         | si se usa plan pagado               |
| Pendiente | Apple                   | Developer Program                  |        99 | USD     | anual           | solo si se publica iOS              |
| Pendiente | Google                  | Play Console                       |        25 | USD     | pago único      | solo si se publica Android          |
| Pendiente | Herramientas            | desarrollo, diseño, monitoreo o QA | pendiente | MXN/USD | variable        | según uso real                      |

---

## Conclusión Económica

OMP tiene dos valores distintos:

```text
1. Valor de mercado del desarrollo completo:
   650,000 – 1,200,000 MXN aprox.

2. Precio mensual de uso por congregación:
   70, 120 o 200 MXN al mes.
```

El precio mensual se mantiene bajo para que sea accesible. No refleja el costo completo de construcción del sistema, sino una contribución mensual para operación, mantenimiento, infraestructura y evolución continua.

Por eso, aunque el proyecto completo tiene un valor de mercado alto, las suscripciones actuales se mantienen sin incremento:

```text
omp_80  = 70 MXN/mes
omp_150 = 120 MXN/mes
omp_250 = 200 MXN/mes
```

---

## Flujo De Billing

El flujo actual de pago es:

1. Usuario autorizado entra a la sección de billing.
2. Selecciona plan.
3. La app llama a `createStripeCheckoutSession`.
4. Cloud Functions valida:

   * autenticación;
   * congregación;
   * permisos;
   * plan;
   * exención de cobro.
5. Cloud Functions crea o reutiliza el cliente Stripe.
6. Stripe Checkout procesa el pago.
7. Stripe redirige al usuario.
8. Stripe Webhook recibe el evento real de pago.
9. Firestore se actualiza con el estado real.
10. La app muestra el estado desde Firestore.

La pantalla de éxito no debe considerarse fuente de verdad. La fuente de verdad es el webhook de Stripe reflejado en Firestore.

---

## Estados De Billing

Estados comunes:

| Estado                    | Significado                               |
| ------------------------- | ----------------------------------------- |
| `active`                  | Suscripción activa                        |
| `trialing`                | Periodo de prueba                         |
| `checkout_pending`        | Checkout iniciado, pago aún no confirmado |
| `past_due`                | Pago vencido                              |
| `payment_action_required` | Requiere acción del usuario               |
| `unpaid`                  | Pago no cubierto                          |
| `canceled`                | Suscripción cancelada                     |
| `incomplete`              | Suscripción incompleta                    |
| `incomplete_expired`      | Suscripción incompleta expirada           |
| `exempt`                  | Congregación exenta                       |

---

## Exenciones De Cobro

Algunas congregaciones pueden estar exentas.

Modelo:

```ts
billingExemption: {
  exempt: boolean;
  reason?: string;
  grantedBy?: string;
  grantedAt?: Timestamp;
  expiresAt?: Timestamp | null;
}
```

Cuando una congregación está exenta:

* no se inicia Checkout;
* no se bloquea el acceso por pago;
* no se envían recordatorios de pago;
* la UI debe mostrar estado exento;
* el backend puede reflejar `billing.provider = "exempt"`;
* el backend puede reflejar `billing.status = "exempt"`.

---

## Modelo Firestore De Billing

La fuente vigente del plan vive en:

```text
/congregations/{congregationId}.billing
```

Campos principales:

```ts
billing: {
  enabled: boolean;
  provider: 'stripe' | 'exempt';
  status: string;
  planKey: 'omp_80' | 'omp_150' | 'omp_250';
  activeUsersLimit: number;
  userLimit: number;
  billingDay: 1;
  billingCycle: 'monthly';
  graceDays: 5;
  graceStartedAt?: Timestamp | null;
  graceUntil?: Timestamp | null;
  adminRestricted?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  currentPeriodStart?: Timestamp;
  currentPeriodEnd?: Timestamp;
  nextPaymentDate?: Timestamp;
  cancelAtPeriodEnd?: boolean;
  lastPaymentStatus?: string;
  lastInvoiceId?: string;
  lastInvoiceUrl?: string;
  lastStripeEventId?: string;
  updatedAt?: Timestamp;
}
```

---

## Historial De Billing

Los eventos importantes de Stripe se guardan en:

```text
/congregations/{congregationId}/billingHistory/{stripeEventId}
```

Ejemplo de estructura:

```ts
{
  provider: 'stripe';
  type: string;
  status: string;
  amount?: number | null;
  currency: 'MXN' | string;
  planKey?: 'omp_80' | 'omp_150' | 'omp_250' | null;
  stripeEventId: string;
  stripeInvoiceId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  hostedInvoiceUrl?: string | null;
  createdAt: Timestamp;
  processedAt: Timestamp;
}
```

El historial puede limpiarse automáticamente después del periodo de retención definido por el backend.

---

## Variables De Entorno

Crear `.env` local a partir de `.env.example`.

Variables públicas del cliente:

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

---

## Secrets De Firebase Functions

Las llaves privadas y Price IDs deben configurarse como secrets de Firebase Functions.

```bash
npx -y firebase-tools@latest functions:secrets:set STRIPE_SECRET_KEY
npx -y firebase-tools@latest functions:secrets:set STRIPE_WEBHOOK_SECRET
npx -y firebase-tools@latest functions:secrets:set STRIPE_PRICE_OMP_80
npx -y firebase-tools@latest functions:secrets:set STRIPE_PRICE_OMP_150
npx -y firebase-tools@latest functions:secrets:set STRIPE_PRICE_OMP_250
npx -y firebase-tools@latest functions:secrets:set APP_BILLING_RETURN_URL
```

No colocar `STRIPE_SECRET_KEY` en frontend.
No guardar `sk_test_...` ni `sk_live_...` en `.env` público.
No subir secrets al repositorio.

---

## Price IDs De Prueba

Los Price IDs de prueba documentados son:

```text
STRIPE_PRICE_OMP_80=price_1Tfr4rBNusNy7pYKEQ7ACpWM
STRIPE_PRICE_OMP_150=price_1Tf4rBNusNy7pYKXPJFlhLwo
STRIPE_PRICE_OMP_250=price_1Tfr4rBNusNy7pYKS7XQFqWA
```

Estos IDs corresponden al entorno de prueba correcto. Si aparecen IDs con otro prefijo o de otro sandbox, debe verificarse el entorno de Stripe antes de hacer pruebas.

Mientras los precios sigan siendo 70, 120 y 200 MXN, no deben reemplazarse los Price IDs correctos.

---

## Archivos Sensibles

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
dist/
web-build/
*.aab
*.apk
*.zip
logs de Firebase
logs de Expo
logs de npm
```

---

## Modelo De Datos Principal

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
/congregations/{congregationId}/departments/{departmentId}
/congregations/{congregationId}/departmentAssignments/{assignmentId}
/congregations/{congregationId}/changeLogs/{changeLogId}
/congregations/{congregationId}/notifications/{notificationId}
/congregations/{congregationId}/preachingReports/{monthId}/submissions/{userId}
/congregations/{congregationId}/billingHistory/{stripeEventId}
/dashboardSummary/{congregationId}
/system/{docId}
```

Regla central:

> Todo dato de congregación debe estar aislado por `congregationId`. No hacer consultas globales desde cliente salvo flujos superadmin protegidos y explícitamente autorizados.

---

## Cache Y Rendimiento

OMP usa una estrategia cache-first para reducir lecturas innecesarias.

Capas de cache:

1. memoria de sesión;
2. cache persistente con AsyncStorage;
3. cache local de Firestore;
4. servidor Firestore.

Reglas de cache:

* no usar cache persistente para billing sensible;
* no usar cache como fuente de autoridad de permisos;
* invalidar cache al crear, editar, publicar o eliminar;
* limpiar cache al cerrar sesión;
* limpiar cache al cambiar de congregación;
* limitar tamaño por entrada;
* usar `schemaVersion` para invalidación segura;
* evitar listeners duplicados;
* evitar `onSnapshot` si no se necesita tiempo real.

---

## Costos Firestore

Buenas prácticas:

* preferir cache-first cuando sea posible;
* evitar listeners en pantallas que solo necesitan lectura puntual;
* no leer colecciones completas si basta un resumen;
* usar filtros por `congregationId`;
* paginar listados grandes;
* usar consultas count cuando solo se necesita conteo;
* limpiar listeners al desmontar;
* evitar duplicar lecturas entre módulos;
* usar IDs deterministas cuando sea útil;
* separar datos publicados de borradores;
* no consultar usuarios completos si solo se necesita cantidad.

---

## Cloud Functions

Cloud Functions se usa para operaciones sensibles y procesos de backend.

Áreas principales:

* usuarios;
* reuniones;
* eventos;
* notificaciones;
* dashboard;
* territorios;
* limpieza;
* planeación operativa;
* billing;
* Stripe;
* recordatorios;
* limpieza programada;
* exenciones administrativas.

Funciones destacadas:

* creación de usuarios por administrador;
* listado seguro de usuarios;
* publicación de schedules;
* sincronización de limpieza;
* sincronización de acomodadores/micrófonos;
* envío de notificaciones;
* generación de dashboard;
* creación de Checkout de Stripe;
* creación de Customer Portal;
* webhook de Stripe;
* recordatorios de pago;
* limpieza de historial.

---

## Firestore Rules

Las reglas deben garantizar:

* autenticación obligatoria;
* aislamiento por congregación;
* validación de usuario activo;
* validación de roles;
* validación de permisos;
* validación de planes;
* protección de billing;
* protección de `/system`;
* protección de roles y campos sensibles;
* bloqueo de escrituras directas indebidas;
* compatibilidad temporal con datos legacy cuando aplique.

Regla general:

> Si una acción puede afectar a otros usuarios, roles, permisos, billing, congregación o datos sensibles, debe estar protegida por Firestore Rules o Cloud Functions.

---

## Comandos Principales

Instalar dependencias:

```bash
npm install
npm --prefix functions install
```

Iniciar Expo:

```bash
npm run start
```

Android local:

```bash
npm run android
```

Android release local:

```bash
npm run android:release
```

iOS local:

```bash
npm run ios
```

Web:

```bash
npm run web
```

Build web:

```bash
npm run build:web
npm run preview:web
```

Validación completa:

```bash
npm run validate
```

Pruebas de reglas:

```bash
npm run test:rules
```

Deploy de reglas:

```bash
npm run deploy:rules
```

Deploy de Functions:

```bash
npm run deploy:functions
```

Deploy completo:

```bash
npm run deploy:all
```

---

## Validación Antes De Producción

Antes de publicar:

* `npm run validate` debe pasar completo.
* TypeScript debe compilar sin errores.
* Lint debe pasar.
* Tests frontend deben pasar.
* Tests de Functions deben pasar.
* Firestore Rules deben probarse.
* Functions deben compilar.
* No debe haber secrets en Git.
* No debe haber builds generados en Git.
* Los índices necesarios deben estar desplegados.
* Las reglas deben estar desplegadas.
* Las Functions deben estar desplegadas.
* Stripe webhook debe estar activo.
* Customer Portal debe estar configurado.
* Variables de entorno deben estar completas.
* Android debe probarse en development build o release.
* Web debe probarse con build real.
* Notificaciones deben probarse fuera de Expo Go.
* i18n debe actualizarse si hubo textos nuevos.
* Estados vacíos y errores humanos deben revisarse.
* Los precios deben permanecer sincronizados entre documentación, frontend, Functions y Stripe.

---

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

Después de cambios de versión o permisos, actualizar:

* `package.json`;
* `app.json`;
* `android.versionName`, si existe carpeta nativa;
* `android.versionCode`, si existe carpeta nativa;
* build AAB.

---

## Build Web

```bash
npm run build:web
npm run preview:web
```

Firebase Hosting está deshabilitado para este proyecto. El resultado de `npm run build:web` debe publicarse usando el host externo configurado para OMP.

---

## Documentación Técnica

La documentación larga vive en `docs/`.

Documentos recomendados:

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

## Estado Comercial

OMP Suite mantiene precios accesibles para congregaciones.

Precios actuales:

| Plan      |               Límite |      Precio |
| --------- | -------------------: | ----------: |
| `omp_80`  |  80 usuarios activos |  70 MXN/mes |
| `omp_150` | 150 usuarios activos | 120 MXN/mes |
| `omp_250` | 250 usuarios activos | 200 MXN/mes |

Estos precios se mantienen sin incremento en esta actualización.

---

## Política De Suscripciones Activas

Reglas actuales:

* No se suben precios.
* No se cambian Price IDs por aumento.
* No se modifican suscripciones activas.
* No se recrean productos Stripe si los actuales funcionan.
* Nuevas congregaciones usan los mismos precios vigentes.
* El historial de pagos se conserva.
* El webhook de Stripe sigue siendo fuente de verdad.
* Las exenciones se respetan.

---

## Riesgos Técnicos Actuales

Riesgos a revisar:

* diferencias entre permisos frontend y Firestore Rules;
* valores legacy pendientes de migración;
* reglas que todavía aceptan compatibilidad temporal;
* pantallas secundarias sin flecha de regreso móvil;
* organigrama desktop con jerarquías profundas;
* cobertura incompleta de tests de Firestore Rules;
* validación de billing en sandbox y producción;
* consistencia entre documentación y código;
* uso correcto de Price IDs por ambiente;
* manejo de permisos delegables y no delegables;
* control real de costos de Firebase/Google Cloud;
* registro interno de facturas y suscripciones pagadas.

---

## Pendientes Técnicos Recomendados

Prioridad alta:

* Actualizar README a versión `1.13.3`.
* Confirmar que documentación y código mantienen precios actuales.
* Registrar costos reales de dominio, host, Firebase, Google Cloud, Stripe y terceros.
* Agregar pruebas de Firestore Rules para organigrama.
* Revisar permisos `organigrama` / `departments`.
* Revisar permiso `acomodadores_microfonos` si existe en frontend y rules.
* Auditar navegación móvil secundaria.
* Verificar que todas las pantallas profundas usen `PageHeader showBack`.
* Probar Stripe Checkout en sandbox.
* Probar Stripe Webhook en sandbox.
* Probar Customer Portal en sandbox.
* Confirmar que no hay secrets expuestos.

Prioridad media:

* Mejorar organigrama desktop recursivo.
* Agregar dashboard por perfil.
* Agregar métricas internas.
* Mejorar estados vacíos.
* Mejorar errores humanos.
* Completar documentación de QA.
* Preparar checklist de producción.

Prioridad futura:

* Panel superadmin.
* Administración avanzada de congregaciones.
* Gestión externa de planes.
* App Check gradual.
* Métricas de uso.
* Auditoría de acciones administrativas.
* Mejoras de rendimiento.
* Mejoras visuales para escritorio.

---

## Roadmap Actualizado

### Fase 1 — Base Técnica

Estado: completada.

Incluye:

* Expo Router.
* Firebase Auth.
* Firestore.
* Cloud Functions.
* estructura protegida;
* roles;
* permisos;
* documentación base;
* configuración de build;
* estructura de módulos.

### Fase 2 — Módulos Operativos

Estado: avanzada.

Incluye:

* usuarios;
* reuniones;
* asignaciones;
* limpieza;
* acomodadores y micrófonos;
* predicación;
* territorios;
* notificaciones;
* organigrama;
* dashboard.

### Fase 3 — Billing

Estado: implementado y en estabilización.

Incluye:

* planes;
* límites de usuarios;
* Stripe Checkout;
* Customer Portal;
* Webhook;
* historial;
* recordatorios;
* exenciones;
* validaciones backend.

### Fase 4 — Seguridad Y QA

Estado: en proceso.

Incluye:

* Firestore Rules;
* tests de reglas;
* validaciones por permisos;
* validaciones por congregación;
* revisión de valores legacy;
* protección de campos sensibles;
* auditoría de navegación.

### Fase 5 — Producción

Estado: pendiente / preparación.

Incluye:

* validación de ambientes;
* build Android;
* build web;
* pruebas reales de notificaciones;
* revisión de Stripe live;
* revisión de secrets;
* checklist de despliegue;
* monitoreo inicial.

### Fase 6 — Escalamiento

Estado: futuro.

Incluye:

* panel superadmin;
* métricas;
* auditoría;
* administración avanzada;
* optimización de costos;
* App Check;
* mejoras de UX;
* soporte multi-congregación avanzado si se decide.

---

## Convención De Commits

Ejemplos:

```text
feat: agregar gestion de territorios
fix: corregir permisos de limpieza
docs: actualizar README principal
test: cubrir reglas de organigrama
refactor: separar servicios de billing
chore: actualizar dependencias
```

Mantener commits pequeños y enfocados.

No mezclar:

* refactors grandes;
* cambios visuales;
* reglas de seguridad;
* cambios de billing;
* cambios de documentación;
* cambios de navegación;

salvo que sean parte del mismo objetivo técnico.

---

## Checklist Antes De Abrir PR

Antes de abrir un PR:

```bash
npm run validate
npm run test:rules
git status --short
```

Verificar:

* no hay archivos sensibles;
* no hay builds generados;
* no hay secrets;
* no se tocaron precios accidentalmente;
* no se rompieron tipos;
* no se rompió lint;
* no se rompieron tests;
* README está actualizado;
* docs están sincronizados;
* cambios tienen alcance claro.

---

## Nota Final

OMP Suite ya cuenta con una base técnica fuerte y debe documentarse como producto real en estabilización, no como prototipo. La documentación debe reflejar el trabajo acumulado durante aproximadamente 4 meses, la arquitectura multiplataforma, el backend Firebase, la integración Stripe, los módulos operativos, las reglas de seguridad existentes, los costos tecnológicos y el valor comercial real del proyecto.

Los precios se mantienen sin aumento:

```text
omp_80  = 70 MXN/mes
omp_150 = 120 MXN/mes
omp_250 = 200 MXN/mes
```

El valor técnico y comercial estimado del proyecto completo es mucho mayor que la suscripción mensual. La suscripción mensual existe para cubrir operación, infraestructura, mantenimiento, procesamiento de pagos, soporte y evolución continua sin trasladar a una sola congregación el costo completo de desarrollo del sistema.
