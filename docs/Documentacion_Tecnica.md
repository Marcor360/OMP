# Documentación Técnica y Arquitectura: OMP

Este documento centraliza el conocimiento profundo a nivel de código de la aplicación OMP. Ha sido redactado meticulosamente para describir la arquitectura, conexiones de base de datos, módulos de frontend, scripts de entorno e integración con backend de Firebase.

---

## FASE 1: Visión General, Tecnologías y Configuración Global

### 1. Visión General del Sistema
**OMP** es una aplicación multiplataforma completa (iOS, Android, Web) orientada a la gestión y automatización de congregaciones. Provee un robusto sistema de dashboard, administración de usuarios (Roles como Empleado, Administrador, Auxiliar), creación de reuniones y asignaciones detalladas. Su principal fuerte radica en la reactividad en tiempo real respaldada por Firebase y una arquitectura cliente-side fluida de última generación.

### 2. Stack Tecnológico Core
- **Framework Principal**: React Native (`0.81.5`) empaquetado bajo el paraguas de **Expo** (SDK `54.x`).
- **Enrutamiento Avanzado**: Se utiliza `expo-router` v6, el cual implementa el paradigma basado en directorios (file-based routing API) para la navegación de pantallas nativas y web.
- **Lenguaje Principal**: **TypeScript** (~5.9.2). Fuertemente tipado en un esquema de *strict mode*, previniendo caídas no esperadas de punteros o tipos (configurado el aliasing `@/*` que apunta a la raíz).
- **Estilos y Renderizado UI**: Arquitectura basada en **NativeWind** (`v4`), lo cual permite la inyección de directivas TailwindCSS compatibles cruzadas hacia vistas de React Native (gestionado por PostCSS y Babel). La UI fluye nativamente gracias a `react-native-reanimated` (gestión rápida de animaciones en hilos principales) y `react-native-gesture-handler`.
- **Backend-as-a-Service**: Configurado unánimemente hacia **Firebase** (`^12.11.0` en el lado frontend) y `firebase-admin` en el backend.

### 3. Configuración del Raíz (Root Files)
Cada archivo de la carpeta raíz cumple un objetivo vital para construir el binario y renderizar el flujo local:

* `app.json`: El Manifiesto de Expo. Define la metadata vital como la versión (`1.4.1`), el slug del proyecto (`omp`) y configuraciones avanzadas del OS:
  - **Android**: Demanda permisos sensitivos como `POST_NOTIFICATIONS` (notificaciones nativas PUSH), `SCHEDULE_EXACT_ALARM` y `RECEIVE_BOOT_COMPLETED` (utilizados para el control y enrutamiento interno de alarmas push del sistema de asignaciones) y `VIBRATE`. Configura también de manera estricta adaptaciones estilizables como el icono `adaptiveIcon` y un fondo.
  - **iOS**: Establece explícitamente el uso de `remote-notification` bajo los Background Modes y estipula la justificación imperativa en `NSUserNotificationsUsageDescription`.
  - **Plugins y Experiments**: Carga `expo-splash-screen`, `expo-notifications`, activa `typedRoutes: true` (para validar rutas estáticas al momento de compilar de react-router) y el modernísimo `reactCompiler`.
* `babel.config.js`: Intercepta la compilación de Metro. Inyecta `babel-preset-expo` con compatibilidad `jsxImportSource: "nativewind"` para forzar a que React nativo entienda las clases `.css` procesadas y las convierta a objetos StyleSheet.
* `tailwind.config.js`: Estructura simplificada que inyecta sus dependencias de NativeWind apuntando al contenido en `App.tsx` y `./components/**/*`.
* `firebase.json`: Configuración para empaquetadores de firebase. Declara explícitamente la fuente de las funciones Cloud (`"source": "functions"`) y asegura procesos pre-despliegue (`predeploy: ["npm run lint", "npm run build"]`).
* `tsconfig.json`: Compilador configurado de manera estricta y extendiendo los defaults abstractos de Expo, inyectando declaraciones para Tailwind y Nativewind-env. 

### 4. Instalación de Dependencias y Scripts de Ejecución
Para que un desarrollador nuevo levante completamente el entorno, el flujo estándar asume haber clonado el repositorio y tener Node instalado (versión 20 o más sugerida).

#### Instalación Base:
```bash
npm install
```

