import { act, render } from '@testing-library/react-native';

import { SystemAnnouncementGate } from '@/src/components/announcements/SystemAnnouncementGate';
import { useSystemAnnouncements } from '@/src/hooks/use-system-announcements';
import type { SystemAnnouncement } from '@/src/types/system-announcement';

jest.mock('@/src/hooks/use-system-announcements', () => ({
  useSystemAnnouncements: jest.fn(),
}));

let mockModalProps: { visible: boolean; onClose: () => void } | null = null;

jest.mock('@/src/components/announcements/SystemAnnouncementModal', () => ({
  SystemAnnouncementModal: (props: { visible: boolean; onClose: () => void }) => {
    mockModalProps = props;
    return null;
  },
}));

const mockedUseSystemAnnouncements = jest.mocked(useSystemAnnouncements);

const announcement = (id: string): SystemAnnouncement => ({
  id,
  title: 'Aviso',
  message: 'Mensaje',
  type: 'info' as const,
  active: true,
  target: 'all',
  scope: 'global',
  showOnce: true,
  priority: 0,
  startsAt: {} as SystemAnnouncement['startsAt'],
  createdAt: {} as SystemAnnouncement['createdAt'],
  updatedAt: {} as SystemAnnouncement['updatedAt'],
  createdBy: 'system',
});

describe('SystemAnnouncementGate', () => {
  const markAsViewed = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('oculta el aviso cerrado y muestra automáticamente uno nuevo', async () => {
    mockedUseSystemAnnouncements.mockReturnValue({
      currentAnnouncement: announcement('one'),
      markAsViewed,
      loading: false,
      error: null,
    });

    const screen = await render(<SystemAnnouncementGate />);
    expect(mockModalProps?.visible).toBe(true);

    await act(async () => {
      await mockModalProps?.onClose();
    });
    expect(markAsViewed).toHaveBeenCalledTimes(1);
    expect(mockModalProps?.visible).toBe(false);

    mockedUseSystemAnnouncements.mockReturnValue({
      currentAnnouncement: announcement('two'),
      markAsViewed,
      loading: false,
      error: null,
    });
    await screen.rerender(<SystemAnnouncementGate />);

    expect(mockModalProps?.visible).toBe(true);
  });
});
