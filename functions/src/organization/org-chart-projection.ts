import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { SERVICE_DEPARTMENT_LABELS } from '../users/constants.js';
import type { ServiceDepartment, ServicePosition, StoredServiceAssignment } from '../users/types.js';

// Coordinador y Secretario se colocan por jerarquia, no como nodos de departamento operativo.
const STRUCTURAL_DEPARTMENTS: ServiceDepartment[] = ['coordinacion', 'secretaria'];

// Orden por defecto para departamentos que la reconciliacion deba crear si faltan.
const DEFAULT_DEPARTMENT_ORDER: Partial<Record<ServiceDepartment, number>> = {
  predicacion: 3,
  territorios: 4,
  reuniones: 5,
  asignaciones: 6,
  limpieza: 7,
  hospitalidad: 8,
  discursos: 9,
  tesoreria: 10,
  acomodadores_microfonos: 11,
  audio_video: 12,
  literatura: 13,
  mantenimiento: 14,
  usuarios: 15,
  configuracion: 16,
};

type ActiveUser = {
  uid: string;
  displayName: string;
  email?: string;
  servicePosition?: ServicePosition;
  serviceDepartment?: ServiceDepartment;
  serviceAssignments: StoredServiceAssignment[];
};

type DesiredAssignment = {
  id: string;
  departmentId: ServiceDepartment;
  position: ServicePosition;
  userId: string;
  displayName: string;
  email?: string;
  title: string;
  parentAssignmentId: string | null;
  level: number;
  order: number;
};

export type ReconcileResult = {
  created: number;
  updated: number;
  deactivated: number;
  departmentsCreated: number;
  warnings: string[];
};

const assignmentDocId = (departmentId: string, position: string, uid: string): string =>
  `auto_${departmentId}_${position}_${uid}`;

const positionLevel = (position: ServicePosition): number => {
  if (position === 'coordinador') return 0;
  if (position === 'secretario') return 1;
  return 3;
};

const positionRank = (position: ServicePosition): number => {
  if (position === 'coordinador') return 0;
  if (position === 'secretario') return 1;
  if (position === 'encargado') return 2;
  return 3;
};

// Asignaciones de servicio efectivas de un usuario (soporta esquema legacy).
const resolveUserAssignments = (user: ActiveUser): StoredServiceAssignment[] => {
  if (user.serviceAssignments.length > 0) return user.serviceAssignments;
  if (!user.servicePosition) return [];

  const label =
    user.servicePosition === 'coordinador'
      ? 'Coordinador'
      : user.servicePosition === 'secretario'
        ? 'Secretario'
        : user.serviceDepartment
          ? `${user.servicePosition === 'encargado' ? 'Encargado' : 'Auxiliar'} de ${SERVICE_DEPARTMENT_LABELS[user.serviceDepartment]}`
          : undefined;

  if (!label) return [];

  const assignment: StoredServiceAssignment = { position: user.servicePosition, label };
  if (user.serviceDepartment) assignment.department = user.serviceDepartment;
  return [assignment];
};

// Pura y testeable: dada la lista de usuarios activos, calcula el set de asignaciones
// deseadas del organigrama, con IDs deterministas y enlaces de padre.
export const computeDesiredAssignments = (
  users: ActiveUser[]
): { assignments: DesiredAssignment[]; referencedDepartments: Set<ServiceDepartment>; warnings: string[] } => {
  const warnings: string[] = [];
  const orderedUsers = [...users].sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));

  type Row = { user: ActiveUser; assignment: StoredServiceAssignment };
  const rows: Row[] = [];
  for (const user of orderedUsers) {
    for (const assignment of resolveUserAssignments(user)) rows.push({ user, assignment });
  }

  // Coordinador y Secretario son unicos: se toma el primero por nombre.
  let coordinatorUid: string | null = null;
  let secretaryUid: string | null = null;
  for (const { user, assignment } of rows) {
    if (assignment.position === 'coordinador') {
      if (!coordinatorUid) coordinatorUid = user.uid;
      else warnings.push('Hay mas de un Coordinador; se usa el primero por nombre.');
    }
    if (assignment.position === 'secretario') {
      if (!secretaryUid) secretaryUid = user.uid;
      else warnings.push('Hay mas de un Secretario; se usa el primero por nombre.');
    }
  }

  const coordinatorAssignmentId = coordinatorUid
    ? assignmentDocId('coordinacion', 'coordinador', coordinatorUid)
    : null;

  // Encargado por departamento (para colgar auxiliares).
  const encargadoIdByDept = new Map<ServiceDepartment, string>();
  for (const { user, assignment } of rows) {
    if (assignment.position === 'encargado' && assignment.department) {
      if (!encargadoIdByDept.has(assignment.department)) {
        encargadoIdByDept.set(assignment.department, assignmentDocId(assignment.department, 'encargado', user.uid));
      }
    }
  }

  const referencedDepartments = new Set<ServiceDepartment>();
  const emitted = new Set<string>();
  const assignments: DesiredAssignment[] = [];

  for (const { user, assignment } of rows) {
    let departmentId: ServiceDepartment;
    let parentAssignmentId: string | null;

    if (assignment.position === 'coordinador') {
      if (coordinatorUid !== user.uid) continue; // ignora duplicados
      departmentId = 'coordinacion';
      parentAssignmentId = null;
    } else if (assignment.position === 'secretario') {
      if (secretaryUid !== user.uid) continue; // ignora duplicados
      departmentId = 'secretaria';
      parentAssignmentId = coordinatorAssignmentId; // informativo; el arbol lo coloca por jerarquia
    } else {
      if (!assignment.department) {
        warnings.push(`${user.displayName}: puesto "${assignment.position}" sin departamento; se omite.`);
        continue;
      }
      departmentId = assignment.department;
      referencedDepartments.add(assignment.department);
      parentAssignmentId =
        assignment.position === 'auxiliar'
          ? encargadoIdByDept.get(assignment.department) ?? null
          : null; // encargado cuelga directo del nodo de departamento
    }

    const id = assignmentDocId(departmentId, assignment.position, user.uid);
    if (emitted.has(id)) continue;
    emitted.add(id);

    assignments.push({
      id,
      departmentId,
      position: assignment.position,
      userId: user.uid,
      displayName: user.displayName,
      email: user.email,
      title: assignment.label,
      parentAssignmentId,
      level: positionLevel(assignment.position),
      order: positionRank(assignment.position) + 1,
    });
  }

  if (!coordinatorUid) warnings.push('Ningun usuario tiene el puesto de Coordinador.');
  return { assignments, referencedDepartments, warnings };
};

