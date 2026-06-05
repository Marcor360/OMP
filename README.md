# 📘 OMP Suite — Organization, Ministry & Programs

**OMP Suite** es una aplicación multiplataforma desarrollada con **Expo**, **React Native**, **TypeScript** y **Firebase**, creada para ayudar a organizar actividades internas de una congregación de forma digital, segura y estructurada.

La plataforma permite administrar usuarios, reuniones, asignaciones, limpieza, hospitalidad, predicación, territorios, notificaciones, permisos, roles, organigrama y configuración general por congregación.

> ⚠️ **Aviso importante:** OMP Suite no es una aplicación oficial de los Testigos de Jehová. No está afiliada, respaldada ni relacionada con JW.ORG ni con ninguna entidad oficial de los Testigos de Jehová. Es una herramienta independiente creada con respeto, cuidado y enfoque técnico para apoyar la organización interna de una congregación.

---

## 🧭 Estado general del proyecto

OMP Suite se encuentra en una etapa avanzada de desarrollo inicial, con una base funcional sólida y varios módulos principales ya integrados.

El proyecto cuenta con aproximadamente **3 meses de desarrollo constante**, con trabajo dedicado casi todos los días en análisis, diseño, programación, arquitectura, seguridad, pruebas, documentación, configuración de servicios y mejoras generales.

Durante este periodo se ha construido una base técnica preparada para operar en dispositivos móviles, web y, posteriormente, distribución iOS.

OMP Suite no es un prototipo improvisado. Es un producto digital en evolución, construido con inversión real de tiempo, infraestructura, herramientas, pruebas, mantenimiento y mejora continua.

---

## 📌 Resumen actual

| Área              | Estado                                                          |
| ----------------- | --------------------------------------------------------------- |
| 📱 App Android    | Release `1.0.1` generado en formato AAB                         |
| 🍎 App iOS        | Base preparada con Expo, pendiente de distribución              |
| 🌐 Web            | Compatible mediante Expo Web                                    |
| 🔐 Autenticación  | Firebase Authentication integrado                               |
| 🗄️ Base de datos | Cloud Firestore integrado                                       |
| ⚙️ Backend        | Firebase Cloud Functions integrado                              |
| 🔔 Notificaciones | Expo Notifications y Firebase integrados                        |
| 🛡️ Seguridad     | Reglas de Firestore implementadas                               |
| 💾 Caché local    | Estrategia cache-first integrada                                |
| 🌎 Idiomas        | Español e inglés activos, estructura preparada para más idiomas |
| 🧩 Administración | Roles, permisos y control por congregación                      |
| 💳 Suscripciones  | Modelo de planes mensuales definido                             |

---

## 🎯 Objetivo del proyecto

OMP Suite busca centralizar y simplificar la administración interna de una congregación mediante una aplicación moderna, accesible y segura.

El objetivo es que los usuarios puedan consultar su información de forma clara, mientras que administradores, supervisores y encargados pueden gestionar las áreas correspondientes sin depender de hojas de cálculo, mensajes dispersos o procesos manuales.

La aplicación está pensada para mejorar la organización, reducir errores, facilitar la comunicación interna y mantener la información disponible de forma ordenada.

---

## ✨ Funcionalidades principales

### 👥 Gestión de usuarios

* Creación y administración de usuarios.
* Roles principales:

  * Administrador
  * Supervisor
  * Usuario
* Activación y desactivación de usuarios.
* Cambio de contraseña por administradores.
* Control de permisos por módulo.
* Validación de usuarios activos.
* Protección contra acciones sensibles.
* Separación entre rol del sistema y privilegios internos de la congregación.
* Sincronización entre Firebase Authentication y Firestore mediante Cloud Functions.

---

### 🏛️ Congregaciones y aislamiento de datos

* Cada usuario pertenece a una congregación.
* Cada congregación maneja sus propios datos.
* Los usuarios solo pueden acceder a la información de su congregación.
* Las reglas de seguridad bloquean lecturas o escrituras no autorizadas.
* Preparado para operar múltiples congregaciones dentro del mismo proyecto Firebase.
* Control de acceso por congregación activa, suspendida o deshabilitada.
* Estructura diseñada para mantener separación de datos por congregación.

---

