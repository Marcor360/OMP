# Planes por congregacion

Los datos privados del plan viven en:

```text
/congregations/{congregationId}/private/plan
```

Campos recomendados:

```json
{
  "planId": "basic",
  "activeUsersLimit": 70,
  "updatedAt": "server timestamp"
}
```

Planes:

- `basic`: OMP Basico, hasta 70 usuarios activos, $69 MXN/mes.
- `intermediate`: OMP Intermedio, hasta 120 usuarios activos, $109 MXN/mes.
- `complete`: OMP Completo, hasta 200 usuarios activos, $159 MXN/mes.

Reglas actuales:

- Solo ancianos activos de la misma congregacion pueden leer el documento privado.
- La escritura directa esta bloqueada; debe hacerse desde consola segura, panel administrativo externo o Cloud Functions administrativas.
- `createUserByAdmin` bloquea crear usuarios activos si la congregacion ya alcanzo el limite.

Pendientes tecnicos:

- Panel administrativo externo para crear/gestionar congregaciones y actualizar `/private/plan`.
- Metricas agregadas historicas por congregacion.
- Enforcement completo de App Check en Functions cuando los clientes esten configurados.
- Auditoria de listeners `onSnapshot` restantes para convertir vistas no criticas a lecturas bajo demanda.
