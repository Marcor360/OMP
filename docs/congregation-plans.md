# Planes Por Congregacion

La fuente vigente del plan vive en el documento de la congregacion:

```text
/congregations/{congregationId}.billing
```

Campos relevantes:

```ts
billing: {
  provider: 'stripe' | 'exempt';
  status: string;
  planKey: 'omp_80' | 'omp_150' | 'omp_250';
  activeUsersLimit: number;
  userLimit: number;
}
```

Planes vigentes:

| Plan | Usuarios activos | Precio mensual |
| --- | ---: | ---: |
| `omp_80` | 80 | 70 MXN |
| `omp_150` | 120 | 120 MXN |
| `omp_250` | 200 | 200 MXN |

## Compatibilidad

El documento legacy `/congregations/{congregationId}/private/plan` ya no debe ser la fuente principal. El cliente y `createUserByAdmin` lo leen solamente como fallback para datos antiguos.

Valores antiguos que deben migrarse:

| Legacy | Actual |
| --- | --- |
| `basic` / 70 usuarios | `omp_80` |
| `intermediate` | `omp_150` |
| `complete` | `omp_250` |

Durante la migracion, mantener `activeUsersLimit` y `userLimit` sincronizados para no romper pantallas antiguas ni validaciones backend.

## Reglas Actuales

- El limite se aplica sobre usuarios activos.
- `createUserByAdmin` bloquea crear usuarios activos si la congregacion ya alcanzo el limite.
- La escritura directa de planes desde cliente debe permanecer bloqueada; cambios de plan deben venir de Stripe webhook, consola segura, panel superadmin o script administrativo controlado.
- Congregaciones con `billingExemption.exempt === true` no se bloquean por cobro, pero deben conservar un limite de usuarios activo.

## Pendientes Tecnicos

- Ejecutar migracion real de documentos legacy.
- Confirmar que no quedan documentos con `basic`, `intermediate`, `complete` o 70 como limite vigente.
- Endurecer reglas y validaciones despues de confirmar la migracion.
- Panel administrativo externo para gestion de congregaciones, plan y billing.
- Enforcement gradual de App Check en Functions cuando Android, iOS y Web esten configurados.

## Script De Migracion

Hay un script administrativo local para normalizar roles y planes:

```bash
node functions/scripts/migrate-legacy-plans-and-roles.js
node functions/scripts/migrate-legacy-plans-and-roles.js --write
```

El primer comando es dry-run. Para aplicar cambios se requiere `--write` y credenciales administrativas de Firebase configuradas en el entorno local. No usar credenciales de servicio dentro del repositorio.