### 📅 Reuniones y asignaciones

* Gestión de reuniones de entre semana.
* Gestión de reuniones de fin de semana.
* Creación, edición y publicación de reuniones.
* Asignaciones vinculadas a reuniones.
* Asignaciones independientes para otras áreas.
* Filtros por fecha, categoría, persona, estado y congregación.
* Notificaciones relacionadas con reuniones y asignaciones.
* Invalidación de caché cuando se crean, editan o eliminan reuniones.
* Soporte para responsabilidades internas relacionadas con reuniones.

---

### 🧹 Limpieza y grupos

* Creación de grupos de limpieza.
* Administración de miembros por grupo.
* Soporte para grupos estándar o familiares.
* Vista de próximas responsabilidades.
* Dashboard de limpieza con información relevante.
* Control de permisos para crear, editar o eliminar grupos.
* Integración con asignaciones y notificaciones.
* Selección de usuarios asignables a limpieza.

---

### 🧑‍💼 Predicación, informes y territorios

* Registro de informes de predicación.
* Contador local de horas.
* Resumen semanal y mensual.
* Gestión de territorios.
* Asignación de territorios por día o planificación.
* Panel para encargado de predicación.
* Visualización de publicadores enviados y faltantes.
* Separación entre datos locales del dispositivo y datos remotos de la congregación.
* Preparado para mejorar la administración de territorios y reportes.

---

### 🧭 Organigrama congregacional

* Estructura de departamentos.
* Responsables y auxiliares por área.
* Visualización para usuarios activos de la congregación.
* Edición limitada a usuarios autorizados.
* Preparado para representar responsabilidades internas de forma clara y ordenada.
* Base para organizar funciones por departamento y asignación.

---

### 🔔 Notificaciones

* Registro de tokens push por usuario.
* Notificaciones internas dentro de la app.
* Notificaciones push para asignaciones, reuniones y recordatorios.
* Preferencias por tipo de notificación.
* Limpieza de notificaciones antiguas.
* Contador de notificaciones no leídas.
* Navegación profunda desde una notificación hacia la pantalla correspondiente.
* Canales de notificación para Android.

---

### ⚙️ Configuración y experiencia de usuario

* Pantalla de ajustes.
* Información de cuenta.
* Información de rol.
* Selector de idioma.
* Selector de tema claro u oscuro.
* Estado de permisos del dispositivo.
* Acceso a información del proyecto.
* Preparado para términos, privacidad y documentación adicional.

---

## 💰 Inversión acumulada y valor estimado del proyecto

OMP Suite representa una inversión real de tiempo, infraestructura, herramientas, análisis, diseño, desarrollo, pruebas, seguridad y mantenimiento continuo.

Durante los primeros **3 meses de desarrollo**, el proyecto ha requerido trabajo constante en diferentes áreas técnicas y de producto, incluyendo desarrollo móvil, desarrollo web, arquitectura Firebase, reglas de seguridad, experiencia de usuario, pruebas en dispositivos reales, documentación, dominio, hosting y configuración de servicios.

Aunque gran parte del trabajo ha sido realizado directamente por **Marco Antonio Rulfo Castro — MrDev**, el valor real del producto puede estimarse tomando como referencia los perfiles profesionales que normalmente participarían en un proyecto de este tipo.

### Valor equivalente por perfiles profesionales

| Perfil equivalente                                                  | Participación estimada                                                                     |   Valor estimado |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------: |
| Desarrollo principal semi-senior en React Native, Expo y TypeScript | Desarrollo de app, navegación, pantallas, lógica, módulos y estructura general             |     $117,000 MXN |
| UX/UI y diseño de experiencia                                       | Diseño visual, estructura de pantallas, experiencia móvil/web y usabilidad                 |      $18,000 MXN |
| Backend, Firebase y seguridad                                       | Firestore, Cloud Functions, autenticación, reglas, permisos y aislamiento por congregación |      $30,000 MXN |
| QA y pruebas funcionales                                            | Pruebas en dispositivos reales, revisión de errores, flujos y comportamiento de la app     |       $8,750 MXN |
| DevOps, dominio, hosting y configuración técnica                    | Configuración de entorno, dominio, hosting, builds, despliegues y servicios externos       |      $12,500 MXN |
| Costos operativos directos                                          | Hosting, dominio, herramientas, Google/Firebase, pruebas y suscripciones                   |       $8,500 MXN |
| **Valor acumulado estimado del proyecto**                           |                                                                                            | **$194,750 MXN** |

