# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
La versión activa es siempre la de `package.json` / `app.json` (deben
coincidir; `npm run check:versions` lo audita en CI).

## Nota sobre el historial previo

El historial de commits antes de este archivo tiene mensajes de commit que
son literalmente números de versión (`1.21.0`, `1.20.0`, `1.19.0`, `1.9.0`,
`1.18.0`, ...) que **no coinciden** con la versión real en `package.json`
(`1.13.4`) y no están en orden monótono (`1.9.0` aparece entre `1.19.0` y
`1.18.0`). No se puede reconstruir de forma confiable un historial de
versiones a partir de esos mensajes — no se intenta aquí. `package.json`
es la única fuente de verdad de la versión actual. Este changelog empieza
a partir de este punto; no hay entradas retroactivas fabricadas.

## [Unreleased]

### Added
- Spec de capacidades compartida para el dominio avisos/eventos
  (`src/shared/capabilities.ts`, `functions/src/shared/capabilities.ts`)
  con tests de contrato frontend/functions/Rules.
- Modularización de `firestore.rules`: fuentes en `firestore-rules/src/`,
  script de composición determinista (`scripts/build-firestore-rules.mjs`),
  guardia en CI y en `npm run validate`.
- Tests de contrato de Firestore Rules para 6 dominios adicionales
  (usuarios, reuniones, asignaciones, limpieza, territorios,
  notificaciones, billing-lectura) — ver `firestore-rules/VERDICTS-SNAPSHOT.md`.
- Helper de logging de Functions con `congregationId` obligatorio
  (`functions/src/shared/logging.ts`), aplicado a los handlers de webhook
  de Stripe.
- `scripts/release-readiness-check.mjs` (`npm run release:check`):
  agrega las verificaciones automatizables del checklist de release
  candidate en una sola corrida.
- `docs/release-candidate.md`: checklist de release candidate con estado
  y evidencia por ítem.

### Changed
- `MeetingFormScreen.tsx` dividido de 1,581 a 124 líneas siguiendo el
  patrón de `user-form/` (componentes y hooks extraídos a
  `src/screens/meetings/meeting-form/`), sin cambio de comportamiento.
- CI (`rules` job): Java 17 → 21 (requerido por `firebase-tools` para el
  emulador de Firestore; el job probablemente fallaba antes de este
  cambio).

## [1.13.4]

Versión activa en `package.json` / `app.json` al momento de crear este
archivo. No hay registro fiable de qué incluyó exactamente frente a
versiones anteriores (ver nota de historial arriba).
