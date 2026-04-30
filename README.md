# 📘 OMP — Organization, Ministry & Programs

**OMP** es una aplicación multiplataforma desarrollada con **Expo**, **React Native**, **TypeScript** y **Firebase** para ayudar a organizar actividades internas de una congregación: usuarios, reuniones, asignaciones, limpieza, hospitalidad, notificaciones y control administrativo.

> ⚠️ **Aviso importante:** OMP no es una aplicación oficial de los Testigos de Jehová. No está afiliada, respaldada ni relacionada con JW.ORG ni con ninguna entidad oficial de los Testigos de Jehová. Es una herramienta independiente creada con respeto, cuidado y enfoque técnico para facilitar la organización interna.

---

## 🧭 Estado del proyecto

| Área | Estado |
|---|---|
| 📱 App Android/iOS | En desarrollo avanzado |
| 🌐 Web con Expo | Disponible mediante `expo start --web` |
| 🔐 Firebase Auth | Integrado |
| 🗄️ Cloud Firestore | Integrado |
| ⚙️ Cloud Functions | Integradas |
| 🔔 Notificaciones push | Integradas con Expo Notifications y Firebase |
| 🛡️ Reglas de seguridad Firestore | Integradas |
| 💾 Caché local / cache-first | Integrado |
| 🧩 Panel administrativo externo | Pendiente / en planeación |
| 📊 Límites por plan de congregación | Pendiente / en planeación |

---

## ✨ Características principales

### 👥 Gestión de usuarios

- Creación de usuarios por administradores.
- Roles principales: `admin`, `supervisor` y `user`.
- Activación, desactivación y eliminación controlada de usuarios.
- Cambio de contraseña por administrador.
- Generación de correo interno por congregación.
- Validación de cargos y responsabilidades internas.
- Protección para evitar que un administrador se elimine o desactive a sí mismo desde flujos sensibles.

### 🏛️ Congregaciones y aislamiento de datos

- Cada usuario pertenece a una `congregationId`.
- Las reglas de Firestore restringen lecturas y escrituras por congregación.
- Las operaciones sensibles validan que el usuario autenticado esté activo y pertenezca a la misma congregación.
- La estructura está preparada para operar varias congregaciones dentro del mismo proyecto Firebase.

### 📅 Reuniones y asignaciones

- Gestión de reuniones de entre semana y fin de semana.
- Asignaciones asociadas a reuniones.
- Asignaciones independientes para áreas como limpieza u hospitalidad.
- Publicación de reuniones.
- Notificaciones al publicar, actualizar o recordar asignaciones.
- Importación de reuniones desde PDF mediante Cloud Functions.

### 🧹 Limpieza y grupos

- Creación y administración de grupos de limpieza.
- Asignación de miembros registrados de la congregación.
- Soporte para grupos estándar o familiares.
- Validación de membresía y conteo de miembros.
- Compatibilidad con nombres de colección actuales y legacy.

### 🔔 Notificaciones

- Registro de tokens push por usuario.
- Preferencias de notificación por tipo.
- Notificaciones internas en Firestore.
- Notificaciones push para asignaciones, reuniones y recordatorios.
- Limpieza programada de notificaciones antiguas.

### 💾 Caché y control de lecturas

- Estrategia cache-first para documentos y consultas.
- Uso de caché local de Firestore cuando está disponible.
- Caché en memoria por sesión.
- Fallback al servidor cuando los datos locales no existen o están incompletos.
- Control `singleFlight` para evitar solicitudes duplicadas simultáneas.

### 🌎 Internacionalización

- Estructura preparada para soporte multiidioma.
- Flujo inicial de selección/configuración de idioma.
- Base actual enfocada principalmente en español, con estructura para crecer.

---

## 🧰 Stack técnico

