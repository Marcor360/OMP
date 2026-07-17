# Release Candidate Checklist — OMP

Criterio de cierre: **Stripe preparado, no activo.** No se exige
checkout/portal/renovación E2E de Stripe; sí se exige que el modo
"preparado" no rompa nada para congregaciones exentas.

**Cómo leer este documento:** cada ítem tiene un estado, la evidencia que
lo respalda (comando, archivo:línea, o "requiere acción humana"), y —
cuando aplica — qué falta para pasar de `⚠️` a `✅`. Nada está marcado
`✅` sin un comando o archivo verificable. Corre `npm run release:check`
para reproducir todos los checks automatizables de una vez.

Rama de referencia de esta auditoría: `docs/release-candidate-checklist`
(construida sobre `refactor/firestore-rules-modularization`, que a su vez
incluye `test(rules)` + `build(rules)`). El refactor de
`MeetingFormScreen` vive en `refactor/meeting-form-split`, una rama
hermana no fusionada aquí — ver nota en la sección Código.

Leyenda: ✅ verificado con evidencia · ⚠️ parcial / acción pendiente ·
❌ no verificado o bloqueado · 🔲 requiere acción humana (no automatizable)

---

## 1. Código

| Check | Estado | Evidencia |
|---|---|---|
| `npm run check:versions` | ✅ | `node scripts/check-versions.mjs` → `OK: package.json 1.13.4; app.json version 1.13.4; Android/iOS build 11304.` |
| `npm run validate` (lint+tsc+tests app, lint+build+tests functions, `build:rules:check`) | ✅ | Corrida completa en verde: 30/30 suites app (143 tests), 12/12 suites functions (137 tests), 0 errores lint/tsc. |
| `npm run test:rules` | ❌ **no verificado en este entorno** | `firebase-tools@15.22.3` requiere Java 21+; este entorno solo tiene Java 17. `npm run release:check` lo reporta como `SKIP`, no como `PASS`. **Acción pendiente:** correr en un entorno/CI con Java 21+ (ver más abajo, CI ya corregido) y pegar el resultado real aquí. |
| CI verde | ⚠️ **parcial** | El job `rules` de `.github/workflows/ci.yml` pedía Java 17 — con `firebase-tools@15.22.3` eso case casi seguro fallaba en cada corrida (mismo error que localmente). Corregido a Java 21 en `refactor/firestore-rules-modularization` (commit `abfd587`). **No hay una corrida de CI real después de este fix todavía** — hay que empujar la rama y confirmar el job `rules` en verde. |
| Ramas pendientes de fusionar | 🔲 | Este trabajo vive en 3 ramas locales sin push ni merge: `refactor/meeting-form-split`, `refactor/firestore-rules-modularization`, `docs/release-candidate-checklist` (esta). Ninguna está en `main`. El release candidate real necesita decidir el orden de merge antes de considerarse "código listo". |

**Automatización nueva:** `npm run release:check` (`scripts/release-readiness-check.mjs`) agrega 15 verificaciones (código, permisos, billing, versiones) en una sola corrida con resumen pass/fail/skip. Última corrida en este entorno: **13 pass, 1 skip (test:rules), 1 fail (tag git, ver sección Release)**.

---

## 2. Permisos — matriz del Paquete 5

**Estado: ⚠️ parcial — NO cumple "sin divergencias conocidas" todavía.**

Solo el dominio **avisos/eventos** está unificado y probado end-to-end:

| Capa | Archivo:línea | Estado |
|---|---|---|
| Frontend | `src/utils/permissions/permissions.ts:409` (`canManageEvents`) | ✅ delega en `src/shared/capabilities.ts` |
| Backend | `functions/src/events.ts` (`assertEventManager`) | ✅ delega en `functions/src/shared/capabilities.ts` |
| Rules | `firestore.rules` (`firestore-rules/src/21-validators-events.rules`, función `canManageEvents()`) | ✅ ya era correcta, ahora verificada por contrato |
| Tests de contrato | `src/shared/__tests__/capabilities.avisos.test.ts`, `functions/src/__tests__/capabilities.avisos.test.ts`, `firestore-rules/events.rules.test.ts` | ✅ 10 casos, mismo fixture (`firestore-rules/fixtures/avisos.capability-cases.json`) |

