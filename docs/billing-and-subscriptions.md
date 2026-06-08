# Cobros Y Suscripciones

El cobro de OMP es por congregacion, no por usuario individual. Los limites se aplican a usuarios activos y el estado real de pago se sincroniza desde Stripe mediante webhook.

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

Para el Customer Portal, activarlo desde Stripe Dashboard en modo prueba antes de usar `createStripePortalSession`. El portal debe permitir actualizar metodo de pago y consultar facturas.

## Cloud Functions

- `createStripeCheckoutSession`: callable autenticado. Valida congregacion, permisos de pago y exencion. Crea/reutiliza `stripeCustomerId` y devuelve la URL de Checkout.
- `createStripePortalSession`: callable autenticado. Valida congregacion, permisos de pago y que exista `stripeCustomerId`. Devuelve la URL del portal de facturacion.
- `getStripeBillingUsage`: callable autenticado. Devuelve solo el conteo de usuarios activos para la pantalla de billing.
- `stripeWebhook`: endpoint HTTP que verifica firma de Stripe y actualiza `congregations/{congregationId}.billing`.
- `sendBillingPaymentReminders`: programada diaria. Revisa congregaciones con `billing.enabled` y omite `billingExemption.exempt`.

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
  provider: 'stripe';
  status: string;
  planKey: 'omp_80' | 'omp_150' | 'omp_250';
  billingDay: 1;
  billingCycle: 'monthly';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  currentPeriodStart?: Timestamp;
  currentPeriodEnd?: Timestamp;
  nextPaymentDate?: Timestamp;
  cancelAtPeriodEnd?: boolean;
  lastPaymentStatus?: string;
  lastInvoiceUrl?: string;
}
```

Exenciones:

```ts
billingExemption: {
  exempt: boolean;
  reason?: string;
  grantedBy?: string;
  grantedAt?: Timestamp;
}
```

Si `billingExemption.exempt` es `true`, no se inicia Checkout, no se bloquea acceso y no se envian recordatorios.

## Flujo De Prueba

1. Configurar secrets y desplegar Functions.
2. Crear el webhook en Stripe con el endpoint anterior y copiar el signing secret a `STRIPE_WEBHOOK_SECRET`.
3. Entrar a `/billing` con un usuario de la congregacion con permiso `pagos.create`, `pagos.manage`, coordinador o encargado de tesoreria.
4. Elegir un plan y pagar con tarjeta de prueba `4242 4242 4242 4242`, cualquier fecha futura y CVC.
5. Volver a `/billing/success`.
6. Confirmar que el webhook actualizo `congregations/{id}.billing.status`, `stripeSubscriptionId`, periodo y `nextPaymentDate`.

La pantalla de exito no confirma el pago por si misma; Firestore se considera la fuente de verdad despues del webhook.
