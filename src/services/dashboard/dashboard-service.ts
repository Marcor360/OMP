import { getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '@/src/config/firebase/firebase';

export interface DashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  totalMeetings: number;
  scheduledMeetings: number;
  totalAssignments: number;
  pendingAssignments: number;
  completedAssignments: number;
  overdueAssignments: number;
}

/** Carga todas las métricas del dashboard en paralelo */
export const getDashboardMetrics = async (): Promise<DashboardMetrics> => {
  const usersCol = collection(db, 'users');
  const meetingsCol = collection(db, 'meetings');
  const assignmentsCol = collection(db, 'assignments');

  const [
    totalUsersSnap,
    activeUsersSnap,
    totalMeetingsSnap,
    scheduledMeetingsSnap,
    totalAssignmentsSnap,
    pendingAssignmentsSnap,
    completedAssignmentsSnap,
  ] = await Promise.all([
    getDocs(usersCol),
    getDocs(query(usersCol, where('status', '==', 'active'))),
    getDocs(meetingsCol),
    getDocs(query(meetingsCol, where('status', '==', 'scheduled'))),
    getDocs(assignmentsCol),
    getDocs(query(assignmentsCol, where('status', '==', 'pending'))),
    getDocs(query(assignmentsCol, where('status', '==', 'completed'))),
  ]);

  // Calcular vencidas: pending con dueDate < ahora
  const now = new Date();
  const overdueAssignments = pendingAssignmentsSnap.docs.filter((d) => {
    const data = d.data();
    if (!data.dueDate) return false;
    return data.dueDate.toDate() < now;
  }).length;

  return {
    totalUsers: totalUsersSnap.size,
    activeUsers: activeUsersSnap.size,
    totalMeetings: totalMeetingsSnap.size,
    scheduledMeetings: scheduledMeetingsSnap.size,
    totalAssignments: totalAssignmentsSnap.size,
    pendingAssignments: pendingAssignmentsSnap.size,
    completedAssignments: completedAssignmentsSnap.size,
    overdueAssignments,
  };
};

/** Métricas reducidas para roles sin acceso a usuarios */
export const getDashboardMetricsForUser = async (
  uid: string
): Promise<Partial<DashboardMetrics>> => {
  const assignmentsCol = collection(db, 'assignments');

  const [totalSnap, pendingSnap, completedSnap] = await Promise.all([
    getDocs(query(assignmentsCol, where('assignedToUid', '==', uid))),
    getDocs(query(assignmentsCol, where('assignedToUid', '==', uid), where('status', '==', 'pending'))),
    getDocs(query(assignmentsCol, where('assignedToUid', '==', uid), where('status', '==', 'completed'))),
  ]);

  const now = new Date();
  const overdueAssignments = pendingSnap.docs.filter((d) => {
    const data = d.data();
    return data.dueDate && data.dueDate.toDate() < now;
  }).length;

  return {
    totalAssignments: totalSnap.size,
    pendingAssignments: pendingSnap.size,
    completedAssignments: completedSnap.size,
    overdueAssignments,
  };
};
