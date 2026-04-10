import { collection, doc } from 'firebase/firestore';

import { db } from '@/src/lib/firebase/app';

export const usersCollectionRef = () => collection(db, 'users');
export const userDocRef = (uid: string) => doc(db, 'users', uid);

export const congregationsCollectionRef = () => collection(db, 'congregations');
export const congregationDocRef = (congregationId: string) => doc(db, 'congregations', congregationId);

export const congregationPersonsCollectionRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'persons');

export const congregationMeetingsCollectionRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'meetings');

export const meetingDocRef = (congregationId: string, meetingId: string) =>
  doc(db, 'congregations', congregationId, 'meetings', meetingId);

export const meetingAssignmentsCollectionRef = (congregationId: string, meetingId: string) =>
  collection(db, 'congregations', congregationId, 'meetings', meetingId, 'assignments');

export const assignmentDocRef = (
  congregationId: string,
  meetingId: string,
  assignmentId: string
) => doc(db, 'congregations', congregationId, 'meetings', meetingId, 'assignments', assignmentId);

export const congregationNotificationsCollectionRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'notifications');

export const congregationChangeLogsCollectionRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'changeLogs');