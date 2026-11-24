# Galería de interfaz de OMP Suite

Las capturas de este proyecto deben proceder de las pantallas reales de OMP, no de mockups ni de imágenes generadas por IA. La galería web utiliza Expo Router, Playwright y Firebase Emulator Suite con información completamente ficticia.

| Archivo previsto | Pantalla | Vista |
| --- | --- | --- |
| `01-idioma-web-movil.png` | Selección del idioma | Web móvil, 390 × 844 |
| `02-acceso-web-escritorio.png` | Inicio de sesión | Web escritorio, 1440 × 1000 |
| `03-acceso-web-movil-oscuro.png` | Inicio de sesión | Web móvil, tema oscuro |
| `04-dashboard-web-escritorio.png` | Dashboard de administración | Web escritorio, tema claro |
| `05-dashboard-web-movil-oscuro.png` | Dashboard de administración | Web móvil, tema oscuro |

**Estado:** los nombres de arriba son el inventario de capturas por generar; no representan archivos ya existentes. Consulta los artefactos de la ejecución de [GitHub Actions](https://github.com/Marcor360/OMP/actions) cuando finalice una ejecución exitosa de la galería.

## Generar capturas localmente

Requisitos: Node.js 22, Java 21, puertos 8081, 9085 y 9099 libres. Desde la raíz:

```bash
npm ci
npx playwright install chromium
npm run check:rules
npx firebase emulators:exec --only auth,firestore --project demo-omp "npx playwright test -c e2e/gallery.config.ts"
```

Las imágenes se guardan en `tmp/omp-gallery/`, ignorado por Git. El proyecto de demostración usa únicamente Auth y Firestore locales; no necesita claves de producción ni una cuenta real. El dashboard muestra una proyección sintética para ilustrar las tarjetas sin depender de tareas programadas.

## Publicación de la galería

1. Confirmar que todas las pruebas de captura finalizaron correctamente.
2. Revisar cada imagen a tamaño completo: sin estados de carga, errores, cortes, datos personales, correos, contraseñas, tokens o identificadores reales.
3. Copiar únicamente las imágenes aprobadas a esta carpeta, añadir texto alternativo y enlaces relativos al README principal.
4. Incluir las capturas en el PR y actualizar la descripción con la versión del código y el entorno utilizado.

No publicar capturas de producción con información de usuarios o congregaciones, ni subir trazas, credenciales, logs o directorios de build. Una captura web a tamaño móvil no acredita el aspecto nativo de Android/iOS. Las capturas nativas deben obtenerse aparte con una cuenta de demostración autorizada.

## Próxima cobertura visual

Reuniones, asignaciones, hospitalidad y limpieza, predicación y territorios, notificaciones, configuración y navegación por rol. Cada módulo requiere fixtures sintéticos representativos y una comprobación explícita del estado final antes de capturarlo.
