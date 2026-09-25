import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import {
  archiveHospitalityScheduleByManager,
  assignHospitalityAssignmentByManager,
  publishHospitalityScheduleByManager,
  saveHospitalityScheduleDraftByManager,
  substituteHospitalityAssignmentByManager,
} from '../planning-schedules.js';

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const congregationId = `hospitality-emulator-${Date.now().toString(36)}`;
const userId = (suffix: string) => `${congregationId}-${suffix}`;
const managerId = userId('manager');
const chairmanId = userId('chairman');
const oldAId = userId('old-a');
const oldBId = userId('old-b');
const replacementId = userId('replacement');
const replacementTwoId = userId('replacement-2');
const db = getFirestore();
const congregationRef = db.collection('congregations').doc(congregationId);
const meetingDate = '2026-10-03';
const draftPublishDate = '2026-10-10';
const draftArchiveDate = '2026-10-17';
const legacyChairDate = '2026-10-24';
const meetingTimestamp = Timestamp.fromDate(new Date(`${meetingDate}T12:00:00.000Z`));
jest.setTimeout(30_000);

type CallableLike = {
  run: (request: { data: Record<string, unknown>; auth: { uid: string; token: Record<string, unknown> } }) => Promise<unknown>;
};

const invoke = (callable: unknown, uid: string, data: Record<string, unknown>) =>
  (callable as CallableLike).run({ data, auth: { uid, token: { uid } } });

const scheduleData = (scheduleId: string) => ({
  congregationId,
  title: scheduleId,
  startDate: meetingDate,
  endDate: meetingDate,
  monthIds: ['2026-10'],
  totalMeetings: 1,
  status: 'published',
  createdBy: 'manager',
  updatedBy: 'manager',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
});

const itemData = (scheduleId: string, meetingId: string, roleKey: string, userId: string, date = meetingDate) => ({
  congregationId,
  scheduleId,
  meetingId,
  meetingDate: date,
  meetingType: 'weekend',
  roleKey,
  roleLabel: roleKey,
  userId,
  userNameSnapshot: userId,
  status: 'scheduled',
  createdBy: 'manager',
  updatedBy: 'manager',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
});

const getAssignedIdsFromMeeting = (sections: unknown): string[] =>
  (Array.isArray(sections) ? sections : []).flatMap((section) => {
    if (!section || typeof section !== 'object') return [];
    const assignments = (section as { assignments?: unknown }).assignments;
    if (!Array.isArray(assignments)) return [];
    return assignments.flatMap((assignment) => {
      if (!assignment || typeof assignment !== 'object') return [];
      const assignees = (assignment as { assignees?: unknown }).assignees;
      return Array.isArray(assignees) ? assignees.flatMap((assignee) =>
        assignee && typeof assignee === 'object' && typeof (assignee as { assigneeUserId?: unknown }).assigneeUserId === 'string'
          ? [(assignee as { assigneeUserId: string }).assigneeUserId]
          : []) : [];
    });
  });

const describeEmulator = emulatorAvailable ? describe : describe.skip;

