import { logger } from 'firebase-functions/v2';

export const sendPushToUser = async (params: {
  uid: string;
  tokens: string[];
  title: string;
  body: string;
  assignmentId: string;
  category: string;
  meetingType: string | null;
  date: string | null;
}): Promise<void> => {
  logger.debug('Skipping legacy FCM push; Expo push is sent from notification trigger', {
    uid: params.uid,
    assignmentId: params.assignmentId,
    category: params.category,
    meetingType: params.meetingType,
  });
};
