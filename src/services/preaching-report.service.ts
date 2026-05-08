import {
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from 'firebase/firestore';

import {
  preachingReportSubmissionDocRef,
  preachingReportSubmissionsCollectionRef,
} from '@/src/lib/firebase/refs';
import { getActiveUsers } from '@/src/services/users/users-service';
import {
  MissingPreachingReportUser,
  PreachingReportSubmission,
  PreachingReportSummary,
  SubmitPreachingReportInput,
} from '@/src/types/preaching-report.types';
import { AppUser, getPioneerType, isPioneer } from '@/src/types/user';

const MONTH_ID_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const normalizeNonNegativeInteger = (value: number, fieldName: string): number => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} debe ser un numero entero mayor o igual a 0.`);
  }

  return value;
};

const normalizeHours = (value: number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Total de horas debe ser un numero mayor o igual a 0.');
  }

  return value;
};

const normalizeComments = (value: string | null | undefined): string | null => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed.slice(0, 500) : null;
};

const assertValidMonthId = (monthId: string): void => {
  if (!MONTH_ID_PATTERN.test(monthId)) {
    throw new Error('Mes invalido. Usa el formato YYYY-MM.');
  }
};

export const getCurrentMonthId = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const getMonthName = (monthId: string): string => {
  assertValidMonthId(monthId);
  const [year, month] = monthId.split('-').map(Number);
  const date = new Date(year, month - 1, 1);

  return date.toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  });
};

export const shiftMonthId = (monthId: string, delta: number): string => {
  assertValidMonthId(monthId);
  const [year, month] = monthId.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const getPreachingReportRef = (
  congregationId: string,
  monthId: string,
  userId: string
) => preachingReportSubmissionDocRef(congregationId, monthId, userId);

const normalizeSubmission = (
  id: string,
  data: Record<string, unknown>
): PreachingReportSubmission => ({
  id,
  userId: typeof data.userId === 'string' ? data.userId : id,
  userName: typeof data.userName === 'string' ? data.userName : 'Usuario',
  congregationId: typeof data.congregationId === 'string' ? data.congregationId : '',
  congregationName: typeof data.congregationName === 'string' ? data.congregationName : undefined,
  monthId: typeof data.monthId === 'string' ? data.monthId : '',
  monthName: typeof data.monthName === 'string' ? data.monthName : '',
  participated: data.participated === true,
  bibleStudies: typeof data.bibleStudies === 'number' ? data.bibleStudies : 0,
  returnVisits: typeof data.returnVisits === 'number' ? data.returnVisits : 0,
  comments: typeof data.comments === 'string' ? data.comments : null,
  isPioneer: data.isPioneer === true,
  pioneerType:
    data.pioneerType === 'regular' || data.pioneerType === 'auxiliary'
      ? data.pioneerType
      : null,
  hours: typeof data.hours === 'number' ? data.hours : null,
  submittedAt: data.submittedAt as Timestamp,
  updatedAt: data.updatedAt as Timestamp,
  submittedBy: typeof data.submittedBy === 'string' ? data.submittedBy : id,
});

export const submitPreachingReport = async ({
  user,
  monthId,
  congregationName,
  participated,
  bibleStudies,
  returnVisits,
  comments,
  hours,
}: SubmitPreachingReportInput): Promise<void> => {
  if (!user.uid) throw new Error('Debes iniciar sesion.');
  if (!user.isActive) throw new Error('Tu usuario no esta activo.');
  if (!user.congregationId) throw new Error('No se encontro tu congregacion.');

  assertValidMonthId(monthId);

  const userIsPioneer = isPioneer(user);
  const normalizedHours = userIsPioneer ? normalizeHours(hours) : null;
  const docRef = getPreachingReportRef(user.congregationId, monthId, user.uid);
  const existing = await getDoc(docRef);

  const payload: Record<string, unknown> = {
    userId: user.uid,
    userName: user.displayName,
    congregationId: user.congregationId,
    monthId,
    monthName: getMonthName(monthId),
    participated,
    bibleStudies: normalizeNonNegativeInteger(bibleStudies, 'Estudios'),
    returnVisits: normalizeNonNegativeInteger(returnVisits, 'Cursos'),
    comments: normalizeComments(comments),
    isPioneer: userIsPioneer,
    pioneerType: getPioneerType(user),
    updatedAt: serverTimestamp(),
    submittedBy: user.uid,
  };

  if (congregationName) {
    payload.congregationName = congregationName;
  }

  if (!existing.exists()) {
    payload.submittedAt = serverTimestamp();
  }

  if (userIsPioneer) {
    payload.hours = normalizedHours ?? 0;
  } else {
    payload.hours = null;
  }

  await setDoc(docRef, payload, { merge: true });
};

export const getMyPreachingReport = async (
  congregationId: string,
  monthId: string,
  userId: string
): Promise<PreachingReportSubmission | null> => {
  if (!congregationId || !monthId || !userId) return null;
  assertValidMonthId(monthId);

  const snap = await getDoc(getPreachingReportRef(congregationId, monthId, userId));
  return snap.exists() ? normalizeSubmission(snap.id, snap.data()) : null;
};

export const getMonthlyPreachingReportsForManager = async (
  congregationId: string,
  monthId: string
): Promise<PreachingReportSubmission[]> => {
  if (!congregationId || !monthId) return [];
  assertValidMonthId(monthId);

  const snap = await getDocs(preachingReportSubmissionsCollectionRef(congregationId, monthId));
  return snap.docs
    .map((docSnap) => normalizeSubmission(docSnap.id, docSnap.data()))
    .sort((left, right) => left.userName.localeCompare(right.userName, 'es'));
};

export const getMissingPreachingReportsForManager = async (
  congregationId: string,
  monthId: string
): Promise<MissingPreachingReportUser[]> => {
  const [activeUsers, submissions] = await Promise.all([
    getActiveUsers(congregationId),
    getMonthlyPreachingReportsForManager(congregationId, monthId),
  ]);
  const submittedUserIds = new Set(submissions.map((submission) => submission.userId));

  return activeUsers
    .filter((user) => !submittedUserIds.has(user.uid))
    .map((user) => ({
      uid: user.uid,
      displayName: user.displayName,
      privileges: user.privileges,
    }));
};

export const getPreachingReportSummary = (
  activeUsers: AppUser[],
  submissions: PreachingReportSubmission[]
): PreachingReportSummary => {
  const submittedUserIds = new Set(submissions.map((submission) => submission.userId));

  return {
    totalActivePublishers: activeUsers.length,
    totalSubmitted: submissions.length,
    totalMissing: activeUsers.filter((user) => !submittedUserIds.has(user.uid)).length,
    totalPioneerHours: submissions.reduce((sum, submission) => sum + (submission.hours ?? 0), 0),
    totalBibleStudies: submissions.reduce((sum, submission) => sum + submission.bibleStudies, 0),
    totalReturnVisits: submissions.reduce((sum, submission) => sum + submission.returnVisits, 0),
  };
};
