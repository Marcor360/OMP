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

### Bloqueador actual de Rules permitidas

Trece pruebas de casos **permitidos** permanecen en `skip` porque la evaluación
de Rules supera el máximo real de 1,000 expresiones. No deben habilitarse hasta
reducir el coste de las Rules; hacerlas pasar ignorando ese error ocultaría una
denegación real en producción.

Plan obligatorio antes de retirar los `skip`:

1. Medir cada operación permitida con un fixture mínimo en el emulador.
2. Simplificar predicados compartidos de acceso y escritura administrativa,
   evitando reevaluar el mismo documento/permisos en cada validación.
3. Mantener sin cambios la semántica de aislamiento por `congregationId` y los
   denies existentes.
4. Volver a activar una prueba permitida por vez y ejecutar `npm run test:rules`.
5. Desplegar Rules e índices juntos sólo después de que todas las pruebas de
   allow y deny estén verdes.

También queda pendiente:

- Crear/editar/eliminar por rol y por módulo.

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
