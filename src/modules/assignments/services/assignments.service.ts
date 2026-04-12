import {
  QueryConstraint,
  Timestamp,
  collection,
  doc,
  getDoc,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';

import { db } from '@/src/lib/firebase/app';
import {
  assignmentDocRef,
  congregationMeetingsCollectionRef,
  meetingAssignmentsCollectionRef,
} from '@/src/lib/firebase/refs';
import {
  Assignment,
  AssignmentFilters,
} from '@/src/modules/assignments/types/assignment.types';
import {
  mapAssignmentFromCongregationDoc,
  mapAssignmentFromMeetingDoc,
} from '@/src/modules/assignments/utils/assignment-mapper';
import { getQueryCacheFirst } from '@/src/services/repositories/firestore-cache-first';

const ASSIGNMENTS_CACHE_TTL_MS = 60 * 1000;
const MAX_MEETINGS_TO_SCAN = 80;
const MAX_ASSIGNMENTS_PER_MEETING = 60;
const MAX_STANDALONE_ASSIGNMENTS = 300;

type DateBounds = {
  startDate?: Date;
  endDate?: Date;
};

interface AssignmentQueryOptions {
  congregationId: string;
  bounds?: DateBounds;
  forceServer?: boolean;
}

interface AssignmentDetailParams {
  congregationId: string;
  assignmentId: string;
  meetingId?: string;
  source?: 'meeting' | 'congregation';
}

interface MeetingLite {
  id: string;
  type: unknown;
  startDate: unknown;
}

const toDate = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
};

const boundsFromFilters = (filters?: AssignmentFilters): DateBounds | undefined => {
  if (!filters) return undefined;

  const exact = filters.exactDate.trim();
  if (exact.length > 0) {
    const start = new Date(`${exact}T00:00:00.000`);
    const end = new Date(`${exact}T23:59:59.999`);

    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      return { startDate: start, endDate: end };
    }
  }

  const start = filters.rangeStart.trim().length > 0
    ? new Date(`${filters.rangeStart.trim()}T00:00:00.000`)
    : undefined;
  const end = filters.rangeEnd.trim().length > 0
    ? new Date(`${filters.rangeEnd.trim()}T23:59:59.999`)
    : undefined;

  if (start && Number.isNaN(start.getTime())) return undefined;
  if (end && Number.isNaN(end.getTime())) return undefined;

  if (!start && !end) return undefined;

  return {
    startDate: start,
    endDate: end,
  };
};

const getMeetings = async (
  congregationId: string,
  bounds: DateBounds | undefined,
  forceServer: boolean | undefined
): Promise<MeetingLite[]> => {
  const dynamicConstraints: QueryConstraint[] = [
    orderBy('startDate', 'desc'),
    limit(MAX_MEETINGS_TO_SCAN),
  ];

  if (bounds?.startDate) {
    dynamicConstraints.unshift(where('startDate', '>=', Timestamp.fromDate(bounds.startDate)));
  }

  if (bounds?.endDate) {
    dynamicConstraints.unshift(where('startDate', '<=', Timestamp.fromDate(bounds.endDate)));
  }

  const rangeKey = `${bounds?.startDate?.toISOString() ?? 'none'}::${bounds?.endDate?.toISOString() ?? 'none'}`;

  return getQueryCacheFirst<MeetingLite[]>({
    cacheKey: `assignments-panel/${congregationId}/meetings/${rangeKey}`,
    query: query(congregationMeetingsCollectionRef(congregationId), ...dynamicConstraints),
    maxAgeMs: ASSIGNMENTS_CACHE_TTL_MS,
    forceServer,
    mapSnapshot: (snapshot) =>
      snapshot.docs.map((meetingDoc) => {
        const data = meetingDoc.data();

        return {
          id: meetingDoc.id,
          type: data.type,
          startDate: data.startDate,
        } satisfies MeetingLite;
      }),
  });
};

const listMeetingAssignments = async (
  congregationId: string,
  meetings: MeetingLite[],
  forceServer: boolean | undefined
): Promise<Assignment[]> => {
  const assignmentGroups = await Promise.all(
    meetings.map(async (meeting) => {
      const docs = await getQueryCacheFirst<Assignment[]>({
        cacheKey: `assignments-panel/${congregationId}/meeting/${meeting.id}/limit/${MAX_ASSIGNMENTS_PER_MEETING}`,
        query: query(
          meetingAssignmentsCollectionRef(congregationId, meeting.id),
          limit(MAX_ASSIGNMENTS_PER_MEETING)
        ),
        maxAgeMs: ASSIGNMENTS_CACHE_TTL_MS,
        forceServer,
        mapSnapshot: (snapshot) =>
          snapshot.docs.map((assignmentDoc) =>
            mapAssignmentFromMeetingDoc(
              assignmentDoc.id,
              assignmentDoc.data(),
              {
                id: meeting.id,
                congregationId,
                type: meeting.type,
                startDate: meeting.startDate,
              }
            )
          ),
      });

      return docs;
    })
  );

  return assignmentGroups.flat();
};

