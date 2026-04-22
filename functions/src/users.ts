import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

type Role = 'admin' | 'supervisor' | 'user';
type ServicePosition = 'coordinador' | 'secretario' | 'encargado' | 'auxiliar';
type ServiceDepartment =
  | 'limpieza'
  | 'literatura'
  | 'tesoreria'
  | 'mantenimiento'
  | 'discursos'
  | 'predicacion'
  | 'acomodadores_microfonos';

type ServiceAssignment = {
  position?: ServicePosition;
  department?: ServiceDepartment;
  label?: string;
};

type RequesterProfile = {
  role: Role;
  isActive: boolean;
  congregationId: string;
  displayName?: string;
  email?: string;
};

type CreateUserPayload = {
  firstName: string;
  middleName?: string;
  lastName: string;
  secondLastName?: string;
  displayName: string;
  role: Role;
  congregationId: string;
  isActive: boolean;
  phone?: string;
  password: string;
  servicePosition?: ServicePosition;
  serviceDepartment?: ServiceDepartment;
  departmentLabel?: string;
};

type UpdateUserPayload = {
  uid: string;
  displayName?: string;
  role?: Role;
  isActive?: boolean;
  phone?: string;
  phoneProvided: boolean;
  servicePosition?: ServicePosition;
  serviceDepartment?: ServiceDepartment;
  servicePositionProvided: boolean;
  serviceDepartmentProvided: boolean;
  serviceAssignmentProvided: boolean;
};

type UpdatePasswordPayload = {
  uid: string;
  newPassword: string;
};

const SERVICE_DEPARTMENT_LABELS: Record<ServiceDepartment, string> = {
  limpieza: 'Limpieza',
  literatura: 'Literatura',
  tesoreria: 'Tesoreria',
  mantenimiento: 'Mantenimiento',
  discursos: 'Discursos',
  predicacion: 'Predicacion',
  acomodadores_microfonos: 'Acomodadores y Microfonos',
};

const SERVICE_DEPARTMENT_LABEL_TO_KEY: Record<string, ServiceDepartment> = Object.fromEntries(
  Object.entries(SERVICE_DEPARTMENT_LABELS).map(([key, value]) => [value, key as ServiceDepartment])
) as Record<string, ServiceDepartment>;

function assertValidRole(role: unknown): asserts role is Role {
  if (role !== 'admin' && role !== 'supervisor' && role !== 'user') {
    throw new HttpsError('invalid-argument', 'Rol invalido.');
  }
}

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseServicePosition = (value: unknown): ServicePosition | undefined => {
  const text = normalizeText(value);
  if (!text) return undefined;
  if (text === 'coordinador' || text === 'secretario' || text === 'encargado' || text === 'auxiliar') {
    return text;
  }
  throw new HttpsError('invalid-argument', 'Asignacion de servicio invalida.');
};

const parseServiceDepartment = (value: unknown): ServiceDepartment | undefined => {
  const text = normalizeText(value);
  if (!text) return undefined;

  if (
    text === 'limpieza' ||
    text === 'literatura' ||
    text === 'tesoreria' ||
    text === 'mantenimiento' ||
    text === 'discursos' ||
    text === 'predicacion' ||
    text === 'acomodadores_microfonos'
  ) {
    return text;
  }

  throw new HttpsError('invalid-argument', 'Departamento de servicio invalido.');
};

const parseLegacyAssignmentLabel = (
  label: string | undefined
): { position?: ServicePosition; department?: ServiceDepartment } => {
  if (!label) return {};
  if (label === 'Coordinador') return { position: 'coordinador' };
  if (label === 'Secretario') return { position: 'secretario' };
  if (label.startsWith('Encargado de ')) {
    const normalizedLabel = label.replace('Encargado de ', '').trim();
    const department = SERVICE_DEPARTMENT_LABEL_TO_KEY[normalizedLabel];
    return department ? { position: 'encargado', department } : {};
  }
  if (label.startsWith('Auxiliar de ')) {
    const normalizedLabel = label.replace('Auxiliar de ', '').trim();
    const department = SERVICE_DEPARTMENT_LABEL_TO_KEY[normalizedLabel];
    return department ? { position: 'auxiliar', department } : {};
  }
  return {};
};

