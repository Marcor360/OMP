/**
 * Pruebas unitarias — Limpieza en cascada de subcolecciones de reuniones
 *
 * Firestore no borra subcolecciones al eliminar un documento. Este trigger
 * llama recursiveDelete() sobre las subcolecciones para que sus asignaciones
 * (y cualquier otra subcoleccion) no queden huerfanas.
 */

jest.mock('firebase-functions/v2', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(),
}));

import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

import { cleanupMeetingSubcollectionsOnDelete } from '../meetings-cleanup.js';

const mockGetFirestore = getFirestore as jest.Mock;

type FakeRef = { delete: jest.Mock };
type FakeCollection = { doc: jest.Mock };

type CleanupEvent = Parameters<typeof cleanupMeetingSubcollectionsOnDelete.run>[0];

const buildEvent = (congregationId: string, meetingId: string): CleanupEvent =>
  ({ params: { congregationId, meetingId } }) as unknown as CleanupEvent;

function buildMockDb() {
  const child = { id: 'assignments' };
  const meetingRef = {
    delete: jest.fn(),
    get: jest.fn().mockResolvedValue({ exists: false }),
    listCollections: jest.fn().mockResolvedValue([child]),
  };
  const meetingsCollection: FakeCollection = { doc: jest.fn(() => meetingRef) };
  const congregationRef: FakeRef & { collection: jest.Mock } = {
    delete: jest.fn(),
    collection: jest.fn(() => meetingsCollection),
  };
  const congregationsCollection: FakeCollection = { doc: jest.fn(() => congregationRef) };
  const db = {
    collection: jest.fn(() => congregationsCollection),
    recursiveDelete: jest.fn().mockResolvedValue(undefined),
  };

  return { db, congregationsCollection, congregationRef, meetingsCollection, meetingRef, child };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('cleanupMeetingSubcollectionsOnDelete', () => {
  it('limpia solo las subcolecciones de la reunion identificada por event.params', async () => {
    const { db, congregationsCollection, congregationRef, meetingsCollection, child } = buildMockDb();
    mockGetFirestore.mockReturnValue(db);

    await cleanupMeetingSubcollectionsOnDelete.run(buildEvent('cong-1', 'meeting-1'));

    expect(db.collection).toHaveBeenCalledWith('congregations');
    expect(congregationsCollection.doc).toHaveBeenCalledWith('cong-1');
    expect(congregationRef.collection).toHaveBeenCalledWith('meetings');
    expect(meetingsCollection.doc).toHaveBeenCalledWith('meeting-1');
    expect(db.recursiveDelete).toHaveBeenCalledTimes(1);
    expect(db.recursiveDelete).toHaveBeenCalledWith(child);
  });

  it('conserva una reunion recreada antes de recibir el evento', async () => {
    const { db, meetingRef } = buildMockDb();
    meetingRef.get.mockResolvedValue({ exists: true });
    mockGetFirestore.mockReturnValue(db);
    await cleanupMeetingSubcollectionsOnDelete.run(buildEvent('cong-1', 'meeting-1'));
    expect(db.recursiveDelete).not.toHaveBeenCalled();
  });

  it('relanza el error si recursiveDelete rechaza, para permitir reintento', async () => {
    const { db } = buildMockDb();
    const failure = new Error('recursiveDelete boom');
    db.recursiveDelete.mockRejectedValue(failure);
    mockGetFirestore.mockReturnValue(db);

    await expect(
      cleanupMeetingSubcollectionsOnDelete.run(buildEvent('cong-1', 'meeting-1'))
    ).rejects.toBe(failure);

    expect(logger.error).toHaveBeenCalledWith(
      'cleanupMeetingSubcollectionsOnDelete fallo',
      expect.objectContaining({ congregationId: 'cong-1', meetingId: 'meeting-1', error: failure })
    );
  });

  it('no llama delete() sobre ningun otro documento', async () => {
    const { db, congregationRef, meetingRef } = buildMockDb();
    mockGetFirestore.mockReturnValue(db);

    await cleanupMeetingSubcollectionsOnDelete.run(buildEvent('cong-1', 'meeting-1'));

    expect(congregationRef.delete).not.toHaveBeenCalled();
    expect(meetingRef.delete).not.toHaveBeenCalled();
  });
});
