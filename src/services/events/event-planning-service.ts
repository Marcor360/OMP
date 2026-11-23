import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import type { EventPerson } from '@/functions/src/shared/event-planning';
import { functions } from '@/src/lib/firebase/app';
import { congregationDocRef } from '@/src/lib/firebase/refs';

export type ServiceGroupValues = {
  name: string;
  superintendentId: string;
  assistantId: string;
  memberIds: string[];
  isActive: boolean;
};
export type ServiceGroup = ServiceGroupValues & { id: string; revision: number };

export async function listEventPlanningPeople(congregationId: string): Promise<EventPerson[]> {
  const call = httpsCallable<{ congregationId: string }, { people: EventPerson[] }>(functions, 'listEventPlanningPeople');
  const { data } = await call({ congregationId });
  return data.people.sort((first, second) => first.name.localeCompare(second.name));
}

export async function listServiceGroups(congregationId: string): Promise<ServiceGroup[]> {
  const snap = await getDocs(collection(congregationDocRef(congregationId), 'serviceGroups'));
  return snap.docs.map((group) => ({ ...group.data(), id: group.id }) as ServiceGroup)
    .sort((first, second) => first.name.localeCompare(second.name));
}

export async function saveServiceGroup(values: ServiceGroupValues & {
  id: string; congregationId: string; expectedRevision?: number;
}): Promise<void> {
  const call = httpsCallable<typeof values, { id: string }>(functions, 'saveServiceGroupByAdmin');
  await call(values);
}
