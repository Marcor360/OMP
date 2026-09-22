import { useState } from 'react';

import { SystemAnnouncementModal } from '@/src/components/announcements/SystemAnnouncementModal';
import { useSystemAnnouncements } from '@/src/hooks/use-system-announcements';

export function SystemAnnouncementGate() {
  const { currentAnnouncement, markAsViewed } = useSystemAnnouncements();
  // La identidad del anuncio es la fuente de verdad: al llegar uno nuevo se
  // muestra automaticamente, sin sincronizar estado derivado dentro de un effect.
  const [dismissedAnnouncementId, setDismissedAnnouncementId] = useState<string | null>(null);

  const handleClose = async () => {
    setDismissedAnnouncementId(currentAnnouncement?.id ?? null);

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
      visible={Boolean(currentAnnouncement && dismissedAnnouncementId !== currentAnnouncement.id)}
    />
  );
}
