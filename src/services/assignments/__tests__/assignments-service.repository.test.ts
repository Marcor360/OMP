import type {
  Assignment,
  AssignmentStatus,
  CreateAssignmentDTO,
} from '@/src/types/assignment';
import type {
  AssignmentRangeOptions,
  AssignmentRepository,
  Unsubscribe,
} from '@/src/services/repositories/ports/assignment-repository.port';
import type { AssignmentFilters } from '@/src/services/assignments/assignment.mapper';
import {
  __resetAssignmentRepositoryForTests,
  __setAssignmentRepositoryForTests,
  createAssignment,
  getAssignmentsByWeek,
  subscribeToAssignments,
  type SubscribeToAssignmentsOptions,
} from '@/src/services/assignments/assignments-service';

jest.mock('@/src/services/repositories/firestore/firestore-assignment-repository', () => ({
  firestoreAssignmentRepository: {
    getById: jest.fn(),
    getAll: jest.fn(),
    getByUser: jest.fn(),
    getByStatus: jest.fn(),
    getByRange: jest.fn(),
    getByMeeting: jest.fn(),
    create: jest.fn(),
    createCleaningGroup: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    subscribeToAssignments: jest.fn(),
  },
}));

const dueDate = { toMillis: () => 1 } as unknown as CreateAssignmentDTO['dueDate'];

const createPayload = (): CreateAssignmentDTO => ({
  title: 'Plataforma',
  description: 'Asignacion semanal',
  priority: 'medium',
  assignedToUid: 'user-1',
  assignedToName: 'Usuario Uno',
  dueDate,
});

class FakeAssignmentRepository implements AssignmentRepository {
  readonly createMock = jest.fn<
    Promise<string>,
    [string, string, CreateAssignmentDTO, string, string]
  >(() => Promise.resolve('assignment-1'));

  readonly getByRangeMock = jest.fn<
    Promise<Assignment[]>,
    [string, Date, Date, AssignmentRangeOptions | undefined]
  >(() => Promise.resolve([]));

  readonly subscribeMock = jest.fn<
    Unsubscribe,
    [
      string,
      (assignments: Assignment[]) => void,
      AssignmentFilters | undefined,
      ((error: unknown) => void) | undefined,
      SubscribeToAssignmentsOptions | undefined,
    ]
  >(() => () => undefined);

  getById(): Promise<Assignment | null> {
    return Promise.resolve(null);
  }

  getAll(): Promise<Assignment[]> {
    return Promise.resolve([]);
  }

  getByUser(): Promise<Assignment[]> {
    return Promise.resolve([]);
  }

  getByStatus(): Promise<Assignment[]> {
    return Promise.resolve([]);
  }

  getByRange(
    congregationId: string,
    startDate: Date,
    endDate: Date,
    options?: AssignmentRangeOptions
  ): Promise<Assignment[]> {
    return this.getByRangeMock(congregationId, startDate, endDate, options);
  }

  getByMeeting(): Promise<Assignment[]> {
    return Promise.resolve([]);
  }

  create(
    congregationId: string,
    meetingId: string,
    data: CreateAssignmentDTO,
    assignedByUid: string,
    assignedByName: string
  ): Promise<string> {
    return this.createMock(congregationId, meetingId, data, assignedByUid, assignedByName);
  }

  createCleaningGroup(): Promise<string> {
    return Promise.resolve('cleaning-assignment-1');
  }

  update(): Promise<void> {
    return Promise.resolve();
  }

  delete(): Promise<void> {
    return Promise.resolve();
  }

  count(_congregationId: string, _status?: AssignmentStatus): Promise<number> {
    return Promise.resolve(0);
  }

  subscribeToAssignments(
    congregationId: string,
    callback: (assignments: Assignment[]) => void,
    filters?: AssignmentFilters,
    onError?: (error: unknown) => void,
    options?: SubscribeToAssignmentsOptions
  ): Unsubscribe {
    return this.subscribeMock(congregationId, callback, filters, onError, options);
  }
}

describe('assignments-service repository seam', () => {
  let repo: FakeAssignmentRepository;

  beforeEach(() => {
    repo = new FakeAssignmentRepository();
    __setAssignmentRepositoryForTests(repo);
  });

  afterEach(() => {
    __resetAssignmentRepositoryForTests();
    jest.clearAllMocks();
  });

  it('createAssignment validates before touching the repository', async () => {
    await expect(
      createAssignment('c1', 'meeting-1', { ...createPayload(), title: ' ' }, 'admin', 'Admin')
    ).rejects.toThrow('El titulo de la asignacion es obligatorio.');

    expect(repo.createMock).not.toHaveBeenCalled();
  });

  it('createAssignment delegates to the repository with the payload intact', async () => {
    const payload = createPayload();

    await expect(
      createAssignment('c1', 'meeting-1', payload, 'admin', 'Admin')
    ).resolves.toBe('assignment-1');

    expect(repo.createMock).toHaveBeenCalledTimes(1);
    expect(repo.createMock).toHaveBeenCalledWith('c1', 'meeting-1', payload, 'admin', 'Admin');
  });

  it('getAssignmentsByWeek delegates to repository.getByRange', async () => {
    const startDate = new Date('2026-01-05T00:00:00.000Z');
    const endDate = new Date('2026-01-11T23:59:59.999Z');
    const options: AssignmentRangeOptions = {
      userUid: 'user-1',
      status: 'pending',
      forceServer: true,
      maxMeetings: 10,
      perMeetingLimit: 5,
    };

    await getAssignmentsByWeek('c1', startDate, endDate, options);

    expect(repo.getByRangeMock).toHaveBeenCalledTimes(1);
    expect(repo.getByRangeMock).toHaveBeenCalledWith('c1', startDate, endDate, options);
  });

  it('subscribeToAssignments guards empty congregation ids before delegating', () => {
    const callback = jest.fn<void, [Assignment[]]>();

    const unsubscribe = subscribeToAssignments('', callback);
    unsubscribe();

    expect(callback).toHaveBeenCalledWith([]);
    expect(repo.subscribeMock).not.toHaveBeenCalled();
  });

  it('subscribeToAssignments delegates valid subscriptions', () => {
    const callback = jest.fn<void, [Assignment[]]>();
    const onError = jest.fn<void, [unknown]>();
    const filters: AssignmentFilters = { userUid: 'user-1' };

    subscribeToAssignments('c1', callback, filters, onError);

    expect(repo.subscribeMock).toHaveBeenCalledTimes(1);
    expect(repo.subscribeMock).toHaveBeenCalledWith(
      'c1',
      callback,
      filters,
      onError,
      undefined
    );
  });

  it('subscribeToAssignments delegates custom subscription options', () => {
    const callback = jest.fn<void, [Assignment[]]>();
    const options: SubscribeToAssignmentsOptions = {
      windowMonthsBack: 6,
      maxMeetings: 25,
    };

    subscribeToAssignments('c1', callback, undefined, undefined, options);

    expect(repo.subscribeMock).toHaveBeenCalledWith(
      'c1',
      callback,
      undefined,
      undefined,
      options
    );
  });
});