const buildServiceAssignmentLabel = (position?: ServicePosition, department?: ServiceDepartment): string | undefined => {
  if (!position) return undefined;
  if (position === 'coordinador') return 'Coordinador';
  if (position === 'secretario') return 'Secretario';

  if (!department) return undefined;
  const departmentLabel = SERVICE_DEPARTMENT_LABELS[department];
  if (position === 'encargado') return `Encargado de ${departmentLabel}`;
  if (position === 'auxiliar') return `Auxiliar de ${departmentLabel}`;

  return undefined;
};

const normalizeAssignmentForRole = (
  role: Role,
  position?: ServicePosition,
  department?: ServiceDepartment
): ServiceAssignment => {
  if (!position) {
    return {};
  }

  if ((position === 'coordinador' || position === 'secretario') && role !== 'admin') {
    throw new HttpsError(
      'invalid-argument',
      'Solo usuarios con rol admin pueden ser Coordinador o Secretario.'
    );
  }

  if (position === 'encargado' || position === 'auxiliar') {
    if (!department) {
      throw new HttpsError(
        'invalid-argument',
        `El departamento es obligatorio para ${position === 'encargado' ? 'Encargado' : 'Auxiliar'}.`
      );
    }
  } else if (department) {
    throw new HttpsError(
      'invalid-argument',
      'Coordinador y Secretario no deben tener departamento.'
    );
  }

  return {
    position,
    department,
    label: buildServiceAssignmentLabel(position, department),
  };
};

const shouldValidateAssignmentUniqueness = (
  assignment: ServiceAssignment,
  isActive: boolean
): boolean => {
  if (!isActive) return false;
  return assignment.position === 'coordinador' || assignment.position === 'secretario' || assignment.position === 'encargado';
};

const assertAssignmentUniqueness = async (params: {
  congregationId: string;
  assignment: ServiceAssignment;
  excludeUid?: string;
  isActive: boolean;
}): Promise<void> => {
  const { congregationId, assignment, excludeUid, isActive } = params;
  if (!shouldValidateAssignmentUniqueness(assignment, isActive)) {
    return;
  }

  const db = getFirestore();
  let q = db
    .collection('users')
    .where('congregationId', '==', congregationId)
    .where('isActive', '==', true)
    .where('servicePosition', '==', assignment.position);

  if (assignment.position === 'encargado') {
    q = q.where('serviceDepartment', '==', assignment.department);
  }

  const snap = await q.limit(5).get();
  const owner = snap.docs.find((doc) => doc.id !== excludeUid);

  if (!owner) return;

  if (assignment.position === 'coordinador') {
    throw new HttpsError('already-exists', 'Ya existe un Coordinador activo en esta congregacion.');
  }

  if (assignment.position === 'secretario') {
    throw new HttpsError('already-exists', 'Ya existe un Secretario activo en esta congregacion.');
  }

  const label = assignment.department ? SERVICE_DEPARTMENT_LABELS[assignment.department] : 'ese departamento';
  throw new HttpsError(
    'already-exists',
    `Ya existe un Encargado activo para ${label}.`
  );
};

const normalizeDomainCandidate = (value: unknown): string | undefined => {
  const source = normalizeText(value);
  if (!source) return undefined;

  let normalized = source
    .toLowerCase()
    .replace(/^mailto:/, '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  if (normalized.includes('@')) {
    normalized = normalized.split('@').pop() ?? normalized;
  }

  normalized = normalized.split('/')[0].trim();

  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) {
    return undefined;
  }

  return normalized;
};

const slugifyDomainLabel = (value: unknown): string => {
  const source = normalizeText(value) ?? 'congregacion';

  const normalized = source
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.length > 0 ? normalized : 'congregacion';
};

const resolveCongregationEmailDomain = (
  congregationId: string,
  congregationData?: Record<string, unknown>
): string => {
  const explicitDomain =
    normalizeDomainCandidate(congregationData?.emailDomain) ??
    normalizeDomainCandidate(congregationData?.domain);

  if (explicitDomain) {
    return explicitDomain;
  }

  const directFromId = normalizeDomainCandidate(congregationId);
  if (directFromId) {
    return directFromId;
  }

  const labelSource =
    normalizeText(congregationData?.slug) ??
    normalizeText(congregationData?.name) ??
    normalizeText(congregationData?.displayName) ??
    congregationId;

  return `${slugifyDomainLabel(labelSource)}.com`;
};