Este valor no representa únicamente gastos pagados, sino el **valor equivalente de desarrollo e inversión técnica** que tendría construir una aplicación como OMP Suite con perfiles profesionales.

Por su alcance actual, OMP Suite puede considerarse un producto con un valor estimado entre:

**$150,000 MXN y $200,000 MXN**

Este rango contempla el desarrollo acumulado, la arquitectura implementada, la experiencia de usuario, la seguridad, la infraestructura, las pruebas, la documentación y el mantenimiento realizado hasta la fecha.

---

## 📌 Costos operativos directos aproximados

Además del tiempo de desarrollo, OMP Suite ha requerido inversión directa para mantenerse activo y preparado para su crecimiento.

| Concepto                                                         | Costo aproximado |
| ---------------------------------------------------------------- | ---------------: |
| Hosting y mantenimiento web                                      |       $2,000 MXN |
| Dominio                                                          |       $1,000 MXN |
| Herramientas y suscripciones de desarrollo                       |       $1,200 MXN |
| Servicios de Google, Firebase, pruebas y plataforma              |       $1,800 MXN |
| Otras herramientas, pruebas, configuraciones y recursos técnicos |       $2,500 MXN |
| **Total operativo estimado**                                     |   **$8,500 MXN** |

Estos costos permiten sostener la infraestructura, realizar pruebas, mantener servicios activos, mejorar la seguridad y continuar desarrollando nuevas funciones.

---

## 💳 Planes y suscripciones

OMP Suite utiliza un modelo de suscripción mensual por congregación.

La suscripción permite sostener el proyecto, cubrir costos operativos, mantener la infraestructura activa, mejorar la seguridad, corregir errores, optimizar el rendimiento y continuar desarrollando nuevas funciones.

| Plan   | Límite de usuarios | Precio mensual |
| ------ | -----------------: | -------------: |
| Básico |  Hasta 80 usuarios |        $70 MXN |
| Medio  | Hasta 150 usuarios |       $120 MXN |
| Grande | Hasta 250 usuarios |       $200 MXN |

Los precios están pensados para que el proyecto sea accesible, pero también sostenible. Incluyen el uso de infraestructura, almacenamiento, autenticación, base de datos, notificaciones, dominio, mantenimiento, procesamiento de pagos y mejora continua.

---

## 💡 ¿Por qué se cobra?

Aunque OMP Suite nace como una herramienta de apoyo, mantener una aplicación funcional, segura y disponible implica costos reales.

El cobro ayuda a cubrir:

* Hosting y mantenimiento web.
* Dominio.
* Firebase Authentication.
* Cloud Firestore.
* Cloud Functions.
* Servicios de Google.
* Notificaciones push.
* Herramientas de desarrollo.
* Suscripciones técnicas.
* Pruebas en dispositivos reales.
* Seguridad y reglas de acceso.
* Corrección de errores.
* Optimización de rendimiento.
* Procesamiento de pagos.
* Documentación.
* Mantenimiento continuo.
* Nuevas funciones.

La suscripción no busca limitar el acceso, sino permitir que OMP Suite siga funcionando de manera estable, segura y profesional.

---

## 🧰 Stack técnico

| Capa               | Tecnología                           |
| ------------------ | ------------------------------------ |
| Framework          | Expo                                 |
| UI móvil           | React Native                         |
| Lenguaje           | TypeScript                           |
| Navegación         | Expo Router                          |
| Estilos            | NativeWind / Tailwind CSS            |
| Backend            | Firebase                             |
| Autenticación      | Firebase Authentication              |
| Base de datos      | Cloud Firestore                      |
| Backend serverless | Firebase Cloud Functions             |
| Notificaciones     | Expo Notifications / Firebase        |
| Persistencia local | AsyncStorage + caché local Firestore |
| Web                | React Native Web mediante Expo       |

---

## 📂 Arquitectura general

