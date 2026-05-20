import type { Timestamp } from 'firebase/firestore';

export type SystemAnnouncementType = 'info' | 'success' | 'warning' | 'maintenance';

export type SystemAnnouncementTarget = 'all' | 'app' | 'web';

export type SystemAnnouncementScope = 'global' | 'congregation';

export interface SystemAnnouncement {
  id: string;
  title: string;
  message: string;
  type: SystemAnnouncementType;
  active: boolean;
  target: SystemAnnouncementTarget;
  scope: SystemAnnouncementScope;
  congregationIds?: string[];
  showOnce: boolean;
  priority: number;
  startsAt: Timestamp;
  endsAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}
