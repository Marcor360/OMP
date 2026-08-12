/* eslint-disable no-console */
/**
 * P0 (predicacion/territorios) — script de solo lectura.
 *
 * Antes de desplegar el cierre del hueco de isPreachingManager (auxiliar ya no
 * obtiene nivel Manager), lista todos los usuarios activos que HOY tienen ese
 * acceso solo por ser 'auxiliar' de predicacion o territorios (sin cumplir
 * ningun otro requisito). Tras el despliegue, estos usuarios pierden:
 *   - list de congregations/{cid}/preachingReports/{monthId}/submissions
 *   - acceso a PreachingManagerScreen / PreachingManagerPanel
 *
 * NO ESCRIBE NADA. Es puramente informativo, para avisar a estos hermanos o
 * reasignarles el cargo de encargado (si corresponde y cumplen isElder) antes
 * de que pierdan acceso.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *     node functions/scripts/list-preaching-auxiliares-p0.js
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *     node functions/scripts/list-preaching-auxiliares-p0.js --congregation=CID
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const parseArgs = () => {
  const congArg = process.argv.slice(2).find((arg) => arg.startsWith('--congregation='));
  return { congregationId: congArg ? congArg.split('=')[1] : null };
};

const init = () => {
  initializeApp({ credential: applicationDefault() });
  return getFirestore();
};

const isAuxiliarPreachingOnly = (data) => {
  const servicePosition = data.servicePosition;
  const serviceDepartment = data.serviceDepartment;
  const directHit =
    servicePosition === 'auxiliar' &&
    (serviceDepartment === 'predicacion' || serviceDepartment === 'territorios');

  const assignments = Array.isArray(data.serviceAssignments) ? data.serviceAssignments : [];
  const assignmentHit = assignments.some(
    (assignment) =>
      assignment &&
      assignment.position === 'auxiliar' &&
      (assignment.department === 'predicacion' || assignment.department === 'territorios')
  );

  return directHit || assignmentHit;
};

const main = async () => {
  const { congregationId } = parseArgs();
  const db = init();

  let query = db.collection('users').where('isActive', '==', true);
  if (congregationId) {
    query = query.where('congregationId', '==', congregationId);
  }

  const snap = await query.get();
  const affected = [];

  snap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    if (isAuxiliarPreachingOnly(data)) {
      affected.push({
        uid: docSnap.id,
        congregationId: data.congregationId ?? null,
        email: data.email ?? null,
        displayName: data.displayName ?? `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim(),
        servicePosition: data.servicePosition ?? null,
        serviceDepartment: data.serviceDepartment ?? null,
        serviceAssignments: Array.isArray(data.serviceAssignments)
          ? data.serviceAssignments
              .filter((a) => a && a.position === 'auxiliar' && (a.department === 'predicacion' || a.department === 'territorios'))
              .map((a) => `${a.position}:${a.department}`)
          : [],
      });
    }
  });

  console.log(`Usuarios escaneados: ${snap.size}`);
  console.log(`Auxiliares de predicacion/territorios que PIERDEN acceso Manager tras P0: ${affected.length}\n`);

  affected.forEach((u) => {
    console.log(
      `  - ${u.uid} | ${u.email ?? 'sin email'} | ${u.displayName || 'sin nombre'} | ` +
        `congregationId=${u.congregationId} | via=${[u.servicePosition ? 'servicePosition' : null, ...u.serviceAssignments].filter(Boolean).join(',')}`
    );
  });

  if (affected.length === 0) {
    console.log('Ningun usuario afectado. Seguro desplegar sin aviso previo.');
  } else {
    console.log(
      '\nAntes de desplegar rules_src/03 (P0), avisar a estos usuarios o ' +
        "reasignarles a 'encargado' si cumplen privileges.isElder == true."
    );
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
