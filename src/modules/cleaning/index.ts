// ─── Tipos ───────────────────────────────────────────────────────────────────
export type {
  CleaningGroup,
  CreateCleaningGroupDTO,
  UpdateCleaningGroupDTO,
  CleaningMemberStatus,
  CleaningAssignableUser,
  CleaningStats,
  CleaningServiceErrorCode,
} from './types/cleaning-group.types';
export type {
  MyCleaningDay,
  MyCleaningDashboardSummary,
} from './services/my-cleaning-dashboard-service';
export { CleaningServiceError, CLEANING_MEMBER_STATUS_LABELS } from './types/cleaning-group.types';

// ─── Servicios ────────────────────────────────────────────────────────────────
export {
  createCleaningGroup,
  getCleaningGroups,
  getCleaningGroupById,
  updateCleaningGroup,
  addUsersToCleaningGroup,
  removeUserFromCleaningGroup,
  deleteCleaningGroup,
  deactivateCleaningGroup,
  getCleaningAssignableUsers,
} from './services/cleaning-service';

// ─── Hooks ───────────────────────────────────────────────────────────────────
export { useCleaningPermission } from './hooks/use-cleaning-permission';
export { useCleaningGroups } from './hooks/use-cleaning-groups';
export { useCleaningGroupDetail } from './hooks/use-cleaning-group-detail';
export { useCleaningAssignableUsers } from './hooks/use-cleaning-assignable-users';
export { useMyCleaningDashboard } from './hooks/use-my-cleaning-dashboard';

// ─── Componentes ─────────────────────────────────────────────────────────────
export { CleaningGroupCard } from './components/CleaningGroupCard';
export { CleaningGroupForm } from './components/CleaningGroupForm';
export { MyCleaningDashboardCard } from './components/MyCleaningDashboardCard';
export { CleaningMemberItem } from './components/CleaningMemberItem';
export { CleaningStatsCard } from './components/CleaningStatsCard';
export { CleaningUserSelectItem } from './components/CleaningUserSelectItem';

// ─── Pantallas ────────────────────────────────────────────────────────────────
export { CleaningDashboardScreen } from './screens/CleaningDashboardScreen';
export { CreateCleaningGroupScreen } from './screens/CreateCleaningGroupScreen';
export { CleaningGroupDetailScreen } from './screens/CleaningGroupDetailScreen';
export { EditCleaningGroupScreen } from './screens/EditCleaningGroupScreen';
export { AddMembersToCleaningGroupModal } from './screens/AddMembersToCleaningGroupModal';
