import { FieldValue, type DocumentData, type DocumentSnapshot, type UpdateData } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

import { normalizeMeetingSectionsFromDoc } from './meeting-sections.js';

const meetingChanged = () => new HttpsError(
  'aborted',
  'La reunión cambió. Vuelve a abrirla antes de guardar o publicar.'
);

export const assertMeetingVersion = (snapshot: DocumentSnapshot, expected: unknown): void => {
  if (expected === undefined) return;
  const revision = expected as { seconds?: unknown; nanoseconds?: unknown } | null;
  if (
    !revision || typeof revision.seconds !== 'number' || !Number.isInteger(revision.seconds) ||
    typeof revision.nanoseconds !== 'number' || !Number.isInteger(revision.nanoseconds) ||
    revision.nanoseconds < 0 || revision.nanoseconds >= 1e9
  ) {
    throw new HttpsError('invalid-argument', 'La versión de la reunión no es válida.');
  }

  const current = snapshot.get('updatedAt');
  // Older meetings can lack updatedAt. Their first save still checks updateTime at commit.
  if (current?.seconds !== undefined && (
    current.seconds !== revision.seconds || current.nanoseconds !== revision.nanoseconds
  )) {
    throw meetingChanged();
  }
};

export const updateMeetingFromSnapshot = async (
  snapshot: DocumentSnapshot,
  changes: UpdateData<DocumentData>
): Promise<void> => {
  const before = snapshot.data() ?? {};
  const after = { ...before, ...changes };
  const sections = (data: DocumentData) => new Map(
    normalizeMeetingSectionsFromDoc(data).map((section) => [section.sectionKey, section])
  );
  const content = (section: unknown) => JSON.stringify(section, (key, value: unknown) =>
    key === 'publishNotificationSentAt' || key === 'reminderSentAt' ? undefined : value
  );
  const previous = sections(before);
  const next = sections(after);
  const changedSections = Array.from(new Set([...previous.keys(), ...next.keys()])).flatMap((key) => {
    const oldSection = previous.get(key);
    const newSection = next.get(key);
    if (content(oldSection) === content(newSection)) return [];
    return [{
      key,
      title: (newSection?.title ?? oldSection?.title ?? key).slice(0, 160),
      change: oldSection && newSection ? 'updated' : newSection ? 'added' : 'removed',
    }];
  });
  const publicationChanged = before.publicationStatus !== after.publicationStatus;
  const detailsChanged = ['title', 'description', 'location', 'meetingDate', 'startDate', 'endDate', 'notes']
    .some((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  try {
    const batch = snapshot.ref.firestore.batch();
    batch.update(snapshot.ref, changes, { lastUpdateTime: snapshot.updateTime });
    if (changedSections.length || publicationChanged || detailsChanged) {
      batch.create(snapshot.ref.collection('changeLogs').doc(), {
        changedSections: changedSections.slice(0, 50),
        sectionsTruncated: changedSections.length > 50,
        publicationChanged,
        detailsChanged,
        changedBy: typeof changes.updatedBy === 'string' ? changes.updatedBy : null,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    // Firestore gRPC FAILED_PRECONDITION / NOT_FOUND after a concurrent write or deletion.
    if (code === 9 || code === 5) throw meetingChanged();
    throw error;
  }
};