#### Scripts Claves en package.json:
- `npm run start` o `npm start`: Inicializa Metro bundler y el Expo Dev Server. Permite abrir la app en emuladores o escaneando un código QR en la Expo Go app.
- `npm run android` / `npm run ios`: Compila la aplicación nativamente abriendo el pre-build de C++ y Gradle/XCode respectivamente.
- `npm run web`: Inicializa el servidor con soporte `react-native-web`.
- `npm run lint`: Realiza el escaneo por `eslint` validando todos los archivos .tsx bajo reglas react/expo.
- `npm run reset-project`: Corre un script en Node (`./scripts/reset-project.js`) que probablemente se encarga del vaciado de cachés temporales de Expo/Metro.

---

## FASE 2: Arquitectura del Frontend y Enrutamiento (Directorio `/app`)

### 1. Sistema Base de Enrutamiento (Expo Router)
La aplicación descansa enteramente sobre `expo-router`. Su directorio raíz de exploración es `/app`. Dentro de esta carpeta, los archivos mapean directamente a pantallas de navegación.
Adicionalmente, el proyecto utiliza extensamente el concepto abstracto de **Grupos de Ruta (Route Groups)** —carpetas encerradas entre paréntesis `()`. Estas no alteran la ruta del URL final, pero agrupan pantallas bajo un escenario lógico en común forzándolas a compartir un `_layout.tsx`.

### 2. El Layout Raíz Maestro (`app/_layout.tsx`)
Es el archivo fundamental que domina y envuelve a toda la aplicación con Context Providers:
- **Proveedores Inyectados**: 
  - `ThemeModeProvider` y `ThemeProvider` (para sincronizar reactivamente las paletas Light/Dark de `@react-navigation`).
  - `AuthProvider` (Atrapa globalmente el estado de sesión de Firebase Authentication).
  - `I18nProvider` (Internacionalización local con los idiomas en/es predeterminados).
- **Hooks de Inicialización Crítica**: Dispara rutinas asíncronas subyacentes justo al lanzar el binario:
  - `useInitialPermissions()`: Gestiona alertas nativas tempranas solicitando permisos de notificaciones al arrancar.
  - `useNotificationSetup()`: Suscribe o desvincula en segundo plano los tokens push de Firebase al autenticar o salir.
  - `useCacheControlCleanup()`: Interconecta lógicas temporales para depurar memorias caché de perfiles o listados en caso de cambios severos.
- **Guardián Global de Enrutamiento (Global Session Guard)**: Mediante un Hook `useEffect`, evalúa en nanosegundos el objeto global `user`. 
  - Si no está autenticado y se encuentra merodeando pantallas protegidas, dispara forzadamente `router.replace('/(auth)/login')`.
  - Si está logueado pero localmente intenta acceder a la raíz del logeo `(auth)`, lo empuja instantáneamente al inicio del dashboard: `router.replace('/(protected)/(tabs)/')`.

### 3. Entorno Segurizado: Grupo `(protected)`
Cúpula en donde la app deposita toda interacción con la base de datos Firestore y pantallas operativas de congregación.
- **Layout Protegido (`_layout.tsx`)**: Antes de habilitar cualquier render, encapsula la navegación bajo un estricto `<UserProvider>`. Este proveedor hace "data fetching" del documento `/users/{uid}` en Firestore para recolectar e hidratar roles en profundidad (ej. si es 'admin', si pertenece a un departamento de mantenimiento, si es Coordinador, etc.), dándole esa información a todas las pantallas anidadas.
- A nivel componentes en pantalla, define un enrutador global apilado (`Stack`) encargado de alojar las rutas que **no deben** exponer el Bottom Tab menú de navegación (ej. creación de reuniones `meetings/create`, listado de notificaciones `notifications/index`, `unauthorized.tsx`, etc.).

### 4. Navegación Principal por Pestañas: Grupo `(tabs)`
Construye el componente de `BottomNav` nativo (Tabuladores) que acompaña al usuario constantemente.
- Archivo base: `app/(protected)/(tabs)/_layout.tsx`.
- Las viñetas disponibles mapean hacia: `index` (Dashboard Home), `meetings`, `assignments`, `users`, `cleaning`, `profile` y `settings`.
- **RBAC Activo en la UI (Role-Based Access Control)**: En la declaración de este archivo, se hace uso dinámico de utilidades nativas leyendo el `role` del usuario. A través de la función `getVisibleTabs(role)`, la base oculta lógicamente una pestaña entregando un `href: null` a componentes como Administrador de Usuarios o Reuniones si la cuenta actualmente detectada es en jerarquía netamente nivel `user`.

---
*(La documentación continuará detallando los Módulos Internos que dan vida a estas vistas)*
