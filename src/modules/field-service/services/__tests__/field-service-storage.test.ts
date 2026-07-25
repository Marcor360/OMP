import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadStore, markMonthlyReportAsSent, saveDay } from '../field-service-storage';
import type { FieldServiceStore } from '../../types/field-service.types';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('markMonthlyReportAsSent', () => {
  const uid = 'user-a';
  let storedValue: string;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 14, 12));

    const store: FieldServiceStore = {
      version: 1,
      entries: {
        '2026-06-03': {
          date: '2026-06-03',
          totalMinutes: 90,
          createdAt: '2026-06-03T12:00:00.000Z',
          updatedAt: '2026-06-03T12:00:00.000Z',
        },
        '2026-06-10': {
          date: '2026-06-10',
          totalMinutes: 45,
          createdAt: '2026-06-10T12:00:00.000Z',
          updatedAt: '2026-06-10T12:00:00.000Z',
        },
        '2026-07-01': {
          date: '2026-07-01',
          totalMinutes: 600,
          createdAt: '2026-07-01T12:00:00.000Z',
          updatedAt: '2026-07-01T12:00:00.000Z',
        },
      },
      meta: {
        lastAutoPurgeAt: '2026-07-01T12:00:00.000Z',
        monthlyReports: {},
      },
    };
    storedValue = JSON.stringify(store);

    mockAsyncStorage.getItem.mockImplementation(async () => storedValue);
    mockAsyncStorage.setItem.mockImplementation(async (_key, value) => {
      storedValue = value;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('persiste el total del mes una sola vez', async () => {
    await markMonthlyReportAsSent(uid, '2026-06');

    const firstStored = JSON.parse(storedValue) as FieldServiceStore;
    expect(firstStored.meta.monthlyReports['2026-06']).toMatchObject({
      monthKey: '2026-06',
      totalMinutes: 135,
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      deadlineDate: '2026-07-02',
      graceDays: 2,
    });

    const firstSentAt = firstStored.meta.monthlyReports['2026-06'].sentAt;
    await markMonthlyReportAsSent(uid, '2026-06');

    const secondStored = JSON.parse(storedValue) as FieldServiceStore;
    expect(secondStored.meta.monthlyReports['2026-06'].sentAt).toBe(firstSentAt);
    expect(Object.keys(secondStored.meta.monthlyReports)).toEqual(['2026-06']);
    expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it('rechaza un monthKey invalido sin escribir', async () => {
    await expect(markMonthlyReportAsSent(uid, '2026-13')).rejects.toThrow(
      'Mes de informe invalido'
    );
    expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('usa una clave de AsyncStorage namespaced por uid, no la clave global legada', async () => {
    await markMonthlyReportAsSent(uid, '2026-06');

    expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(`@field_service_v1:${uid}`);
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      `@field_service_v1:${uid}`,
      expect.any(String)
    );
  });
});

describe('aislamiento por uid en un dispositivo compartido', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 14, 12));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('los datos guardados por un usuario no son visibles para otro en el mismo dispositivo', async () => {
    const backingStore = new Map<string, string>();
    mockAsyncStorage.getItem.mockImplementation(async (key: string) => backingStore.get(key) ?? null);
    mockAsyncStorage.setItem.mockImplementation(async (key: string, value: string) => {
      backingStore.set(key, value);
    });

    const { store: storeA } = await loadStore('user-a');
    await saveDay('user-a', storeA, { date: '2026-07-10', hours: 2, minutes: 0 });

    const { store: storeB } = await loadStore('user-b');

    expect(storeB.entries['2026-07-10']).toBeUndefined();
    expect(backingStore.has('@field_service_v1:user-a')).toBe(true);
    expect(backingStore.has('@field_service_v1:user-b')).toBe(true);
  });
});
