# Seguridad Firestore

Firestore Rules son la barrera real para los datos leídos o escritos por clientes. La UI solo mejora la experiencia; no reemplaza la autorización.

## Principios

- Exigir autenticación para datos protegidos.
- Usar `/users/{uid}` como fuente de rol, estado y congregación.
- Validar la misma congregación en lecturas y escrituras.
- Mantener `/system/{docId}` sin escritura cliente y `dashboardSummary` como solo lectura cliente.
- Ejecutar operaciones administrativas sensibles mediante Cloud Functions.

## Índices `collectionGroup`

Las consultas `collectionGroup()` requieren índice con alcance `COLLECTION_GROUP`; los índices automáticos con alcance `COLLECTION` no bastan. Todo `fieldOverride` conserva además ASC/DESC de `COLLECTION` para no romper consultas normales.

Inventario auditado:

| Proceso | Grupo y campos |
|---|---|
| Limpieza de datos | `reuniones.endDate`, `assignments.dueDate`, `asignaciones.dueDate`, `meetings.meetingDate/endDate/startDate`, `tareas.dueDate`, `tasks.dueDate`, `archivos.endDate`, `files.endDate` |
| Limpieza de notificaciones | `notifications.createdAt` |
| Recordatorios de reuniones | `meetings.meetingDate` |
| Limpieza de facturación | `billingHistory.createdAt` |

Las eliminaciones relacionadas con eventos, reuniones y asignaciones consultan ahora la subcolección de la congregación conocida. No hacen búsquedas globales por identificadores que pueden repetirse entre congregaciones. `metadata.meetingDate` es `Timestamp`; `metadata.meetingDateLabel` es solo presentación. El campo legado localizado `metadata.date` no se usa para consultas.

`scheduledDataCleanup` tiene un mapa explícito colección→campos, pagina en lotes y continúa si un campo falla. Su resumen registra por campo documentos, archivos, notificaciones, errores, índices faltantes y duración.

## Guard de CI

`npm run check:indexes` compara el inventario auditado con `firestore.indexes.json`. Los argumentos dinámicos fallan salvo que su archivo y referencia estén en la allowlist explícita. El guard forma parte de `npm run validate` y tiene una autoprueba para el contrato de usos dinámicos.

## Despliegue seguro

1. Ejecutar `npm run check:indexes`, pruebas, lint y builds.
2. Desplegar solo índices: `firebase deploy --only firestore:indexes --project ormeprassig-public`.
3. Esperar a que todos estén en estado `READY` en Firestore.
4. Después desplegar Functions.
5. Verificar en Cloud Logging cada proceso programado: campos procesados, paginación, errores, índices faltantes y aislamiento por congregación.

No se deben desplegar Functions que dependan de índices mientras alguno siga construyéndose.

## Usuarios y roles legacy

Las escrituras administrativas de `/users/{uid}` se realizan mediante Cloud Functions. El cliente solo conserva actualizaciones del perfil propio, tokens push y campos operativos expresamente limitados. Los indicadores `protectedFromDeletion`, `isSystemUser`, `isPrimaryAdmin`, `isRootAdmin` y `systemProtected` son autoridad backend; nombres, correos y campos `createdBy*` nunca identifican usuarios protegidos.

`administrador` y `usuario` siguen aceptándose únicamente al leer documentos legacy en Rules y normalizadores. Las Functions de creación escriben exclusivamente `admin`, `supervisor` o `user`. Antes de retirar la compatibilidad se debe migrar cada documento existente, confirmar que no quedan roles legacy y ejecutar las pruebas de Rules para usuario propio, misma/otra congregación, usuarios inactivos y todos los roles.

La estructura completa de `serviceAssignments`, sus combinaciones, duplicados y unicidad congregacional se valida en `createUserByAdmin` y `updateUserByAdmin`. Rules bloquea su modificación directa: esta validación es deliberadamente backend porque Firestore Rules no puede comprobar de forma segura unicidad entre documentos ni listas complejas arbitrarias.
