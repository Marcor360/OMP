/* eslint-disable no-console */
// BUG-01: separa assignedToGroupId de assignedToUid. Las asignaciones de
// grupos de limpieza escribian el mismo valor en ambos campos
// (assignedToUid: cleaningGroupId), lo que rompia el filtro
// where('assignedToUid','==',uid) de la lista personal y contaminaba
// cualquier logica que asuma que assignedToUid es siempre un UID real.
//
// Deteccion: assignedToUid === cleaningGroupId (ambos presentes). Es la
// firma exacta del bug -- los dos sitios de escritura afectados ponian el
// mismo valor de grupo en los dos campos a la vez.
//
// Idempotente: si assignedToUid ya no esta presente, la asignacion se
// cuenta como "ya migrada". Dry-run por defecto; requiere --apply.
//
// Uso (Google Cloud Shell):
//   echo 'BASE64_AQUI' | base64 -d > migrate.js && node migrate.js
//   node migrate.js --apply
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const PAGE_SIZE = 300;

const parseArgs = () => {
  const args = new Set(process.argv.slice(2));
  return { apply: args.has('--apply') };
};

const init = () => {
  initializeApp({ credential: applicationDefault() });
  return getFirestore();
};

const isBuggyGroupAssignment = (data) =>
  typeof data.assignedToUid === 'string' &&
  typeof data.cleaningGroupId === 'string' &&
  data.assignedToUid.length > 0 &&
  data.assignedToUid === data.cleaningGroupId;

const main = async () => {
  const { apply } = parseArgs();
  const firestore = init();

  if (!apply) {
    console.log('DRY RUN. Re-run con --apply para escribir.');
  }

  const report = { processed: 0, migrated: 0, alreadyMigrated: 0, failed: 0 };
  let cursor = null;

  while (true) {
    let query = firestore
      .collectionGroup('assignments')
      .orderBy('__name__')
      .limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);

    const snap = await query.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      report.processed += 1;
      const data = doc.data() || {};

      if (!isBuggyGroupAssignment(data)) {
        report.alreadyMigrated += 1;
        continue;
      }

      console.log(`[assigned-to-group-id] ${doc.ref.path}: assignedToUid -> assignedToGroupId (${data.assignedToUid})`);

      if (!apply) {
        report.migrated += 1;
        continue;
      }

      try {
        await doc.ref.update({
          assignedToGroupId: data.assignedToUid,
          assignedToUid: FieldValue.delete(),
        });
        report.migrated += 1;
      } catch (error) {
        report.failed += 1;
        console.error(`[assigned-to-group-id] ${doc.ref.path}: FALLO`, error);
      }
    }

    cursor = snap.docs[snap.docs.length - 1];
  }

  console.log({ mode: apply ? 'apply' : 'dry-run', ...report });
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
