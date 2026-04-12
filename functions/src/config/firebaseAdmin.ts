import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

if (getApps().length === 0) {
  initializeApp();
}

export const adminDb = getFirestore();
export const adminMessaging = getMessaging();