| Capa | Tecnología |
|---|---|
| ⚛️ Framework | Expo SDK 54 |
| 📱 UI runtime | React 19 / React Native 0.81 |
| 🧠 Lenguaje | TypeScript |
| 🧭 Navegación | Expo Router |
| 🎨 Estilos | NativeWind / Tailwind CSS |
| 🔥 Backend | Firebase |
| 🔐 Autenticación | Firebase Authentication |
| 🗄️ Base de datos | Cloud Firestore |
| ⚙️ Backend serverless | Firebase Cloud Functions |
| 🔔 Notificaciones | Expo Notifications / Firebase Admin Messaging |
| 💾 Persistencia local | AsyncStorage + caché local Firestore |
| 🌐 Web | React Native Web vía Expo |

---

## 📂 Arquitectura del repositorio

```text
/
├── app/                         # Rutas de Expo Router
│   ├── (auth)/                  # Pantallas de autenticación
│   ├── (protected)/             # Pantallas protegidas por sesión
│   ├── _layout.tsx              # Layout raíz y providers globales
│   ├── index.tsx                # Entrada inicial
│   └── language-setup.tsx       # Configuración inicial de idioma
│
├── src/
│   ├── components/              # Componentes reutilizables
│   ├── config/                  # Configuración auxiliar
│   ├── constants/               # Constantes del sistema
│   ├── context/                 # Contextos globales
│   ├── features/notifications/  # Funcionalidad de notificaciones
│   ├── firebase/                # Utilidades relacionadas con Firebase
│   ├── hooks/                   # Hooks reutilizables
│   ├── i18n/                    # Internacionalización
│   ├── lib/firebase/            # Inicialización Firebase y referencias Firestore
│   ├── modules/                 # Módulos por dominio
│   │   ├── assignments/         # Asignaciones
│   │   ├── cleaning/            # Limpieza
│   │   └── field-service/       # Servicio / contador local
│   ├── screens/                 # Pantallas principales
│   ├── services/                # Servicios de Auth, Firestore, notificaciones y repositorios
│   ├── styles/                  # Estilos globales
│   ├── types/                   # Tipos y DTOs
│   └── utils/                   # Utilidades puras
│
├── functions/                   # Firebase Cloud Functions
│   ├── src/
│   │   ├── users.ts             # Administración de usuarios con Firebase Admin
│   │   ├── users-sync.ts        # Sincronización Auth <-> Firestore
│   │   ├── meetings-management.ts
│   │   ├── meetings-publication.ts
│   │   ├── meetings-notifications.ts
│   │   ├── midweek-import.ts
│   │   ├── maintenance/         # Limpiezas programadas
│   │   └── modules/notifications/
│   └── package.json
│
├── docs/                        # Documentación técnica extendida
├── assets/images/               # Iconos, splash y recursos visuales
├── firestore.rules              # Reglas de seguridad Firestore
├── firestore.indexes.json       # Índices Firestore
├── firebase.json                # Configuración de Firebase deploy
├── app.json                     # Configuración Expo
├── package.json                 # Dependencias y scripts de la app
└── tsconfig.json                # Configuración TypeScript
```

---

## 🗄️ Modelo de datos principal

| Colección / ruta | Uso |
|---|---|
| `/users/{uid}` | Perfil de usuario, rol, congregación, estado, tokens push y responsabilidades |
| `/congregations/{congregationId}` | Datos base de cada congregación |
| `/congregations/{congregationId}/persons/{personId}` | Personas registradas dentro de la congregación |
| `/congregations/{congregationId}/meetings/{meetingId}` | Reuniones de entre semana, fin de semana u otras |
| `/congregations/{congregationId}/meetings/{meetingId}/assignments/{assignmentId}` | Asignaciones vinculadas a una reunión |
| `/congregations/{congregationId}/assignments/{assignmentId}` | Asignaciones independientes: limpieza, hospitalidad u otras |
| `/congregations/{congregationId}/cleaningGroups/{groupId}` | Grupos de limpieza por congregación |
| `/congregations/{congregationId}/notifications/{notificationId}` | Notificaciones internas por congregación |
| `/dashboardSummary/{congregationId}` | Resumen precalculado para dashboard |
| `/system/{docId}` | Documentos internos de control, por ejemplo cache control |

---

## 🛡️ Seguridad y permisos

La seguridad se aplica en dos capas:

