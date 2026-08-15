/* eslint-disable no-console */
// SEC-01: mueve los identificadores internos de Stripe del documento raiz
// congregations/{id} a congregations/{id}/private/billing.
//
// Idempotente: si el doc raiz ya no tiene los 7 campos privados, la
// congregacion se cuenta como "ya migrada" y no se toca. Dry-run por
// defecto; requiere --apply para escribir.
//
// Uso (Google Cloud Shell):
//   echo 'BASE64_AQUI' | base64 -d > migrate.js && node migrate.js
//   node migrate.js --apply
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const PRIVATE_BILLING_FIELDS = [
  'stripePriceId',
  'stripeCustomerId',
  'stripeSubscriptionId',
  'lastPaymentStatus',
  'lastInvoiceId',
  'lastInvoiceUrl',
  'lastStripeEventId',
];

const parseArgs = () => {
  const args = new Set(process.argv.slice(2));
  return { apply: args.has('--apply') };
};

const init = () => {
  initializeApp({ credential: applicationDefault() });
  return getFirestore();
};

const extractPrivateFields = (billing) => {
  const found = {};
  let hasAny = false;
  for (const field of PRIVATE_BILLING_FIELDS) {
    if (billing && Object.prototype.hasOwnProperty.call(billing, field)) {
      found[field] = billing[field];
      hasAny = true;
    }
  }
  return { found, hasAny };
};

const migrateCongregation = async (db, congregationDoc, apply) => {
  const data = congregationDoc.data() || {};
  const billing = data.billing && typeof data.billing === 'object' ? data.billing : {};
  const { found, hasAny } = extractPrivateFields(billing);

  if (!hasAny) {
    return { status: 'already-migrated' };
  }

  console.log(`[private-billing] ${congregationDoc.id}: migrando ${Object.keys(found).join(', ')}`);

  if (!apply) {
    return { status: 'migrated' };
  }

  const privateRef = congregationDoc.ref.collection('private').doc('billing');

  // 1. copiar al doc privado
  await privateRef.set(
    { ...found, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  // 2. verificar la copia antes de borrar el original
  const verifySnap = await privateRef.get();
  const verifyData = verifySnap.data() || {};
  const copiedOk = Object.entries(found).every(([key, value]) => verifyData[key] === value);
  if (!copiedOk) {
    throw new Error(`verificacion fallo para ${congregationDoc.id}: el doc privado no coincide`);
  }

  // 3. solo entonces borrar del doc raiz
  const deleteUpdate = {};
  for (const field of PRIVATE_BILLING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(found, field)) {
      deleteUpdate[`billing.${field}`] = FieldValue.delete();
    }
  }
  await congregationDoc.ref.update(deleteUpdate);

  return { status: 'migrated' };
};

const main = async () => {
  const { apply } = parseArgs();
  const db = init();

  if (!apply) {
    console.log('DRY RUN. Re-run con --apply para escribir.');
  }

  const snapshot = await db.collection('congregations').get();
  const report = { processed: 0, migrated: 0, alreadyMigrated: 0, failed: 0 };

  for (const congregationDoc of snapshot.docs) {
    report.processed += 1;
    try {
      const { status } = await migrateCongregation(db, congregationDoc, apply);
      if (status === 'migrated') report.migrated += 1;
      else report.alreadyMigrated += 1;
    } catch (error) {
      report.failed += 1;
      console.error(`[private-billing] ${congregationDoc.id}: FALLO`, error);
    }
  }

  console.log({ mode: apply ? 'apply' : 'dry-run', ...report });
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
