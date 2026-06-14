# Cobros Y Suscripciones

El cobro de OMP es por congregacion, no por usuario individual. Solo se usa Stripe Billing; no existen pagos manuales, transferencias, depositos, efectivo ni `provider: "manual"`. Los limites se aplican a usuarios activos y el estado real de pago se sincroniza desde Stripe mediante webhook.

## Planes

| Plan | Usuarios activos | Precio mensual |
| --- | ---: | ---: |
| `omp_80` | 80 | 70 MXN |
| `omp_150` | 150 | 120 MXN |
| `omp_250` | 250 | 200 MXN |

## Firebase Functions Secrets

Configurar los valores con Firebase Functions v2 secrets. No usar `EXPO_PUBLIC` ni variables del cliente para llaves privadas.

```bash
npx -y firebase-tools@latest functions:secrets:set STRIPE_SECRET_KEY
npx -y firebase-tools@latest functions:secrets:set STRIPE_WEBHOOK_SECRET
npx -y firebase-tools@latest functions:secrets:set STRIPE_PRICE_OMP_80
npx -y firebase-tools@latest functions:secrets:set STRIPE_PRICE_OMP_150
npx -y firebase-tools@latest functions:secrets:set STRIPE_PRICE_OMP_250
npx -y firebase-tools@latest functions:secrets:set APP_BILLING_RETURN_URL
```

Valores de prueba:

```bash
STRIPE_PRICE_OMP_80=price_1Tfr4rBNusNy7pYKEQ7ACpWM
STRIPE_PRICE_OMP_150=price_1Tf4rBNusNy7pYKXPJFlhLwo
STRIPE_PRICE_OMP_250=price_1Tfr4rBNusNy7pYKS7XQFqWA
APP_BILLING_RETURN_URL=https://app.ompsuite.com/billing
```

La clave publicable `pk_test_...` no se usa en esta integracion principal porque OMP no captura tarjetas ni inicializa Stripe desde React/Expo. Checkout se crea en Cloud Functions y el cliente solo abre la URL devuelta. No guardar `pk_test_...` como `STRIPE_SECRET_KEY`; `STRIPE_SECRET_KEY` debe ser una clave rotada `sk_test_...` o `sk_live_...` del mismo entorno donde existen los `price_id`.

Despues de crear el webhook en Stripe, guardar tambien el signing secret `whsec_...`:

```bash
npx -y firebase-tools@latest functions:secrets:set STRIPE_WEBHOOK_SECRET
npx -y firebase-tools@latest deploy --only functions
```

Para el Customer Portal, activarlo desde Stripe Dashboard en modo prueba antes de usar `createStripePortalSession`. El portal debe permitir actualizar metodo de pago y consultar facturas. No activar cambio de plan ni cancelacion de suscripcion desde Customer Portal en esta fase.

## Cloud Functions

- `createStripeCheckoutSession`: callable autenticado. Valida congregacion, permisos de pago y exencion. Crea/reutiliza `stripeCustomerId` y devuelve la URL de Checkout.
- `createStripePortalSession`: callable autenticado. Valida congregacion, permisos de pago y que exista `stripeCustomerId`. Devuelve la URL del portal de facturacion.
- `getStripeBillingUsage`: callable autenticado. Devuelve solo el conteo de usuarios activos para la pantalla de billing.
- `stripeWebhook`: endpoint HTTP que verifica firma de Stripe y actualiza `congregations/{congregationId}.billing`.
- `sendBillingPaymentReminders`: programada diaria. Revisa congregaciones con `billing.enabled` y omite `billingExemption.exempt`.
- `scheduledBillingHistoryCleanup`: programada diaria. Borra historial de eventos Stripe con mas de 365 dias.

Webhook sugerido:

```text
https://us-central1-ormeprassig-public.cloudfunctions.net/stripeWebhook
```

