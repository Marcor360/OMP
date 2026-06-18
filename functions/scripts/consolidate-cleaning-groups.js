/* eslint-disable no-console */
/**
 * Consolidacion de grupos de limpieza hacia la ruta canonica:
 *   congregations/{congregationId}/cleaningGroups   (scoped, camelCase)
 *
 * Drena las ubicaciones legacy hacia la canonica PRESERVANDO el doc id
 * (los usuarios referencian cleaningGroupId, asi que el id debe mantenerse):
 *   - congregations/{cid}/cleaning_groups   (nested snake_case)
 *   - cleaningGroups   (raiz, filtrado por congregationId)
 *   - cleaning_groups  (raiz, filtrado por congregationId)
 *
 * Propiedades:
 *   - DRY RUN por defecto. Aplica solo con --write.
 *   - NO destructivo: nunca borra docs legacy (quedan como respaldo).
 *   - Idempotente: si el id ya existe en la canonica, se omite (la canonica gana).
 *   - Auto-sanador: escribe SOLO las claves permitidas por las reglas y
 *     normaliza invariantes (memberCount == memberIds.length, timestamps),
 *     para que el doc migrado sea editable por el cliente sin romper reglas.
 *
 * La auditoria va a consola (capturar la salida). NUNCA se anaden marcadores
 * de migracion al doc, porque las reglas validan hasOnlyKeys en cada update.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *     node scripts/consolidate-cleaning-groups.js          # dry-run
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *     node scripts/consolidate-cleaning-groups.js --write   # aplica
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

const CANONICAL_SUBPATH = (cid) => `congregations/${cid}/cleaningGroups`;

const buildLegacySources = (db, cid) => [
  {
    label: 'nested:cleaning_groups',
    ref: db.collection(`congregations/${cid}/cleaning_groups`),
  },
  {
    label: 'root:cleaningGroups',
    ref: db.collection('cleaningGroups').where('congregationId', '==', cid),
  },
  {
    label: 'root:cleaning_groups',
    ref: db.collection('cleaning_groups').where('congregationId', '==', cid),
  },
];

const parseArgs = () => {
  const args = new Set(process.argv.slice(2));
  return { write: args.has('--write') };
};

const init = () => {
  initializeApp({ credential: applicationDefault() });
  return getFirestore();
};

/**
 * Devuelve SOLO las claves permitidas por allowedCleaningGroupKeys(), normalizadas
 * para satisfacer validCleaningGroupData(). Cualquier clave extra del doc legacy se
 * descarta para que el cliente pueda actualizar el doc sin violar hasOnlyKeys.
 */
const sanitizeGroup = (data, cid) => {
  const memberIds = Array.isArray(data.memberIds)
    ? data.memberIds.filter((v) => typeof v === 'string')
    : [];

  const out = {
    name: typeof data.name === 'string' ? data.name.slice(0, 80) : '',
    congregationId: cid,
    groupType: data.groupType === 'family' ? 'family' : 'standard',
    memberIds,
    // Invariante exigido por las reglas: memberCount == memberIds.size().
    memberCount: memberIds.length,
    isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (typeof data.description === 'string' && data.description.length > 0) {
    out.description = data.description.slice(0, 300);
  }

  return out;
};

const loadCanonicalIds = async (db, cid) => {
  const snap = await db.collection(CANONICAL_SUBPATH(cid)).get();
  return new Set(snap.docs.map((d) => d.id));
};

const consolidateCongregation = async (db, cid, write, totals) => {
  const canonicalIds = await loadCanonicalIds(db, cid);
  const seen = new Set(canonicalIds);
  const targetCol = db.collection(CANONICAL_SUBPATH(cid));

  for (const source of buildLegacySources(db, cid)) {
    let snap;
    try {
      snap = await source.ref.get();
    } catch (error) {
      console.warn(`[${cid}] no se pudo leer ${source.label}: ${error.message}`);
      continue;
    }

    for (const docSnap of snap.docs) {
      totals.scanned += 1;

      if (seen.has(docSnap.id)) {
        totals.skipped += 1;
        if (canonicalIds.has(docSnap.id)) {
          // Ya existe en la canonica: candidato a borrado legacy en el paso de limpieza.
          totals.legacyDuplicatesOfCanonical += 1;
          console.log(`[${cid}] SKIP ${docSnap.id} (ya en canonica) <- ${source.label}`);
        } else {
          console.log(`[${cid}] SKIP ${docSnap.id} (ya copiado en esta corrida) <- ${source.label}`);
        }
        continue;
      }

      const payload = sanitizeGroup(docSnap.data() || {}, cid);

      if (!payload.name) {
        totals.warnings += 1;
        console.warn(
          `[${cid}] WARN ${docSnap.id} sin nombre. Se migra pero requiere correccion manual del nombre.`
        );
      }

      totals.migrated += 1;
      seen.add(docSnap.id);
      console.log(
        `[${cid}] MIGRATE ${docSnap.id} <- ${source.label} -> ${CANONICAL_SUBPATH(cid)} ` +
          `(name="${payload.name}", members=${payload.memberCount})`
      );

      if (write) {
        await targetCol.doc(docSnap.id).set(payload);
      }
    }
  }
};

/**
 * Reporta grupos legacy de las colecciones raiz cuyo congregationId NO corresponde
 * a ninguna congregacion existente (huerfanos que la consolidacion no alcanzaria).
 */
const reportOrphans = async (db, knownCongregationIds) => {
  const orphans = [];
  for (const rootCol of ['cleaningGroups', 'cleaning_groups']) {
    const snap = await db.collection(rootCol).get();
    snap.docs.forEach((d) => {
      const cid = d.get('congregationId');
      if (typeof cid !== 'string' || !knownCongregationIds.has(cid)) {
        orphans.push({ collection: rootCol, id: d.id, congregationId: cid ?? null });
      }
    });
  }
  if (orphans.length > 0) {
    console.warn(`\nHUERFANOS (no migrados, congregationId desconocido): ${orphans.length}`);
    orphans.forEach((o) =>
      console.warn(`  - ${o.collection}/${o.id} congregationId=${o.congregationId}`)
    );
  }
  return orphans.length;
};

const main = async () => {
  const { write } = parseArgs();
  const db = init();

  if (!write) {
    console.log('DRY RUN. Re-run with --write to apply changes.\n');
  }

  const congregations = await db.collection('congregations').get();
  const knownCongregationIds = new Set(congregations.docs.map((d) => d.id));

  const totals = {
    congregations: 0,
    scanned: 0,
    migrated: 0,
    skipped: 0,
    legacyDuplicatesOfCanonical: 0,
    warnings: 0,
  };

  for (const c of congregations.docs) {
    totals.congregations += 1;
    await consolidateCongregation(db, c.id, write, totals);
  }

  const orphans = await reportOrphans(db, knownCongregationIds);

  console.log('\n===== RESUMEN =====');
  console.log({ mode: write ? 'write' : 'dry-run', ...totals, orphans });

  if (!write) {
    console.log('\nNada se escribio. Revisa el log y vuelve a correr con --write.');
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
