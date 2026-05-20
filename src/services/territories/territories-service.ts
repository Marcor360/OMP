import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/src/lib/firebase/app';
import type {
  Territory,
  TerritoryDayOfWeek,
  TerritoryFormValues,
  TerritorySchedule,
} from '@/src/types/territory';

const territoriesCollectionRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'territories');

const territoryScheduleCollectionRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'territorySchedule');

const normalizeTerritory = (id: string, congregationId: string, data: Record<string, unknown>): Territory => ({
  id,
  congregationId,
  number: typeof data.number === 'number' ? data.number : null,
  name: typeof data.name === 'string' ? data.name : '',
  description: typeof data.description === 'string' ? data.description : '',
  status: data.status === 'inactive' ? 'inactive' : 'active',
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
  updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
  createdAt: data.createdAt as Territory['createdAt'],
  updatedAt: data.updatedAt as Territory['updatedAt'],
});

const normalizeSchedule = (
  id: string,
  congregationId: string,
  data: Record<string, unknown>
): TerritorySchedule => ({
  id,
  congregationId,
  dayOfWeek: data.dayOfWeek as TerritoryDayOfWeek,
  territoryIds: Array.isArray(data.territoryIds)
    ? data.territoryIds.filter((value): value is string => typeof value === 'string')
    : [],
  note: typeof data.note === 'string' ? data.note : '',
  isActive: data.isActive === true,
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
  updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
  createdAt: data.createdAt as TerritorySchedule['createdAt'],
  updatedAt: data.updatedAt as TerritorySchedule['updatedAt'],
});

export const subscribeToTerritories = (
  congregationId: string,
  onChange: (territories: Territory[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  const territoriesQuery = query(territoriesCollectionRef(congregationId));

  return onSnapshot(
    territoriesQuery,
    (snapshot) => {
      const territories = snapshot.docs
        .map((territoryDoc) =>
          normalizeTerritory(territoryDoc.id, congregationId, territoryDoc.data())
        )
        .sort((a, b) => {
          const numberCompare = (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER);
          if (numberCompare !== 0) return numberCompare;
          return a.name.localeCompare(b.name, 'es');
        });

      onChange(territories);
    },
    onError
  );
};

export const subscribeToTerritorySchedule = (
  congregationId: string,
  onChange: (schedule: TerritorySchedule[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  const scheduleQuery = query(
    territoryScheduleCollectionRef(congregationId),
    where('isActive', '==', true)
  );

  return onSnapshot(
    scheduleQuery,
    (snapshot) => {
      onChange(
        snapshot.docs.map((scheduleDoc) =>
          normalizeSchedule(scheduleDoc.id, congregationId, scheduleDoc.data())
        )
      );
    },
    onError
  );
};

export const createTerritory = async (
  congregationId: string,
  actorUid: string,
  values: TerritoryFormValues
) => {
  await addDoc(territoriesCollectionRef(congregationId), {
    congregationId,
    number: values.number,
    name: values.name,
    description: values.description,
    status: 'active',
    createdBy: actorUid,
    updatedBy: actorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const updateTerritory = async (
  congregationId: string,
  territoryId: string,
  actorUid: string,
  values: TerritoryFormValues
) => {
  await updateDoc(doc(db, 'congregations', congregationId, 'territories', territoryId), {
    number: values.number,
    name: values.name,
    description: values.description,
    updatedBy: actorUid,
    updatedAt: serverTimestamp(),
  });
};

export const deactivateTerritory = async (
  congregationId: string,
  territoryId: string,
  actorUid: string
) => {
  await updateDoc(doc(db, 'congregations', congregationId, 'territories', territoryId), {
    status: 'inactive',
    updatedBy: actorUid,
    updatedAt: serverTimestamp(),
  });
};

export const assignTerritoriesToDay = async (
  congregationId: string,
  actorUid: string,
  dayOfWeek: TerritoryDayOfWeek,
  territoryIds: string[],
  note: string
) => {
  const scheduleRef = doc(db, 'congregations', congregationId, 'territorySchedule', dayOfWeek);
  const scheduleSnapshot = await getDoc(scheduleRef);
  const payload = scheduleSnapshot.exists()
    ? {
      congregationId,
      dayOfWeek,
      territoryIds,
      note,
      isActive: true,
      updatedBy: actorUid,
      updatedAt: serverTimestamp(),
    }
    : {
      congregationId,
      dayOfWeek,
      territoryIds,
      note,
      isActive: true,
      updatedBy: actorUid,
      updatedAt: serverTimestamp(),
      createdBy: actorUid,
      createdAt: serverTimestamp(),
    };

  await setDoc(scheduleRef, payload, { merge: true });
};
