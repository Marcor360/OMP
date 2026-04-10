import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

type Role = 'admin' | 'supervisor' | 'user';

function assertValidRole(role: unknown): asserts role is Role {
    if (role !== 'admin' && role !== 'supervisor' && role !== 'user') {
        throw new HttpsError('invalid-argument', 'Rol inválido.');
    }
}

async function getRequesterProfile(uid: string) {
    const db = getFirestore();
    const snap = await db.collection('users').doc(uid).get();

    if (!snap.exists) {
        throw new HttpsError('permission-denied', 'No existe perfil del usuario autenticado.');
    }

    const data = snap.data();
    if (!data?.isActive) {
        throw new HttpsError('permission-denied', 'El usuario autenticado está inactivo.');
    }

    return data as {
        role: Role;
        isActive: boolean;
        congregationId: string;
        email?: string;
    };
}

function assertAdmin(profile: { role: Role }) {
    if (profile.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Solo un administrador puede realizar esta operación.');
    }
}

export const createUserByAdmin = onCall(
    { region: 'us-central1' },
    async (request) => {
        if (!request.auth?.uid) {
            throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
        }

        const requester = await getRequesterProfile(request.auth.uid);
        assertAdmin(requester);

        const {
            email,
            password,
            firstName,
            lastName,
            role,
            congregationId,
        } = request.data ?? {};

        if (
            typeof email !== 'string' ||
            typeof password !== 'string' ||
            typeof firstName !== 'string' ||
            typeof lastName !== 'string' ||
            typeof congregationId !== 'string'
        ) {
            throw new HttpsError('invalid-argument', 'Payload inválido.');
        }

        assertValidRole(role);

        if (congregationId !== requester.congregationId) {
            throw new HttpsError('permission-denied', 'No puedes crear usuarios en otra congregación.');
        }

        const auth = getAuth();
        const db = getFirestore();

        const userRecord = await auth.createUser({
            email,
            password,
            displayName: `${firstName} ${lastName}`,
            disabled: false,
        });

        try {
            await db.collection('users').doc(userRecord.uid).set({
                uid: userRecord.uid,
                email,
                firstName,
                lastName,
                role,
                isActive: true,
                congregationId,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            return { uid: userRecord.uid };
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
            throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
        }

        const requester = await getRequesterProfile(request.auth.uid);
        assertAdmin(requester);

        const { uid, firstName, lastName, role, isActive } = request.data ?? {};

        if (
            typeof uid !== 'string' ||
            typeof firstName !== 'string' ||
            typeof lastName !== 'string' ||
            typeof isActive !== 'boolean'
        ) {
            throw new HttpsError('invalid-argument', 'Payload inválido.');
        }

        assertValidRole(role);

        const db = getFirestore();
        const targetRef = db.collection('users').doc(uid);
        const targetSnap = await targetRef.get();

        if (!targetSnap.exists) {
            throw new HttpsError('not-found', 'Usuario no encontrado.');
        }

        const target = targetSnap.data() as { congregationId: string };

        if (target.congregationId !== requester.congregationId) {
            throw new HttpsError('permission-denied', 'No puedes modificar usuarios de otra congregación.');
        }

        await getAuth().updateUser(uid, {
            displayName: `${firstName} ${lastName}`,
            disabled: !isActive,
        });

        await targetRef.update({
            firstName,
            lastName,
            role,
            isActive,
            updatedAt: FieldValue.serverTimestamp(),
        });

        return { ok: true };
    }
);

export const disableUserByAdmin = onCall(
    { region: 'us-central1' },
    async (request) => {
        if (!request.auth?.uid) {
            throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
        }

        const requester = await getRequesterProfile(request.auth.uid);
        assertAdmin(requester);

        const { uid } = request.data ?? {};
        if (typeof uid !== 'string') {
            throw new HttpsError('invalid-argument', 'UID inválido.');
        }

        const db = getFirestore();
        const targetRef = db.collection('users').doc(uid);
        const targetSnap = await targetRef.get();

        if (!targetSnap.exists) {
            throw new HttpsError('not-found', 'Usuario no encontrado.');
        }

        const target = targetSnap.data() as { congregationId: string };

        if (target.congregationId !== requester.congregationId) {
            throw new HttpsError('permission-denied', 'No puedes desactivar usuarios de otra congregación.');
        }

        await getAuth().updateUser(uid, { disabled: true });
        await targetRef.update({
            isActive: false,
            updatedAt: FieldValue.serverTimestamp(),
        });

        return { ok: true };
    }
);

export const deleteUserByAdmin = onCall(
    { region: 'us-central1' },
    async (request) => {
        if (!request.auth?.uid) {
            throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
        }

        const requester = await getRequesterProfile(request.auth.uid);
        assertAdmin(requester);

        const { uid } = request.data ?? {};
        if (typeof uid !== 'string') {
            throw new HttpsError('invalid-argument', 'UID inválido.');
        }

        const db = getFirestore();
        const targetRef = db.collection('users').doc(uid);
        const targetSnap = await targetRef.get();

        if (!targetSnap.exists) {
            throw new HttpsError('not-found', 'Usuario no encontrado.');
        }

        const target = targetSnap.data() as { congregationId: string };

        if (target.congregationId !== requester.congregationId) {
            throw new HttpsError('permission-denied', 'No puedes eliminar usuarios de otra congregación.');
        }

        await getAuth().deleteUser(uid);
        await targetRef.delete();

        return { ok: true };
    }
);