1. **Frontend:** rutas protegidas, control de pantallas visibles y permisos por rol.
2. **Backend/Firestore Rules:** validación real de lectura/escritura por usuario, rol, estado activo y congregación.

Principios actuales:

- Un usuario debe estar autenticado para acceder a datos protegidos.
- El documento `/users/{uid}` define el rol real y la congregación del usuario.
- Las operaciones de congregación validan `sameCongregation(congregationId)`.
- Las escrituras sensibles requieren `admin`, `supervisor` o encargado autorizado, según el módulo.
- `dashboardSummary` es solo lectura desde cliente; la escritura queda reservada para procesos backend.
- Los documentos de sistema son de solo lectura para usuarios autenticados y escritura bloqueada desde cliente.

---

## ⚙️ Cloud Functions incluidas

Las funciones exportadas actualmente cubren:

- `createUserByAdmin`
- `updateUserByAdmin`
- `updateUserPasswordByAdmin`
- `disableUserByAdmin`
- `deleteUserByAdmin`
- `deleteAuthUserOnProfileDelete`
- `deleteUserProfileOnAuthDelete`
- `importMidweekMeetingsFromPdf`
- `setMeetingPublicationStatus`
- `createMeetingByManager`
- `updateMeetingByManager`
- `deleteMeetingByManager`
- `syncMeetingCleaningAssignmentsByManager`
- `notifyAssignmentUsers`
- `notifyCongregationAssignmentUsers`
- `notifyMeetingAssignmentUsers`
- `notifyMeetingPublicationAndChanges`
- `sendMeetingReminderThreeDaysBefore`
- `scheduledDataCleanup`
- `scheduledNotificationsCleanup`

---

## 🧮 Inversión estimada del desarrollo

Esta estimación representa el valor aproximado del trabajo realizado hasta el estado actual del proyecto. No incluye impuestos ni costos legales.

### ⏱️ Horas estimadas

| Periodo | Dedicación aproximada | Horas |
|---|---:|---:|
| Mes 1 | 10 h/día × 30 días | 300 h |
| Mes 2 | 3-5 h/día × 30 días | 90-150 h |
| **Total estimado** | 2 meses completos | **390-450 h** |

Para el cálculo principal se usa un punto medio de **420 horas**.

### 💰 Costo estimado por área

Tarifa conservadora usada: **$150 MXN/hora**.

| Área | Horas estimadas | Costo aproximado |
|---|---:|---:|
| 💻 Desarrollo / programación de la app | 190 h | $28,500 MXN |
| 🎨 Diseño UX/UI, estructura visual e imágenes | 85 h | $12,750 MXN |
| 🔥 Firebase, reglas, Auth, Firestore y arquitectura de datos | 65 h | $9,750 MXN |
| 🧪 Pruebas, errores, ajustes y depuración | 45 h | $6,750 MXN |
| 🧠 Planificación, estructura, ideas y flujos | 35 h | $5,250 MXN |
| **Subtotal por trabajo** | **420 h** | **$63,000 MXN** |

### 🧾 Suscripciones usadas

| Concepto | Costo mensual | Meses | Total |
|---|---:|---:|---:|
| Herramientas / suscripciones de desarrollo | $400 MXN | 2 | $800 MXN |

### 📌 Total estimado actual

| Concepto | Total |
|---|---:|
| Trabajo estimado | $63,000 MXN |
| Suscripciones | $800 MXN |
| **Total general estimado** | **$63,800 MXN** |

Rango razonable:


> Esta cifra no representa precio de venta final. Representa una estimación conservadora del valor del trabajo ya invertido.

---

## 🔥 Costos aproximados de Firebase

Firebase puede operar con costo muy bajo al inicio si la app está bien optimizada. El consumo crítico para OMP no será solamente la cantidad de usuarios, sino principalmente:

- Lecturas de Firestore.
- Listeners en tiempo real.
- Consultas repetidas.
- Cloud Functions ejecutadas por cambios de documentos.
- Notificaciones.
- Storage si en el futuro se agregan imágenes, PDFs o archivos.



### 📊 Escenarios mensuales iniciales

