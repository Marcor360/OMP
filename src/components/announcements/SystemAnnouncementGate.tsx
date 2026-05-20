import { useEffect, useState } from 'react';

import { SystemAnnouncementModal } from '@/src/components/announcements/SystemAnnouncementModal';
import { useSystemAnnouncements } from '@/src/hooks/use-system-announcements';

export function SystemAnnouncementGate() {
  const { currentAnnouncement, markAsViewed } = useSystemAnnouncements();
  const [visibleAnnouncementId, setVisibleAnnouncementId] = useState<string | null>(null);

  useEffect(() => {
    setVisibleAnnouncementId(currentAnnouncement?.id ?? null);
  }, [currentAnnouncement?.id]);

  const handleClose = async () => {
    setVisibleAnnouncementId(null);

    try {
      await markAsViewed();
    } catch {
      // If the viewed marker fails, keep the modal closed for this session.
    }
  };

  return (
    <SystemAnnouncementModal
      announcement={currentAnnouncement}
      onClose={handleClose}
      visible={Boolean(currentAnnouncement && visibleAnnouncementId === currentAnnouncement.id)}
    />
  );
}
