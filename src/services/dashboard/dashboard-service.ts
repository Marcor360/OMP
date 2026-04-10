import { Assignment } from '@/src/types/assignment';
import { getAllAssignments, getAssignmentsByUser } from '@/src/services/assignments/assignments-service';
import { getAllMeetings } from '@/src/services/meetings/meetings-service';
import { getAllUsers } from '@/src/services/users/users-service';

const countOverduePending = (assignments: Assignment[]): number => {
  const now = Date.now();

  return assignments.filter((assignment) => {
    if (assignment.status !== 'pending' || !assignment.dueDate) return false;
    return assignment.dueDate.toDate().getTime() < now;
  }).length;
};

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

/** Carga metricas globales de la congregacion */
export const getDashboardMetrics = async (
  congregationId: string
): Promise<DashboardMetrics> => {
  const [users, meetings, assignments] = await Promise.all([
    getAllUsers(congregationId),
    getAllMeetings(congregationId),
    getAllAssignments(congregationId),
  ]);

  const pendingAssignments = assignments.filter((item) => item.status === 'pending');
  const completedAssignments = assignments.filter((item) => item.status === 'completed');

  return {
    totalUsers: users.length,
    activeUsers: users.filter((user) => user.isActive).length,
    totalMeetings: meetings.length,
    scheduledMeetings: meetings.filter((meeting) => meeting.status === 'scheduled').length,
    totalAssignments: assignments.length,
    pendingAssignments: pendingAssignments.length,
    completedAssignments: completedAssignments.length,
    overdueAssignments: countOverduePending(assignments),
  };
};

/** Metricas para usuario regular dentro de su congregacion */
export const getDashboardMetricsForUser = async (
  congregationId: string,
  uid: string
): Promise<Partial<DashboardMetrics>> => {
  const assignments = await getAssignmentsByUser(congregationId, uid);
  const pendingAssignments = assignments.filter((item) => item.status === 'pending');
  const completedAssignments = assignments.filter((item) => item.status === 'completed');

  return {
    totalAssignments: assignments.length,
    pendingAssignments: pendingAssignments.length,
    completedAssignments: completedAssignments.length,
    overdueAssignments: countOverduePending(assignments),
  };
};
