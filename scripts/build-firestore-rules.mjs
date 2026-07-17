#!/usr/bin/env node
// Genera firestore.rules a partir de las fuentes en firestore-rules/src/*.rules.
//
// Firestore no soporta includes nativos, asi que la "modularizacion" es
// composicion en build: cada archivo fuente es un fragmento de texto que
// se concatena en un orden fijo (definido en MANIFEST, no por orden
// alfabetico del sistema de archivos) para reconstruir el ruleset
// completo dentro de un unico bloque
// `service cloud.firestore { match /databases/{database}/documents { ... } }`.
//
// El orden de los fragmentos no cambia el comportamiento: en el lenguaje
// de Firestore Rules las funciones pueden referenciarse entre si sin
// importar el orden textual de declaracion, y cada `match` de coleccion
// en este ruleset tiene un patron de ruta unico (no hay dos `match` con
// el mismo patron), asi que el orden de los bloques `match` tampoco
// afecta que reglas aplican a una request dada.
//
// Uso:
//   node scripts/build-firestore-rules.mjs           # escribe firestore.rules
//   node scripts/build-firestore-rules.mjs --check    # no escribe; falla (exit 1)
//                                                       si el archivo generado
//                                                       difiere del firestore.rules
//                                                       actual en disco

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SRC_DIR = resolve(REPO_ROOT, 'firestore-rules/src');
const OUTPUT_PATH = resolve(REPO_ROOT, 'firestore.rules');

// Orden de composicion. Es la unica fuente de verdad sobre el orden final;
// no se infiere del listado del directorio para no depender de que el
// ordenamiento alfabetico del filesystem coincida con el deseado.
const MANIFEST = [
  '00-header.rules',
  '10-helpers-identity.rules',
  '11-helpers-role-gates.rules',
  '12-helpers-congregation-access.rules',
  '20-validators-users.rules',
  '21-validators-events.rules',
  '22-validators-sync.rules',
  '23-validators-congregations-persons.rules',
  '24-validators-meetings.rules',
  '25-validators-assignments.rules',
  '26-validators-territories.rules',
  '27-validators-departments.rules',
  '28-validators-cleaning.rules',
  '29-validators-notifications.rules',
  '30-validators-outgoing-talks.rules',
  '31-validators-planning-schedules.rules',
  '32-validators-changelogs-preaching.rules',
  '50-match-system-events.rules',
  '51-match-users.rules',
  '52-match-congregations.rules',
  '53-match-root-collections.rules',
  '99-footer.rules',
];

const GENERATED_HEADER = `// ARCHIVO GENERADO -- editar firestore-rules/src, no este archivo.
// Se reconstruye con: node scripts/build-firestore-rules.mjs
// Ver docs/firestore-rules-build.md para el flujo completo
// (editar fuentes -> build -> npm run test:rules -> npm run deploy:rules).
`;

function buildRulesContent() {
  const missing = MANIFEST.filter((name) => !existsSync(resolve(SRC_DIR, name)));
  if (missing.length > 0) {
    throw new Error(`Faltan archivos fuente listados en MANIFEST: ${missing.join(', ')}`);
  }

  const fragments = MANIFEST.map((name) => readFileSync(resolve(SRC_DIR, name), 'utf8'));
  return GENERATED_HEADER + fragments.join('');
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const generated = buildRulesContent();

  if (!checkOnly) {
    writeFileSync(OUTPUT_PATH, generated, 'utf8');
    console.log(`OK: firestore.rules regenerado desde ${MANIFEST.length} fragmentos de firestore-rules/src/.`);
    return;
  }

  if (!existsSync(OUTPUT_PATH)) {
    console.error('ERROR: firestore.rules no existe. Corre sin --check para generarlo.');
    process.exit(1);
  }

  const current = readFileSync(OUTPUT_PATH, 'utf8');
  if (current !== generated) {
    console.error(
      'ERROR: firestore.rules esta desactualizado respecto a firestore-rules/src/.\n' +
        'Corre "node scripts/build-firestore-rules.mjs" y comitea el resultado.'
    );
    process.exit(1);
  }

  console.log('OK: firestore.rules coincide con firestore-rules/src/.');
}

main();
