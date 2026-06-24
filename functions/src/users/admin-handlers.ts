import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { isSystemPrincipalUser } from '../user-protection.js';
import { assertAssignmentUniqueness } from './assignment-uniqueness.js';
import {
  assertAdministrativeBillingAccess,
  assertDelegatedCreateIsSafe,
  assertDelegatedUpdateIsSafe,
  assertUserPermission,
  getRequesterProfile,
  stripOrgChartManageUnlessAuthorized,
} from './authorization.js';
import { assertCongregationHasUserCapacity } from './capacity.js';
import { resolveCongregationEmailDomain, resolveGeneratedEmail, splitDisplayName } from './email.js';
import { logCreateUserFailure } from './logging.js';
import {
  ensureAdminElderPrivileges,
  normalizeAssignmentForRole,
  normalizeText,
  parseCreateUserPayload,
  parseLegacyAssignmentLabel,
  parsePrivilegesWithLegacyFlags,
  parseServiceAssignments,
  parseUidFromPayload,
  parseUpdatePasswordPayload,
  parseUpdateUserPayload,
  rawServiceAssignmentsRequireAdminElder,
  requiresAdminElderPosition,
  resolveActorEmail,
  resolveActorName,
  serviceAssignmentsRequireAdminElder,
} from './parsers.js';
import type {
  CreateUserPayload,
  Role,
  ServiceDepartment,
  ServicePosition,
  StoredServiceAssignment,
  UserPrivileges,
} from './types.js';