**Divergencias conocidas y NO resueltas fuera de avisos/eventos:**

1. **`isGlobalScreenAccess` (coordinador/secretario) duplicado con lógica distinta en 3 capas.** El backend (`functions/src/users/authorization.ts:156-164`, `requesterHasGlobalScreenAccess`) solo revisa `servicePosition` singular; el frontend (`src/utils/permissions/permissions.ts:144-169`) y las Rules (`firestore-rules/src/10-helpers-identity.rules`, función `isCoordinatorOrSecretary`) también revisan `serviceAssignments[]` / `serviceAssignmentKeys`. Un coordinador asignado solo vía el array (no el campo singular) pasa en frontend y Rules pero falla en backend. Afecta: listado/lectura de usuarios (`assertCanListUsers`), organigrama (`regenerateOrgChart`, `functions/src/organization/triggers.ts:32-39`, que tampoco revisa el array).
2. **Dominios sin migrar a la spec compartida:** usuarios, asignaciones, limpieza, predicación/territorios, organigrama. Cada uno sigue con su propia implementación ad-hoc en `authorization.ts` / Rules, sin tests de contrato que congelen su comportamiento actual (los tests nuevos de `firestore-rules/*.rules.test.ts` cubren Rules, pero no comparan Rules vs. frontend vs. backend como hace el fixture de eventos).
3. **Alias de rol legado `'administrador'`** se normaliza en `functions/src/users/parsers.ts` (`normalizeRole`) y en Rules (`isAdmin()` acepta ambos), pero cualquier dominio que no pase por el `getRequesterProfile` compartido de `users/authorization.ts` puede seguir sin normalizarlo. No audité exhaustivamente todos los `onCall` de `functions/src/` para confirmar que todos usan el `getRequesterProfile` compartido.

**Para marcar este ítem ✅:** migrar los dominios listados en el punto 2 a `capabilities.ts` (o al menos corregir el punto 1, que es transversal y de mayor impacto), y agregar fixtures de contrato equivalentes al de avisos/eventos. Backlog concreto ya entregado en la conversación de Paquete 3 (6 paquetes Codex, uno de ellos específicamente para `isGlobalScreenAccess`).

**Tests de contrato en verde:** ⚠️ mismo bloqueo de Java que la sección Código — los 72 casos en `firestore-rules/*.rules.test.ts` (26 preexistentes + 46 nuevos) están escritos y pasan `tsc`/`eslint`, pero no corridos contra el emulador real. Ver `firestore-rules/VERDICTS-SNAPSHOT.md`.

---

## 3. Multiplataforma

**Estado: ❌ no verificado — requiere QA manual, no es automatizable desde este entorno.**

No tengo forma de operar un navegador interactivo, un emulador/dispositivo
Android, ni un simulador/dispositivo iOS desde este entorno. Lo único que
pude verificar automáticamente es que el **bundle compila**, no que los
flujos funcionen:

| Verificación automatizable | Estado | Evidencia |
|---|---|---|
| `npm run build:web` (compila, no es QA funcional) | ✅ | Export limpio, 1648+ módulos resueltos, 0 errores. |
| `npx tsc --noEmit` sobre toda la app | ✅ | 0 errores (cubre las pantallas de los 9 flujos listados, ya que todas están en el árbol de `src/`). |
| Flujos funcionales reales (login, dashboard, usuarios, reuniones, asignaciones, limpieza, territorios, organigrama, notificaciones) × (web, Android, iOS) | 🔲 **27 combinaciones sin verificar** | Ninguna. |

### Checklist manual pendiente (rellenar con evidencia enlazable — captura, video, o link a build de EAS)

