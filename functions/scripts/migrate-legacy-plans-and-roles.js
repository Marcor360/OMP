/* eslint-disable no-console */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const PLAN_LIMITS = {
  omp_80: 80,
  omp_150: 150,
  omp_250: 250,
};

const normalizeRole = (value) => {
  if (value === 'administrador') return 'admin';
  if (value === 'usuario') return 'user';
  return null;
};

const normalizePlanKey = (value) => {
  if (value === 'omp_80' || value === 'omp_150' || value === 'omp_250') return value;
  if (value === 'complete') return 'omp_250';
  if (value === 'intermediate') return 'omp_150';
  if (value === 'basic') return 'omp_80';
  return null;
};

const normalizePlanKeyFromLimit = (value) => {
  if (value === 200) return 'omp_250';
  if (value === 120) return 'omp_150';
  if (value === 70) return 'omp_80';
  return null;
};

const parseArgs = () => {
  const args = new Set(process.argv.slice(2));
  return {
    write: args.has('--write'),
  };
};

const init = () => {
  initializeApp({
    credential: applicationDefault(),
  });
  return getFirestore();
};

const migrateUsers = async (db, write) => {
  const snapshot = await db
    .collection('users')
    .where('role', 'in', ['administrador', 'usuario'])
    .get();
  let scanned = 0;
  let changed = 0;

  for (const doc of snapshot.docs) {
    scanned += 1;
    const nextRole = normalizeRole(doc.get('role'));
    if (!nextRole) continue;

    changed += 1;
    console.log(`[users] ${doc.id}: ${doc.get('role')} -> ${nextRole}`);
    if (write) {
      await doc.ref.update({
        role: nextRole,
        updatedAt: FieldValue.serverTimestamp(),
        migrationUpdatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  return { scanned, changed };
};

const resolvePlanUpdate = (congregationData, privatePlanData) => {
  const billing = congregationData.billing && typeof congregationData.billing === 'object'
    ? congregationData.billing
    : {};
  const planKey =
    normalizePlanKey(billing.planKey) ||
    normalizePlanKey(congregationData.planKey) ||
    normalizePlanKey(privatePlanData.planKey) ||
    normalizePlanKey(privatePlanData.planId) ||
    normalizePlanKeyFromLimit(billing.activeUsersLimit) ||
    normalizePlanKeyFromLimit(billing.userLimit) ||
    normalizePlanKeyFromLimit(privatePlanData.activeUsersLimit) ||
    normalizePlanKeyFromLimit(privatePlanData.userLimit);

  if (!planKey) return null;

  const limit = PLAN_LIMITS[planKey];
  return { planKey, limit };
};

const migrateCongregationPlans = async (db, write) => {
  const snapshot = await db.collection('congregations').get();
  let scanned = 0;
  let changed = 0;

  for (const doc of snapshot.docs) {
    scanned += 1;
    const privatePlanSnap = await doc.ref.collection('private').doc('plan').get();
    const congregationData = doc.data();
    const privatePlanData = privatePlanSnap.exists ? privatePlanSnap.data() : {};
    const plan = resolvePlanUpdate(congregationData, privatePlanData || {});

    if (!plan) continue;

    const billing = congregationData.billing && typeof congregationData.billing === 'object'
      ? congregationData.billing
      : {};
    const alreadyCurrent =
      billing.planKey === plan.planKey &&
      billing.activeUsersLimit === plan.limit &&
      billing.userLimit === plan.limit &&
      privatePlanData?.planKey === plan.planKey &&
      privatePlanData?.activeUsersLimit === plan.limit;

    if (alreadyCurrent) continue;

    changed += 1;
    console.log(`[congregations] ${doc.id}: planKey=${plan.planKey}, limit=${plan.limit}`);

    if (write) {
      await doc.ref.update({
        'billing.planKey': plan.planKey,
        'billing.activeUsersLimit': plan.limit,
        'billing.userLimit': plan.limit,
        'billing.updatedAt': FieldValue.serverTimestamp(),
      });

      await doc.ref.collection('private').doc('plan').set({
        planKey: plan.planKey,
        activeUsersLimit: plan.limit,
        userLimit: plan.limit,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }

  return { scanned, changed };
};

const main = async () => {
  const { write } = parseArgs();
  const db = init();

  if (!write) {
    console.log('DRY RUN. Re-run with --write to apply changes.');
  }

  const users = await migrateUsers(db, write);
  const congregations = await migrateCongregationPlans(db, write);

  console.log({
    mode: write ? 'write' : 'dry-run',
    users,
    congregations,
  });
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