const normalizeNameForEmail = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const buildEmailLocalPart = (...values: (string | undefined)[]): string => {
  return values
    .map((value) => (value ? normalizeNameForEmail(value) : ''))
    .filter(Boolean)
    .join('');
};

const buildEmailLocalCandidates = (
  firstName: string,
  middleName: string | undefined,
  lastName: string
): string[] => {
  const primary = buildEmailLocalPart(firstName, lastName);
  const withMiddle = middleName ? buildEmailLocalPart(firstName, middleName, lastName) : '';

  const candidates = [primary, withMiddle].filter(Boolean);
  return Array.from(new Set(candidates));
};

const isAuthUserNotFoundError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const code = 'code' in error ? String(error.code) : '';
  return code === 'auth/user-not-found';
};

const isEmailTaken = async (email: string): Promise<boolean> => {
  try {
    await getAuth().getUserByEmail(email);
    return true;
  } catch (error) {
    if (!isAuthUserNotFoundError(error)) {
      throw error;
    }
  }

  const db = getFirestore();
  const snap = await db.collection('users').where('email', '==', email).limit(1).get();
  return !snap.empty;
};

const resolveGeneratedEmail = async (
  firstName: string,
  middleName: string | undefined,
  lastName: string,
  requiredDomain: string
): Promise<string> => {
  const normalizedDomain = requiredDomain.toLowerCase();
  const candidates = buildEmailLocalCandidates(firstName, middleName, lastName);
  const fallbackBase = candidates[0] || 'usuario';

  for (const localPart of candidates) {
    const email = `${localPart}@${normalizedDomain}`;
    if (!(await isEmailTaken(email))) {
      return email;
    }
  }

  for (let suffix = 2; suffix < 500; suffix += 1) {
    const email = `${fallbackBase}${suffix}@${normalizedDomain}`;
    if (!(await isEmailTaken(email))) {
      return email;
    }
  }

  throw new HttpsError(
    'resource-exhausted',
    'No se pudo generar un correo disponible para este usuario.'
  );
};

const splitDisplayName = (displayName: string): { firstName?: string; lastName?: string } => {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return {};
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ') || undefined,
  };
};

async function getRequesterProfile(uid: string): Promise<RequesterProfile> {
  const db = getFirestore();
  const snap = await db.collection('users').doc(uid).get();

  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'No existe perfil del usuario autenticado.');
  }

  const data = snap.data();
  if (!data?.isActive) {
    throw new HttpsError('permission-denied', 'El usuario autenticado esta inactivo.');
  }

  return data as RequesterProfile;
}

function assertAdmin(profile: { role: Role }) {
  if (profile.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un administrador puede realizar esta operacion.');
  }
}

const parseCreateUserPayload = (raw: unknown): CreateUserPayload => {
  if (typeof raw !== 'object' || raw === null) {
    throw new HttpsError('invalid-argument', 'Payload invalido.');
  }

  const data = raw as Record<string, unknown>;

  const firstName = normalizeText(data.firstName);
  const middleName = normalizeText(data.middleName) ?? normalizeText(data.secondName);
  const lastName = normalizeText(data.lastName);
  const secondLastName = normalizeText(data.secondLastName);
  const displayName =
    normalizeText(data.displayName) ?? [firstName, middleName, lastName, secondLastName].filter(Boolean).join(' ').trim();
  const congregationId = normalizeText(data.congregationId);
  const password = normalizeText(data.password);

  if (!firstName || !lastName || !displayName || !congregationId || !password) {
    throw new HttpsError('invalid-argument', 'Faltan datos requeridos para crear usuario.');
  }

  const role = data.role;
  assertValidRole(role);

  if (password.length < 6) {
    throw new HttpsError('invalid-argument', 'La contrasena debe tener al menos 6 caracteres.');
  }

  const legacyAssignment = parseLegacyAssignmentLabel(normalizeText(data.department));
  const rawPosition = parseServicePosition(data.servicePosition) ?? legacyAssignment.position;
  const rawDepartment = parseServiceDepartment(data.serviceDepartment) ?? legacyAssignment.department;
  const assignment = normalizeAssignmentForRole(role, rawPosition, rawDepartment);

  return {
    firstName,
    middleName,
    lastName,
    secondLastName,
    displayName,
    role,
    congregationId,
    isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
    phone: normalizeText(data.phone),
    password,
    servicePosition: assignment.position,
    serviceDepartment: assignment.department,
    departmentLabel: assignment.label,
  };
};

