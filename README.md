# 📊 OMP - Sistema Integral de Gestión (Dashboard Seguro y Autenticado)

Bienvenido al repositorio oficial del proyecto **OMP** (Operation Management Portal - Nombre en Código). Esta es una aplicación móvil robusta de grado empresarial desarrollada con **React Native** y **Expo**, impulsada por un backend BaaS gestionado sobre **Firebase**.

El sistema está diseñado específicamente para lograr una gestión operativa eficiente mediante módulos de asignaciones y limpiezas (entre otros dominios), respaldado por una fuerte arquitectura de control de acceso basado en roles (RBAC), notificaciones nativas push, y una experiencia de usuario en la que predominan interacciones de alta cadencia.

---

## 🚀 Características y Capacidades Principales

### 🔐 Autenticación y Seguridad Integral
*   **Firebase Authentication Core:** Mecanismo centralizado para gestionar el ciclo de vida del usuario, garantizando persistencia segura y control de tokens de acceso (JWT).
*   **Timeout de Inactividad Inteligente:** Por razones de estricta confidencialidad operativa de la base de datos, la plataforma finaliza de forma predeterminada la sesión transcurrido un periodo de **30 minutos de inactividad**.
*   **Control de Acceso Basado en Roles Estricto (RBAC):** La plataforma procesa tres jerarquías fundamentales que determinan las interfaces habilitadas y las operaciones Firestore permitidas:
    *   🛡️ **Administrador (`admin`):** Gestión absoluta de configuraciones, módulos, asignación de permisos globales, y super-poderes sobre toda colección (lectura, escritura y modificación).
    *   👥 **Supervisor (`supervisor`):** Capacidades de solo lectura, más una escritura y modificación restringida por zona/entornos asignados. Moderación del módulo de tareas (creación y designación).
    *   👤 **Usuario Base (`user`):** Accesos a rutas públicas y dashboards visuales read-only.
*   **Gestión UX Segura:** Controles dinámicos en los flujos de ingreso, estados *loading*, debouncing en procesos críticos, e interacción de visibilidad unificada.

### 🧩 Ecosistema Modular (Feature-Sliced Design)
El proyecto ha sido desglosado en módulos lógicos en código fuente (dominio vertical) aislando interfaces, tipos, y componentes.
*   **Módulo de Limpieza (`modules/cleaning`):** Controlador de equipos, métricas activas (cuentas de miembros), gestión in-app de *Cleaning Groups* donde se asocian perfiles de usuario y asignaciones futuras a dichas cuadrillas.
*   **Módulo de Asignaciones (`modules/assignments`):** Motor de traqueo o delegación de actividades/asignaciones temporales para perfiles operativos. (Infraestructura subyacente).

### 📱 Sistema Nativo Transparente (Device Level)
El portal aprovecha toda la integración nativa y las capacidades de los dispositivos que expone el API de Expo y React Native bajo la configuración `app.json`:
*   **Generación de Tokens Push (Telemetría Firebase):** A través del servicio de `expo-notifications`, los dispositivos se registran en Firestore para recepción de avisos. La API interactiva solicita permisos, verifica canales (`General`, `Limpieza`) y emite Push Notifications asíncronas sobre eventos del RBAC y asignaciones.
*   **API Multimedia Segura:** Uso del manejador `expo-image-picker` para solicitar permisos de dispositivo para inyección a galería (`NSPhotoLibraryUsageDescription`) y hardware visual (`NSCameraUsageDescription`).
*   **Retroalimentación háptica (Haptic Engine):** Aumentando la interactividad móvil, usamos integraciones de vibración `expo-haptics` en cambios de vista, activaciones toggle y operaciones satisfactorias CRUD.

### 🧭 Navegación Topológica y Layouts
*   **Expo Router de Enrutamiento Anidado:** Basado y abstraído en `expo-router` v6 permitiendo navegación declarativa usando ficheros estructurados lógicamente (`(auth)`, `(protected)`) gestionando barreras entre los accesos por medio del Provider principal.

---

## 🛠️ Stack Tecnológico en Profundidad

La suite se ha cimentado sobre tecnologías punteras correspondientes al *Current Release* y la iteración moderna de React.

*   **Core App / Framework:**
    *   **React:** `v19.1.0` y **React Native:** `v0.81.5`
    *   **Expo SDK:** `v54.x` configurado explícitamente tanto con soporte Nativo Puro como para Web (con Metro Bundler universal).
*   **Navegación e IA de Enrutado:**
    *   **Expo Router** `~6.0.23` soportado robustamente sobre la base `@react-navigation/native` `^7.1.8`.