| Flujo | Web | Android | iOS |
|---|---|---|---|
| Login | 🔲 | 🔲 | 🔲 |
| Dashboard | 🔲 | 🔲 | 🔲 |
| Usuarios | 🔲 | 🔲 | 🔲 |
| Reuniones | 🔲 | 🔲 | 🔲 |
| Asignaciones | 🔲 | 🔲 | 🔲 |
| Limpieza | 🔲 | 🔲 | 🔲 |
| Territorios | 🔲 | 🔲 | 🔲 |
| Organigrama | 🔲 | 🔲 | 🔲 |
| Notificaciones | 🔲 | 🔲 | 🔲 |

`eas.json` ya tiene perfiles `development`/`preview`/`production` listos
para generar builds instalables (`eas build --profile preview --platform android|ios`).
No corrí ningún build de EAS: consume minutos de build reales de tu
cuenta Expo y requiere credenciales que no tengo aquí. Es la vía
recomendada para llenar las columnas Android/iOS de la tabla.

---

## 4. Billing — modo preparado, no activo

**Estado: ⚠️ parcial.** Verificado por lectura de código lo que se puede
verificar sin desplegar; el punto más riesgoso (deploy sin claves reales)
sigue sin una corrida real.

| Sub-criterio | Estado | Evidencia |
|---|---|---|
| Congregaciones exentas por defecto | ✅ | `firestore-rules/src/12-helpers-congregation-access.rules` (`congregationBillingAdministrativeRestricted`) solo restringe si `billing.provider == 'stripe'` existe en el documento. Una congregación sin ese campo (el estado de cualquier congregación nueva: `validCongregationData` en `firestore-rules/src/23-validators-congregations-persons.rules` ni siquiera permite al cliente escribir `billing`/`billingExemption` al crear) queda **no restringida** por construcción, sin necesitar una exención explícita. |
| Deploy sin claves reales | ❌ **no verificado** | `functions/src/billing/stripe/stripe-client.ts:14-19` declara 6 `defineSecret(...)`. Solo 3 archivos los consumen vía `secrets: STRIPE_RUNTIME_SECRETS`: `webhook-handlers.ts`, `checkout-portal-handlers.ts` (verificado con `npm run release:check`, check "billing: alcance de secretos Stripe sin expandir" — ✅ el alcance no creció). **Lo que no pude probar:** si `firebase deploy --only functions` realmente tiene éxito cuando esos 6 secretos no existen en Secret Manager. Es el riesgo P0 original del plan de estabilización, no confirmado como resuelto ni como vigente — solo confirmado que el *alcance* (qué archivos lo requieren) no se expandió por accidente. |
| App 100% funcional con congregación exenta | ✅ (parcial, ver Multiplataforma) | `src/screens/billing/BillingScreen.tsx:302` oculta los botones de checkout (`canPay && !isExempt`) y `:343` oculta el botón de portal cuando `isExempt`. No verificado interactivamente (ver sección 3). |
| Pantalla de billing honesta | ⚠️ **hallazgo, no bloqueante pero real** | `isExempt` en `BillingScreen.tsx:100` solo es `true` cuando existe el flag explícito `billingExemption.exempt === true`. Una congregación **nueva sin ningún dato de billing** (el caso por defecto, ver arriba) NO tiene ese flag, así que `isExempt` es `false` y, si el usuario tiene `canPay`, la pantalla muestra los botones de "elegir plan" — es decir, para el caso más común (congregación nueva, nunca tocó Stripe) la UI no muestra el aviso "exento", muestra precios y botones de pago reales que fallarían si se presionan sin secretos configurados. El fallo es controlado (try/catch + `Alert`, no crashea ni corrompe datos — ver siguiente fila), pero no es la experiencia "honesta" ideal. **No lo arreglé yo mismo**: es una decisión de producto (¿debe verse igual "exento explícito" y "nunca configuró billing"?) que te corresponde a ti. |
| Webhook inofensivo | ✅ | `functions/src/billing/stripe/webhook-handlers.ts`: sin firma válida → 400 sin escribir nada (`logError` agregado en esta auditoría, `congregationId: null`); firma válida pero secreto no configurado → error controlado, mismo resultado; el ledger de idempotencia (`stripeWebhookEvents`) es una colección cerrada a clientes (`firestore-rules/src/53-match-root-collections.rules`, `allow read, write: if false`) así que ningún tráfico inesperado puede corromper datos de negocio. No hay escritura a `billingHistory`/congregación salvo que el evento sea uno de los tipos gestionados y tenga `congregationId` resuelto. |

