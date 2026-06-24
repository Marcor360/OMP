import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { normalizeText } from './parsers.js';

export const normalizeDomainCandidate = (value: unknown): string | undefined => {
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

export const slugifyDomainLabel = (value: unknown): string => {
  const source = normalizeText(value) ?? 'congregacion';

  const normalized = source
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.length > 0 ? normalized : 'congregacion';
};

export const resolveCongregationEmailDomain = (
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

export const normalizeNameForEmail = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

export const buildEmailLocalPart = (...values: (string | undefined)[]): string => {
  return values
    .map((value) => (value ? normalizeNameForEmail(value) : ''))
    .filter(Boolean)
    .join('');
};

export const buildEmailLocalCandidates = (
  firstName: string,
  middleName: string | undefined,
  lastName: string
): string[] => {
  const primary = buildEmailLocalPart(firstName, lastName);
  const withMiddle = middleName ? buildEmailLocalPart(firstName, middleName, lastName) : '';

  const candidates = [primary, withMiddle].filter(Boolean);
  return Array.from(new Set(candidates));
};

export const isAuthUserNotFoundError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const code = 'code' in error ? String(error.code) : '';
  return code === 'auth/user-not-found';
};

export const isEmailTaken = async (email: string): Promise<boolean> => {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    await getAuth().getUserByEmail(normalizedEmail);
    return true;
  } catch (error) {
    if (!isAuthUserNotFoundError(error)) {
      throw error;
    }
  }

  const db = getFirestore();
  const [emailSnap, emailKeySnap] = await Promise.all([
    db.collection('users').where('email', '==', normalizedEmail).limit(1).get(),
    db.collection('users').where('emailKey', '==', normalizedEmail).limit(1).get(),
  ]);
  return !emailSnap.empty || !emailKeySnap.empty;
};

export const resolveGeneratedEmail = async (
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

export const splitDisplayName = (displayName: string): { firstName?: string; lastName?: string } => {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return {};
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ') || undefined,
  };
};
