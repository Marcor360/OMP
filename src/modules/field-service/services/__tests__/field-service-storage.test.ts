import AsyncStorage from '@react-native-async-storage/async-storage';

import { markMonthlyReportAsSent } from '../field-service-storage';
import type { FieldServiceStore } from '../../types/field-service.types';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('markMonthlyReportAsSent', () => {
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
    await markMonthlyReportAsSent('2026-06');

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
    await markMonthlyReportAsSent('2026-06');

    const secondStored = JSON.parse(storedValue) as FieldServiceStore;
    expect(secondStored.meta.monthlyReports['2026-06'].sentAt).toBe(firstSentAt);
    expect(Object.keys(secondStored.meta.monthlyReports)).toEqual(['2026-06']);
    expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it('rechaza un monthKey invalido sin escribir', async () => {
    await expect(markMonthlyReportAsSent('2026-13')).rejects.toThrow('Mes de informe invalido');
    expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
  });
});
