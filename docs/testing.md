# Testing

## Comando Actual

```bash
npm run validate
```

Este comando ejecuta lint de la app, TypeScript, tests frontend, lint/build de Functions y tests de Functions.

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

Pendiente ampliar pruebas para:

Agregar pruebas para:

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

Pendiente ampliar:

- Admin puede crear usuario.
- Supervisor solo puede hacer lo permitido.
- Usuario normal no puede editar roles.
- Encargado puede gestionar su modulo.
- Usuario con permiso `usuarios.view` lee usuarios de la misma congregacion sin agotar el presupuesto de expresiones de Rules.
- Endurecimiento post-migracion de roles y planes legacy.

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
