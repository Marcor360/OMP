import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/src/lib/firebase/app';
import type {
  CreateTerritoryScheduleInput,
  TerritoryDay,
  TerritoryItem,
  TerritorySchedule,
  UpdateTerritoryScheduleInput,
} from '@/src/types/territory';
import {
  TERRITORIES_PER_DAY_MAX,
  TERRITORY_DAYS,
  TERRITORY_DESCRIPTION_MAX_LENGTH,
} from '@/src/types/territory';

const territoryScheduleCollectionRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'territorySchedule');

const territoryScheduleDocRef = (congregationId: string, scheduleId: string) =>
  doc(db, 'congregations', congregationId, 'territorySchedule', scheduleId);

const assertCongregationId = (congregationId: string) => {
  if (!congregationId.trim()) {
    throw new Error('Necesitas una congregacion activa.');
  }
};

const assertDay = (day: TerritoryDay) => {
  if (!TERRITORY_DAYS.includes(day)) {
    throw new Error('Selecciona un dia valido.');
  }
};

export const sanitizeTerritoryItems = (territories: TerritoryItem[]): TerritoryItem[] => {
  if (!Array.isArray(territories)) {
    throw new Error('Los territorios deben ser una lista.');
  }

  if (territories.length > TERRITORIES_PER_DAY_MAX) {
    throw new Error(`Solo se permiten ${TERRITORIES_PER_DAY_MAX} territorios por dia.`);
  }

  return territories.map((territory) => {
    const number = Number(territory.number);
    const description = territory.description.trim();

    if (!Number.isInteger(number) || number <= 0) {
      throw new Error('El numero de territorio debe ser positivo.');
    }

    if (!description) {
      throw new Error('La descripcion del territorio es obligatoria.');
    }

    if (description.length > TERRITORY_DESCRIPTION_MAX_LENGTH) {
      throw new Error(
        `La descripcion no puede superar ${TERRITORY_DESCRIPTION_MAX_LENGTH} caracteres.`
      );
    }

    return {
      number,
      description,
      enabled: territory.enabled === true,
    };
  });
};

const normalizeTerritoryItem = (value: unknown): TerritoryItem | null => {
  if (!value || typeof value !== 'object') return null;

  const data = value as Record<string, unknown>;
  if (typeof data.number !== 'number' || typeof data.description !== 'string') {
    return null;
  }

  return {
    number: data.number,
    description: data.description,
    enabled: data.enabled === true,
  };
};

const normalizeSchedule = (
  id: string,
  congregationId: string,
  data: Record<string, unknown>
): TerritorySchedule => ({
  id,
  congregationId,
  dayOfWeek: data.dayOfWeek as TerritoryDay,
  territories: Array.isArray(data.territories)
    ? data.territories
        .map(normalizeTerritoryItem)
        .filter((item): item is TerritoryItem => item !== null)
    : [],
  active: data.active !== false,
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
  updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
  createdAt: (data.createdAt as TerritorySchedule['createdAt']) ?? null,
  updatedAt: (data.updatedAt as TerritorySchedule['updatedAt']) ?? null,
});

const sortSchedule = (items: TerritorySchedule[]) =>
  [...items].sort(
    (a, b) => TERRITORY_DAYS.indexOf(a.dayOfWeek) - TERRITORY_DAYS.indexOf(b.dayOfWeek)
  );

export const getTerritorySchedule = async (
  congregationId: string
): Promise<TerritorySchedule[]> => {
  assertCongregationId(congregationId);

  const snapshot = await getDocs(query(territoryScheduleCollectionRef(congregationId)));
  return sortSchedule(
    snapshot.docs
      .map((scheduleDoc) =>
        normalizeSchedule(scheduleDoc.id, congregationId, scheduleDoc.data())
      )
      .filter((schedule) => schedule.active)
  );
};

export const subscribeTerritorySchedule = (
  congregationId: string,
  onChange: (schedule: TerritorySchedule[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  assertCongregationId(congregationId);

  return onSnapshot(
    query(territoryScheduleCollectionRef(congregationId)),
    (snapshot) => {
      onChange(
        sortSchedule(
          snapshot.docs
            .map((scheduleDoc) =>
              normalizeSchedule(scheduleDoc.id, congregationId, scheduleDoc.data())
            )
            .filter((schedule) => schedule.active)
        )
      );
    },
    onError
  );
};

export const createTerritorySchedule = async (
  congregationId: string,
  actorUid: string,
  input: CreateTerritoryScheduleInput
): Promise<void> => {
  assertCongregationId(congregationId);
  assertDay(input.dayOfWeek);

  const scheduleRef = territoryScheduleDocRef(congregationId, input.dayOfWeek);
  await setDoc(scheduleRef, {
    dayOfWeek: input.dayOfWeek,
    territories: sanitizeTerritoryItems(input.territories),
    active: input.active !== false,
    createdBy: actorUid,
    updatedBy: actorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const updateTerritorySchedule = async (
  congregationId: string,
  scheduleId: string,
  actorUid: string,
  input: UpdateTerritoryScheduleInput
): Promise<void> => {
  assertCongregationId(congregationId);
  assertDay(scheduleId as TerritoryDay);

  const payload: Record<string, unknown> = {
    updatedBy: actorUid,
    updatedAt: serverTimestamp(),
  };

  if (input.dayOfWeek) {
    assertDay(input.dayOfWeek);
    payload.dayOfWeek = input.dayOfWeek;
  }

  if (input.territories) {
    payload.territories = sanitizeTerritoryItems(input.territories);
  }

  if (typeof input.active === 'boolean') {
    payload.active = input.active;
  }

  await updateDoc(territoryScheduleDocRef(congregationId, scheduleId), payload);
};

export const deleteTerritorySchedule = async (
  congregationId: string,
  scheduleId: string
): Promise<void> => {
  assertCongregationId(congregationId);
  assertDay(scheduleId as TerritoryDay);
  await deleteDoc(territoryScheduleDocRef(congregationId, scheduleId));
};
