# Testing

## Comando Actual

```bash
npm run validate
```

Este comando ejecuta lint de la app, TypeScript, tests frontend, lint/build de Functions y tests de Functions.
La cobertura forma parte de CI: el cliente no puede bajar de 50% statements,
33% branches, 49% functions y 52% lines; Functions no puede bajar de 30%,
15%, 25% y 28%, respectivamente. Los mínimos son una línea base, no una meta
de calidad: cada módulo nuevo debe incluir pruebas de sus flujos autorizados y
de sus fallos relevantes.

## Frontend

Comandos:

```bash
npm run test
npm run test:watch
npm run test:coverage
```

Cobertura inicial agregada:

- Planes y limites de usuarios activos.
- Permisos por rol tecnico y asignacion de servicio.
- Helpers de fecha `YYYY-MM-DD` y rango semanal.
- Cache persistente AsyncStorage con ciclo anual, TTL, limpieza por valor y limpieza por congregacion.

Prioridad para ampliar pruebas:

- Roles.
- Permisos.
- Rutas protegidas.
- Helpers de Firestore.
- Validaciones de usuario.
- Navegacion.
- Visibilidad de modulos.

## Validación con Node 24 y Node 22

La raíz usa Node 24.12 o posterior de la línea 24. Para probar la misma versión
del runtime de Functions, ten disponible Node 22.13 o posterior de la línea 22.
Instala dependencias con el Node correspondiente a cada paquete. Ejecuta la
validación desde la raíz con Node 24 activo y Java 21 disponible:

```bash
export OMP_FUNCTIONS_NODE=/ruta/a/node22/bin/node
npm run quality:check
```

Para Playwright, instala Chromium con `npm exec -- playwright install chromium`
y compila Functions con Node 22. Mantén Node 24 en el PATH para Expo y Playwright.
Invoca la CLI de Firebase con el binario de Node 22 para que los workers de
Functions también usen ese runtime:

```bash
"$OMP_FUNCTIONS_NODE" ./node_modules/.bin/firebase emulators:exec \
  --only auth,firestore,functions --project demo-omp \
  'npm exec -- playwright test -c e2e/playwright.config.ts --workers=1'
```

Si ya existe un archivo local de Functions, respétalo. El emulador puede
solicitar el valor del parámetro de App Check al descubrir las funciones.
Usa exclusivamente configuración de prueba en esta ejecución.

## Firestore Rules

Comando:

```bash
npm run test:rules
```

Este comando usa Firestore Emulator mediante `firebase emulators:exec`.

Cobertura inicial agregada:

- Usuario activo puede leer su propio perfil.
- Usuario normal no lee otros perfiles de la misma congregacion.
- Admin y supervisor leen usuarios de la misma congregacion.
- Usuario de otra congregacion queda bloqueado.
- Usuario inactivo no lee otros perfiles.
- Congregacion suspendida bloquea acceso a datos de esa congregacion.
- Push token solo puede escribirse por el usuario dueno.

### Reglas de horarios de limpieza

La suite cubre creación por cargo de encargado de limpieza, por clave de
asignación y por permiso explícito. También verifica el aislamiento por
congregación, los perfiles inactivos, los bloqueos de facturación y
mantenimiento, y la conservación de los metadatos de creación. Ejecuta
`npm run test:rules` después de cambiar los predicados de acceso o los
validadores de horarios.

El dry-run de roles y planes legacy realizado el 23 de septiembre de 2026 no
encontro documentos que requirieran migracion. Las Rules ya rechazan roles
legacy y validan solo `admin`, `supervisor` y `user`.

## Manual

Probar en Android, iOS y Web:

- Login/logout.
- Recuperacion de perfil.
- Usuarios y permisos.
- Reuniones y asignaciones.
- Limpieza.
- Predicacion y territorios.
- Notificaciones.
- Estados vacios y errores.
