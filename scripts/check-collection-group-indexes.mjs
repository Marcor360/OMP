#!/usr/bin/env node
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'functions', 'src');
const INDEXES = join(ROOT, 'firestore.indexes.json');

// Audited query shapes. Dynamic collectionGroup calls are permitted only by
// this explicit file/ref allowlist and must remain covered here.
const REQUIRED_FIELDS = {
  reuniones: ['endDate'], assignments: ['dueDate'], asignaciones: ['dueDate'],
  meetings: ['meetingDate', 'endDate', 'startDate'], tareas: ['dueDate'],
  tasks: ['dueDate'], archivos: ['endDate'], files: ['endDate'],
  notifications: ['createdAt'], billingHistory: ['createdAt'],
  private: ['stripeSubscriptionId'],
};
const DYNAMIC_ALLOWLIST = new Map([
  ['functions/src/maintenance/scheduled-data-cleanup.ts::params.collectionId',
    Object.entries(REQUIRED_FIELDS).filter(([name]) => !['notifications', 'billingHistory'].includes(name))],
]);

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith('.ts')) out.push(path);
  }
  return out;
};
const constants = (files) => {
  const map = new Map();
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(/(?:export\s+)?const\s+([A-Z][\w]*)\s*(?::[^=]+)?=\s*['"]([\w.-]+)['"]/g)) map.set(m[1], m[2]);
  }
  return map;
};
const coverage = (json) => {
  const set = new Set();
  for (const index of json.indexes || []) {
    if (index.queryScope !== 'COLLECTION_GROUP') continue;
    for (const field of index.fields || []) set.add(`${index.collectionGroup}::${field.fieldPath}`);
  }
  for (const item of json.fieldOverrides || []) {
    if ((item.indexes || []).some((index) => index.queryScope === 'COLLECTION_GROUP')) set.add(`${item.collectionGroup}::${item.fieldPath}`);
  }
  return set;
};
const audit = ({files, indexes}) => {
  const known = constants(files);
  const failures = [];
  const used = new Set();
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file).replaceAll('\\', '/');
    for (const match of source.matchAll(/collectionGroup\(\s*([^)]*?)\s*\)/g)) {
      const ref = match[1].trim();
      const literal = ref.match(/^['"]([\w-]+)['"]$/)?.[1] || known.get(ref);
      if (literal) used.add(literal);
      else {
        const key = `${rel}::${ref}`;
        const allowed = DYNAMIC_ALLOWLIST.get(key);
        if (!allowed) failures.push(`Dynamic collectionGroup not declared: ${key}`);
        else for (const [group] of allowed) used.add(group);
      }
    }
  }
  const covered = coverage(indexes);
  for (const group of used) {
    const fields = REQUIRED_FIELDS[group];
    if (!fields) failures.push(`collectionGroup '${group}' has no audited query shape`);
    else for (const field of fields) if (!covered.has(`${group}::${field}`)) failures.push(`Missing COLLECTION_GROUP coverage: ${group}.${field}`);
  }
  return failures;
};

const main = () => {
  if (process.argv.includes('--self-test')) {
    if (!DYNAMIC_ALLOWLIST.has('functions/src/maintenance/scheduled-data-cleanup.ts::params.collectionId')) throw new Error('declared dynamic use rejected');
    if (DYNAMIC_ALLOWLIST.has('functions/src/other.ts::unknown')) throw new Error('undeclared dynamic use accepted');
    console.log('OK: dynamic allowlist self-test passed.');
    return;
  }
  const files = walk(SRC);
  const failures = audit({files, indexes: JSON.parse(readFileSync(INDEXES, 'utf8'))});
  if (failures.length) {
    console.error(failures.map((failure) => `- ${failure}`).join('\n'));
    process.exit(1);
  }
  console.log(`OK: ${Object.values(REQUIRED_FIELDS).flat().length} audited collectionGroup field shapes are covered.`);
};
main();
