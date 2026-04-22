import { logger } from 'firebase-functions/v2';

import { adminMessaging } from '../../config/firebaseAdmin.js';
import { removeInvalidTokens } from './notification.firestore.js';

const INVALID_TOKEN_ERROR_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

const isInvalidTokenError = (errorCode: string | undefined): boolean => {
  if (!errorCode) return false;
  return INVALID_TOKEN_ERROR_CODES.has(errorCode);
};

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
  const normalizedTokens = Array.from(
    new Set(
      params.tokens
        .map((token) => token.trim())
        .filter((token) => token.length > 0)
    )
  );

  if (normalizedTokens.length === 0) {
    logger.info('Skipping push notification: user has no valid tokens', {
      uid: params.uid,
      assignmentId: params.assignmentId,
      category: params.category,
      meetingType: params.meetingType,
    });
    return;
  }

  const response = await adminMessaging.sendEachForMulticast({
    tokens: normalizedTokens,
    notification: {
      title: params.title,
      body: params.body,
    },
    data: {
      type: 'assignment',
      assignmentId: params.assignmentId,
      category: params.category,
      meetingType: params.meetingType ?? '',
      date: params.date ?? '',
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'default',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
        },
      },
    },
  });

  const invalidTokens: string[] = [];

  response.responses.forEach((result, index) => {
    if (result.success) return;

    const token = normalizedTokens[index];
    const code = result.error?.code;

    if (isInvalidTokenError(code)) {
      invalidTokens.push(token);
      return;
    }

    logger.error('sendPushToUser failed for token', {
      uid: params.uid,
      token,
      code,
      message: result.error?.message,
    });
  });

  if (invalidTokens.length > 0) {
    await removeInvalidTokens(params.uid, invalidTokens);
  }
};
