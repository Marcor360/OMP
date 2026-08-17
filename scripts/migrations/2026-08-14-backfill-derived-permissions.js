/* eslint-disable no-console */
// F0.4: backfill de derivedPermissions para usuarios existentes.
//
// Fase 0 materializo la derivacion de permisos por cargo (position x
// department) en Cloud Functions: functions/src/users/derived-permissions-trigger.ts
// escribe derivedPermissions al escribir la ficha del usuario, y
// rules_src/04-department-permissions.rules:25 ya lo lee. Pero el trigger es
// onDocumentWritten: solo dispara con una escritura nueva. Ningun usuario
// existente tiene el campo poblado todavia. Mientras las ramas hardcodeadas
// de servicePosition sigan en las rules esto no rompe nada, pero Fase 1 las
// elimina -- y sin este backfill, ese despliegue deja a toda la congregacion
// sin acceso de golpe. Este script es el prerequisito bloqueante de Fase 1.
//
// Deteccion: se recalcula derivedPermissions para cada usuario con
// getPermissionsFromServiceAssignments() -- la MISMA funcion que usa el
// trigger, importada del build compilado de functions/src/shared/derived-permissions.ts.
// No se reimplementa la tabla de permisos aqui: hacerlo reintroduce
// exactamente la divergencia cliente/servidor que Fase 0 cierra.
//
// Idempotente: permissionsEqual(derived, stored) decide si hay algo que
// escribir. Si el valor derivado ya coincide con el almacenado, se cuenta
// como "ya migrado" y no se toca el documento.
//
// Escribe UNICAMENTE el campo derivedPermissions. Nunca permissions
// (otorgado a mano), role, servicePosition, serviceDepartment ni
// serviceAssignments.
//
// Dry-run por defecto; requiere --apply para escribir.
//
// Desglose de cobertura (actualizado tras el PR de cobertura explicita de la
// tabla de derivacion): ademas del conteo por servicePosition, agrupa por
// serviceDepartment y contrasta cada departamento vacio contra
// SERVICE_DEPARTMENT_PERMISSION_DECISIONS -- si aparece un departamento con
// derivedPermissions vacio que esa tabla NO documenta como deliberado (motivo
// != null), es un hueco real y Fase 1 no debe desplegarse hasta cerrarlo.
//
// PREREQUISITO: este script requiere el build compilado de functions/.
// Correr primero:
//   cd functions && npm run build
// El script importa functions/lib/shared/derived-permissions.js por ruta
// relativa, asi que debe ejecutarse desde un checkout del repo con
// functions/lib/ ya generado (no como archivo aislado).
//
// Uso (Google Cloud Shell, con el repo clonado y functions/ ya compilado):
//   echo 'BASE64_AQUI' | base64 -d > backfill.js && node backfill.js
//   node backfill.js --apply
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const {
  getPermissionsFromServiceAssignments,
  permissionsEqual,
  SERVICE_DEPARTMENT_PERMISSION_DECISIONS,
} = require('../../functions/lib/shared/derived-permissions.js');

const PAGE_SIZE = 300;
const BATCH_SIZE = 400;

const parseArgs = () => {
  const args = new Set(process.argv.slice(2));
  return { apply: args.has('--apply') };
};

const init = () => {
  initializeApp({ credential: applicationDefault() });
  return getFirestore();
};

// Mismas guardas de tipo que decideDerivedPermissionsUpdate en
// functions/src/users/derived-permissions-trigger.ts:47-53. No es la tabla de
// permisos: es solo la extraccion de los tres campos fuente del documento.
const buildAssignmentInput = (data) => ({
  servicePosition: typeof data.servicePosition === 'string' ? data.servicePosition : undefined,
  serviceDepartment: typeof data.serviceDepartment === 'string' ? data.serviceDepartment : undefined,
  serviceAssignments: Array.isArray(data.serviceAssignments) ? data.serviceAssignments : undefined,
});

// Mismos assignments que arma internamente getPermissionsFromServiceAssignments,
// solo para el desglose de cobertura (no participan en el calculo de permisos).
const listAssignments = (input) => {
  const assignments = [];
  if (input.servicePosition) {
    assignments.push({ position: input.servicePosition, department: input.serviceDepartment });
  }
  (input.serviceAssignments ?? []).forEach((assignment) => {
    if (assignment && typeof assignment.position === 'string' && assignment.position) {
      assignments.push({ position: assignment.position, department: assignment.department });
    }
  });
  return assignments;
};

