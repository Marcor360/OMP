# Plan: Consolidación de grupos de limpieza

## Problema

Los grupos de limpieza viven hoy en **4 rutas** distintas, mezclando dos
convenciones de nombres y dos ubicaciones:

| Ruta | Tipo | Estado |
| --- | --- | --- |
| `congregations/{cid}/cleaningGroups` | Canónica (scoped, camelCase) | **Destino** |
| `congregations/{cid}/cleaning_groups` | Legacy anidada (snake_case) | A drenar |
| `cleaningGroups` (raíz) | Legacy global | A drenar (bloqueada para clientes) |
| `cleaning_groups` (raíz) | Legacy global | A drenar (bloqueada para clientes) |

El cliente (`cleaning-service.ts`) lee con una **cadena de fallback** que devuelve
el **primer modo no vacío**, no la unión. Riesgo real: una congregación con datos
solo en legacy "pierde de vista" esos grupos en cuanto alguien crea uno nuevo
(que cae en la canónica), porque la siguiente lectura devuelve solo la canónica.

Las colecciones raíz ya están **cerradas por reglas** (`allow read, write: if false`),
pero los datos pueden seguir existiendo físicamente; solo el Admin SDK puede leerlos.

## Objetivo

Que **toda** la data viva en `congregations/{cid}/cleaningGroups`, preservando los
doc id (los usuarios referencian `cleaningGroupId`), para luego poder retirar el
código de fallback y las rutas legacy.

## Restricciones de seguridad detectadas

- Las reglas validan `hasOnlyKeys(request.resource.data, allowedCleaningGroupKeys())`
  en **cada update**, sobre el documento completo resultante. Por eso la migración
  escribe **solo las claves permitidas** y **no** añade marcadores (`migratedFrom`,
  etc.) al doc: hacerlo rompería todo update posterior del cliente.
- La migración **normaliza** invariantes exigidos por `validCleaningGroupData`
  (`memberCount == memberIds.length`, `groupType ∈ {standard, family}`, timestamps),
  dejando los docs editables por el cliente sin violar reglas.
- No hay subcolecciones bajo un grupo (membresía denormalizada en `memberIds` +
  `users.cleaningGroupId`), así que es una copia plana de documentos.

## Fases

### Fase 1 — Consolidación de datos (este paso)
- Script: `functions/scripts/consolidate-cleaning-groups.js`.
- **DRY RUN por defecto**, no destructivo, idempotente.
- Drena las 3 rutas legacy hacia la canónica preservando id; la canónica gana ante
  colisiones de id; reporta huérfanos (congregationId inexistente).

```bash
# 1) Vista previa (no escribe nada)
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
  node functions/scripts/consolidate-cleaning-groups.js

# 2) Revisar el log: MIGRATE / SKIP / WARN / HUERFANOS y el RESUMEN.
# 3) Aplicar
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
  node functions/scripts/consolidate-cleaning-groups.js --write
```

### Fase 2 — Verificación (manual, antes de tocar código)
- Confirmar en consola/app que cada congregación ve el conjunto completo de grupos.
- Revisar manualmente los `WARN` (grupos sin nombre) y los `HUERFANOS`.
- Confirmar que `users.cleaningGroupId` sigue resolviendo (id preservado).

### Fase 3 — Simplificación del código (PR posterior, tras verificar)
- `cleaning-service.ts`: eliminar `CleaningGroupStorageMode`, la cadena de fallback
  y los refs de raíz; dejar **solo** `congregations/{cid}/cleaningGroups`.
- `functions/src/cleaning.ts`: `listCleaningGroupsForCurrentUser` lee solo la canónica.
- `src/lib/firebase/refs.ts`: borrar `cleaningGroupsCollectionRef`/`cleaningGroupDocRef`
  (refs de raíz, hoy código muerto que apunta a colecciones bloqueadas).

### Fase 4 — Limpieza de legacy (PR posterior, tras un periodo de gracia)
- Script de borrado de docs legacy (las 3 rutas), también dry-run primero.
- Retirar de `firestore.rules` los match de `cleaning_groups` anidado y los de raíz.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Pérdida de datos | Script no destructivo; legacy permanece como respaldo hasta Fase 4. |
| Doc migrado no editable por reglas | Se escribe solo con claves permitidas y normalizadas. |
| Rotura de referencias de usuario | Se preserva el doc id en todas las copias. |
| Grupos huérfanos | Reportados explícitamente; no se migran en silencio. |
| Colisión de id con distinta data | La canónica gana; se registra SKIP para revisión. |

## No incluido aquí
- No se modifica `cleaning-service.ts`, `firestore.rules` ni `refs.ts` en este paso.
- No se borra ningún dato legacy.