const parseUpdateUserPayload = (raw: unknown): UpdateUserPayload => {
  if (typeof raw !== 'object' || raw === null) {
    throw new HttpsError('invalid-argument', 'Payload invalido.');
  }

  const root = raw as Record<string, unknown>;
  const uid = normalizeText(root.uid);

  if (!uid) {
    throw new HttpsError('invalid-argument', 'UID invalido.');
  }

  const nested =
    typeof root.data === 'object' && root.data !== null
      ? (root.data as Record<string, unknown>)
      : root;

  const legacyFirstName = normalizeText(root.firstName);
  const legacyLastName = normalizeText(root.lastName);
  const legacyDisplayName = [legacyFirstName, legacyLastName].filter(Boolean).join(' ').trim();
  const displayName = normalizeText(nested.displayName) ?? (legacyDisplayName || undefined);

  const roleCandidate = nested.role ?? root.role;
  const role = roleCandidate !== undefined ? roleCandidate : undefined;

  if (role !== undefined) {
    assertValidRole(role);
  }

  let isActive: boolean | undefined;

  if (typeof nested.isActive === 'boolean') {
    isActive = nested.isActive;
  } else if (nested.status === 'active') {
    isActive = true;
  } else if (nested.status === 'inactive' || nested.status === 'suspended') {
    isActive = false;
  } else if (typeof root.isActive === 'boolean') {
    isActive = root.isActive;
  }

  const phoneProvided = Object.prototype.hasOwnProperty.call(nested, 'phone');
  const servicePositionProvided =
    Object.prototype.hasOwnProperty.call(nested, 'servicePosition') ||
    Object.prototype.hasOwnProperty.call(nested, 'department');
  const serviceDepartmentProvided =
    Object.prototype.hasOwnProperty.call(nested, 'serviceDepartment') ||
    Object.prototype.hasOwnProperty.call(nested, 'department');

  const legacyAssignment = parseLegacyAssignmentLabel(normalizeText(nested.department));
  const servicePosition = servicePositionProvided
    ? (parseServicePosition(nested.servicePosition) ?? legacyAssignment.position)
    : undefined;
  const serviceDepartment = serviceDepartmentProvided
    ? (parseServiceDepartment(nested.serviceDepartment) ?? legacyAssignment.department)
    : undefined;

  return {
    uid,
    displayName,
    role: role as Role | undefined,
    isActive,
    phone: normalizeText(nested.phone),
    phoneProvided,
    servicePosition,
    serviceDepartment,
    servicePositionProvided,
    serviceDepartmentProvided,
    serviceAssignmentProvided: servicePositionProvided || serviceDepartmentProvided,
  };
};

const parseUpdatePasswordPayload = (raw: unknown): UpdatePasswordPayload => {
  if (typeof raw !== 'object' || raw === null) {
    throw new HttpsError('invalid-argument', 'Payload invalido.');
  }

  const data = raw as Record<string, unknown>;
  const uid = normalizeText(data.uid);
  const newPassword = normalizeText(data.newPassword);

  if (!uid || !newPassword) {
    throw new HttpsError('invalid-argument', 'UID o contrasena invalida.');
  }

  if (newPassword.length < 6) {
    throw new HttpsError('invalid-argument', 'La contrasena debe tener al menos 6 caracteres.');
  }

  return { uid, newPassword };
};

const parseUidFromPayload = (raw: unknown): string => {
  if (typeof raw !== 'object' || raw === null) {
    throw new HttpsError('invalid-argument', 'Payload invalido.');
  }

  const uid = normalizeText((raw as Record<string, unknown>).uid);
  if (!uid) {
    throw new HttpsError('invalid-argument', 'UID invalido.');
  }

  return uid;
};

