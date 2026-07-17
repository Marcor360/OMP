# Firestore Rules: fuentes y composición en build

`firestore.rules` es un **archivo generado**. La fuente de verdad vive en
`firestore-rules/src/*.rules`.

## Por qué

`firestore.rules` había crecido a 2,805 líneas monolíticas, con más de 100
funciones y ~35 bloques `match` mezclados. Firestore no soporta includes
nativos (no hay forma de que las reglas reales importen otros archivos en
tiempo de despliegue), así que la única forma real de modularizar es
**componer en build time**: mantener el código fuente dividido por
dominio, y generar el `firestore.rules` monolítico que Firebase realmente
despliega a partir de esas fuentes.

## Estructura

```
firestore-rules/
  src/
    00-header.rules                          # rules_version + apertura de service/match
    10-helpers-identity.rules                # sesión, rol activo, isAdmin/isSupervisor...
    11-helpers-role-gates.rules               # isXxxManager / canXxx (gates por dominio)
    12-helpers-congregation-access.rules      # aislamiento multi-tenant, billing, mantenimiento
    20-validators-users.rules
    21-validators-events.rules
    22-validators-sync.rules                  # push tokens, viewedAnnouncements, sync organigrama
    23-validators-congregations-persons.rules
    24-validators-meetings.rules
    25-validators-assignments.rules
    26-validators-territories.rules
    27-validators-departments.rules
    28-validators-cleaning.rules
    29-validators-notifications.rules
    30-validators-outgoing-talks.rules
    31-validators-planning-schedules.rules
    32-validators-changelogs-preaching.rules
    50-match-system-events.rules
    51-match-users.rules
    52-match-congregations.rules               # todo el subarbol /congregations/{id}/...
    53-match-root-collections.rules
    99-footer.rules                            # cierre de match/service
  *.rules.test.ts                              # tests de contrato (jest + rules-unit-testing)
  test-support/rules-test-helpers.ts           # builders compartidos (userDoc, congregaciones, authedDb)
scripts/build-firestore-rules.mjs              # concatena las fuentes -> firestore.rules
```

**Por qué el orden textual original se preservó en vez de agrupar cada
dominio en un solo archivo (validators + match juntos):** los validadores
de un dominio y su bloque `match` están muy separados en el archivo
original (los validators viven a la mitad del archivo, los `match` casi
al final). Agruparlos habría significado *reordenar* texto respecto al
original, y sin poder correr el emulador de Firestore en este entorno
(ver limitación de Java más abajo) no había forma de verificar
empíricamente que un reordenamiento no cambiaba el comportamiento. Se
priorizó la migración de menor riesgo: cortar el archivo en fragmentos
**exactamente en el mismo orden**, verificable con un `diff` de texto
plano (`node scripts/build-firestore-rules.mjs` + `git diff firestore.rules`
debe mostrar únicamente el encabezado "ARCHIVO GENERADO" como cambio, cero
líneas de reglas movidas o alteradas). Cada archivo fuente sigue
identificando su dominio por nombre; la separación en capas
(identity/role-gates/access → validators → match) es la única
concesión frente a "un archivo por dominio" literal, y queda documentada
aquí para quien la audite.

El orden de composición en sí (funciones antes o después de otras
funciones, o de qué bloque `match` aparece primero) no afecta el
comportamiento: en el lenguaje de Firestore Rules las `function` pueden
referenciar otras funciones sin importar el orden de declaración, y cada
bloque `match` de este ruleset tiene un patrón de ruta único (no hay dos
`match` compitiendo por el mismo patrón), así que el orden entre ellos
tampoco decide qué regla aplica.

## Flujo de trabajo

1. Editar el dominio correspondiente en `firestore-rules/src/*.rules`.
2. Regenerar el archivo real:
   ```
   npm run build:rules
   ```
3. Correr los tests de contrato (requiere Java 21+ para el emulador de
   Firestore vía `firebase-tools`):
   ```
   npm run test:rules
   ```
4. Si todo pasa, desplegar **solo** las reglas (nunca junto con un deploy
   completo que pueda abortar a medio camino):
   ```
   npm run deploy:rules
   ```
   Este script corre automáticamente `build:rules:check` antes de
   desplegar, así que nunca se puede desplegar un `firestore.rules` que no
   coincida con las fuentes.

`npm run validate` incluye `build:rules:check` (comparación de texto, no
requiere el emulador) para atrapar drift en desarrollo local sin
depender de Java. La verificación semántica real (`test:rules`) sigue
siendo un paso aparte porque necesita el emulador.

## Nunca edites `firestore.rules` a mano

El archivo generado empieza con:

```
// ARCHIVO GENERADO -- editar firestore-rules/src, no este archivo.
```

Si lo editas directamente, tu cambio se pierde en el siguiente
`npm run build:rules`, y además:

- `npm run validate` falla localmente (`build:rules:check`).
- El job `rules` de CI falla explícitamente en el paso "Guard firestore.rules
  generado" (`.github/workflows/ci.yml`), antes incluso de levantar el
  emulador.

## Limitación conocida de este entorno (Java)

`firebase-tools@15.22.3` (versión fijada en este repo) requiere **Java
21+** para el emulador de Firestore. El job de CI (`.github/workflows/ci.yml`,
job `rules`) fue corregido en esta misma migración: pedía Java 17, lo
cual con esa versión de `firebase-tools` falla con
`Error: firebase-tools no longer supports Java version before 21`. Si ves
ese error localmente, instala un JDK 21+ (Temurin recomendado) — no hay
forma de correr `npm run test:rules` con Java 17.

## Cobertura de tests por dominio

Cada archivo `firestore-rules/*.rules.test.ts` cubre, como mínimo, para su
dominio: mismo rol en otra congregación (denegado), usuario inactivo
(denegado), titular de un permiso granular (`permissions.<departamento>.<accion>`,
permitido) vs. sin el permiso (denegado), y — donde la colección lo
amerita — escritura directa de cliente en una colección reservada a
Cloud Functions (siempre denegada). Ver
`firestore-rules/VERDICTS-SNAPSHOT.md` para el detalle caso por caso y su
estado de verificación real.