```text
/
├── app/                         # Rutas principales con Expo Router
│   ├── (auth)/                  # Pantallas de autenticación
│   ├── (protected)/             # Pantallas protegidas
│   ├── _layout.tsx              # Layout raíz
│   ├── index.tsx                # Entrada inicial
│   └── language-setup.tsx       # Configuración inicial de idioma
│
├── src/
│   ├── components/              # Componentes reutilizables
│   ├── config/                  # Configuración auxiliar
│   ├── constants/               # Constantes globales
│   ├── context/                 # Contextos globales
│   ├── features/                # Funciones por característica
│   ├── firebase/                # Utilidades Firebase
│   ├── hooks/                   # Hooks reutilizables
│   ├── i18n/                    # Internacionalización
│   ├── lib/                     # Inicialización y referencias
│   ├── modules/                 # Módulos por dominio
│   ├── screens/                 # Pantallas principales
│   ├── services/                # Servicios de negocio
│   ├── styles/                  # Estilos globales
│   ├── types/                   # Tipos TypeScript
│   └── utils/                   # Utilidades generales
│
├── functions/                   # Firebase Cloud Functions
│   └── src/
│
├── docs/                        # Documentación técnica
├── assets/                      # Recursos visuales
├── android/                     # Proyecto Android generado
├── firestore.rules              # Reglas de seguridad
├── firestore.indexes.json       # Índices Firestore
├── firebase.json                # Configuración Firebase
├── app.json                     # Configuración Expo
├── package.json                 # Dependencias y scripts
└── tsconfig.json                # Configuración TypeScript
```

---

## 🗄️ Modelo de datos principal

| Ruta                                                    | Uso                           |
| ------------------------------------------------------- | ----------------------------- |
| `/users/{uid}`                                          | Perfil del usuario            |
| `/congregations/{congregationId}`                       | Datos base de la congregación |
| `/congregations/{congregationId}/persons`               | Personas registradas          |
| `/congregations/{congregationId}/meetings`              | Reuniones                     |
| `/congregations/{congregationId}/assignments`           | Asignaciones                  |
| `/congregations/{congregationId}/cleaningGroups`        | Grupos de limpieza            |
| `/congregations/{congregationId}/departments`           | Departamentos del organigrama |
| `/congregations/{congregationId}/departmentAssignments` | Responsables por departamento |
| `/congregations/{congregationId}/territories`           | Territorios                   |
| `/congregations/{congregationId}/notifications`         | Notificaciones internas       |
| `/congregations/{congregationId}/changeLogs`            | Bitácora de cambios           |

---

## 🔐 Seguridad

OMP Suite utiliza varias capas de seguridad para proteger la información de cada congregación.

Entre las principales medidas se incluyen:

* Autenticación mediante Firebase Authentication.
* Reglas de seguridad en Cloud Firestore.
* Validación de usuario activo.
* Validación de congregación.
* Separación de datos por congregación.
* Control de permisos por módulo.
* Cloud Functions para operaciones sensibles.
* Protección de rutas dentro de la aplicación.
* Validación de estructura en documentos importantes.
* Bloqueo de acceso para congregaciones suspendidas o deshabilitadas.

La seguridad se diseña bajo el principio de que ningún usuario debe acceder a información de otra congregación ni modificar información para la que no tenga permisos.

---

## 🧩 Roles, permisos y responsabilidades

OMP Suite separa el rol del sistema de las responsabilidades internas.

### Roles principales del sistema

| Rol           | Descripción                                             |
| ------------- | ------------------------------------------------------- |
| Administrador | Puede administrar la congregación dentro de la app      |
| Supervisor    | Puede gestionar módulos específicos según permisos      |
| Usuario       | Puede consultar información y usar funciones permitidas |

### Responsabilidades internas

Un usuario puede tener responsabilidades adicionales por departamento, por ejemplo:

* Limpieza
* Predicación
* Territorios
* Reuniones
* Discursos
* Tesorería
* Organigrama
* Configuración

Esto permite que un usuario no necesite ser administrador completo para apoyar en una sección específica.

---

## 💾 Rendimiento y control de lecturas

El proyecto integra estrategias para reducir lecturas innecesarias y mejorar la experiencia:

* Caché local.
* Consultas cache-first.
* Caché en memoria por sesión.
* Invalidación de caché después de cambios importantes.
* Uso controlado de listeners en tiempo real.
* Prevención de solicitudes duplicadas simultáneas.
* Separación entre datos locales y datos remotos.

