import { Timestamp } from 'firebase/firestore';

export type OutgoingTalkStatus = 'scheduled' | 'cancelled' | 'completed';

export interface OutgoingTalk {
  id: string;
  congregationId: string;
  speakerUserId: string;
  speakerName: string;
  destinationCongregationName: string;
  talkDate: string;
  talkTime: string;
  weekStartDate: string;
  weekEndDate: string;
  status: OutgoingTalkStatus;
  notes?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface OutgoingTalkFormPayload {
  congregationId: string;
  outgoingTalkId?: string;
  speakerUserId: string;
  destinationCongregationName: string;
  talkDate: string;
  talkTime: string;
  notes?: string;
  status?: OutgoingTalkStatus;
}