| Escenario | Descripción | Costo estimado |
|---|---|---:|
| 🟢 Inicial optimizado | Pocas congregaciones, caché activa, sin bucles | $0 - $100 MXN/mes |
| 🟡 Crecimiento controlado | Varias congregaciones, lecturas moderadas | $100 - $500 MXN/mes |
| 🟠 Uso medio | Más usuarios activos, notificaciones y funciones frecuentes | $500 - $1,500 MXN/mes |
| 🔴 Uso alto | Muchas congregaciones, muchos listeners, más Storage y Functions | $1,500 - $5,000+ MXN/mes |



---

## 📈 Costos futuros del proyecto

Además de Firebase, OMP puede requerir costos de operación y publicación.

### 🧾 Costos técnicos mensuales

| Concepto | Costo aproximado |
|---|---:|
| Suscripciones de herramientas | $400 MXN/mes |
| Firebase inicial / moderado | $0 - $500 MXN/mes |
| Reserva técnica recomendada | $300 - $1,000 MXN/mes |
| **Total mensual base estimado** | **$700 - $1,900 MXN/mes** |

### 📱 Publicación de apps

| Servicio | Costo aproximado |
|---|---:|
| Google Play Console | $25 USD una sola vez |
| Apple Developer Program | $99 USD/año |

Con referencia de **1 USD ≈ $17.43 MXN**:

| Servicio | Aprox. MXN |
|---|---:|
| Google Play Console | ~$436 MXN una sola vez |
| Apple Developer Program | ~$1,726 MXN/año |

### 🛠️ Mantenimiento futuro

Si el proyecto sigue creciendo, el costo real no será solo Firebase. También debe considerarse:

- Corrección de errores.
- Ajustes de seguridad.
- Revisión de reglas Firestore.
- Optimización de lecturas.
- Nuevas pantallas.
- Soporte a administradores.
- Publicación de versiones.
- Desarrollo de una segunda aplicación administrativa.

Ejemplo de costo de mantenimiento si se valoran las horas a **$150 MXN/hora**:

| Escenario | Horas mensuales | Costo estimado |
|---|---:|---:|
| Mantenimiento ligero | 10 h/mes | $1,500 MXN |
| Mantenimiento moderado | 20-40 h/mes | $3,000 - $6,000 MXN |
| Desarrollo activo | 90-150 h/mes | $13,500 - $22,500 MXN |

---

## 📦 Planes sugeridos por congregación

Todos los planes deben incluir las mismas funcionalidades. La única diferencia es la cantidad máxima de usuarios activos por congregación.

| Plan | Usuarios activos máximos | Precio mensual sugerido |
|---|---:|---:|
| 🟢 OMP Básico | 70 usuarios | $60 MXN/mes |
| 🟡 OMP Intermedio | 120 usuarios | $100 MXN/mes |
| 🔵 OMP Completo | 200 usuarios | $150 MXN/mes |

### Criterio de estos precios

Estos precios no buscan generar ganancia. Su objetivo es ayudar a cubrir:

- Firebase.
- Servidores y almacenamiento.
- Notificaciones.
- Publicación en tiendas.
- Herramientas de desarrollo.
- Reserva técnica.
- Mantenimiento futuro.

---

## 🚀 Instalación local

### Requisitos

- Node.js compatible con Expo y Firebase Functions.
- npm.
- Expo CLI mediante `npx expo`.
- Proyecto Firebase configurado.
- Firebase CLI si se van a desplegar reglas o funciones.
- Android Studio para Android local.
- Xcode para iOS local en macOS.

### Instalar dependencias de la app

```bash
npm install
```

### Ejecutar en desarrollo

```bash
npm start
```

Atajos comunes desde Expo:

```bash
npm run android
npm run ios
npm run web
```

### Instalar dependencias de Cloud Functions

```bash
cd functions
npm install
npm run build
```

### Ejecutar lint

Desde la raíz:

```bash
npm run lint
```

Desde `functions/`:

```bash
cd functions
npm run lint
```

---

## 🔥 Firebase

### Configuración actual

La app inicializa Firebase desde `src/lib/firebase/app.ts`.

