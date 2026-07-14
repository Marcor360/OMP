# Seguridad Firestore

Firestore Rules son la barrera real para datos leidos o escritos por cliente. La UI solo mejora experiencia y reduce acciones visibles.

## Principios

- Requerir autenticacion para datos protegidos.
- Usar `/users/{uid}` como fuente de rol, estado activo y congregacion.
- Validar misma congregacion en lecturas y escrituras.
- Bloquear escrituras directas a campos sensibles.
- Mantener `/system/{docId}` sin escritura cliente.
- Mantener `dashboardSummary` como lectura cliente y escritura backend.
- Push tokens solo bajo `/users/{uid}/pushTokens`.

## Acciones Sensibles

Deben pasar por Cloud Functions:

- Crear usuarios.
- Actualizar roles.
- Cambiar permisos.
- Desactivar usuarios.
- Eliminar usuarios.
- Cambiar planes.
- Registrar pagos.
- Activar o suspender congregaciones.
- Publicar reuniones si dispara sincronizacion o notificaciones.

## Auditoria Requerida

Antes de endurecer reglas:

- Comparar reglas `create` y `update`.
- Revisar que la autoridad no venga de `request.resource.data` en campos sensibles.
- Validar tipos y limites de strings/listas.
- Confirmar que cada write valida identidad y congregacion.
- Probar usuario activo, inactivo, otra congregacion, admin, supervisor y usuario normal.

## Riesgo Actual Con Roles Legacy

Las reglas aun aceptan `administrador` y `usuario` por compatibilidad. Esto debe eliminarse despues de una migracion real de datos; hacerlo antes puede bloquear cuentas antiguas.

## Índices collectionGroup

### Por qué esto es distinto de un índice normal

Firestore crea automáticamente índices de un solo campo (ASC/DESC) con **scope `COLLECTION`** para todo campo, en todo momento, sin configuración. Ese automatismo **no** cubre `collectionGroup()`: una query `collectionGroup(x).where(campo, ...)` o `.orderBy(campo, ...)` exige que ese campo tenga scope `COLLECTION_GROUP` habilitado explícitamente — vía un `fieldOverride` en `firestore.indexes.json`, o vía un índice compuesto con `"queryScope": "COLLECTION_GROUP"`. Sin eso, la query falla con `FAILED_PRECONDITION` en cada ejecución, sin importar si hay documentos que la satisfagan.

**Cuidado al declarar un `fieldOverride` a mano:** declarar el override para un campo reemplaza por completo su indexación automática. Si ese campo ya se usa en queries `COLLECTION` (no-group) en el cliente, hay que incluir también las entradas `COLLECTION` ASC/DESC en el mismo override, o esas queries se rompen. Por eso el flujo correcto es: 1) exportar el estado real de consola con `npx firebase firestore:indexes --project ormeprassig-public > firestore.indexes.json`, 2) revisar el diff, 3) si falta cobertura, agregar el override manualmente incluyendo scope `COLLECTION` + `COLLECTION_GROUP`.

### Incidente confirmado (2026-07-13)

Una auditoría inicial asumía que el proyecto `ormeprassig-public` tenía índices `COLLECTION_GROUP` creados en consola (por links de error) pero nunca exportados al repo. **Eso era falso**: el export directo de consola (`firebase firestore:indexes`) resultó idéntico al repo — 17 índices `COLLECTION`, cero `COLLECTION_GROUP`, `fieldOverrides: []`. Se verificó con `gcloud logging read` contra los logs reales de Cloud Functions que esto es una **falla de producción activa**, no un riesgo latente:

| Función | `collectionGroup(...)`.campo | Estado confirmado en logs |
|---|---|---|
| `scheduledBillingHistoryCleanup` | `billingHistory.createdAt` | Falla **todos los días** desde antes del 2026-07-06 |
| `sendMeetingReminderThreeDaysBefore` | `meetings.meetingDate` | Falla **todos los días** — los recordatorios de reunión a 3 días **no se han enviado nunca** |
| `scheduledNotificationsCleanup` | `notifications.createdAt` | Falla en la primera query y crashea la función completa; nunca llega a probar `metadata.date` |
| `scheduledEventsCleanup` → `deleteRelatedNotifications` | `notifications.eventId` | Falla diariamente desde ~2026-06-29 (cuando empezó a encontrar eventos vencidos que limpiar) |
| `scheduledDataCleanup` (mensual, día 1) | `{reuniones,assignments,asignaciones,meetings,tareas,tasks,archivos,files}.endDate` | **Las 8 colecciones fallan** en la ejecución del 2026-07-01 (confirmado vía `gcloud logging read`, no solo por `firebase functions:log` que es más flaky/no determinístico en qué ventana de logs devuelve) |

`scheduledDataCleanup` atrapa el error por colección y continúa con la siguiente (por eso "corre" sin marcarse como fallida en Cloud Scheduler), pero **no limpia nada** desde que se desplegó: el loop interno prueba `endDate` primero en `DATE_FIELD_CANDIDATES` y siempre truena ahí, así que los otros 5 campos de fecha (`meetingDate`, `startDate`, `dueDate`, `date`, `scheduledAt`) nunca se llegan a ejecutar para ninguna de las 8 colecciones — su estado de indexación real es desconocido.

**Fix aplicado (alcance acotado a lo confirmado por logs):** se agregaron 12 `fieldOverrides` a `firestore.indexes.json` (scope `COLLECTION` ASC+DESC preservado + `COLLECTION_GROUP` ASC agregado) para: `billingHistory.createdAt`, `meetings.meetingDate`, `meetings.endDate`, `notifications.createdAt`, `notifications.eventId`, y `endDate` en las 8 colecciones de `TARGET_COLLECTION_IDS`.

**Pendiente, no cubierto en este fix** (nunca confirmado por logs porque el código nunca llega a ejecutar esas queries; se espera que empiecen a fallar con su propio `FAILED_PRECONDITION` apenas se despliegue el fix de `endDate` y el loop avance):
- `notifications.assignmentId` (igualdad y rango+orderBy, `scheduled-data-cleanup.ts`)
- `notifications.metadata.meetingId` (`scheduled-data-cleanup.ts`)
- `notifications.metadata.date` (`scheduled-notifications-cleanup.ts`, segunda query)
- `meetingDate`, `startDate`, `dueDate`, `date`, `scheduledAt` en las 8 colecciones de `TARGET_COLLECTION_IDS` (`scheduled-data-cleanup.ts`)

Cuando cualquiera de estos aparezca en logs con su propio link de `FAILED_PRECONDITION`, agregar el `fieldOverride` correspondiente y re-exportar para confirmar.

### Guard de CI

`npm run check:indexes` (`scripts/check-collection-group-indexes.mjs`) escanea `functions/src/**/*.ts` en busca de `collectionGroup(...)`, resuelve constantes (incluso importadas de otro archivo) de mejor esfuerzo, y falla si falta cobertura `COLLECTION_GROUP` para una colección usada, o si falta alguno de los campos requeridos listados en `REQUIRED_FIELDS` dentro del script. Argumentos dinámicos (ej. `params.collectionId` en `scheduled-data-cleanup.ts`) se listan pero no bloquean el build — se corren en el CI job `rules` antes del emulador.

### Procedimiento de export

```powershell
npx firebase firestore:indexes --project ormeprassig-public > firestore.indexes.json
```

Revisar el diff antes de commitear: no debe desaparecer ningún índice existente. Si falta un índice `COLLECTION_GROUP` que una query necesita, no inventarlo — dispararlo una vez (emulador o logs de producción) y usar el link `FAILED_PRECONDITION` para crearlo en consola, luego re-exportar.