export const createUserByAdmin = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const requester = await getRequesterProfile(request.auth.uid);
    assertAdmin(requester);

    const payload = parseCreateUserPayload(request.data);

    if (payload.congregationId !== requester.congregationId) {
      throw new HttpsError('permission-denied', 'No puedes crear usuarios en otra congregacion.');
    }

    await assertAssignmentUniqueness({
      congregationId: payload.congregationId,
      assignment: {
        position: payload.servicePosition,
        department: payload.serviceDepartment,
      },
      isActive: payload.isActive,
    });

    const auth = getAuth();
    const db = getFirestore();

    const congregationSnap = await db.collection('congregations').doc(payload.congregationId).get();
    const congregationData = congregationSnap.exists ? (congregationSnap.data() as Record<string, unknown>) : undefined;

    const requiredDomain = resolveCongregationEmailDomain(payload.congregationId, congregationData);
    const generatedEmail = await resolveGeneratedEmail(
      payload.firstName,
      payload.middleName,
      payload.lastName,
      requiredDomain
    );

    const userRecord = await auth.createUser({
      email: generatedEmail,
      password: payload.password,
      displayName: payload.displayName,
      disabled: !payload.isActive,
    });

    try {
      const userDoc: Record<string, unknown> = {
        uid: userRecord.uid,
        email: generatedEmail,
        displayName: payload.displayName,
        role: payload.role,
        isActive: payload.isActive,
        status: payload.isActive ? 'active' : 'inactive',
        congregationId: payload.congregationId,
        congregationDomain: requiredDomain,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      userDoc.firstName = payload.firstName;
      userDoc.lastName = payload.lastName;
      if (payload.middleName) userDoc.middleName = payload.middleName;
      if (payload.secondLastName) userDoc.secondLastName = payload.secondLastName;
      if (payload.phone) userDoc.phone = payload.phone;
      if (payload.servicePosition) userDoc.servicePosition = payload.servicePosition;
      if (payload.serviceDepartment) userDoc.serviceDepartment = payload.serviceDepartment;
      if (payload.departmentLabel) userDoc.department = payload.departmentLabel;

      await db.collection('users').doc(userRecord.uid).set(userDoc);

      return {
        uid: userRecord.uid,
        email: generatedEmail,
        requiredDomain,
      };
    } catch (error) {
      await auth.deleteUser(userRecord.uid);
      throw error;
    }
  }
);

export const updateUserByAdmin = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const requester = await getRequesterProfile(request.auth.uid);
    assertAdmin(requester);

    const payload = parseUpdateUserPayload(request.data);

    const db = getFirestore();
    const targetRef = db.collection('users').doc(payload.uid);
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      throw new HttpsError('not-found', 'Usuario no encontrado.');
    }

    const target = targetSnap.data() as {
      congregationId: string;
      role?: Role;
      isActive?: boolean;
      servicePosition?: ServicePosition;
      serviceDepartment?: ServiceDepartment;
      department?: string;
    };

    if (target.congregationId !== requester.congregationId) {
      throw new HttpsError('permission-denied', 'No puedes modificar usuarios de otra congregacion.');
    }

    const currentRole = target.role === 'admin' || target.role === 'supervisor' || target.role === 'user'
      ? target.role
      : 'user';
    const nextRole = payload.role ?? currentRole;
    const currentIsActive = Boolean(target.isActive);
    const nextIsActive = typeof payload.isActive === 'boolean' ? payload.isActive : currentIsActive;

    const legacyCurrentAssignment = parseLegacyAssignmentLabel(normalizeText(target.department));
    const currentPosition = target.servicePosition ?? legacyCurrentAssignment.position;
    const currentDepartment = target.serviceDepartment ?? legacyCurrentAssignment.department;

    let nextPosition = currentPosition;
    let nextDepartment = currentDepartment;

    if (payload.servicePositionProvided) {
      nextPosition = payload.servicePosition;
      if (!nextPosition) {
        nextDepartment = undefined;
      }
    }

    if (payload.serviceDepartmentProvided) {
      nextDepartment = payload.serviceDepartment;
    }

    const normalizedAssignment = normalizeAssignmentForRole(nextRole, nextPosition, nextDepartment);

    await assertAssignmentUniqueness({
      congregationId: target.congregationId,
      assignment: normalizedAssignment,
      excludeUid: payload.uid,
      isActive: nextIsActive,
    });

    const authUpdates: { displayName?: string; disabled?: boolean } = {};

    if (payload.displayName) {
      authUpdates.displayName = payload.displayName;
    }

    if (typeof payload.isActive === 'boolean') {
      authUpdates.disabled = !payload.isActive;
    }

    if (Object.keys(authUpdates).length > 0) {
      await getAuth().updateUser(payload.uid, authUpdates);
    }

    const docUpdates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (payload.displayName) {
      const names = splitDisplayName(payload.displayName);
      docUpdates.displayName = payload.displayName;

      if (names.firstName) {
        docUpdates.firstName = names.firstName;
      } else {
        docUpdates.firstName = FieldValue.delete();
      }

      if (names.lastName) {
        docUpdates.lastName = names.lastName;
      } else {
        docUpdates.lastName = FieldValue.delete();
      }
    }

    if (payload.role) {
      docUpdates.role = payload.role;
    }

    if (typeof payload.isActive === 'boolean') {
      docUpdates.isActive = payload.isActive;
      docUpdates.status = payload.isActive ? 'active' : 'inactive';
    }

    if (payload.phoneProvided) {
      docUpdates.phone = payload.phone ?? FieldValue.delete();
    }

    if (payload.serviceAssignmentProvided || payload.role) {
      if (normalizedAssignment.position) {
        docUpdates.servicePosition = normalizedAssignment.position;
      } else {
        docUpdates.servicePosition = FieldValue.delete();
      }

      if (normalizedAssignment.department) {
        docUpdates.serviceDepartment = normalizedAssignment.department;
      } else {
        docUpdates.serviceDepartment = FieldValue.delete();
      }

      if (normalizedAssignment.label) {
        docUpdates.department = normalizedAssignment.label;
      } else {
        docUpdates.department = FieldValue.delete();
      }
    }

    await targetRef.update(docUpdates);

    return { ok: true };
  }
);