*   **Cloud BaaS y Datos:**
    *   **Firebase Core SDK:** `^12.11.0` (Auth y Firestore implementados). Referencias estáticas unificadas.
*   **System Design & Styling UI (CSS y UIx):**
    *   **NativeWind:** `^4.2.3` - Integrando de forma inmaculada todo **Tailwind CSS (`v3.4.x`)** a variables de hoja de estilo en React Native manteniendo alto performance usando pre-compiladores (`babel` plugins, `postcss.config.js`).
*   **Estados, Hooks Globales y Caching local:**
    *   Uso puro del entorno Context API envuelto en custom Hooks e integrado a asincronía mediante un Storage seguro (`@react-native-async-storage/async-storage`).

---

## 📂 Arquitectura Detallada de Carpetas

Adoptamos un diseño de carpetas altamente segregado para propiciar el mantenimiento concurrente, y desacoplar *views*, de la *lógica global*, de las *integraciones BaaS*.

```text
/
├── app/                  # Enrutamiento Declarativo de Vistas (Rutas Expo Router).
│   ├── (auth)/           # Barrera Layout para invitados -> Contiene la lógica de autenticación (Login, Recuperación, Verificación de roles temporal).
│   ├── (protected)/      # Rutas bloqueadas tras el "Auth Guard Layout". Acceso sólo para Sesión Activa. 
│   │   └── (tabs)/       # Segmentos base de BottomTabs y Dashboards (Ej: cleaning.tsx).
│   └── _layout.tsx       # El Provider Wrapper Global de la app entera. Monta Notificaciones, Seguridad Timeout, y Temas.
│
├── src/                  # Capa de presentación y lógica comercial base.
│   ├── components/       # Componentes Átomos o Genéricos (compartidos en cualquier vista).
│   │   ├── common/       # Cajas de diálogo, modales, alertas, switch, o layouts genéricos.
│   │   ├── ui/           # Colecciones base de inputs, botones custom de estado cargando, selectores.
│   │   └── cards/        # UI de empaquetados visuales genéricos.
│   ├── config/           # Setup Base: Instanciación e importación fundamental de 'firebase.ts' para usar getApp(), getAuth(), getFirestore().
│   ├── constants/        # Archivos inmutables: Keys y enums.
│   ├── context/          # Estados persistentes globales en Scope Superior.
│   │   ├── auth-context.tsx    # Máquina de estados JWT - Verificador de credenciales
│   │   ├── user-context.tsx    # Observador de variables Firestore y rol real-time.
│   │   └── theme-context.tsx   # Gestor dinámico de variables gráficas del UX.
│   ├── hooks/            # Funcionalidades reutilizables conectadas a ciclo de vida de React (ej. useLogoutTimer).
│   ├── lib/              # Facades o Abstracciones Globales puras conectadas a 3ras API.
│   │   └── firebase/refs.ts # Tipados persistentes de colecciones y referenciadores (Firestore Docs).
│   ├── modules/          # Dominio Vertical Completo por ÁREA TEMÁTICA (Feature Sliced).
│   │   ├── cleaning/     # (Views, components locales, custom hooks lógicos de la temática Limpieza).
│   │   └── assignments/  # Igual al anterior, bajo Asignaciones.
│   ├── services/         # Integraciones de Red Crudas y Firestore. Lógica que no es de UI (Auth Service, Notification Service, Users).
│   ├── styles/           # System Design global estático, definiendo variables fundamentales de NativeWind / global CSS en `global.ts`.
│   ├── types/            # DTOs, Declaraciones Tipos base .ts y Modelos lógicos de la DB Firestore.
│   └── utils/            # Herramientas matemáticas, validadores JS puros u operaciones estáticas.
│
├── tailwind.config.js    # Fichero vital. Motor de temas de NativeWind y configurador de compatibilidad de resoluciones con Metro.
├── global.css            # Definiciones nativas de capa Tailwind para transformaciones a estilos nativos. 
├── app.json              # Configuración de compilaicón universal para iOS, Android y variables de Metadatos y permisos (App Name y versión).
└── tsconfig.json         # Directrices rigurosas de configuración de types para React Native con resolución de Alias `@/`.
```

---

## 🏗️ Configuración del Entorno de Desarrollo (Getting Started)

La aplicación, al requerir servicios en la Nube y de Expo, requiere pasos precisos para arrancar exitosamente de la clonación base.

### 1. Prerrequisitos Base de Entorno

