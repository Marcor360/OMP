import { randomUUID } from 'node:crypto';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import {
  createMeetingByManager,
  createMeetingAssignmentByManager,
  getMeetingAssignmentSaveStatus,
  getMeetingWorkReview,
  retryMeetingCleaningSync,
  syncMeetingCleaningAssignmentsByManager,
  updateMeetingByManager,
} from '../meetings-management.js';
import { setMeetingPublicationStatus } from '../meetings-publication.js';
import { updateMeetingFromSnapshot } from '../modules/meetings/meeting-version.js';

jest.setTimeout(30_000);

const describeEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

describeEmulator('meeting writes under retries and concurrent edits', () => {
  const db = getFirestore();
  const congregationId = `meeting-writes-${randomUUID()}`;
  const uid = `${congregationId}-admin`;
  const otherUid = `${congregationId}-editor`;
  const unauthorizedUid = `${congregationId}-viewer`;
  const congregation = db.collection('congregations').doc(congregationId);
  const meeting = congregation.collection('meetings').doc('weekly');
  const revision = Timestamp.fromMillis(1000);
  const authenticate = (actor = uid) => ({ uid: actor, token: { uid: actor } });

  beforeAll(async () => {
    await Promise.all([
      congregation.set({ isActive: true, status: 'active' }),
      db.collection('users').doc(uid).set({ congregationId, isActive: true, role: 'admin' }),
      db.collection('users').doc(otherUid).set({ congregationId, isActive: true, role: 'admin' }),
      db.collection('users').doc(unauthorizedUid).set({ congregationId, isActive: true, role: 'user' }),
    ]);
  });

  beforeEach(async () => {
    await meeting.set({
      title: 'Reunión de prueba',
      type: 'midweek',
      publicationStatus: 'awaiting_assignments',
      updatedAt: revision,
    });
  });

  afterEach(() => db.recursiveDelete(meeting));

  afterAll(async () => {
    await Promise.all([
      congregation.delete(),
      ...[uid, otherUid, unauthorizedUid].map((actor) => db.collection('users').doc(actor).delete()),
    ]);
  });

  const create = (actor = uid, title = 'Asignación', requestId = 'a'.repeat(20)) =>
    createMeetingAssignmentByManager.run({
      auth: authenticate(actor),
      data: { congregationId, meetingId: meeting.id, requestId, assignmentData: { title } },
    } as Parameters<typeof createMeetingAssignmentByManager.run>[0]);

  it('returns one assignment for concurrent retries and rejects changed data for the same request', async () => {
    const [first, second] = await Promise.all([create(), create()]);

    expect(second).toEqual(first);
    await expect(create(uid, 'Otra asignación')).rejects.toMatchObject({ code: 'already-exists' });
    await expect(create(unauthorizedUid)).rejects.toMatchObject({ code: 'permission-denied' });
    const assignments = (await meeting.collection('assignments').get()).docs;
    expect(assignments.map((assignment) => [assignment.id, assignment.get('title')]))
      .toEqual([[first.assignmentId, 'Asignación']]);
  });

  it('keeps intentionally separate submissions and scopes the same identifier by author', async () => {
    const results = await Promise.all([create(), create(otherUid), create(uid, 'Asignación', 'b'.repeat(20))]);

    expect(new Set(results.map(({ assignmentId }) => assignmentId)).size).toBe(3);
  });

  it('confirms the original save after deletion and never recreates it on retry', async () => {
    const requestId = 'a'.repeat(20);
    const status = (actor: string, expectedActorUid = actor) => getMeetingAssignmentSaveStatus.run({
      auth: authenticate(actor),
      data: { congregationId, meetingId: meeting.id, requestId, expectedActorUid },
    } as Parameters<typeof getMeetingAssignmentSaveStatus.run>[0]);
    await expect(status(uid)).resolves.toEqual({ saved: false });
    const { assignmentId } = await create();
    await meeting.collection('assignments').doc(assignmentId).delete();

    await expect(status(uid)).resolves.toEqual({ saved: true, assignmentId });
    await expect(status(otherUid)).resolves.toEqual({ saved: false });
    await expect(status(otherUid, uid)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(status(unauthorizedUid)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(create()).resolves.toEqual({ assignmentId });
    expect((await meeting.collection('assignments').get()).empty).toBe(true);
  });

  it('rejects a second editor and a publication based on the old revision', async () => {
    const edit = (actor: string, title: string) => updateMeetingByManager.run({
      auth: authenticate(actor),
      data: {
        congregationId, meetingId: meeting.id, scope: 'assignments',
        expectedUpdatedAt: { seconds: revision.seconds, nanoseconds: revision.nanoseconds },
        meetingData: { sections: [{ sectionKey: 'section', title, assignments: [] }] },
      },
    } as Parameters<typeof updateMeetingByManager.run>[0]);

    await expect(edit(uid, 'Primera edición')).resolves.toEqual({ ok: true });
    await expect(edit(otherUid, 'Edición obsoleta')).rejects.toMatchObject({ code: 'aborted' });
    await expect(setMeetingPublicationStatus.run({
      auth: authenticate(otherUid),
      data: {
        congregationId, meetingId: meeting.id, publicationStatus: 'published',
        expectedUpdatedAt: { seconds: revision.seconds, nanoseconds: revision.nanoseconds },
      },
    } as Parameters<typeof setMeetingPublicationStatus.run>[0])).rejects.toMatchObject({ code: 'aborted' });
    expect((await meeting.get()).get('sections')).toMatchObject([{ title: 'Primera edición' }]);
    const history = (actor: string) => getMeetingWorkReview.run({
      auth: authenticate(actor),
      data: { congregationId, meetingId: meeting.id, review: 'history' },
    } as Parameters<typeof getMeetingWorkReview.run>[0]);
    await expect(history(otherUid)).resolves.toMatchObject({
      history: [{
        ownChange: false,
        changedSections: [{ key: 'section', title: 'Primera edición', change: 'added' }],
      }],
    });
    await expect(history(unauthorizedUid)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rejects writes even from legacy clients if the server snapshot changes before commit', async () => {
    const stale = await meeting.get();
    await meeting.update({ title: 'Cambio simultáneo' });

    await expect(updateMeetingFromSnapshot(stale, { title: 'Versión antigua' }))
      .rejects.toMatchObject({ code: 'aborted' });
    expect((await meeting.get()).get('title')).toBe('Cambio simultáneo');
  });

  it('re-syncs cleaning without reopening a completed task or changing its creator', async () => {
    const sync = (actor: string) => syncMeetingCleaningAssignmentsByManager.run({
      auth: authenticate(actor),
      data: {
        congregationId, meetingId: meeting.id, mode: 'selected',
        groups: [{ id: 'group-1', name: 'Grupo de prueba' }],
      },
    } as Parameters<typeof syncMeetingCleaningAssignmentsByManager.run>[0]);

    await sync(uid);
    const assignment = meeting.collection('assignments').doc('cleaning-group-1');
    await assignment.update({ status: 'completed', assignedUsers: ['original-assignee'] });
    const original = (await assignment.get()).data();

    await sync(otherUid);

    expect((await assignment.get()).data()).toMatchObject({
      createdAt: original?.createdAt, createdBy: uid, updatedBy: otherUid,
      status: 'completed', assignedUsers: ['original-assignee'],
    });
    expect((await meeting.collection('assignments').get()).size).toBe(1);
  });

  it('persists a pending cleaning plan and retries only the saved version', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);
    const date = Timestamp.fromDate(tomorrow);
    const { meetingId } = await createMeetingByManager.run({
      auth: authenticate(),
      data: { congregationId, meetingData: {
        title: 'Reunión con limpieza',
        type: 'midweek',
        startDate: date,
        endDate: date,
        meetingDate: date,
        cleaningAssignmentMode: 'selected',
        cleaningGroupIds: ['saved-group'],
        cleaningGroupNames: ['Grupo guardado'],
      } },
    } as Parameters<typeof createMeetingByManager.run>[0]);
    const saved = congregation.collection('meetings').doc(meetingId);
    try {
      expect((await saved.get()).get('cleaningSyncPending')).toBe(true);
      expect((await saved.collection('assignments').get()).empty).toBe(true);

      const retry = (actor = uid) => retryMeetingCleaningSync.run({
        auth: authenticate(actor),
        data: { congregationId, meetingId, mode: 'none' },
      } as Parameters<typeof retryMeetingCleaningSync.run>[0]);
      await expect(retry(unauthorizedUid)).rejects.toMatchObject({ code: 'permission-denied' });
      await retry();
      const after = await saved.get();
      await retry();

      expect(after.get('cleaningSyncPending')).toBe(false);
      expect((await saved.get()).updateTime!.isEqual(after.updateTime!)).toBe(true);
      const assignments = await saved.collection('assignments').get();
      expect(assignments.docs.map((doc) => [doc.id, doc.get('cleaningGroupName')]))
        .toEqual([['cleaning-saved-group', 'Grupo guardado']]);
    } finally {
      await db.recursiveDelete(saved);
    }
  });

  it('only groups similar records for the same target, day and category of the selected meeting', async () => {
    const collection = meeting.collection('assignments');
    const common = { category: 'platform', assignedToUid: 'person-one', dueDate: revision };
    await Promise.all([
      collection.doc('one').set({ ...common, title: 'Lectúra bíblica' }),
      collection.doc('two').set({ ...common, title: 'Lectura  bíblica' }),
      collection.doc('other-person').set({ ...common, title: 'Lectura bíblica', assignedToUid: 'person-two' }),
      collection.doc('other-day').set({ ...common, title: 'Lectura bíblica', dueDate: Timestamp.fromMillis(172_800_000) }),
      collection.doc('cancelled').set({ ...common, title: 'Lectura bíblica', status: 'cancelled' }),
    ]);
    const getReview = (actor = uid, congregation = congregationId) => getMeetingWorkReview.run({
      auth: authenticate(actor),
      data: { congregationId: congregation, meetingId: meeting.id, review: 'duplicates' },
    } as Parameters<typeof getMeetingWorkReview.run>[0]);

    const review = await getReview();
    expect(review.duplicates.map((group) => group.map((item) => item.id))).toEqual([['one', 'two']]);
    await expect(getReview(unauthorizedUid)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(getReview(uid, 'another-congregation')).rejects.toMatchObject({ code: 'permission-denied' });
    expect((await collection.get()).size).toBe(5);
  });
});
