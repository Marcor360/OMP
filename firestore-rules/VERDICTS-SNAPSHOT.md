# Snapshot de veredictos — Firestore Rules

**Estado: NO EJECUTADO.** Este entorno de trabajo solo tiene Java 17
instalado; `firebase-tools@15.22.3` requiere Java 21+ para el emulador de
Firestore, así que `npm run test:rules` no pudo correrse aquí (ver
`docs/firestore-rules-build.md`, sección "Limitación conocida de Java").

Este documento es el registro de qué se espera que pase/falle según la
lectura del texto de `firestore.rules`, **no** una captura real de la
ejecución del emulador. Sirve como:

1. Congelamiento del comportamiento pretendido *antes* del split a
   `firestore-rules/src/` (paso 1 de la tarea).
2. Checklist para que confirmes con una corrida real (`npm run test:rules`
   en un entorno con Java 21+, o en el job `rules` de CI ya corregido).

## Cómo usarlo

Corre:

```
npm run test:rules
```

Todos los `it(...)` listados abajo deben pasar (columna "Esperado" dice
si la aserción interna es `assertSucceeds` o `assertFails`; un test en
verde significa que la regla se comportó como se esperaba). Si algo falla,
compáralo contra la columna "Esperado" — un fallo indica una divergencia
entre lo que el texto de las reglas dice y lo que el emulador realmente
hace (o un bug en el test), no asumas automáticamente que el test está
mal.

Ejecuta esto **antes** de tocar `firestore-rules/src/` (baseline) y otra
vez **después** de cualquier cambio a las fuentes, para confirmar
"mismos veredictos".

## Archivos ya existentes (no tocados en esta tarea)

- `users.rules.test.ts` — 12 casos (lectura propia/cruzada, roles,
  congregación suspendida, push tokens, departamentos/organigrama,
  auto-escalación, validación de permisos).
- `notifications.rules.test.ts` — 4 casos (marcar como leído, propio vs.
  ajeno, contenido inmutable).
- `events.rules.test.ts` — 10 casos, la matriz de contrato del dominio
  avisos/eventos contra `firestore-rules/fixtures/avisos.capability-cases.json`
  (Paquete 3, ya en `main`).

## Archivos nuevos de esta tarea

### `users-permissions.rules.test.ts` — dominio usuarios (gaps)

| Caso | Esperado |
|---|---|
| `permissions.usuarios.view` lee perfiles de su congregación | succeeds |
| `permissions.usuarios.view` no cruza congregación | fails |
| `permissions.usuarios.view` inactivo no lee | fails |
| `permissions.usuarios.view` no permite editar | fails |
| admin regular no puede crear usuario directo (solo Functions) | fails |
| admin regular no puede eliminar usuario directo (solo Functions) | fails |
| superadmin puede crear y eliminar usuario directo | succeeds (create y delete) |

### `events-domain.rules.test.ts` — dominio avisos/eventos (aislamiento)

| Caso | Esperado |
|---|---|
| admin activo crea evento en su congregación | succeeds |
| admin no crea evento marcado con otra congregación | fails |
| admin de otra congregación no lee el evento | fails |
| admin inactivo no crea eventos | fails |

*(No hay caso "solo-Functions" para eventos: las reglas permiten
legítimamente escritura directa del cliente cuando `canManageEvents()` se
cumple — ver nota en el propio archivo de test.)*

### `meetings.rules.test.ts` — dominio reuniones

| Caso | Esperado |
|---|---|
| admin crea reunión en su congregación | succeeds |
| admin no crea reunión bajo otra congregación | fails |
| admin inactivo no crea reunión | fails |
| `permissions.reuniones.manage` crea reunión | succeeds |
| usuario sin permiso no crea reunión | fails |
| nadie escribe directo en `meetings/{id}/assignments` (ni admin) | fails |

### `assignments.rules.test.ts` — dominio asignaciones

| Caso | Esperado |
|---|---|
| admin crea asignación en su congregación | succeeds |
| admin no crea asignación marcada con otra congregación | fails |
| admin inactivo no crea asignación | fails |
| `permissions.asignaciones.manage` crea asignación | succeeds |
| usuario sin permiso no crea asignación | fails |
| nadie escribe directo en `outgoingTalks` (ni admin) | fails |

### `cleaning.rules.test.ts` — dominio limpieza

| Caso | Esperado |
|---|---|
| admin crea grupo de limpieza en su congregación | succeeds |
| admin no crea grupo marcado con otra congregación | fails |
| admin inactivo no crea grupo | fails |
| `permissions.limpieza.manage` crea grupo | succeeds |
| usuario sin permiso no crea grupo | fails |
| nadie lee la colección raíz legacy `cleaningGroups` (ni admin) | fails |
| nadie escribe la colección raíz legacy `cleaningGroups` (ni admin) | fails |

### `territories.rules.test.ts` — dominio territorios

| Caso | Esperado |
|---|---|
| admin crea territorio en su congregación | succeeds |
| admin no crea territorio marcado con otra congregación | fails |
| admin inactivo no crea territorio | fails |
| `permissions.predicacion.territories.create` crea territorio | succeeds |
| usuario sin permiso no crea territorio | fails |
| nadie borra un territorio directamente (ni admin) — solo se desactiva | fails |

### `notifications-permissions.rules.test.ts` — dominio notificaciones (gaps)

| Caso | Esperado |
|---|---|
| admin crea notificación en su congregación | succeeds |
| admin no crea notificación marcada con otra congregación | fails |
| admin inactivo no crea notificación | fails |
| `permissions.avisos.create` crea notificación | succeeds |
| usuario sin permiso no crea notificación | fails |
| admin regular no lee la colección raíz `/notifications` | fails |
| admin regular no escribe la colección raíz `/notifications` | fails |
| superadmin lee y escribe la colección raíz `/notifications` | succeeds (get y create) |

### `billing.rules.test.ts` — dominio billing-lectura

| Caso | Esperado |
|---|---|
| admin lee el historial de facturación de su congregación | succeeds |
| `permissions.pagos.view` lee el historial | succeeds |
| usuario sin permiso no lee el historial | fails |
| admin de otra congregación no lee el historial | fails |
| admin inactivo no lee el historial | fails |
| nadie crea un evento de facturación directo (ni admin) | fails |
| nadie actualiza un evento de facturación directo (ni admin) | fails |
| nadie elimina un evento de facturación directo (ni admin) | fails |

## Total

- 3 archivos existentes: 26 casos (sin cambios).
- 8 archivos nuevos: 46 casos.
- **72 casos de contrato en total** cubriendo los 8 dominios pedidos.

## Verificación pendiente (marca cuando corras `npm run test:rules`)

- [ ] Corrida baseline en la rama `main` (antes de cualquier cambio a
      `firestore-rules/src/`), todos los 72 casos en verde.
- [ ] Corrida después de aceptar el split a `firestore-rules/src/`
      (esta misma rama), los mismos 72 casos en verde con los mismos
      veredictos.