**Cambio hecho en esta auditoría:** `functions/src/shared/logging.ts`
(nuevo) + 3 call sites en `webhook-handlers.ts` migrados a incluir
`congregationId` (o `null` explícito) en los logs de error del webhook —
ver sección Observabilidad.

---

## 5. Versiones

| Check | Estado | Evidencia |
|---|---|---|
| `package.json` ↔ `app.json` (version, versionCode, buildNumber) | ✅ | `npm run check:versions` → todos coinciden (`1.13.4`, `versionCode 11304`, `buildNumber "11304"`). Ya existía antes de esta auditoría (`scripts/check-versions.mjs`, parte de `npm run validate`). |
| Pantalla "Acerca de" | ✅ | `src/screens/settings/AboutScreen.tsx:21-26` lee `Application.nativeApplicationVersion`/`nativeBuildVersion` con fallback a `Constants.expoConfig` — una sola fuente, sin versión hardcodeada. (El hallazgo original del PDF, fallback `'1.5.0'` hardcodeado, ya no existe en el código actual.) |
| Changelog | ✅ (recién creado) | `CHANGELOG.md` (nuevo en esta auditoría) — entrada para `1.13.4` + sección `[Unreleased]` con los cambios de esta sesión. |
| Tag git | 🔲 **pendiente, acción humana** | No existe ningún tag (`git tag -l` vacío). `npm run release:check` lo marca `FAIL` a propósito — el script **no crea tags automáticamente**, eso es una decisión de release explícita tuya. |
| Coherencia de mensajes de commit | ❌ **hallazgo confirmado, no arreglado** | El historial tiene commits cuyo mensaje es literalmente un número de versión (`1.21.0`, `1.20.0`, `1.19.0`, `1.9.0`, `1.18.0`...) que **no coincide con `package.json` (`1.13.4`)** y no está en orden (`1.9.0` aparece entre `1.19.0` y `1.18.0`). No reescribí el historial — es una operación destructiva que no haría sin tu autorización explícita. Documentado en `CHANGELOG.md` ("Nota sobre el historial previo") para que quien audite no confunda esos mensajes con versiones reales. |

---

## 6. Observabilidad

**Estado: ⚠️ parcial — infraestructura lista, adopción incompleta (a propósito, ver alcance abajo).**

- Cliente: `src/utils/logger.ts` (`createLogger`) ya existía, sin cambios.
- Backend: **no existía un equivalente compartido.** Encontré `functions/src/users/logging.ts` (`logCreateUserFailure`), pero es específico del dominio usuarios, no reutilizable.
- **Nuevo:** `functions/src/shared/logging.ts` (`logError`) — helper mínimo que fuerza `congregationId: string | null` en el contexto de todo log de error (null explícito cuando el error ocurre antes de resolver congregación, p. ej. verificación de firma de webhook). Probado: `functions/src/__tests__/logging.test.ts` (4 casos), `npm --prefix functions test` en verde.
- **Aplicado a:** los 3 `logger.error` de `functions/src/billing/stripe/webhook-handlers.ts` (verificación de firma, reclamo de idempotencia, procesamiento del evento) — el punto de mayor riesgo (webhook público, sin auth) y el que más directamente sirve al criterio de Billing de arriba.
- **NO aplicado (a propósito, por alcance):** conté ~19 call sites de `logger.error` en `functions/src/`; unos 8-9 no incluyen `congregationId` (auditoría vía `grep -n "logger.error" functions/src -A3`, ver detalle abajo). Migrarlos todos habría significado tocar archivos grandes que no leí por completo (`scheduled-data-cleanup.ts`, 700+ líneas) sin poder verificar cada uno con el mismo nivel de cuidado — exactamente la sobre-ingeniería que pediste evitar. Quedan como backlog explícito, no como "hecho":