Esto ayuda a mejorar el rendimiento, reducir tiempos de carga y controlar costos de infraestructura.

---

## 🌎 Internacionalización

OMP Suite está preparado para múltiples idiomas.

Actualmente cuenta con:

* Español.
* Inglés.

La estructura está preparada para extenderse a otros idiomas en el futuro.

---

## 🚀 Instalación y ejecución local

### Requisitos

* Node.js
* npm
* Expo CLI
* Firebase CLI
* Cuenta de Firebase configurada
* Proyecto Firebase activo

### Instalar dependencias

```bash
npm install
```

### Ejecutar en desarrollo

```bash
npm run start
```

### Ejecutar en Android

```bash
npm run android
```

### Ejecutar en Web

```bash
npm run web
```

### Validar el proyecto

```bash
npm run validate
```

---

## ⚙️ Scripts principales

| Script                    | Uso                            |
| ------------------------- | ------------------------------ |
| `npm run start`           | Inicia Expo                    |
| `npm run android`         | Ejecuta Android                |
| `npm run android:release` | Ejecuta variante release       |
| `npm run ios`             | Ejecuta iOS                    |
| `npm run web`             | Ejecuta versión web            |
| `npm run build:web`       | Genera build web               |
| `npm run lint`            | Ejecuta lint                   |
| `npm run validate`        | Ejecuta validaciones generales |

---

## 🧪 Calidad y validación

El proyecto utiliza:

* TypeScript para tipado estático.
* ESLint para revisión de código.
* Validación de reglas y funciones.
* Build de Cloud Functions.
* Pruebas para funciones backend.
* Revisión de permisos y flujos sensibles.
* Pruebas en dispositivos reales.

Se recomienda seguir ampliando las pruebas automatizadas, especialmente para:

* Permisos.
* Roles.
* Acceso por congregación.
* Reglas de Firestore.
* Navegación protegida.
* Operaciones administrativas.
* Flujos de suscripción.
* Notificaciones.

---

## 🧱 Roadmap

### Prioridad alta

* Pulir navegación móvil.
* Homologar headers y botones de regreso.
* Fortalecer modelo de permisos.
* Limpiar reglas legacy.
* Mejorar documentación técnica.
* Finalizar flujo de suscripciones y cobros.
* Mejorar pantalla de planes.
* Optimizar experiencia visual en web y móvil.

### Prioridad media

* Panel administrativo externo.
* Reportes avanzados.
* Historial de actividad.
* Mejoras visuales del organigrama.
* Exportación de información.
* Mejoras en territorios.
* Más idiomas.
* Mejoras en accesibilidad.

### Prioridad futura

* Distribución iOS.
* Panel web independiente.
* Métricas administrativas.
* Automatizaciones avanzadas.
* Herramientas de respaldo y recuperación.
* Módulos adicionales según necesidades reales.

---

## 🛡️ Principios del proyecto

OMP Suite se desarrolla bajo estos principios:

* Seguridad primero.
* Separación clara de datos por congregación.
* Interfaz sencilla para usuarios no técnicos.
* Control granular de permisos.
* Código escalable y mantenible.
* Costos controlados.
* Respeto por la información privada.
* Mejora continua con base en uso real.
* Accesibilidad y claridad visual.
* Sostenibilidad técnica y económica.

---

## 📄 Licencia y uso

Este proyecto es privado/independiente y se desarrolla con fines de organización interna.

El uso, distribución o modificación debe respetar la finalidad original del proyecto, la privacidad de los usuarios y las condiciones definidas por el responsable del desarrollo.

---

## 👨‍💻 Desarrollo y mantenimiento

OMP Suite es desarrollado y mantenido por:

**Marco Antonio Rulfo Castro — MrDev**

El proyecto concentra trabajo de diferentes áreas: desarrollo frontend, desarrollo móvil, backend serverless, arquitectura Firebase, UX/UI, seguridad, pruebas, documentación, configuración técnica y mantenimiento continuo.

Esta inversión permite que OMP Suite no sea solo una app básica, sino una plataforma organizada, escalable y preparada para seguir creciendo con nuevas funcionalidades.
