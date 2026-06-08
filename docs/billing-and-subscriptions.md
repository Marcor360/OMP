# Cobros Y Suscripciones

El cobro es por congregacion, no por usuario individual. Los limites se aplican a usuarios activos.

## Planes Vigentes En Codigo

Segun las reglas del proyecto y `functions/src/users.ts`:

| Plan | Limite de usuarios activos |
| --- | ---: |
| OMP Basic | 70 |
| OMP Intermediate | 120 |
| OMP Complete | 200 |

`createUserByAdmin` bloquea crear usuarios activos cuando la congregacion alcanzo el limite de su plan.

## Pantalla De Planes

Debe mostrar:

- Plan actual.
- Usuarios activos.
- Cupo disponible.
- Fecha de proximo pago.
- Estado de pago.
- Accion de pago solo para autorizados.
- Avisos para administradores.

## Decisiones Pendientes

- Quien puede pagar.
- Quien recibe alertas.
- Dias de gracia despues del vencimiento.
- Como exentar cobro a congregaciones especiales.
- Como registrar pagos manuales.
- Como guardar historial.
- Si Stripe sera el proveedor principal.

## Seguridad

- Cambiar plan, registrar pagos y suspender/reactivar cobro debe vivir en Cloud Functions o panel superadmin.
- Congregaciones con cobro deshabilitado no deben mostrar deuda ni bloqueo de pago.
- No bloquear lecturas historicas por limite de asientos.
