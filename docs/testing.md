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