const main = async () => {
  const { apply } = parseArgs();
  const firestore = init();

  if (!apply) {
    console.log('DRY RUN. Re-run con --apply para escribir.');
  }

  const report = { processed: 0, migrated: 0, alreadyMigrated: 0, failed: 0 };
  // Desglose clave: usuarios con cargo (servicePosition o serviceAssignments)
  // cuyo derivedPermissions calculado queda VACIO. Con las decisiones de
  // SERVICE_DEPARTMENT_PERMISSION_DECISIONS ya explicitas, cada departamento
  // vacio DEBE tener un motivo documentado (string) alli. Si aparece uno con
  // motivo null (o ausente de la tabla), es un hueco real: Fase 1 no debe
  // desplegarse hasta cerrarlo.
  const emptyByPosition = {};
  const emptyByDepartment = {};
  const undocumentedGaps = new Set();

  let cursor = null;
  let batch = firestore.batch();
  let batchCount = 0;

  const flushBatch = async () => {
    if (batchCount === 0) return;
    await batch.commit();
    batch = firestore.batch();
    batchCount = 0;
  };

  while (true) {
    let query = firestore.collection('users').orderBy('__name__').limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);

    const snap = await query.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      report.processed += 1;
      const data = doc.data() || {};

      const input = buildAssignmentInput(data);
      const derived = getPermissionsFromServiceAssignments(input);
      const stored = data.derivedPermissions ?? null;

      const assignments = listAssignments(input);
      if (assignments.length > 0 && Object.keys(derived).length === 0) {
        assignments.forEach(({ position, department }) => {
          emptyByPosition[position] = (emptyByPosition[position] ?? 0) + 1;

          if (!department) return;
          emptyByDepartment[department] = (emptyByDepartment[department] ?? 0) + 1;

          const decision = Object.prototype.hasOwnProperty.call(
            SERVICE_DEPARTMENT_PERMISSION_DECISIONS,
            department
          )
            ? SERVICE_DEPARTMENT_PERMISSION_DECISIONS[department]
            : undefined;
          // null = mapeado deliberadamente (aqui no deberia dar vacio, pero eso
          // se contrasta en PR C/tests, no en produccion). undefined = fuera de
          // la tabla. string = motivo documentado para estar vacio: esperado.
          if (decision === undefined || decision === null) {
            undocumentedGaps.add(department);
          }
        });
      }

      if (permissionsEqual(derived, stored)) {
        report.alreadyMigrated += 1;
        continue;
      }

      console.log(`[derived-permissions] ${doc.ref.path}: derivedPermissions desactualizado`);

      if (!apply) {
        report.migrated += 1;
        continue;
      }

      try {
        batch.update(doc.ref, { derivedPermissions: derived });
        batchCount += 1;
        report.migrated += 1;

        if (batchCount >= BATCH_SIZE) {
          await flushBatch();
        }
      } catch (error) {
        report.failed += 1;
        console.error(`[derived-permissions] ${doc.ref.path}: FALLO`, error);
      }
    }

    cursor = snap.docs[snap.docs.length - 1];
  }

  await flushBatch();

  console.log({ mode: apply ? 'apply' : 'dry-run', ...report });
  console.log('Usuarios con cargo y derivedPermissions vacio, por servicePosition:');
  console.log(emptyByPosition);
  console.log('Usuarios con cargo y derivedPermissions vacio, por serviceDepartment:');
  console.log(emptyByDepartment);

  if (undocumentedGaps.size > 0) {
    console.error(
      '[derived-permissions] HUECO NO DOCUMENTADO: los siguientes departamentos quedan ' +
        'con derivedPermissions vacio sin una decision (null o motivo) registrada en ' +
        'SERVICE_DEPARTMENT_PERMISSION_DECISIONS. Fase 1 NO debe desplegarse hasta ' +
        'cerrarlo:',
      Array.from(undocumentedGaps)
    );
    process.exitCode = 1;
  } else {
    console.log(
      '[derived-permissions] Cada departamento vacio corresponde a una decision ' +
        'documentada en SERVICE_DEPARTMENT_PERMISSION_DECISIONS. Sin huecos.'
    );
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