const listStandaloneAssignments = async (
  congregationId: string,
  forceServer: boolean | undefined
): Promise<Assignment[]> => {
  const standaloneCollection = collection(db, 'congregations', congregationId, 'assignments');

  try {
    return await getQueryCacheFirst<Assignment[]>({
      cacheKey: `assignments-panel/${congregationId}/standalone/limit/${MAX_STANDALONE_ASSIGNMENTS}`,
      query: query(standaloneCollection, limit(MAX_STANDALONE_ASSIGNMENTS)),
      maxAgeMs: ASSIGNMENTS_CACHE_TTL_MS,
      forceServer,
      mapSnapshot: (snapshot) =>
        snapshot.docs.map((assignmentDoc) =>
          mapAssignmentFromCongregationDoc(
            assignmentDoc.id,
            assignmentDoc.data(),
            congregationId
          )
        ),
    });
  } catch {
    // If this collection is not used in the current project, return empty list.
    return [];
  }
};

const dedupeAssignments = (assignments: Assignment[]): Assignment[] => {
  const bySource = new Map<string, Assignment>();

  assignments.forEach((assignment) => {
    bySource.set(assignment.sourceKey, assignment);
  });

  return Array.from(bySource.values());
};

export const getAssignments = async (
  options: AssignmentQueryOptions & { filters?: AssignmentFilters }
): Promise<Assignment[]> => {
  const congregationId = options.congregationId.trim();
  if (!congregationId) return [];

  const bounds = options.bounds ?? boundsFromFilters(options.filters);

  const meetings = await getMeetings(congregationId, bounds, options.forceServer);

  const [meetingAssignments, standaloneAssignments] = await Promise.all([
    listMeetingAssignments(congregationId, meetings, options.forceServer),
    listStandaloneAssignments(congregationId, options.forceServer),
  ]);

  return dedupeAssignments([...meetingAssignments, ...standaloneAssignments]);
};

const matchBounds = (assignment: Assignment, bounds: DateBounds | undefined): boolean => {
  if (!bounds) return true;

  const date = toDate(assignment.date);
  if (!date) return false;

  if (bounds.startDate && date < bounds.startDate) {
    return false;
  }

  if (bounds.endDate && date > bounds.endDate) {
    return false;
  }

  return true;
};

export const getAssignmentById = async (
  params: AssignmentDetailParams
): Promise<Assignment | null> => {
  const congregationId = params.congregationId.trim();
  const assignmentId = params.assignmentId.trim();

  if (!congregationId || !assignmentId) return null;

  if (params.source === 'congregation' || (!params.source && !params.meetingId)) {
    const standaloneRef = doc(db, 'congregations', congregationId, 'assignments', assignmentId);
    const standaloneSnap = await getDoc(standaloneRef);

    if (standaloneSnap.exists()) {
      return mapAssignmentFromCongregationDoc(
        standaloneSnap.id,
        standaloneSnap.data(),
        congregationId
      );
    }
  }

  if (params.meetingId) {
    const meetingSnap = await getDoc(
      assignmentDocRef(congregationId, params.meetingId, assignmentId)
    );

    if (meetingSnap.exists()) {
      const meetingRef = doc(db, 'congregations', congregationId, 'meetings', params.meetingId);
      const meetingMeta = await getDoc(meetingRef);
      const meetingData = meetingMeta.exists() ? meetingMeta.data() : {};

      return mapAssignmentFromMeetingDoc(
        meetingSnap.id,
        meetingSnap.data(),
        {
          id: params.meetingId,
          congregationId,
          type: meetingData.type,
          startDate: meetingData.startDate,
        }
      );
    }
  }

  const all = await getAssignments({
    congregationId,
    forceServer: false,
  });

  const matched = all.find((item) => {
    if (item.id !== assignmentId) return false;
    if (params.meetingId && item.meetingId !== params.meetingId) return false;
    if (params.source && item.source !== params.source) return false;
    return true;
  });

  return matched ?? null;
};

export const getAssignmentsByCategory = async (
  options: AssignmentQueryOptions & {
    category: Assignment['category'];
    filters?: AssignmentFilters;
  }
): Promise<Assignment[]> => {
  const all = await getAssignments(options);

  const filtered = all.filter(
    (assignment) => assignment.category === options.category && matchBounds(assignment, options.bounds)
  );

  return filtered;
};