// Reconcilia la proyeccion departmentAssignments de una congregacion a partir de los
// usuarios activos. Idempotente. Solo escribe departments/departmentAssignments.
export const reconcileOrgChartProjection = async (
  congregationId: string,
  db: Firestore = getFirestore()
): Promise<ReconcileResult> => {
  const cid = congregationId.trim();
  if (!cid) return { created: 0, updated: 0, deactivated: 0, departmentsCreated: 0, warnings: ['congregationId vacio'] };

  const usersSnap = await db
    .collection('users')
    .where('congregationId', '==', cid)
    .where('isActive', '==', true)
    .get();

  const users: ActiveUser[] = usersSnap.docs
    .map((docSnap) => {
      const data = docSnap.data();
      return {
        uid: docSnap.id,
        displayName: typeof data.displayName === 'string' ? data.displayName : '',
        email: typeof data.email === 'string' ? data.email : undefined,
        servicePosition: data.servicePosition as ServicePosition | undefined,
        serviceDepartment: data.serviceDepartment as ServiceDepartment | undefined,
        serviceAssignments: Array.isArray(data.serviceAssignments)
          ? (data.serviceAssignments as StoredServiceAssignment[])
          : [],
      };
    })
    .filter((user) => user.displayName.trim().length > 0);

  const { assignments, referencedDepartments, warnings } = computeDesiredAssignments(users);

  const deptCol = db.collection('congregations').doc(cid).collection('departments');
  const asgCol = db.collection('congregations').doc(cid).collection('departmentAssignments');
  const [deptSnap, asgSnap] = await Promise.all([deptCol.get(), asgCol.get()]);

  const existingDeptIds = new Set(deptSnap.docs.map((docSnap) => docSnap.id));
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();

  // 1) Crear docs de departamento faltantes (NUNCA sobrescribe existentes).
  let departmentsCreated = 0;
  for (const deptId of referencedDepartments) {
    if (STRUCTURAL_DEPARTMENTS.includes(deptId)) continue;
    if (existingDeptIds.has(deptId)) continue;
    batch.set(deptCol.doc(deptId), {
      id: deptId,
      congregationId: cid,
      name: SERVICE_DEPARTMENT_LABELS[deptId] ?? deptId,
      description: '',
      icon: '',
      color: '',
      order: DEFAULT_DEPARTMENT_ORDER[deptId] ?? 50,
      isActive: true,
      allowMultipleManagers: false,
      allowMultipleAssistants: true,
      createdAt: now,
      updatedAt: now,
    });
    departmentsCreated += 1;
  }

  // 2) Upsert de asignaciones deseadas (solo claves del allowlist de reglas).
  const existingById = new Map(asgSnap.docs.map((docSnap) => [docSnap.id, docSnap.data()]));
  const desiredIds = new Set(assignments.map((assignment) => assignment.id));
  let created = 0;
  let updated = 0;

  for (const assignment of assignments) {
    const departmentName = SERVICE_DEPARTMENT_LABELS[assignment.departmentId] ?? assignment.departmentId;
    const base: Record<string, unknown> = {
      id: assignment.id,
      congregationId: cid,
      departmentId: assignment.departmentId,
      departmentName,
      userId: assignment.userId,
      displayName: assignment.displayName,
      position: assignment.position,
      title: assignment.title,
      parentAssignmentId: assignment.parentAssignmentId,
      level: assignment.level,
      order: assignment.order,
      isActive: true,
      updatedAt: now,
      updatedBy: 'system',
    };
    if (assignment.email) base.email = assignment.email;

    if (existingById.has(assignment.id)) {
      batch.set(asgCol.doc(assignment.id), base, { merge: true });
      updated += 1;
    } else {
      batch.set(asgCol.doc(assignment.id), { ...base, createdAt: now, createdBy: 'system' });
      created += 1;
    }
  }

  // 3) Desactivar asignaciones activas que ya no correspondan.
  let deactivated = 0;
  for (const docSnap of asgSnap.docs) {
    const data = docSnap.data();
    if (data.isActive !== true) continue;
    if (desiredIds.has(docSnap.id)) continue;
    batch.set(asgCol.doc(docSnap.id), { isActive: false, updatedAt: now, updatedBy: 'system' }, { merge: true });
    deactivated += 1;
  }

  await batch.commit();
  logger.info('reconcileOrgChartProjection done', {
    congregationId: cid,
    created,
    updated,
    deactivated,
    departmentsCreated,
    warnings,
  });

  return { created, updated, deactivated, departmentsCreated, warnings };
};
