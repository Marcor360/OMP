#!/usr/bin/env node
// Agrega las verificaciones automatizables del checklist de release
// candidate (docs/release-candidate.md, seccion "Codigo") en una sola
// corrida con un resumen legible. No reemplaza la verificacion manual de
// las secciones Multiplataforma/Billing/Release: esas requieren un humano.
//
// Uso:
//   node scripts/release-readiness-check.mjs
//
// Exit code 0 solo si ningun check reporta "fail". Los checks "skip"
// (ej. test:rules sin Java 21+) no rompen el exit code pero se listan
// para que quede explicito que faltan por correr en otro entorno/CI.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const results = [];

const run = (cmd, cwd = ROOT) =>
  execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8' });

const check = (name, fn) => {
  try {
    const detail = fn();
    results.push({ name, status: 'pass', detail: detail ?? 'OK' });
  } catch (error) {
    if (error?.__skip) {
      results.push({ name, status: 'skip', detail: error.message });
      return;
    }
    const detail =
      error?.stdout?.toString?.().trim().split('\n').slice(-8).join('\n') ||
      error?.message ||
      String(error);
    results.push({ name, status: 'fail', detail });
  }
};

const skip = (message) => {
  const error = new Error(message);
  error.__skip = true;
  throw error;
};

// --- Codigo -----------------------------------------------------------

check('check:versions', () => run('npm run check:versions'));
check('check:indexes', () => run('npm run check:indexes'));
check('build:rules:check', () => run('npm run build:rules:check'));
check('app lint', () => run('npm run lint'));
check('app typecheck', () => run('npx tsc --noEmit'));
check('app tests', () => run('npm test -- --runInBand'));
check('functions lint', () => run('npm --prefix functions run lint'));
check('functions build', () => run('npm --prefix functions run build'));
check('functions tests', () => run('npm --prefix functions test -- --runInBand'));
check('web build (smoke, not functional QA)', () => run('npm run build:web'));

check('test:rules (Firestore emulator)', () => {
  let javaVersion = 0;
  try {
    const raw = execSync('java -version 2>&1', { cwd: ROOT, encoding: 'utf8' });
    const match = raw.match(/version "(\d+)/);
    javaVersion = match ? Number(match[1]) : 0;
  } catch {
    skip('Java no esta instalado en este entorno; requerido (21+) para el emulador de Firestore.');
  }
  if (javaVersion < 21) {
    skip(`Java ${javaVersion || 'desconocido'} detectado; firebase-tools requiere 21+. Corre esto en CI o localmente con un JDK 21+.`);
  }
  return run('npm run test:rules');
});

// --- Permisos: hallazgos conocidos (no auto-verificable, solo se listan) --

check('permisos: divergencias documentadas', () => {
  const snapshot = resolve(ROOT, 'firestore-rules/VERDICTS-SNAPSHOT.md');
  if (!existsSync(snapshot)) {
    throw new Error('firestore-rules/VERDICTS-SNAPSHOT.md no existe.');
  }
  return 'Ver docs/release-candidate.md seccion Permisos para el estado real (hay divergencias abiertas fuera de avisos/eventos).';
});

// --- Billing: guardia de alcance de secretos de Stripe -----------------

check('billing: alcance de secretos Stripe sin expandir', () => {
  const allowList = new Set([
    'functions/src/billing/stripe/stripe-client.ts',
    'functions/src/billing/stripe/webhook-handlers.ts',
    'functions/src/billing/stripe/checkout-portal-handlers.ts',
  ]);

  const grepOutput = run(
    'grep -rl "STRIPE_RUNTIME_SECRETS\\|defineSecret(" functions/src --include=*.ts || true'
  );
  const offenders = grepOutput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, '/'))
    .filter((p) => !allowList.has(p));

  if (offenders.length > 0) {
    throw new Error(
      `Archivos nuevos referencian secretos de Stripe fuera de la lista esperada: ${offenders.join(', ')}. ` +
        'Si es intencional, revisa el riesgo de "firebase deploy --only functions" abortando sin claves reales y actualiza este script.'
    );
  }
  return `Solo los 3 archivos esperados declaran secretos de Stripe: ${[...allowList].join(', ')}.`;
});

// --- Versiones ----------------------------------------------------------

check('versiones: changelog tiene entrada para la version actual', () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
  const changelogPath = resolve(ROOT, 'CHANGELOG.md');
  if (!existsSync(changelogPath)) {
    throw new Error(`CHANGELOG.md no existe (version actual: ${pkg.version}).`);
  }
  const content = readFileSync(changelogPath, 'utf8');
  if (!content.includes(pkg.version)) {
    throw new Error(`CHANGELOG.md no menciona la version actual (${pkg.version}).`);
  }
  return `CHANGELOG.md incluye una entrada para ${pkg.version}.`;
});

check('versiones: existe un tag git para la version actual', () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
  const candidates = [`v${pkg.version}`, pkg.version];
  let tags = '';
  try {
    tags = run('git tag -l');
  } catch {
    skip('No se pudo leer los tags de git en este entorno.');
  }
  const tagList = tags.split('\n').map((t) => t.trim());
  const found = candidates.find((c) => tagList.includes(c));
  if (!found) {
    throw new Error(
      `Ningun tag git coincide con la version ${pkg.version} (se buscaron: ${candidates.join(', ')}). ` +
        'Crea el tag como parte del release, no automaticamente por este script.'
    );
  }
  return `Tag ${found} encontrado.`;
});

// --- Resumen -------------------------------------------------------------

const statusIcon = { pass: 'OK  ', fail: 'FAIL', skip: 'SKIP' };
console.log('\n=== Release readiness check ===\n');
for (const r of results) {
  console.log(`[${statusIcon[r.status]}] ${r.name}`);
  if (r.status !== 'pass') {
    console.log(
      r.detail
        .split('\n')
        .map((l) => `        ${l}`)
        .join('\n')
    );
  }
}

const failed = results.filter((r) => r.status === 'fail');
const skipped = results.filter((r) => r.status === 'skip');
console.log(
  `\n${results.length - failed.length - skipped.length}/${results.length} pass, ${skipped.length} skipped, ${failed.length} failed.\n`
);

if (failed.length > 0) {
  process.exitCode = 1;
}