*   **Motor JavaScript:** Node.js v18.x LTS (o superior indispensable). Comprobación de instalación `node -v` e Instalador estable NPM (`npm -v`).
*   **Servicios Activos Opcionales/Requeridos:** Un ambiente virtual Firebase (Con Auth Activado -Email/Pass- & Módulo Firestore activado en modo desarrollo temporal o Nativo).
*   **Entornos de Compilación Físicos:** El uso de Expo Go es esencial, con lo que instálalo en iOS o Android, de forma paralela podrías depender de Xcode (para ecosistema Apple) o Android Studio Engine.

### 2. Seteo Inicial de Variables Seguras

El framework lee por convención los archivos ocultos `.env`. Crea un fichero en la raíz (hermano de `app.json`) llamado `.env`.
Ahí debes proveer las credenciales dadas por Google Config. Debe seguir estrictamente la taxonomía `EXPO_PUBLIC_*`.

```env
# Claves Extraídas de la Consola Firebase (Project Settings > Web App)
EXPO_PUBLIC_FIREBASE_API_KEY="AIzaSy...TuSuperApiKeyPrivada"
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN="omp-system-dev.firebaseapp.com"
EXPO_PUBLIC_FIREBASE_PROJECT_ID="omp-system-dev"
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET="omp-system-dev.appspot.com"
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="48XXXXXXXX38"
EXPO_PUBLIC_FIREBASE_APP_ID="1:48XXXXXXXX38:web:75XXXXXXXXXX"
```
*(Nota: Esté archivo de claves sensibles queda ignorado formalmente por git a causa del registro explícito en el fichero `.gitignore` nativo).*

### 3. Recuperar Dependencias e Iniciar Plataforma

Re-ejecuta el mapa de resoluciones del árbol de dependencias JS nativos en todo React.

```bash
# Limpieza total e instalación limpia del package-lock (Módulo nativos incluidos)
npm install
```

Arranca entonces el servicio. Esto invocará el compilador JIT local de Metro:

```bash
# Lanza en terminal la abstracción Expo local
npm start
```

En este punto la terminal generará comandos visuales (QR) permitiendo atajos de red física:
*   En tu hardware móvil dentro de la misma WLAN local escanea el código con *Expo Go* o por la app de Cámara si tu ecosistema lo soporta.
*   Digita `i` si tienes un Emulador iOS corriendo (macOS only).
*   Digita `a` si tienes un Emulador Android o Hardware conectado por ADB / Cable y en Debug Mode.

---

## 📝 Glosario Operativo Extendido (Scripts Disponibles)

Se exponen utilidades atómicas directamente desde la directriz principal del `package.json` para facilidad del equipo:

*   **`npm start`**: Inicializador universal seguro para Metro Bundler.
*   **`npm run android`**: Compilado expreso forzando el lanzamiento de las binarias APK internas conectando con sistema Android.
*   **`npm run ios`**: Equivalente en arquitectura de simuladores Apple empaquetando entorno veloz sobre darwin.
*   **`npm run web`**: Aprovecha el framework universal exportando código Expo a SPA React Pura adaptando renderizado a DOM y corriendo un localhost web sobre React Native para navegadores.
*   **`npm run lint`**: Auditoría agresiva (via plugin eslint expo y configs puras) para verificar las reglas estilísticas y bugs de sintaxis general pre-producción. Indispensable en CI/CD pipeline.
*   **`npm run reset-project`**: Útil en caídas de caché Metro o librerías corrompidas; purga configuraciones corruptibles.

---

## 🔒 Auditoría de Seguridad Aplicada & Reglas Clave

El ecosistema en **front-end** del proyecto OMP enmascara e interactúa rigurosamente en base de roles (`role === 'admin'`). *Sin embargo*, se insta al control posterior vía back-end en Firebase Console usando Rules nativas. La app enviará solicitudes sobre nodos referenciados que la Plataforma Cloud deberá permitir bajo estas directrices obligatorias sugeridas:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Definimos función validando estado autorizante local atado al nodo master users.
    function isSuperAdmin() {
      return request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // El usuario se ve sí mismo y nada más
    match /users/{userId} {
      allow read: if request.auth != null && (request.auth.uid == userId || isSuperAdmin());
      allow write: if isSuperAdmin();
    }
    
    // Rutinas y Limpieza
    match /cleaning_groups/{groupId} {
      allow read: if request.auth != null; // Usuarios leen 
      allow write, update, delete: if isSuperAdmin(); // Restricción dura admin
    }
  }
}
```

Estas convenciones de Reglas garantizarán que un usuario malicioso o interceptador que bypasee el FrontEnd React Native se estrelle firmemente contra la bóveda de la estructura Firestore de Google.
