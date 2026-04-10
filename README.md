# App OMP - Dashboard Seguro y Autenticado

Este es un proyecto desarrollado usando [React Native](https://reactnative.dev/) y [Expo](https://expo.dev/), utilizando enrutamiento basado en archivos a través de **Expo Router**, y una arquitectura modular escalable. Está diseñado para proveer una experiencia de usuario segura, autenticada y con control de acceso basado en roles.

## 🚀 Características Principales

* **Autenticación y Seguridad:**
  * Sistema de inicio y cierre de sesión seguro mediante **Firebase**.
  * Cierre de sesión automático tras 30 minutos de inactividad por seguridad.
  * Funcionalidad de visibilidad de contraseña (icono de ojo) en el login.
* **Control de Acceso Basado en Roles (RBAC):**
  * Acceso diferenciado y vistas específicas para roles de `admin`, `supervisor` y `user`, integrados con los servicios de Firestore.
* **Navegación Moderna:**
  * Rutas públicas y protegidas gestionadas eficientemente con los *nested layouts* de **Expo Router** (grupos `(auth)` y `(protected)`).
* **Arquitectura de Estilos Centralizada:**
  * Sistema de diseño estructurado en el directorio `src/styles` (definiendo `global.ts` con la paleta de colores base).
  * Integración con **NativeWind** (Tailwind CSS para React Native) para agilizar la construcción de la UI de manera consistente.

## 🛠️ Tecnologías y Stack

* **Framework:** React Native & Expo
* **Navegación:** Expo Router (`expo-router`)
* **Backend y Base de Datos:** Firebase (Authentication & Firestore)
* **Estilos:** NativeWind (`nativewind`, `tailwindcss`) y Estilos Globales Centralizados
* **Almacenamiento Local:** AsyncStorage (`@react-native-async-storage/async-storage`)

## 📂 Estructura del Proyecto

La aplicación sigue las mejores prácticas manteniendo una arquitectura modular en la carpeta `src` y delegando las rutas a la carpeta `app/`:

```text
├── app/                  # Enrutamiento basado en archivos (Expo Router)
│   ├── (auth)/           # Rutas públicas (Archivos de Login, etc.)
│   ├── (protected)/      # Rutas protegidas (Dashboards y flujos internos)
│   └── _layout.tsx       # Layout principal de la aplicación
├── src/                  # Código fuente modular
│   ├── components/       # Componentes de UI reutilizables
│   ├── config/           # Configuraciones (Ej. Inicialización de Firebase)
│   ├── constants/        # Constantes globales compartidas
│   ├── context/          # Estados globales y Context API (Ej. Estado de Sesión)
│   ├── hooks/            # Custom Hooks (Ej. Control de inactividad)
│   ├── screens/          # Vistas y componentes de pantalla completos
│   ├── services/         # Integración y lógica de servicios (Firestore)
│   ├── styles/           # Estilos globales y tokens de diseño (global.ts)
│   ├── types/            # Interfaces y tipos de TypeScript
│   └── utils/            # Funciones auxiliares y utilidades
├── tailwind.config.js    # Configuración de Tailwind / NativeWind
└── package.json          # Dependencias y scripts
```

## 🏁 Primeros Pasos

### 1. Variables de Entorno (Firebase)
Antes de iniciar, debes asegurarte de contar con la configuración de tu entorno de Firebase en el proyecto.

### 2. Instalar Dependencias
Ejecuta el siguiente comando en la raíz del proyecto para descargar todas las librerías necesarias:

```bash
npm install
```

### 3. Iniciar la Aplicación
Para levantar el entorno de desarrollo con Expo:

```bash
npx expo start
```
En la terminal verás instrucciones y un código QR que te permitirá abrir la app en tu dispositivo físico mediante la app de **Expo Go**, o bien presionando teclas para emuladores de Android / iOS.

## 📝 Scripts Disponibles

* `npm start`: Inicia el servidor nativo de Expo.
* `npm run android`: Inicia la aplicación en un emulador de Android (requiere configuración local).
* `npm run ios`: Inicia la aplicación en un simulador de iOS (sólo Mac).
* `npm run web`: Lanza la aplicación en un navegador web.
* `npm run lint`: Ejecuta el linter de código (eslint).
