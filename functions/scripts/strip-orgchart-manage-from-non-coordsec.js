/* eslint-disable no-console */
/**
 * Quita permissions.departments.manage / permissions.organigrama.manage de usuarios
 * que no son coordinador/secretario ni admin de sistema.
 *
 * DRY RUN por defecto. Aplica solo con --apply.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *     node scripts/strip-orgchart-manage-from-non-coordsec.js
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *     node scripts/strip-orgchart-manage-from-non-coordsec.js --apply
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const ORG_CHART_PERMISSION_PATHS = [
  ['departments', 'permissions.departments.manage'],
  ['organigrama', 'permissions.organigrama.manage'],
];

const parseArgs = () => {
  const args = new Set(process.argv.slice(2));
  return { apply: args.has('--apply') };
};

const init = () => {
  initializeApp({ credential: applicationDefault() });
  return getFirestore();
};

const hasCoordinatorOrSecretaryAssignment = (data) => {
  if (data.servicePosition === 'coordinador' || data.servicePosition === 'secretario') {
    return true;
  }

  return Array.isArray(data.serviceAssignments) &&
    data.serviceAssignments.some(
      (assignment) =>
        assignment &&
        (assignment.position === 'coordinador' || assignment.position === 'secretario')
    );
};

const isSystemRootUser = (data) =>
  data.isSystemUser === true ||
  data.isPrimaryAdmin === true ||
  data.isRootAdmin === true ||
  data.systemProtected === true;

const getManageKeysToRemove = (data) => {
  const permissions = data.permissions || {};
  return ORG_CHART_PERMISSION_PATHS
    .filter(([key]) => permissions[key]?.manage === true)
    .map(([key, path]) => ({ key, path }));
};

const buildUpdate = (data, keysToRemove) => {
  const update = {};
  keysToRemove.forEach(({ key, path }) => {
    const block = data.permissions?.[key] || {};
    const remainingKeys = Object.keys(block).filter((blockKey) => blockKey !== 'manage');
    if (remainingKeys.length === 0) {
      update[`permissions.${key}`] = FieldValue.delete();
    } else {
      update[path] = FieldValue.delete();
    }
  });
  return update;
};

const main = async () => {
  const { apply } = parseArgs();
  const db = init();

  if (!apply) {
    console.log('DRY RUN. Re-run with --apply to write changes.\n');
  }

  const totals = {
    scanned: 0,
    affected: 0,
    modified: 0,
  };
  const affectedByCongregation = new Map();
  const usersSnap = await db.collection('users').get();

  for (const docSnap of usersSnap.docs) {
    totals.scanned += 1;
    const data = docSnap.data() || {};
    const keysToRemove = getManageKeysToRemove(data);

    if (
      keysToRemove.length === 0 ||
      hasCoordinatorOrSecretaryAssignment(data) ||
      isSystemRootUser(data)
    ) {
      continue;
    }

    totals.affected += 1;
    const congregationId = typeof data.congregationId === 'string' ? data.congregationId : '(sin congregacion)';
    affectedByCongregation.set(
      congregationId,
      (affectedByCongregation.get(congregationId) || 0) + 1
    );

    console.log(
      [
        `uid=${docSnap.id}`,
        `email=${data.email || ''}`,
        `role=${data.role || ''}`,
        `congregationId=${congregationId}`,
        `remove=${keysToRemove.map((item) => item.path).join(',')}`,
      ].join(' ')
    );

    if (apply) {
      await docSnap.ref.update(buildUpdate(data, keysToRemove));
      totals.modified += 1;
    }
  }

  console.log('\n===== RESUMEN =====');
  console.log({
    mode: apply ? 'apply' : 'dry-run',
    ...totals,
    affectedByCongregation: Object.fromEntries(affectedByCongregation.entries()),
  });

  if (!apply) {
    console.log('\nNada se escribio. Revisa el reporte y vuelve a correr con --apply.');
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
