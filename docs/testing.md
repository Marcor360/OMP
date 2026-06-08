# Testing

## Comando Actual

```bash
npm run validate
```

Este comando ejecuta lint de la app, TypeScript, lint/build de Functions y tests de Functions.

## Frontend Pendiente

Agregar pruebas para:

- Roles.
- Permisos.
- Rutas protegidas.
- Helpers de Firestore.
- Planes y limites.
- Validaciones de usuario.
- Navegacion.
- Visibilidad de modulos.
- Formatos de fecha.

Comandos futuros sugeridos:

```bash
npm run test
npm run test:watch
npm run test:coverage
```

## Firestore Rules Pendiente

Cubrir:

- Usuario activo puede leer su congregacion.
- Usuario inactivo no puede acceder.
- Usuario no puede leer otra congregacion.
- Admin puede crear usuario.
- Supervisor solo puede hacer lo permitido.
- Usuario normal no puede editar roles.
- Encargado puede gestionar su modulo.
- Congregacion suspendida bloquea acceso.

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