Para producción o distribución pública, se recomienda migrar la configuración cliente a variables `EXPO_PUBLIC_*` y mantener fuera del repositorio cualquier credencial privada de servidor. La configuración cliente de Firebase no equivale a una llave secreta de administrador, pero las credenciales de servicio, llaves privadas y archivos sensibles nunca deben incluirse en el cliente ni en el repositorio.

### Deploy de reglas e índices

```bash
firebase deploy --only firestore
```

### Deploy de funciones

```bash
firebase deploy --only functions
```

También puede ejecutarse desde la carpeta `functions`:

```bash
npm run deploy
```

---

## 📜 Scripts disponibles

### App principal

| Script | Uso |
|---|---|
| `npm start` | Inicia Expo / Metro Bundler |
| `npm run android` | Ejecuta la app en Android |
| `npm run ios` | Ejecuta la app en iOS |
| `npm run web` | Ejecuta la app en web |
| `npm run lint` | Ejecuta validación ESLint |
| `npm run reset-project` | Ejecuta el script local de reset del proyecto |

### Cloud Functions

| Script | Uso |
|---|---|
| `npm run lint` | Revisa código de funciones |
| `npm run build` | Compila TypeScript |
| `npm run test` | Ejecuta pruebas con Jest |
| `npm run serve` | Compila e inicia emuladores de Functions |
| `npm run shell` | Abre shell de Firebase Functions |
| `npm run deploy` | Despliega Functions |
| `npm run logs` | Consulta logs de Firebase Functions |

---

## ✅ Buenas prácticas del proyecto

Antes de agregar o modificar una funcionalidad:

1. Identificar los archivos exactos que se van a tocar.
2. Confirmar que el cambio no afecta módulos no relacionados.
3. Mantener separación entre UI, servicios, tipos y reglas.
4. Evitar `onSnapshot` innecesarios en pantallas que no requieren tiempo real.
5. Usar estrategia cache-first cuando sea posible.
6. Mantener consultas filtradas por `congregationId`.
7. No cargar colecciones completas si solo se necesita un resumen.
8. Probar reglas de Firestore antes de desplegar cambios sensibles.
9. No subir logs, llaves privadas, archivos `.env`, certificados o builds generados.

---

## ⚠️ Riesgos técnicos conocidos

- El repositorio es público; conviene mantener reglas, App Check y credenciales privadas correctamente protegidas.
- Existe configuración Firebase visible del lado cliente; esto es normal en apps Firebase, pero no reemplaza la necesidad de reglas estrictas.
- Los listeners en tiempo real pueden aumentar lecturas si se montan varias veces o no se limpian correctamente.
- Las funciones con memoria alta o muchos `maxInstances` pueden generar costos si el uso crece.
- Es recomendable auditar periódicamente Firestore Reads, Functions Invocations y Storage.

---

## 🗺️ Roadmap sugerido

- [ ] Implementar planes por congregación:
  - OMP Básico: hasta 70 usuarios activos.
  - OMP Intermedio: hasta 120 usuarios activos.
  - OMP Completo: hasta 200 usuarios activos.
- [ ] Mostrar plan actual en configuración.
- [ ] Mostrar usuarios disponibles restantes al crear usuarios.
- [ ] Bloquear creación de usuarios al alcanzar el límite del plan.
- [ ] Crear panel administrativo externo para alta y gestión de congregaciones.
- [ ] Agregar métricas internas de consumo por congregación.
- [ ] Revisar y reducir listeners `onSnapshot` no esenciales.
- [ ] Endurecer App Check y monitoreo de Firebase.
- [ ] Agregar documentación de despliegue Android/iOS.
- [ ] Definir licencia o política de uso privado.

---

## 📚 Documentación adicional

Existe documentación técnica extendida en:

```text
docs/Documentacion_Tecnica.md
```

---

## 📄 Licencia y uso

Este repositorio no define todavía una licencia pública. Hasta que se agregue una licencia formal, el código debe considerarse de uso privado del autor.

---

## 👨‍💻 Autor

**Desarrollado por MRC**

Proyecto desarrollado de forma independiente, con enfoque en organización, utilidad práctica y sostenibilidad técnica.
