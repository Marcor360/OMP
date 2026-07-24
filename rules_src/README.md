# rules_src/

`firestore.rules` es un artefacto generado. No lo edites a mano: edita el modulo
correspondiente aqui y corre `npm run build:rules`.

- `manifest.json` define el orden exacto de concatenacion. Es el orden que produce
  `firestore.rules` byte a byte; no lo reordenes salvo que sepas lo que haces.
- `build-rules.js` (raiz del repo) concatena los modulos, en ese orden, con
  join(''), sin separadores añadidos. Cada modulo ya trae su propio salto de linea
  final.
- `npm run check:rules` falla si `firestore.rules` no coincide exactamente con lo
  que generan estos modulos (alguien lo edito a mano, o un modulo quedo
  desactualizado).
- `npm run test:rules` corre `build:rules` primero, siempre. Nunca testees un
  archivo y despliegues otro.

## Mapa de modulos

| Modulo | Contenido |
|---|---|
| `00-header.rules` | `rules_version`, apertura de `service cloud.firestore` y `match /databases/{database}/documents` |
| `01-auth-current-user.rules` | Autenticacion y usuario actual: `isAuthenticated`, `currentUid`, `currentUserData`, `isSuperAdmin`, etc. |
| `02-base-validations.rules` | Validaciones base genericas: `hasOnlyKeys`, `hasAllKeys`, `sameKeysOnUpdate`, `preservesCreatedAt` |
| `03-roles-and-managers.rules` | Estado del usuario actual y gates de "manager" por departamento: `isActive`, `isAdmin`, `isCleaningManager`, `isPreachingManager`, `isMeetingsManager`, etc. |
| `04-department-permissions.rules` | `hasPermission`, permisos de territorios, `canManageDepartments`, `canManageTerritorySchedule`, `canManagePreachingGroups` |
| `05-billing-access.rules` | `canViewBillingData` — espejo de `functions/src/shared/billing-access.ts` |
| `06-user-permissions.rules` | `canReadUsers`, `canCreateUsers`, `canEditUsers`, `canDeleteUsers`, `canManageEvents`, `canManagePersons`, `canManageAssignments` |
| `07-congregation-access.rules` | Alcance de congregacion: `isSameUser`, `myCongregationId`, restricciones de facturacion, `administrativeWritesAllowed`, bloqueos de acceso |
| `08-users-validation.rules` | Validacion de datos de `/users`, eventos y tokens push |
| `09-congregations-validation.rules` | Validacion de `/congregations` |
| `10-persons-validation.rules` | Validacion de `/persons` |
| `11-meetings-validation.rules` | Validacion de `/meetings` |
| `12-assignments-territories-validation.rules` | Validacion de asignaciones sueltas y territorios |
| `13-preaching-territory-validation.rules` | Validacion de grupos de predicacion, asignaciones mensuales de territorio y calendario de territorios |
| `14-departments-validation.rules` | Validacion de departamentos y asignaciones de departamento |
| `15-cleaning-groups-validation.rules` | Validacion de grupos de limpieza |
| `16-notifications-outgoing-validation.rules` | Validacion de notificaciones y discursos salientes |
| `17-scheduling-validation.rules` | Validacion de calendarios de reuniones/limpieza/hospitalidad |
| `18-changelogs-preaching-report-validation.rules` | Validacion de `changeLogs` e informes de predicacion |
| `19-root-system-collections.rules` | Reglas de `/system`, `/systemAnnouncements`, `/superAdmins` |
| `20-root-users-events-collections.rules` | Reglas de `/events` y `/users` (con `pushTokens`, `viewedAnnouncements`, `private` anidados) |
| `21-congregations-people-meetings.rules` | Apertura de `/congregations/{congregationId}` y reglas de `persons`, `meetings` (+ `assignments` anidado), `assignments` suelto, `territories`, `preachingGroups`, `monthlyTerritoryAssignments`, `territorySchedule` |
| `22-congregations-tasks-schedules.rules` | Reglas de `outgoingTalks`, `cleaningGroups`/`cleaning_groups` (anidado), `cleaningSchedules`, `hospitalitySchedules` |
| `23-congregations-admin-billing.rules` | Reglas de `departments`, `departmentAssignments`, `notifications` (anidado), `preachingReports`, `billingHistory`, `changeLogs`, y cierre de `/congregations` |
| `24-root-misc-collections.rules` | `dashboardSummary`, `cleaningGroups`/`cleaning_groups` (raiz legacy), `notifications` (raiz), `stripeWebhookEvents`, cierre de `service cloud.firestore` |

Esta division sigue los encabezados `// ====...====` y `// ----...----` que ya
existian dentro del propio `firestore.rules` original; no se movio ni se reordeno
ninguna regla, solo se corto el archivo en los mismos puntos que ya marcaban esos
comentarios (mas algunos cortes adicionales dentro de las secciones mas grandes,
por tamaño de archivo).