Eventos a activar en Stripe:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
invoice.payment_action_required
```

## Modelo Firestore

Campo en `congregations/{congregationId}`:

```ts
billing: {
  enabled: boolean;
  provider: 'stripe' | 'exempt';
  status: 'active' | 'trialing' | 'past_due' | 'unpaid' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'payment_action_required' | 'exempt' | string;
  planKey: 'omp_80' | 'omp_150' | 'omp_250';
  activeUsersLimit: number;
  userLimit: number;
  billingDay: 1;
  billingCycle: 'monthly';
  graceDays: 5;
  graceStartedAt?: Timestamp | null;
  graceUntil?: Timestamp | null;
  adminRestricted?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  currentPeriodStart?: Timestamp;
  currentPeriodEnd?: Timestamp;
  nextPaymentDate?: Timestamp;
  cancelAtPeriodEnd?: boolean;
  lastPaymentStatus?: string;
  lastInvoiceId?: string;
  lastInvoiceUrl?: string;
  lastStripeEventId?: string;
}
```

Exenciones:

```ts
billingExemption: {
  exempt: boolean;
  reason?: string;
  grantedBy?: string;
  grantedAt?: Timestamp;
  expiresAt?: Timestamp | null;
}
```

Si `billingExemption.exempt` es `true`, no se inicia Checkout, no se bloquea acceso y no se envian recordatorios. En ese caso el cliente muestra estado exento y las funciones reflejan `billing.provider = "exempt"` y `billing.status = "exempt"` cuando se intenta iniciar un flujo de cobro.

Historial de eventos Stripe:

```ts
congregations/{congregationId}/billingHistory/{stripeEventId}: {
  provider: 'stripe';
  type: string;
  status: string;
  amount?: number | null;
  currency: 'MXN' | string;
  planKey?: 'omp_80' | 'omp_150' | 'omp_250' | null;
  stripeEventId: string;
  stripeInvoiceId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  hostedInvoiceUrl?: string | null;
  createdAt: Timestamp;
  processedAt: Timestamp;
}
```

Se conserva como maximo 1 año mediante `scheduledBillingHistoryCleanup`.

## Permisos

Pueden pagar y abrir Customer Portal:

- Coordinador.
- Secretario.
- Encargado de tesoreria.
- Auxiliar de tesoreria solo con permiso explicito `pagos.create` o `pagos.manage`.
- Cualquier usuario con permiso explicito `pagos.create` o `pagos.manage`.

Pueden ver alertas/estado:

- Todos los administradores.
- Coordinador.
- Secretario.
- Encargado de tesoreria.
- Auxiliar de tesoreria.
- Usuarios con `pagos.view` o `pagos.manage`.

Un administrador sin cargo o permiso de billing ve alertas informativas, pero no ve acciones de pago ni puede abrir el portal.

## Estados Y Gracia

- `active` y `trialing`: acceso normal.
- `past_due`, `payment_action_required` e `incomplete`: 5 dias de gracia. Se muestran alertas persistentes.
- Vencida la gracia, `billing.adminRestricted` o `billing.graceUntil` bloquean escrituras administrativas sensibles en Firestore Rules y Cloud Functions de usuarios.
- `unpaid`, `canceled` e `incomplete_expired`: restricciones administrativas inmediatas.
- `exempt`: acceso normal, sin alertas ni acciones de pago.

## Flujo De Prueba

1. Configurar secrets y desplegar Functions.
2. Crear el webhook en Stripe con el endpoint anterior y copiar el signing secret a `STRIPE_WEBHOOK_SECRET`.
3. Activar Stripe Customer Portal en Stripe Dashboard. Permitir al menos actualizacion de metodo de pago y consulta de facturas.
4. Entrar a `/billing` con un usuario de la congregacion con permiso `pagos.create`, `pagos.manage`, coordinador, secretario o encargado de tesoreria.
5. Elegir un plan y pagar con tarjeta de prueba `4242 4242 4242 4242`, cualquier fecha futura, CVC cualquiera y codigo postal valido.
6. Volver a `/billing/success`.
7. Confirmar que el webhook actualizo `congregations/{id}.billing.status`, `stripeSubscriptionId`, periodo y `nextPaymentDate`.
8. Confirmar que se creo `congregations/{id}/billingHistory/{evt_...}`.
9. Probar Customer Portal desde `/billing` con una congregacion que ya tenga `stripeCustomerId`.

La pantalla de exito no confirma el pago por si misma; Firestore se considera la fuente de verdad despues del webhook.

## Migracion De Campos Antiguos

Los planes actuales son `omp_80`, `omp_150` y `omp_250`. Si existen documentos antiguos con limites 70, 120 o 200 usuarios por planes anteriores, migrarlos a:

- 70 usuarios anteriores -> revisar manualmente y asignar `omp_80` si corresponde.
- 120 usuarios anteriores -> `omp_150`.
- 200 usuarios anteriores -> `omp_250`.

Mantener `activeUsersLimit` y `userLimit` sincronizados durante la migracion para compatibilidad con pantallas antiguas y nuevas.
