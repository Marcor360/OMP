/* eslint-disable no-console */
/**
 * Fase 0 (F0.4) — backfill de derivedPermissions para todos los usuarios
 * existentes.
 *
 * ORDEN DE DESPLIEGUE (no negociable, ver OMP-AUDIT §6):
 *   F0.1, F0.2, F0.3 -> deploy:rules -> deploy:functions -> ESTE SCRIPT
 *   -> verificar -> F0.5, F0.6 -> deploy:rules -> deploy:functions
 * Este backfill va ANTES de que hasPermission() lea derivedPermissions
 * (F0.5). Si se invierte el orden, no hay impacto negativo porque
 * hasPermission() todavia no lee el campo -- pero el trigger de Fase 0
 * (F0.2) YA recalcula derivedPermissions en cada escritura de usuario desde
 * que se despliega, asi que este backfill solo cubre a los usuarios que NO
 * se hayan escrito desde entonces.
 *
 * Propiedades:
 *   - DRY RUN por defecto. Aplica solo con --apply.
 *   - Chunks de 400 por batch.
 *   - Idempotente: si derivedPermissions ya coincide con el calculado, se omite.
 *   - Nunca toca permissions (otorgado a mano), role ni serviceAssignments.
 *
 * IMPORTANTE: la tabla assignmentToPermissions de abajo es una copia textual
 * de functions/src/shared/derived-permissions.ts (que a su vez es copia de
 * src/utils/permissions/permissions.ts:219-305). Se duplica aqui a proposito
 * para que el script sea un archivo unico, copiable a Cloud Shell sin
 * depender de que functions/ este compilado (functions/lib/ es un artefacto
 * de build, gitignored). Si la tabla cambia, actualizar las TRES copias en
 * el mismo PR.
 *
 * Uso local:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *     node functions/scripts/backfill-derived-permissions.js          # dry-run
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *     node functions/scripts/backfill-derived-permissions.js --apply   # aplica
 *
 * Uso en Cloud Shell (heredoc no es fiable ahi):
 *   echo 'BASE64_DE_ESTE_ARCHIVO' | base64 -d > s.js && node s.js
 *   echo 'BASE64_DE_ESTE_ARCHIVO' | base64 -d > s.js && node s.js --apply
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CHUNK_SIZE = 400;

const PERMISSION_DEPARTMENTS = [
  'usuarios', 'reuniones', 'limpieza', 'departments', 'predicacion',
  'tesoreria', 'pagos', 'configuracion', 'avisos', 'asignaciones',
  'acomodadores_microfonos', 'organigrama',
];
const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete', 'manage', 'approve', 'export'];
const TERRITORY_PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete', 'assign', 'manage'];

const mergePermissions = (...permissionSets) =>
  permissionSets.reduce((merged, permissions) => {
    if (!permissions) return merged;

    PERMISSION_DEPARTMENTS.forEach((department) => {
      const departmentPermissions = permissions[department];
      if (!departmentPermissions) return;

      const target = merged[department] ?? {};
      PERMISSION_ACTIONS.forEach((action) => {
        if (departmentPermissions[action] === true) target[action] = true;
      });
      if (department === 'predicacion' && departmentPermissions.territories) {
        const currentTerritories = target.territories ?? {};
        TERRITORY_PERMISSION_ACTIONS.forEach((action) => {
          if (departmentPermissions.territories?.[action] === true) currentTerritories[action] = true;
        });
        target.territories = currentTerritories;
      }
      merged[department] = target;
    });

    return merged;
  }, {});

// Espejo textual de assignmentToPermissions en
// functions/src/shared/derived-permissions.ts. Ver nota de sincronizacion arriba.
const assignmentToPermissions = (assignment) => {
  if (assignment.position === 'encargado' && assignment.department === 'limpieza') {
    return { limpieza: { view: true, create: true, edit: true, delete: true, manage: true } };
  }
  if (assignment.position === 'auxiliar' && assignment.department === 'limpieza') {
    return { limpieza: { view: true, edit: true } };
  }
  if (assignment.position === 'encargado' && assignment.department === 'tesoreria') {
    return {
      tesoreria: { view: true, create: true, edit: true, delete: true, manage: true },
      pagos: { view: true, create: true, approve: true, manage: true },
    };
  }
  if (assignment.position === 'auxiliar' && assignment.department === 'tesoreria') {
    return { tesoreria: { view: true, create: true, edit: true }, pagos: { view: true } };
  }
  if (assignment.position === 'encargado' && (assignment.department === 'predicacion' || assignment.department === 'territorios')) {
    return { predicacion: { view: true, approve: true, export: true, manage: true } };
  }
  if (assignment.position === 'auxiliar' && (assignment.department === 'predicacion' || assignment.department === 'territorios')) {
    return { predicacion: { view: true, export: true } };
  }
  if (assignment.position === 'encargado' && assignment.department === 'reuniones') {
    return { reuniones: { view: true, create: true, edit: true, delete: true, manage: true } };
  }
  if (assignment.position === 'auxiliar' && assignment.department === 'reuniones') {
    return { reuniones: { view: true, edit: true } };
  }
  if (assignment.position === 'encargado' && assignment.department === 'discursos') {
    return { asignaciones: { view: true, create: true, edit: true, delete: true, manage: true } };
  }
  if (assignment.position === 'auxiliar' && assignment.department === 'discursos') {
    return { asignaciones: { view: true, edit: true } };
  }
  if (assignment.position === 'encargado' && assignment.department === 'acomodadores_microfonos') {
    return {
      acomodadores_microfonos: { view: true, create: true, edit: true, manage: true },
      asignaciones: { view: true, create: true, edit: true, manage: true },
      reuniones: { view: true, edit: true },
    };
  }
  if (assignment.position === 'auxiliar' && assignment.department === 'acomodadores_microfonos') {
    return {
      acomodadores_microfonos: { view: true, edit: true },
      asignaciones: { view: true, edit: true },
      reuniones: { view: true, edit: true },
    };
  }
  return {};
};

const getPermissionsFromServiceAssignments = (user) => {
  const assignments = [
    ...(user?.servicePosition ? [{ position: user.servicePosition, department: user.serviceDepartment }] : []),
    ...(Array.isArray(user?.serviceAssignments) ? user.serviceAssignments : []),
  ];
  return mergePermissions(...assignments.map(assignmentToPermissions));
};

const permissionsEqual = (left, right) => {
  const normalize = (permissions) => {
    const departments = PERMISSION_DEPARTMENTS.map((department) => {
      const dept = permissions?.[department];
      if (!dept) return null;
      const actions = PERMISSION_ACTIONS.filter((action) => dept[action] === true);
      const territories = dept.territories
        ? TERRITORY_PERMISSION_ACTIONS.filter((action) => dept.territories?.[action] === true)
        : [];
      if (actions.length === 0 && territories.length === 0) return null;
      return [department, actions.join(','), territories.join(',')].join(':');
    }).filter((entry) => entry !== null);
    return departments.join('|');
  };
  return normalize(left) === normalize(right);
};

const parseArgs = () => {
  const args = new Set(process.argv.slice(2));
  return { apply: args.has('--apply') };
};

const init = () => {
  initializeApp({ credential: applicationDefault() });
  return getFirestore();
};

const chunk = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const main = async () => {
  const { apply } = parseArgs();
  const db = init();

  if (!apply) {
    console.log('DRY RUN. Re-run with --apply to write changes.\n');
  }

  const snap = await db.collection('users').get();
  const totals = { total: snap.size, updated: 0, unchanged: 0, errors: 0 };
  const toUpdate = [];

  snap.docs.forEach((docSnap) => {
    try {
      const data = docSnap.data() || {};
      const derived = getPermissionsFromServiceAssignments(data);
      const stored = data.derivedPermissions ?? null;

      if (permissionsEqual(derived, stored)) {
        totals.unchanged += 1;
        return;
      }

      totals.updated += 1;
      toUpdate.push({ id: docSnap.id, derived });
      console.log(`  - ${docSnap.id}: derivedPermissions ${stored ? 'cambia' : 'se agrega'} -> ${JSON.stringify(derived)}`);
    } catch (error) {
      totals.errors += 1;
      console.error(`  ! ${docSnap.id}: error calculando derivedPermissions: ${error.message}`);
    }
  });

  if (apply && toUpdate.length > 0) {
    for (const group of chunk(toUpdate, CHUNK_SIZE)) {
      const batch = db.batch();
      group.forEach(({ id, derived }) => {
        batch.update(db.collection('users').doc(id), { derivedPermissions: derived });
      });
      await batch.commit();
    }
  }

  console.log('\n===== RESUMEN =====');
  console.log({ mode: apply ? 'apply' : 'dry-run', ...totals });

  if (!apply) {
    console.log('\nNada se escribio. Revisa el log y vuelve a correr con --apply.');
  } else if (totals.updated === 0) {
    console.log('\n0 actualizados: si esta es la segunda corrida con --apply, es lo esperado (idempotente).');
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
