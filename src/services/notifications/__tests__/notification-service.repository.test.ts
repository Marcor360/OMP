import type {
  NotificationRecord,
  NotificationRepository,
  Unsubscribe,
} from '@/src/services/repositories/ports/notification-repository.port';
import {
  __resetNotificationRepositoryForTests,
  __setNotificationRepositoryForTests,
  markAllNotificationsAsRead,
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

class FakeNotificationRepository implements NotificationRepository {
  readonly markAllAsReadMock = jest.fn<Promise<number>, [string, string]>(() =>
    Promise.resolve(250)
  );

  list(): Promise<NotificationRecord[]> {
    return Promise.resolve([]);
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

  markAllAsRead(congregationId: string, userId: string): Promise<number> {
    return this.markAllAsReadMock(congregationId, userId);
  }
}

describe('notificationService repository seam', () => {
  afterEach(() => {
    __resetNotificationRepositoryForTests();
    jest.clearAllMocks();
  });

  it('markAllNotificationsAsRead delegates to repo.markAllAsRead', async () => {
    const repo = new FakeNotificationRepository();
    __setNotificationRepositoryForTests(repo);

    await expect(markAllNotificationsAsRead('user-1', 'cong-1')).resolves.toBe(250);

    expect(repo.markAllAsReadMock).toHaveBeenCalledTimes(1);
    expect(repo.markAllAsReadMock).toHaveBeenCalledWith('cong-1', 'user-1');
  });
});