describeEmulator('hospitality callables with Firestore emulator', () => {
  const scheduleIds = ['race-a', 'race-b', 'assign-sync', 'draft-publish', 'draft-archive', 'legacy-chair'];
  const meetingIds = ['race-meeting', 'assign-meeting', 'draft-meeting', 'archive-meeting', 'legacy-chair-meeting'];

  beforeAll(async () => {
    await congregationRef.set({ isActive: true, status: 'active' });
    await Promise.all([
      congregationRef.collection('meetings').doc('race-meeting').set({
        meetingDate: meetingTimestamp, meetingCategory: 'weekend', chairmanUserId: chairmanId, sections: [],
      }),
      congregationRef.collection('meetings').doc('assign-meeting').set({
        meetingDate: meetingTimestamp, meetingCategory: 'weekend', chairmanUserId: chairmanId, sections: [],
      }),
      congregationRef.collection('meetings').doc('draft-meeting').set({
        meetingDate: Timestamp.fromDate(new Date(`${draftPublishDate}T12:00:00.000Z`)), meetingCategory: 'weekend', chairmanUserId: chairmanId, sections: [],
      }),
      congregationRef.collection('meetings').doc('archive-meeting').set({
        meetingDate: Timestamp.fromDate(new Date(`${draftArchiveDate}T12:00:00.000Z`)), meetingCategory: 'weekend', chairmanUserId: chairmanId, sections: [],
      }),
      congregationRef.collection('meetings').doc('legacy-chair-meeting').set({
        meetingDate: Timestamp.fromDate(new Date(`${legacyChairDate}T12:00:00.000Z`)), meetingCategory: 'weekend', chairman: 'Replacement Two', sections: [],
      }),
      db.collection('users').doc(managerId).set({
        congregationId, isActive: true, role: 'user', servicePosition: 'encargado',
        serviceDepartment: 'acomodadores_microfonos',
      }),
      db.collection('users').doc(chairmanId).set({ congregationId, isActive: true, privileges: { isElder: true } }),
      db.collection('users').doc(oldAId).set({ congregationId, isActive: true, privileges: { isElder: true } }),
      db.collection('users').doc(oldBId).set({ congregationId, isActive: true, privileges: { isElder: true } }),
      db.collection('users').doc(replacementId).set({ congregationId, isActive: true, privileges: { isElder: true }, displayName: 'Replacement' }),
      db.collection('users').doc(replacementTwoId).set({ congregationId, isActive: true, privileges: { isElder: true }, displayName: 'Replacement Two' }),
    ]);
    await Promise.all(scheduleIds.map((id) => congregationRef.collection('hospitalitySchedules').doc(id).set(scheduleData(id))));
    await Promise.all([
      congregationRef.collection('hospitalitySchedules').doc('draft-publish').set({ ...scheduleData('draft-publish'), startDate: draftPublishDate, endDate: draftPublishDate, status: 'draft' }),
      congregationRef.collection('hospitalitySchedules').doc('draft-archive').set({ ...scheduleData('draft-archive'), startDate: draftArchiveDate, endDate: draftArchiveDate, status: 'draft' }),
      congregationRef.collection('hospitalitySchedules').doc('legacy-chair').set({ ...scheduleData('legacy-chair'), startDate: legacyChairDate, endDate: legacyChairDate }),
    ]);
    await Promise.all([
      congregationRef.collection('hospitalitySchedules').doc('race-a').collection('items').doc('a-item')
        .set(itemData('race-a', 'race-meeting', 'microphoneOne', oldAId)),
      congregationRef.collection('hospitalitySchedules').doc('race-b').collection('items').doc('b-item')
        .set(itemData('race-b', 'race-meeting', 'microphoneTwo', oldBId)),
    ]);
  });

  afterAll(async () => {
    for (const scheduleId of scheduleIds) {
      const scheduleRef = congregationRef.collection('hospitalitySchedules').doc(scheduleId);
      const items = await scheduleRef.collection('items').get();
      await Promise.all(items.docs.map((snapshot) => snapshot.ref.delete()));
      await scheduleRef.delete();
    }
    for (const meetingId of meetingIds) await congregationRef.collection('meetings').doc(meetingId).delete();
    for (const uid of [managerId, chairmanId, oldAId, oldBId, replacementId, replacementTwoId]) {
      await db.collection('users').doc(uid).delete();
    }
    const locks = await congregationRef.collection('hospitalityPlanningLocks').get();
    await Promise.all(locks.docs.map((snapshot) => snapshot.ref.delete()));
    await congregationRef.delete();
  });

  it('serializes simultaneous substitutions and only one can claim the person', async () => {
    const results = await Promise.allSettled([
      invoke(substituteHospitalityAssignmentByManager, managerId, {
        congregationId, scheduleId: 'race-a', itemId: 'a-item', newUserId: replacementId,
      }),
      invoke(substituteHospitalityAssignmentByManager, managerId, {
        congregationId, scheduleId: 'race-b', itemId: 'b-item', newUserId: replacementId,
      }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const assignments = await Promise.all(['race-a', 'race-b'].map((scheduleId) =>
      congregationRef.collection('hospitalitySchedules').doc(scheduleId).collection('items').get()));
    const claimed = assignments.flatMap((snapshot) => snapshot.docs)
      .filter((snapshot) => snapshot.get('userId') === replacementId);
    expect(claimed).toHaveLength(1);
  });

  it('creates and substitutes a published assignment while syncing the meeting sections', async () => {
    const created = await invoke(assignHospitalityAssignmentByManager, managerId, {
      congregationId, scheduleId: 'assign-sync', meetingId: 'assign-meeting', meetingDate,
      meetingType: 'weekend', roleKey: 'microphoneOne', newUserId: replacementTwoId,
    });
    expect(created).toMatchObject({ ok: true, meetingSynced: true });
    let meeting = await congregationRef.collection('meetings').doc('assign-meeting').get();
    expect(getAssignedIdsFromMeeting(meeting.get('sections'))).toContain(replacementTwoId);

    await invoke(substituteHospitalityAssignmentByManager, managerId, {
      congregationId, scheduleId: 'assign-sync', itemId: 'assign-meeting-microphoneOne',
      newUserId: replacementId,
    });
    meeting = await congregationRef.collection('meetings').doc('assign-meeting').get();
    expect(getAssignedIdsFromMeeting(meeting.get('sections'))).toContain(replacementId);
    expect(getAssignedIdsFromMeeting(meeting.get('sections'))).not.toContain(replacementTwoId);
  });

  it('saves drafts, publishes and archives through their authorized callables', async () => {
    const publishDraft = await invoke(saveHospitalityScheduleDraftByManager, managerId, {
      congregationId,
      scheduleId: 'draft-publish',
      title: 'Emulator publish',
      startDate: draftPublishDate,
      endDate: draftPublishDate,
      optionalRoles: {},
      items: [{ meetingId: 'draft-meeting', meetingDate: draftPublishDate, meetingType: 'weekend', roleKey: 'microphoneOne', userId: replacementTwoId }],
    });
    expect(publishDraft).toMatchObject({ ok: true, scheduleId: 'draft-publish', savedItems: 1 });
    const published = await invoke(publishHospitalityScheduleByManager, managerId, {
      congregationId, scheduleId: 'draft-publish', syncMeetings: false,
    });
    expect(published).toMatchObject({ ok: true });
    expect((await congregationRef.collection('hospitalitySchedules').doc('draft-publish').get()).get('status'))
      .toBe('published');

    await invoke(saveHospitalityScheduleDraftByManager, managerId, {
      congregationId,
      scheduleId: 'draft-archive',
      title: 'Emulator archive',
      startDate: draftArchiveDate,
      endDate: draftArchiveDate,
      optionalRoles: {},
      items: [{ meetingId: 'archive-meeting', meetingDate: draftArchiveDate, meetingType: 'weekend', roleKey: 'microphoneOne', userId: replacementId }],
    });
    const archived = await invoke(archiveHospitalityScheduleByManager, managerId, {
      congregationId, scheduleId: 'draft-archive',
    });
    expect(archived).toMatchObject({ ok: true, cancelledItems: 1 });
  });

  it('blocks a legacy text-only chairman from receiving another hospitality assignment', async () => {
    await expect(invoke(assignHospitalityAssignmentByManager, managerId, {
      congregationId, scheduleId: 'legacy-chair', meetingId: 'legacy-chair-meeting',
      meetingDate: legacyChairDate, meetingType: 'weekend', roleKey: 'microphoneOne',
      newUserId: replacementTwoId,
    })).rejects.toMatchObject({ code: 'failed-precondition' });
    const item = await congregationRef.collection('hospitalitySchedules').doc('legacy-chair')
      .collection('items').doc('legacy-chair-meeting-microphoneOne').get();
    expect(item.exists).toBe(false);
  });

});
