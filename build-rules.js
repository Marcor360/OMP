#!/usr/bin/env node
// Genera firestore.rules a partir de los modulos en rules_src/.
// firestore.rules pasa a ser un artefacto generado: no se edita a mano.
// Editar siempre en rules_src/<modulo>.rules y correr `npm run build:rules`.
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = __dirname;
const SRC_DIR = path.join(REPO_ROOT, 'rules_src');
const MANIFEST_PATH = path.join(SRC_DIR, 'manifest.json');
const OUTPUT_PATH = path.join(REPO_ROOT, 'firestore.rules');

const checkOnly = process.argv.includes('--check');

const readManifest = () => {
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const modules = JSON.parse(raw);
  if (!Array.isArray(modules) || modules.some((name) => typeof name !== 'string')) {
    throw new Error(`${MANIFEST_PATH} debe ser un array de nombres de archivo.`);
  }
  return modules;
};

const buildRules = () => {
  const modules = readManifest();
  const chunks = modules.map((name) => {
    const filePath = path.join(SRC_DIR, name);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Falta el modulo listado en manifest.json: ${name}`);
    }
    return fs.readFileSync(filePath, 'utf8');
  });
  return chunks.join('');
};

const main = () => {
  const listed = new Set(readManifest());
  const orphans = fs
    .readdirSync(SRC_DIR)
    .filter((name) => name.endsWith('.rules') && !listed.has(name));
  if (orphans.length > 0) {
    throw new Error(
      `Modulos .rules no listados en manifest.json: ${orphans.join(', ')}. ` +
        'Anadelos al manifest o borralos.'
    );
  }

  const generated = buildRules();

  if (checkOnly) {
    if (!fs.existsSync(OUTPUT_PATH)) {
      console.error(`No existe ${OUTPUT_PATH}.`);
      process.exit(1);
    }
    const current = fs.readFileSync(OUTPUT_PATH, 'utf8');
    if (current !== generated) {
      console.error(
        'firestore.rules NO coincide con rules_src/. ' +
          'Alguien lo edito a mano, o rules_src/ quedo desactualizado. ' +
          'Corre `npm run build:rules` y revisa el diff antes de commitear.'
      );
      process.exit(1);
    }
    console.log('OK: firestore.rules coincide exactamente con rules_src/.');
    return;
  }

  fs.writeFileSync(OUTPUT_PATH, generated, 'utf8');
  console.log(`Generado ${OUTPUT_PATH} a partir de ${readManifest().length} modulos en rules_src/.`);
};

main();
