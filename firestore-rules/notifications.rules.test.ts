import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;
const projectId = `omp-notification-rules-${Date.now()}`;
const rules = readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8');

jest.setTimeout(30_000);

const userDoc = (uid: string, congregationId: string) => ({
  uid,
  email: `${uid}@example.com`,
  firstName: uid,
  lastName: 'User',
  role: 'user',
  isActive: true,
  congregationId,
});

const authedDb = (uid: string) => testEnv.authenticatedContext(uid).firestore();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules, host: '127.0.0.1', port: 9085 },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'congregations/c1'), {
        name: 'Congregation 1',
        isActive: true,
        status: 'active',
      }),
      setDoc(doc(db, 'users/member'), userDoc('member', 'c1')),
      setDoc(doc(db, 'users/other'), userDoc('other', 'c1')),
      setDoc(doc(db, 'congregations/c1/notifications/event-member'), {
        notificationId: 'event-member',
        congregationId: 'c1',
        userId: 'member',
        userIds: ['member'],
        type: 'event',
        eventId: 'event-1',
        eventType: 'reunion_especial',
        title: 'Nueva informacion de evento',
        body: 'Se ha agregado un nuevo evento para la congregacion.',
        isRead: false,
        createdAt: serverTimestamp(),
        sentBy: 'admin',
        data: { url: '/(protected)/(tabs)' },
      }),
      setDoc(doc(db, 'congregations/c1/notifications/group-member'), {
        notificationId: 'group-member',
        congregationId: 'c1',
        userIds: ['member'],
        type: 'assignment',
        title: 'Asignacion',
        body: 'Nueva asignacion',
        isRead: false,
        createdAt: serverTimestamp(),
      }),
    ]);
  });
});

describe('notification read rules', () => {
  it('allows the recipient to mark an event notification as read', async () => {
    await assertSucceeds(updateDoc(
      doc(authedDb('member'), 'congregations/c1/notifications/event-member'),
      { isRead: true, readAt: serverTimestamp() }
    ));
  });

  it('allows a recipient listed only in userIds to mark it as read', async () => {
    await assertSucceeds(updateDoc(
      doc(authedDb('member'), 'congregations/c1/notifications/group-member'),
      { isRead: true, readAt: serverTimestamp() }
    ));
  });

  it('blocks another user from marking the notification as read', async () => {
    await assertFails(updateDoc(
      doc(authedDb('other'), 'congregations/c1/notifications/event-member'),
      { isRead: true, readAt: serverTimestamp() }
    ));
  });

  it('blocks the recipient from changing notification content', async () => {
    await assertFails(updateDoc(
      doc(authedDb('member'), 'congregations/c1/notifications/event-member'),
      { isRead: true, readAt: serverTimestamp(), title: 'Alterado' }
    ));
  });
});
