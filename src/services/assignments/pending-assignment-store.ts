import AsyncStorage from '@react-native-async-storage/async-storage';

export type AssignmentIntentScope = { uid: string; congregationId: string };

export type AssignmentSaveIntent = {
  congregationId: string;
  meetingId: string;
  requestId: string;
  assignmentData: Record<string, unknown>;
  assignedByName: string;
  expectedActorUid?: string;
};

export type PendingAssignment = {
  intent: AssignmentSaveIntent;
  confirmed: boolean;
  createdAt: number;
};

const prefix = ({ uid, congregationId }: AssignmentIntentScope) =>
  `@omp/assignment-save/v1/${encodeURIComponent(uid)}/${encodeURIComponent(congregationId)}/`;

const parsePending = (raw: string | null): PendingAssignment | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingAssignment>;
    const intent = value?.intent;
    if (
      !intent || typeof intent.meetingId !== 'string' || typeof intent.congregationId !== 'string' ||
      typeof intent.assignedByName !== 'string' || !/^[A-Za-z0-9]{20}$/.test(intent.requestId) ||
      !intent.assignmentData || typeof value.createdAt !== 'number'
    ) return null;
    return { intent, confirmed: value.confirmed === true, createdAt: value.createdAt };
  } catch {
    return null;
  }
};

export const rememberAssignmentIntent = async (uid: string, intent: AssignmentSaveIntent): Promise<void> => {
  const key = prefix({ uid, congregationId: intent.congregationId }) + intent.requestId;
  if (await AsyncStorage.getItem(key) === null) {
    await AsyncStorage.setItem(key, JSON.stringify({ intent, confirmed: false, createdAt: Date.now() }));
  }
};

export const readPendingAssignments = async (scope: AssignmentIntentScope): Promise<PendingAssignment[]> => {
  const namespace = prefix(scope);
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(namespace));
  if (!keys.length) return [];
  return (await AsyncStorage.multiGet(keys)).flatMap(([key, raw]) => {
    const record = parsePending(raw);
    return record && record.intent.congregationId === scope.congregationId &&
      key === namespace + record.intent.requestId ? [record] : [];
  }).sort((first, second) => first.createdAt - second.createdAt);
};

export const forgetAssignmentIntent = (scope: AssignmentIntentScope, requestId: string): Promise<void> =>
  AsyncStorage.removeItem(prefix(scope) + requestId);

export const markAssignmentConfirmed = async (scope: AssignmentIntentScope, requestId: string): Promise<void> => {
  const key = prefix(scope) + requestId;
  const record = parsePending(await AsyncStorage.getItem(key));
  if (record && !record.confirmed) {
    const { intent } = record;
    await AsyncStorage.setItem(key, JSON.stringify({
      ...record,
      confirmed: true,
      intent: { ...intent, assignedByName: '', assignmentData: { title: intent.assignmentData.title } },
    }));
  }
};
