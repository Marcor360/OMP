import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { createMeetingByManager } from '../meetings-management.js';
import { ensurePlanningMeetingsByManager } from '../planning-schedules.js';
import { formatDateKey } from '../planning-schedules/date-utils.js';

jest.setTimeout(30_000);

const describeEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

describeEmulator('meeting creation across managers', () => {
  const db = getFirestore();
  const congregationId = `meeting-generation-${Date.now()}`;
  const uid = `${congregationId}-admin`;
  const congregation = db.collection('congregations').doc(congregationId);
  const user = db.collection('users').doc(uid);
  const meetings = congregation.collection('meetings');

  beforeAll(async () => {
    await Promise.all([
      congregation.set({ isActive: true, status: 'active' }),
      user.set({ congregationId, isActive: true, role: 'admin' }),
    ]);
  });

  afterEach(async () => {
    const snapshot = await meetings.get();
    await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
  });

  afterAll(async () => {
    await Promise.all([congregation.delete(), user.delete()]);
  });

  const forTomorrow = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(12, 0, 0, 0);
    const dateKey = formatDateKey(date);
    const auth = { uid, token: { uid } };
    const planning = () => ensurePlanningMeetingsByManager.run({
      auth,
      data: {
        congregationId,
        startDate: dateKey,
        endDate: dateKey,
        midweekDay: date.getDay(),
        weekendDay: (date.getDay() + 1) % 7,
      },
    } as Parameters<typeof ensurePlanningMeetingsByManager.run>[0]);
    const timestamp = Timestamp.fromDate(date);
    const manual = () => createMeetingByManager.run({
      auth,
      data: {
        congregationId,
        meetingData: {
          type: 'midweek',
          startDate: timestamp,
          endDate: timestamp,
          meetingDate: timestamp,
        },
      },
    } as Parameters<typeof createMeetingByManager.run>[0]);
    return { manual, planning };
  };

  it('returns an existing meeting on a concurrent planning retry', async () => {
    const { planning } = forTomorrow();
    const results = await Promise.all([planning(), planning()]);

    expect(results.map((result) => result.createdMidweek).sort()).toEqual([0, 1]);
    expect(results.map((result) => result.existing).sort()).toEqual([0, 1]);
    expect((await meetings.get()).size).toBe(1);
  });

  it('keeps an existing meeting and its original identifier', async () => {
    const { manual, planning } = forTomorrow();
    const { meetingId } = await manual();

    await expect(planning()).resolves.toMatchObject({ createdMidweek: 0, existing: 1 });
    expect((await meetings.get()).docs.map((doc) => doc.id)).toEqual([meetingId]);
  });

  it('creates only one meeting when both managers run concurrently', async () => {
    const { manual, planning } = forTomorrow();
    const [manualResult, planningResult] = await Promise.allSettled([manual(), planning()]);

    expect(planningResult.status).toBe('fulfilled');
    if (manualResult.status === 'rejected') {
      expect(manualResult.reason).toMatchObject({ code: 'already-exists' });
    }
    expect((await meetings.get()).size).toBe(1);
  });
});
