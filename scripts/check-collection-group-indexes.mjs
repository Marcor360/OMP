#!/usr/bin/env node
// Guard: every `collectionGroup(<arg>)` used with a filter/orderBy in
// functions/src must have a matching COLLECTION_GROUP entry (index or
// fieldOverride) in firestore.indexes.json. Prevents the drift documented in
// docs/firestore-security.md#collectiongroup-drift (2026-07-13 incident: 9
// query shapes across scheduled jobs had zero supporting index in production,
// several failing on every run for weeks).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const FUNCTIONS_SRC = join(REPO_ROOT, 'functions', 'src');
const INDEXES_FILE = join(REPO_ROOT, 'firestore.indexes.json');

// Exact fields required per collection, per the collectionGroup query audit
// in docs/firestore-security.md. Extend this when a new collectionGroup
// query shape is added in functions/src.
const REQUIRED_FIELDS = {
  notifications: ['createdAt', 'eventId'],
  meetings: ['meetingDate'],
  billingHistory: ['createdAt'],
};

const walk = (dir, files = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (entry.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
};

const lineNumberAt = (source, index) => source.slice(0, index).split('\n').length;

// Pass 1: build a project-wide map of resolvable string / string[] constants,
// so imported constants (e.g. BILLING_HISTORY_COLLECTION declared in another
// file) still resolve instead of falling back to "dynamic".
const buildConstantMap = (files) => {
  const stringConsts = new Map();
  const arrayConsts = new Map();

  for (const file of files) {
    const source = readFileSync(file, 'utf8');

    for (const match of source.matchAll(/(?:export\s+)?const\s+([A-Z][\w]*)\s*(?::[^=]+)?=\s*['"]([\w.-]+)['"]/g)) {
      stringConsts.set(match[1], match[2]);
    }

    for (const match of source.matchAll(/(?:export\s+)?const\s+([A-Z][\w]*)\s*(?::[^=]+)?=\s*\[([\s\S]*?)\]\s*as const/g)) {
      const values = Array.from(match[2].matchAll(/['"]([\w.-]+)['"]/g)).map((m) => m[1]);
      arrayConsts.set(match[1], values);
    }
  }

  return { stringConsts, arrayConsts };
};

const resolveArgument = (rawArg, constants) => {
  const trimmed = rawArg.trim();

  const literalMatch = trimmed.match(/^['"]([\w-]+)['"]$/);
  if (literalMatch) return { kind: 'literal', values: [literalMatch[1]] };

  const identifierMatch = trimmed.match(/^[A-Za-z_$][\w$]*$/);
  if (identifierMatch) {
    if (constants.stringConsts.has(trimmed)) {
      return { kind: 'literal', values: [constants.stringConsts.get(trimmed)] };
    }
    if (constants.arrayConsts.has(trimmed)) {
      return { kind: 'literal', values: constants.arrayConsts.get(trimmed) };
    }
  }

  return { kind: 'dynamic' };
};

const findCollectionGroupUsages = (files, constants) => {
  const literalUsages = [];
  const dynamicUsages = [];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');

    for (const match of source.matchAll(/collectionGroup\(\s*([^)]*?)\s*\)/g)) {
      const line = lineNumberAt(source, match.index);
      const resolved = resolveArgument(match[1], constants);

      if (resolved.kind === 'literal') {
        for (const collectionGroup of resolved.values) {
          literalUsages.push({ collectionGroup, file, line });
        }
      } else {
        dynamicUsages.push({ file, line, ref: match[1].trim() });
      }
    }
  }

  return { literalUsages, dynamicUsages };
};

const buildCollectionGroupFieldSet = (indexesJson) => {
  const set = new Set();

  for (const index of indexesJson.indexes || []) {
    if (index.queryScope !== 'COLLECTION_GROUP') continue;
    for (const field of index.fields || []) {
      set.add(`${index.collectionGroup}::${field.fieldPath}`);
    }
    set.add(`${index.collectionGroup}::*`);
  }

  for (const override of indexesJson.fieldOverrides || []) {
    const hasGroupScope = (override.indexes || []).some(
      (entry) => entry.queryScope === 'COLLECTION_GROUP'
    );
    if (hasGroupScope) {
      set.add(`${override.collectionGroup}::${override.fieldPath}`);
      set.add(`${override.collectionGroup}::*`);
    }
  }

  return set;
};

const main = () => {
  const files = walk(FUNCTIONS_SRC);
  const constants = buildConstantMap(files);
  const { literalUsages, dynamicUsages } = findCollectionGroupUsages(files, constants);
  const indexesJson = JSON.parse(readFileSync(INDEXES_FILE, 'utf8'));
  const cgFieldSet = buildCollectionGroupFieldSet(indexesJson);

  const failures = [];
  const seenCollections = new Set(literalUsages.map((u) => u.collectionGroup));

  for (const collectionGroup of seenCollections) {
    if (!cgFieldSet.has(`${collectionGroup}::*`)) {
      failures.push(
        `collectionGroup('${collectionGroup}') has no COLLECTION_GROUP index/fieldOverride at all.`
      );
      continue;
    }

    const requiredFields = REQUIRED_FIELDS[collectionGroup];
    if (!requiredFields) continue;

    for (const field of requiredFields) {
      if (!cgFieldSet.has(`${collectionGroup}::${field}`)) {
        failures.push(
          `Missing COLLECTION_GROUP coverage for ${collectionGroup}.${field} (required by REQUIRED_FIELDS in this script).`
        );
      }
    }
  }

  if (dynamicUsages.length > 0) {
    console.log('Dynamic collectionGroup() usages found (not enforced, review manually):');
    for (const usage of dynamicUsages) {
      console.log(`  dynamic:${usage.file}:${usage.line} (arg: ${usage.ref})`);
    }
  }

  if (failures.length > 0) {
    console.error('\nfirestore.indexes.json is missing COLLECTION_GROUP coverage:\n');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    console.error(
      '\nSee docs/firestore-security.md for the export procedure and known collectionGroup query shapes.'
    );
    process.exit(1);
  }

  console.log(
    `OK: ${seenCollections.size} literal collectionGroup() collection(s) covered, ${dynamicUsages.length} dynamic usage(s) reported above.`
  );
};

main();