export const updateUserPasswordByAdmin = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const requester = await getRequesterProfile(request.auth.uid);
    assertAdmin(requester);

    const payload = parseUpdatePasswordPayload(request.data);

    if (payload.uid === request.auth.uid) {
      throw new HttpsError('failed-precondition', 'No puedes cambiar tu propia contrasena desde este flujo.');
    }

    const db = getFirestore();
    const targetRef = db.collection('users').doc(payload.uid);
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      throw new HttpsError('not-found', 'Usuario no encontrado.');
    }

    const target = targetSnap.data() as { congregationId: string };
    if (target.congregationId !== requester.congregationId) {
      throw new HttpsError('permission-denied', 'No puedes modificar usuarios de otra congregacion.');
    }

    await getAuth().updateUser(payload.uid, { password: payload.newPassword });
    await targetRef.update({ updatedAt: FieldValue.serverTimestamp() });

    return { ok: true };
  }
);

export const disableUserByAdmin = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const requester = await getRequesterProfile(request.auth.uid);
    assertAdmin(requester);

    const uid = parseUidFromPayload(request.data ?? {});

    if (uid === request.auth.uid) {
      throw new HttpsError('failed-precondition', 'No puedes desactivar tu propio usuario.');
    }

    const db = getFirestore();
    const targetRef = db.collection('users').doc(uid);
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      throw new HttpsError('not-found', 'Usuario no encontrado.');
    }

    const target = targetSnap.data() as { congregationId: string };

    if (target.congregationId !== requester.congregationId) {
      throw new HttpsError('permission-denied', 'No puedes desactivar usuarios de otra congregacion.');
    }

    await getAuth().updateUser(uid, { disabled: true });
    await targetRef.update({
      isActive: false,
      status: 'inactive',
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true };
  }
);

export const deleteUserByAdmin = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const requester = await getRequesterProfile(request.auth.uid);
    assertAdmin(requester);

    const uid = parseUidFromPayload(request.data ?? {});

    if (uid === request.auth.uid) {
      throw new HttpsError('failed-precondition', 'No puedes eliminar tu propio usuario.');
    }

    const db = getFirestore();
    const targetRef = db.collection('users').doc(uid);
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      throw new HttpsError('not-found', 'Usuario no encontrado.');
    }

    const target = targetSnap.data() as { congregationId: string };

    if (target.congregationId !== requester.congregationId) {
      throw new HttpsError('permission-denied', 'No puedes eliminar usuarios de otra congregacion.');
    }

    await getAuth().deleteUser(uid);
    await targetRef.delete();

    return { ok: true };
  }
);
