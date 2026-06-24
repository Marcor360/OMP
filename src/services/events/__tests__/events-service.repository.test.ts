import type { EventRepository } from '@/src/services/repositories/ports/event-repository.port';
import {
  __resetEventRepositoryForTests,
  __setEventRepositoryForTests,
  eventToFormValues,
  getActiveEvents,
  createEvent,
  validateEventForm,
} from '@/src/services/events/events-service';
import type { CongregationEvent, CongregationEventFormValues } from '@/src/types/event';

jest.mock('@/src/services/repositories/firestore/firestore-event-repository', () => ({
  firestoreEventRepository: {
    listByCongregation: async () => [],
    getById: async () => null,
    create: async () => 'evt-id',
    update: async () => undefined,
    delete: async () => undefined,
  },
}));

const makeTimestamp = (ms: number) => ({
  toMillis: () => ms,
  toDate: () => new Date(ms),
});

const makeEvent = (overrides: Partial<CongregationEvent> = {}): CongregationEvent => ({
  id: 'evt-1',
  congregationId: 'cong-1',
  type: 'conmemoracion',
  title: 'Test Event',
  superintendentName: '',
  superintendentWifeName: '',
  startDate: makeTimestamp(Date.now() + 1000) as never,
  endDate: makeTimestamp(Date.now() + 1000) as never,
  deleteAt: makeTimestamp(Date.now() + 86400000) as never,
  location: '',
  color: '#000',
  createdBy: 'uid-1',
  createdAt: makeTimestamp(Date.now()) as never,
  updatedAt: makeTimestamp(Date.now()) as never,
  ...overrides,
});

class FakeEventRepository implements EventRepository {
  public listCalls: string[] = [];
  public createPayload: { congregationId: string; eventData: CongregationEventFormValues } | null = null;
  public events: CongregationEvent[] = [];
  public createdId = 'new-evt-id';

  async listByCongregation(congregationId: string): Promise<CongregationEvent[]> {
    this.listCalls.push(congregationId);
    return this.events;
  }

  async getById(): Promise<CongregationEvent | null> {
    return null;
  }

  async create(payload: { congregationId: string; eventData: CongregationEventFormValues }): Promise<string> {
    this.createPayload = payload;
    return this.createdId;
  }

  async update(): Promise<void> {
    return undefined;
  }

  async delete(): Promise<void> {
    return undefined;
  }
}

describe('events-service repository port', () => {
  let repo: FakeEventRepository;

  beforeEach(() => {
    repo = new FakeEventRepository();
    __setEventRepositoryForTests(repo);
  });

  afterEach(() => {
    __resetEventRepositoryForTests();
  });

  it('getActiveEvents delegates to listByCongregation', async () => {
    repo.events = [makeEvent()];

    const result = await getActiveEvents('cong-1');

    expect(repo.listCalls).toEqual(['cong-1']);
    expect(result).toHaveLength(1);
  });

  it('getActiveEvents filters out events where deleteAt is in the past', async () => {
    repo.events = [
      makeEvent({ id: 'future', deleteAt: makeTimestamp(Date.now() + 99999999) as never }),
      makeEvent({ id: 'past', deleteAt: makeTimestamp(Date.now() - 1) as never }),
    ];

    const result = await getActiveEvents('cong-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('future');
  });

  it('createEvent delegates to repo.create with correct payload', async () => {
    const values: CongregationEventFormValues = {
      type: 'asamblea_circuito',
      title: 'Asamblea',
      superintendentName: '',
      superintendentWifeName: '',
      startDate: '2026-07-01',
      endDate: '2026-07-01',
      location: '',
    };

    const id = await createEvent({
      values,
      congregationId: 'cong-1',
      uid: 'uid-1',
    });

    expect(id).toBe('new-evt-id');
    expect(repo.createPayload).toMatchObject({
      congregationId: 'cong-1',
      eventData: values,
    });
  });

  it('createEvent throws when validation fails', async () => {
    const values: CongregationEventFormValues = {
      type: 'asamblea_circuito',
      title: '',
      superintendentName: '',
      superintendentWifeName: '',
      startDate: '',
      endDate: '',
      location: '',
    };

    await expect(createEvent({ values, congregationId: 'cong-1', uid: 'uid-1' })).rejects.toThrow();
  });

  it('eventToFormValues returns defaults for null event', () => {
    const result = eventToFormValues(null);

    expect(result.type).toBe('conmemoracion');
    expect(result.title).toBe('');
    expect(result.startDate).toBe('');
  });

  it('validateEventForm returns errors for missing title on non-superintendent event', () => {
    const errors = validateEventForm({
      type: 'asamblea_circuito',
      title: '',
      superintendentName: '',
      superintendentWifeName: '',
      startDate: '2026-07-01',
      endDate: '2026-07-01',
      location: '',
    });

    expect(errors).toContain('El titulo del evento es requerido.');
  });

  it('validateEventForm returns no errors for valid event', () => {
    const errors = validateEventForm({
      type: 'asamblea_circuito',
      title: 'Asamblea',
      superintendentName: '',
      superintendentWifeName: '',
      startDate: '2026-07-01',
      endDate: '2026-07-03',
      location: '',
    });

    expect(errors).toHaveLength(0);
  });
});