| Archivo | Líneas aprox. | ¿Tiene congregationId disponible en scope? |
|---|---|---|
| `maintenance/scheduled-data-cleanup.ts` | 177, 330, 370, 502, 521, 594, 712, 747, 764 | Algunas sí (line 330 ya lo incluye), otras no está claro sin leer más contexto — requiere auditoría propia antes de tocar, es el archivo más grande y más until. |
| `maintenance/scheduled-notifications-cleanup.ts` | 84 | No evidente sin más contexto. |
| `billing/webhook-idempotency.ts` | 68 | No — el ledger es por `eventId` de Stripe, no por congregación en ese nivel; agregarlo requeriría cambiar la firma pública de `releaseWebhookEvent` y sus llamadores. |
| `modules/notifications/notifyAssignmentUsers.ts` | 261 | Probablemente sí (asignaciones son de congregación), no confirmado. |
| `users-sync.ts` | 37, 64 | Triggers de Auth — el uid está, congregationId requeriría una lectura extra a Firestore. |

**Para marcar este ítem ✅:** decidir si vale la pena esa lectura extra en cada caso (costo/beneficio, no es gratis) y migrar los que sí. No lo hice unilateralmente.

---

## 7. Release

| Ítem | Estado | Detalle |
|---|---|---|
| Changelog | ✅ | `CHANGELOG.md`, ver sección Versiones. |
| Tag | 🔲 | Pendiente, acción humana — ver Versiones. Sugerido: `v1.13.4` una vez fusionadas las ramas pendientes y confirmado `test:rules` en CI. |
| Plan de rollback | ✅ (documentado en esta auditoría) | Ver abajo. |
| Responsable definido | 🔲 | No hay ningún artefacto en el repo que designe un responsable de release — es una decisión organizacional, no de código. Complétalo aquí antes de cerrar: **Responsable de este release: _____________**. |

### Plan de rollback

1. **Firestore Rules** — el riesgo más aislado, por eso `deploy:rules` es
   independiente desde antes de esta auditoría (`npm run deploy:rules`,
   ahora además corre `build:rules:check` primero). Rollback: `git revert`
   del commit de `firestore-rules/src/` + `firestore.rules`, luego
   `npm run build:rules && npm run deploy:rules` de nuevo. No toca
   Functions ni el bundle de la app — el rollback más rápido y seguro del
   sistema.
2. **Cloud Functions** — `npm run deploy:functions` despliega todas juntas.
   Rollback vía `firebase functions:log`/consola para identificar la
   revisión anterior, o `git revert` + redeploy. Como Stripe está inactivo,
   un rollback de Functions no afecta cobros en curso (no hay).
3. **App (Expo/EAS)** — si ya se publicó un build de producción, el
   rollback es promover el build anterior desde EAS (no borrar/republicar
   a ciegas). Para `build:web`, revertir el commit y volver a exportar.
4. **Orden recomendado si algo falla post-deploy:** Rules primero (más
   barato de revertir, afecta permisos en caliente), luego Functions,
   luego la app — la app cliente ya desplegada sigue funcionando contra
   Rules/Functions revertidas sin necesitar que el usuario actualice.

---

## Resumen ejecutivo

**No está listo para release.** Lo que falta, en orden de impacto:

1. **Correr `npm run test:rules` de verdad** (Java 21+) y confirmar los 72
   casos — sin esto, "Permisos" y "Código" no pueden pasar de ⚠️.
2. **Cerrar las divergencias de `isGlobalScreenAccess`** (Permisos,
   punto 1) — es transversal, afecta usuarios y organigrama.
3. **QA manual multiplataforma real** — 27 combinaciones sin ninguna
   evidencia todavía.
4. **Confirmar (o mitigar) el riesgo de deploy de Functions sin secretos
   de Stripe** — no verificado en ningún sentido.
5. Fusionar las 3 ramas pendientes, crear el tag, y nombrar un responsable.

Lo que sí está listo: la base de código pasa todo lo estático (lint,
tsc, tests unitarios de app y functions), el versionado es coherente
hacia adelante, hay changelog, y el modo billing-preparado tiene buena
base de diseño (exención por defecto, webhook con fallo controlado) aunque
con un hallazgo de honestidad de UI sin resolver.
