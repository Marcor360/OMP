import { randomUUID } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';

import { saveServiceGroupByAdmin } from '../event-groups.js';
import {
  createEventByManager, deleteEventByManager, listEventPlanningPeople, updateEventByManager,
} from '../events.js';
import { eventDay } from '../shared/event-planning.js';

jest.setTimeout(30_000);
const describeEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

describeEmulator('special events and service groups', () => {
  const db = getFirestore();
  const congregationId = `event-planning-${randomUUID()}`;
  const congregation = db.collection('congregations').doc(congregationId);
  const actors = ['admin', 'member', 'assistant', 'other', 'inactive'].map((key) => `${congregationId}-${key}`);
  const [admin, member, assistant, other, inactive] = actors;
  const extra = ['one', 'two', 'three', 'four'].map((name) => `${congregationId}-${name}`);
  const auth = (uid = admin) => ({ uid, token: { uid } });
  const day = eventDay(new Date(Date.now() + 86_400_000 * 7));
  const event = () => ({
    type: 'personalizado', title: 'Asignación de baños', startDate: day, endDate: day, location: 'Salón',
    categories: ['asamblea', 'limpieza', 'asamblea'],
    schedules: [{
      name: 'Baños', date: day, startTime: '09:00', endTime: '10:30', minutesPerShift: 60, teamSize: 2,
      teams: [{ memberIds: [admin, member] }, { memberIds: [admin, assistant] }],
    }],
  });
  const create = (data = event(), requestId = randomUUID(), actor = admin) => createEventByManager.run({
    auth: auth(actor), data: { congregationId, requestId, eventData: data },
  } as Parameters<typeof createEventByManager.run>[0]);
  const update = (eventId: string, expectedRevision: number, eventData = event()) => updateEventByManager.run({
    auth: auth(), data: { congregationId, eventId, expectedRevision, eventData },
  } as Parameters<typeof updateEventByManager.run>[0]);
  const remove = (eventId: string) => deleteEventByManager.run({
    auth: auth(), data: { congregationId, eventId },
  } as Parameters<typeof deleteEventByManager.run>[0]);

  beforeAll(async () => {
    await congregation.set({ isActive: true, status: 'active', billing: { enabled: false } });
    await Promise.all(actors.map((uid) => db.collection('users').doc(uid).set({
      displayName: uid.slice(congregationId.length + 1), isActive: uid !== inactive,
      role: uid === admin ? 'admin' : 'user', congregationId: uid === other ? 'other-congregation' : congregationId,
    })));
  });
  afterEach(async () => {
    const events = await db.collection('events').where('congregationId', '==', congregationId).get();
    await Promise.all(events.docs.map((doc) => remove(doc.id)));
  });
  afterAll(async () => {
    await Promise.all([db.recursiveDelete(congregation), ...actors.map((uid) => db.collection('users').doc(uid).delete())]);
  });

  it('deduplicates concurrent retries and releases the day when the event is deleted', async () => {
    const key = randomUUID();
    const [first, second] = await Promise.all([create(event(), key), create(event(), key)]);

    expect(first).toEqual(second);
    const stored = (await db.collection('events').doc(first.eventId).get()).data();
    expect(stored?.categories).toEqual(['asamblea', 'limpieza']);
    expect(stored?.schedules[0].people.map(({ name }: { name: string }) => name)).toEqual(['admin', 'member', 'assistant']);
    await expect(create()).rejects.toMatchObject({ code: 'failed-precondition' });
    await remove(first.eventId);
    expect((await congregation.collection('eventShiftDays').doc(day).get()).exists).toBe(false);
    await expect(create()).resolves.toHaveProperty('eventId');
  });

  it('makes competing requests for the same participants and time mutually exclusive', async () => {
    const results = await Promise.allSettled([create(), create()]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { code: 'failed-precondition' },
    });
  });

  it('rejects stale edits, nonexistent dates, incomplete shifts and unauthorized people', async () => {
    const { eventId } = await create();
    await update(eventId, 1, { ...event(), title: 'Nueva revisión' });
    await expect(update(eventId, 1)).rejects.toMatchObject({ code: 'aborted' });
    await expect(create({ ...event(), startDate: '2099-02-30' })).rejects.toMatchObject({
      code: 'invalid-argument', details: { publicationNotCommitted: true },
    });
    const incomplete = event();
    incomplete.schedules[0].teams[0].memberIds.pop();
    await expect(create(incomplete)).rejects.toMatchObject({ code: 'invalid-argument' });
    for (const person of [other, inactive]) {
      const outside = event();
      outside.schedules[0].teams[0].memberIds[1] = person;
      await expect(create(outside)).rejects.toMatchObject({ code: 'failed-precondition' });
    }
    await expect(create(event(), randomUUID(), member)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('accepts six participants for one shift while keeping the next at two', async () => {
    await Promise.all(extra.map((uid) => db.collection('users').doc(uid).set({
      displayName: uid, isActive: true, role: 'user', congregationId,
    })));
    try {
      const base = event();
      const [first, second] = base.schedules[0].teams;
      const makeRoster = (capacity: number, memberIds: string[]) => ({
        ...base, schedules: [{ ...base.schedules[0], teams: [{ capacity, memberIds }, second] }],
      });
      const fullTeam = [...first.memberIds, ...extra];
      await expect(create(makeRoster(7, [...fullTeam, assistant]))).rejects.toMatchObject({ code: 'invalid-argument' });
      await expect(create(makeRoster(6, first.memberIds))).rejects.toMatchObject({ code: 'invalid-argument' });
      const { eventId } = await create(makeRoster(6, fullTeam));
      const [schedule] = (await db.collection('events').doc(eventId).get()).get('schedules');
      expect(schedule.teams).toEqual([{ capacity: 6, memberIds: fullTeam }, second]);
    } finally {
      await Promise.all(extra.map((uid) => db.collection('users').doc(uid).delete()));
    }
  });

  it('requires distinct active leaders and rejects a duplicate group name', async () => {
    const id = randomUUID();
    const values = {
      id, congregationId, name: 'Grupo Álamo', superintendentId: admin, assistantId: assistant,
      memberIds: [member, member], isActive: true,
    };
    const save = (patch = {}, actor = admin) => saveServiceGroupByAdmin.run({
      auth: auth(actor), data: { ...values, ...patch },
    } as Parameters<typeof saveServiceGroupByAdmin.run>[0]);
    await expect(save({ assistantId: admin })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(save({ assistantId: inactive })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(save({}, member)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(save()).resolves.toEqual({ id });
    await expect(save({ id: randomUUID(), name: '  grupo alamo ' })).rejects.toMatchObject({ code: 'already-exists' });
    await expect(save({ isActive: false, expectedRevision: 1, memberIds: [other] }))
      .rejects.toMatchObject({ code: 'failed-precondition' });
    const stored = await congregation.collection('serviceGroups').doc(id).get();
    expect(stored.get('memberIds')).toEqual([admin, assistant, member].sort());

    const result = await createEventByManager.run({
      auth: auth(), data: {
        congregationId, requestId: randomUUID(), eventData: { ...event(), audience: { kind: 'service', groupId: id } },
      },
    } as Parameters<typeof createEventByManager.run>[0]);
    expect((await db.collection('events').doc(result.eventId).get()).get('audience.name')).toBe(values.name);
    const { people } = await listEventPlanningPeople.run({ auth: auth(), data: { congregationId } } as Parameters<typeof listEventPlanningPeople.run>[0]);
    expect(people.map(({ uid }) => uid).sort()).toEqual([admin, assistant, member].sort());
  });
});