export const createUserByAdmin = onCall(
  { region: 'us-central1' },
  async (request) => {
    let step = 'auth';
    let payload: CreateUserPayload | undefined;

    try {
      if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
      }

      step = 'requester-profile';
      const requester = await getRequesterProfile(request.auth.uid);
      await assertAdministrativeBillingAccess(requester.congregationId);

      step = 'requester-permission';
      assertUserPermission(requester, 'create');

      step = 'payload';
      payload = parseCreateUserPayload(request.data);

      step = 'delegated-safety';
      assertDelegatedCreateIsSafe(requester, payload);

      step = 'same-congregation';
      if (payload.congregationId !== requester.congregationId) {
        throw new HttpsError('permission-denied', 'No puedes crear usuarios en otra congregacion.');
      }

      step = 'assignment-uniqueness';
      await assertAssignmentUniqueness({
        congregationId: payload.congregationId,
        assignments: payload.serviceAssignments,
        isActive: payload.isActive,
      });

      step = 'plan-capacity';
      await assertCongregationHasUserCapacity({
        congregationId: payload.congregationId,
        willCreateActiveUser: payload.isActive,
      });

      const auth = getAuth();
      const db = getFirestore();

      step = 'congregation-domain';
      const congregationSnap = await db.collection('congregations').doc(payload.congregationId).get();
      const congregationData = congregationSnap.exists ? (congregationSnap.data() as Record<string, unknown>) : undefined;

      const requiredDomain = resolveCongregationEmailDomain(payload.congregationId, congregationData);
      const generatedEmail = await resolveGeneratedEmail(
        payload.firstName,
        payload.middleName,
        payload.lastName,
        requiredDomain
      );

      step = 'auth-create';
      const userRecord = await auth.createUser({
        email: generatedEmail,
        password: payload.password,
        displayName: payload.displayName,
        disabled: !payload.isActive,
      });

      try {
        step = 'firestore-profile';
        const userDoc: Record<string, unknown> = {
          uid: userRecord.uid,
          email: generatedEmail,
          emailKey: generatedEmail.trim().toLowerCase(),
          displayName: payload.displayName,
          role: payload.role,
          isActive: payload.isActive,
          status: payload.isActive ? 'active' : 'inactive',
          congregationId: payload.congregationId,
          congregationDomain: requiredDomain,
          createdBy: request.auth.uid,
          createdByName: resolveActorName(requester, request.auth.uid),
          createdByEmail: resolveActorEmail(requester),
          updatedBy: request.auth.uid,
          updatedByName: resolveActorName(requester, request.auth.uid),
          updatedByEmail: resolveActorEmail(requester),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };

        userDoc.firstName = payload.firstName;
        userDoc.lastName = payload.lastName;
        if (payload.middleName) userDoc.middleName = payload.middleName;
        if (payload.secondLastName) userDoc.secondLastName = payload.secondLastName;
        if (payload.phone) userDoc.phone = payload.phone;
        if (payload.gender) userDoc.gender = payload.gender;
        if (payload.servicePosition) userDoc.servicePosition = payload.servicePosition;
        if (payload.serviceDepartment) userDoc.serviceDepartment = payload.serviceDepartment;
        if (payload.departmentLabel) userDoc.department = payload.departmentLabel;
        userDoc.serviceAssignments = payload.serviceAssignments;
        if (payload.privileges && Object.keys(payload.privileges).length > 0) {
          userDoc.privileges = payload.privileges;
        }
        userDoc.isElder = payload.privileges?.isElder === true;
        userDoc.isMinisterialServant = payload.privileges?.isMinisterialServant === true;
        if (payload.responsibilities && Object.keys(payload.responsibilities).length > 0) {
          userDoc.responsibilities = payload.responsibilities;
        }
        const safePermissions = stripOrgChartManageUnlessAuthorized(
          payload.permissions,
          payload.serviceAssignments,
          {}
        );
        if (safePermissions && Object.keys(safePermissions).length > 0) {
          userDoc.permissions = safePermissions;
        }

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
    } catch (error) {
      logCreateUserFailure(error, {
        step,
        requesterUid: request.auth?.uid,
        congregationId: payload?.congregationId,
        role: payload?.role,
        raw: request.data,
      });
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
    await assertAdministrativeBillingAccess(requester.congregationId);
    assertUserPermission(requester, 'edit');

    const payload = parseUpdateUserPayload(request.data);
    assertDelegatedUpdateIsSafe(requester, payload);

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
      serviceAssignments?: StoredServiceAssignment[];
      privileges?: UserPrivileges;
      isElder?: boolean;
      isMinisterialServant?: boolean;
      isSystemUser?: boolean;
      isPrimaryAdmin?: boolean;
      isRootAdmin?: boolean;
      systemProtected?: boolean;
    };

    if (target.congregationId !== requester.congregationId) {
      throw new HttpsError('permission-denied', 'No puedes modificar usuarios de otra congregacion.');
    }

    if (target.role === 'admin' && requester.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Solo un administrador puede modificar a otro administrador.');
    }

    const currentRole = target.role === 'admin' || target.role === 'supervisor' || target.role === 'user'
      ? target.role
      : 'user';
    const requestedRole = payload.role ?? currentRole;
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

    const requestedAssignmentsRequireAdminElder = payload.serviceAssignmentsProvided
      ? rawServiceAssignmentsRequireAdminElder(payload.serviceAssignmentsRaw)
      : requiresAdminElderPosition(nextPosition);
    const nextRole: Role = requestedAssignmentsRequireAdminElder ? 'admin' : requestedRole;
    const normalizedAssignment = normalizeAssignmentForRole(nextRole, nextPosition, nextDepartment);
    const nextServiceAssignments = payload.serviceAssignmentsProvided
      ? parseServiceAssignments(payload.serviceAssignmentsRaw, nextRole)
      : parseServiceAssignments(target.serviceAssignments, nextRole, normalizedAssignment);
    const primaryAssignment = nextServiceAssignments[0];
    const finalRole: Role = serviceAssignmentsRequireAdminElder(nextServiceAssignments)
      ? 'admin'
      : nextRole;
    const currentPrivileges = parsePrivilegesWithLegacyFlags(target.privileges, target as Record<string, unknown>);
    const nextPrivileges = ensureAdminElderPrivileges(
      payload.privilegesProvided ? payload.privileges : currentPrivileges,
      serviceAssignmentsRequireAdminElder(nextServiceAssignments)
    );

    await assertAssignmentUniqueness({
      congregationId: target.congregationId,
      assignments: nextServiceAssignments,
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
      updatedBy: request.auth.uid,
      updatedByName: resolveActorName(requester, request.auth.uid),
      updatedByEmail: resolveActorEmail(requester),
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

    if (payload.role || finalRole !== currentRole) {
      docUpdates.role = finalRole;
    }

    if (typeof payload.isActive === 'boolean') {
      docUpdates.isActive = payload.isActive;
      docUpdates.status = payload.isActive ? 'active' : 'inactive';
    }

    if (payload.phoneProvided) {
      docUpdates.phone = payload.phone ?? FieldValue.delete();
    }

    if (payload.genderProvided && payload.gender) {
      docUpdates.gender = payload.gender;
    }

    if (payload.serviceAssignmentsProvided || payload.serviceAssignmentProvided || payload.role) {
      if (primaryAssignment?.position) {
        docUpdates.servicePosition = primaryAssignment.position;
      } else {
        docUpdates.servicePosition = FieldValue.delete();
      }

      if (primaryAssignment?.department) {
        docUpdates.serviceDepartment = primaryAssignment.department;
      } else {
        docUpdates.serviceDepartment = FieldValue.delete();
      }

      if (primaryAssignment?.label) {
        docUpdates.department = primaryAssignment.label;
      } else {
        docUpdates.department = FieldValue.delete();
      }
    }

    if (payload.serviceAssignmentsProvided || payload.serviceAssignmentProvided || payload.role) {
      docUpdates.serviceAssignments =
        nextServiceAssignments.length > 0 ? nextServiceAssignments : FieldValue.delete();
    }

    if (payload.privilegesProvided || serviceAssignmentsRequireAdminElder(nextServiceAssignments)) {
      docUpdates.privileges =
        nextPrivileges && Object.keys(nextPrivileges).length > 0
          ? nextPrivileges
          : FieldValue.delete();
      docUpdates.isElder = nextPrivileges?.isElder === true;
      docUpdates.isMinisterialServant = nextPrivileges?.isMinisterialServant === true;
    }

    if (payload.responsibilitiesProvided) {
      docUpdates.responsibilities =
        payload.responsibilities && Object.keys(payload.responsibilities).length > 0
          ? payload.responsibilities
          : FieldValue.delete();
    }

    // Permisos pegajosos: un payload ausente o vacio conserva el set actual.
    // Para retirar permisos se desmarcan individualmente o se cambia el rol.
    if (
      payload.permissionsProvided &&
      payload.permissions &&
      Object.keys(payload.permissions).length > 0
    ) {
      const safePermissions = stripOrgChartManageUnlessAuthorized(
        payload.permissions,
        nextServiceAssignments,
        {
          isSystemUser: target.isSystemUser,
          isPrimaryAdmin: target.isPrimaryAdmin,
          isRootAdmin: target.isRootAdmin,
          systemProtected: target.systemProtected,
        }
      );
      if (safePermissions && Object.keys(safePermissions).length > 0) {
        docUpdates.permissions = safePermissions;
      }
    }

    await targetRef.update(docUpdates);

    const updatedSnap = await targetRef.get();
    const updatedData = updatedSnap.data() as {
      role?: Role;
      servicePosition?: ServicePosition;
      serviceDepartment?: ServiceDepartment;
      serviceAssignments?: StoredServiceAssignment[];
      privileges?: UserPrivileges;
      isElder?: boolean;
      isMinisterialServant?: boolean;
    } | undefined;

    logger.info('updateUserByAdmin persisted user fields', {
      requesterUid: request.auth.uid,
      targetUid: payload.uid,
      updatedKeys: Object.keys(docUpdates),
      persisted: {
        role: updatedData?.role,
        servicePosition: updatedData?.servicePosition,
        serviceDepartment: updatedData?.serviceDepartment,
        serviceAssignmentsCount: Array.isArray(updatedData?.serviceAssignments)
          ? updatedData.serviceAssignments.length
          : 0,
        privileges: updatedData?.privileges,
        isElder: updatedData?.isElder,
        isMinisterialServant: updatedData?.isMinisterialServant,
      },
    });

    return {
      ok: true,
      user: {
        uid: payload.uid,
        role: updatedData?.role,
        servicePosition: updatedData?.servicePosition,
        serviceDepartment: updatedData?.serviceDepartment,
        serviceAssignments: updatedData?.serviceAssignments ?? [],
        privileges: updatedData?.privileges ?? {},
        isElder: updatedData?.isElder === true,
        isMinisterialServant: updatedData?.isMinisterialServant === true,
      },
    };
  }
);

export const updateUserPasswordByAdmin = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const requester = await getRequesterProfile(request.auth.uid);
    await assertAdministrativeBillingAccess(requester.congregationId);
    assertUserPermission(requester, 'edit');

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

    const target = targetSnap.data() as { congregationId: string; role?: Role };
    if (target.congregationId !== requester.congregationId) {
      throw new HttpsError('permission-denied', 'No puedes modificar usuarios de otra congregacion.');
    }

    if (target.role === 'admin' && requester.role !== 'admin') {
      throw new HttpsError(
        'permission-denied',
        'Solo un administrador puede cambiar la contrasena de otro administrador.'
      );
    }

    await getAuth().updateUser(payload.uid, { password: payload.newPassword });
    await targetRef.update({
      updatedBy: request.auth.uid,
      updatedByName: resolveActorName(requester, request.auth.uid),
      updatedByEmail: resolveActorEmail(requester),
      updatedAt: FieldValue.serverTimestamp(),
    });

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
    await assertAdministrativeBillingAccess(requester.congregationId);
    assertUserPermission(requester, 'edit');

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

    const target = targetSnap.data() as { congregationId: string; role?: Role };

    if (target.congregationId !== requester.congregationId) {
      throw new HttpsError('permission-denied', 'No puedes desactivar usuarios de otra congregacion.');
    }

    if (target.role === 'admin' && requester.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Solo un administrador puede desactivar a otro administrador.');
    }

    await getAuth().updateUser(uid, { disabled: true });
    await targetRef.update({
      isActive: false,
      status: 'inactive',
      updatedBy: request.auth.uid,
      updatedByName: resolveActorName(requester, request.auth.uid),
      updatedByEmail: resolveActorEmail(requester),
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
    await assertAdministrativeBillingAccess(requester.congregationId);
    assertUserPermission(requester, 'delete');

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

    const target = targetSnap.data() as { congregationId: string; role?: Role };

    if (target.congregationId !== requester.congregationId) {
      throw new HttpsError('permission-denied', 'No puedes eliminar usuarios de otra congregacion.');
    }

    if (target.role === 'admin' && requester.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Solo un administrador puede eliminar a otro administrador.');
    }

    if (isSystemPrincipalUser(target as Record<string, unknown>)) {
      throw new HttpsError(
        'failed-precondition',
        'Este usuario fue creado por el sistema principal y no se puede eliminar.'
      );
    }

    await getAuth().deleteUser(uid);
    await targetRef.delete();

    return { ok: true };
  }
);
