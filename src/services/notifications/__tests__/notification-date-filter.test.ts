import type {
  NotificationRecord,
  NotificationRepository,
  Unsubscribe,
} from '@/src/services/repositories/ports/notification-repository.port';
import {
  __resetNotificationRepositoryForTests,
  __setNotificationRepositoryForTests,
  getUserNotifications,
} from '@/src/services/notifications/notificationService';

jest.mock('@/src/services/repositories/firestore/firestore-notification-repository', () => ({
  firestoreNotificationRepository: {
    list: jest.fn(),
    subscribeUserNotifications: jest.fn(),
    subscribeUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  },
}));

class NotificationDateRepository implements NotificationRepository {
  constructor(private readonly records: NotificationRecord[]) {}

  list(): Promise<NotificationRecord[]> {
    return Promise.resolve(this.records);
  }

  subscribeUserNotifications(): Unsubscribe {
    return () => undefined;
  }

  subscribeUnreadCount(): Unsubscribe {
    return () => undefined;
  }

  markAsRead(): Promise<void> {
    return Promise.resolve();
  }

  markAllAsRead(): Promise<number> {
    return Promise.resolve(0);
  }
}

const assignmentRecord = (
  id: string,
  metadata?: Record<string, unknown>
): NotificationRecord => ({
  id,
  data: {
    userId: 'user-1',
    congregationId: 'cong-1',
    type: 'assignment',
    category: 'platform',
    title: 'Asignacion',
    body: 'Tienes una asignacion',
    assignmentId: `assignment-${id}`,
    isRead: false,
    createdAt: makeTimestamp(new Date()),
    ...(metadata ? { metadata } : {}),
  },
});

const makeTimestamp = (date: Date): Record<string, unknown> => ({
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
  toDate: () => date,
});

const relativeDate = (days: number): Date => {
  const value = new Date();
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + days);
  return value;
};

describe('notification assignment date filtering', () => {
  afterEach(() => {
    __resetNotificationRepositoryForTests();
  });

  it('uses canonical Timestamp and ISO metadata while preserving legacy notices', async () => {
    const yesterday = relativeDate(-1);
    const tomorrow = relativeDate(1);
    const oldIso = new Date(yesterday);
    const oldIsoLabel = [
      oldIso.getFullYear(),
      String(oldIso.getMonth() + 1).padStart(2, '0'),
      String(oldIso.getDate()).padStart(2, '0'),
    ].join('-');
    const records = [
      assignmentRecord('timestamp-old', { meetingDate: makeTimestamp(yesterday) }),
      assignmentRecord('timestamp-future', { meetingDate: makeTimestamp(tomorrow) }),
      assignmentRecord('iso-old', { meetingDateLabel: oldIsoLabel }),
      assignmentRecord('legacy-localized', { date: 'lunes, 20 de julio de 2026' }),
      assignmentRecord('no-metadata'),
    ];
    __setNotificationRepositoryForTests(new NotificationDateRepository(records));

    const notifications = await getUserNotifications('user-1', 'cong-1');

    expect(notifications.map((item) => item.id)).toEqual([
      'timestamp-future',
      'legacy-localized',
      'no-metadata',
    ]);
  });
});
