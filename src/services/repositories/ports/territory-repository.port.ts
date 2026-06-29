import type { Unsubscribe } from 'firebase/firestore';

import type {
  MonthlyTerritoryAssignment,
  MonthlyTerritoryAssignmentInput,
  PreachingGroup,
  PreachingGroupInput,
  Territory,
  TerritoryInput,
  VisibleMonthlyTerritories,
} from '@/src/types/territory';
import type { AppUser } from '@/src/types/user';

export type { Unsubscribe };

export interface TerritoryRepository {
  getTerritories(congregationId: string): Promise<Territory[]>;
  subscribeTerritories(
    congregationId: string,
    onChange: (territories: Territory[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe;
  createTerritory(payload: {
    congregationId: string;
    territoryId: string;
    actorUid: string;
    input: TerritoryInput;
  }): Promise<void>;
  updateTerritory(payload: {
    congregationId: string;
    territoryId: string;
    actorUid: string;
    input: TerritoryInput;
  }): Promise<void>;
  deactivateTerritory(payload: {
    congregationId: string;
    territoryId: string;
    actorUid: string;
  }): Promise<void>;
  getPreachingGroups(congregationId: string): Promise<PreachingGroup[]>;
  subscribePreachingGroups(
    congregationId: string,
    onChange: (groups: PreachingGroup[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe;
  createPreachingGroup(payload: {
    congregationId: string;
    groupId: string;
    actorUid: string;
    input: PreachingGroupInput;
  }): Promise<void>;
  updatePreachingGroup(payload: {
    congregationId: string;
    groupId: string;
    actorUid: string;
    input: PreachingGroupInput;
  }): Promise<void>;
  deactivatePreachingGroup(payload: {
    congregationId: string;
    groupId: string;
    actorUid: string;
  }): Promise<void>;
  getMonthlyAssignment(
    congregationId: string,
    monthId: string
  ): Promise<MonthlyTerritoryAssignment | null>;
  subscribeVisibleMonthlyTerritories(
    congregationId: string,
    userId: string,
    monthId: string,
    onChange: (data: VisibleMonthlyTerritories) => void,
    onError: (error: Error) => void
  ): Unsubscribe;
  upsertMonthlyAssignment(payload: {
    congregationId: string;
    monthId: string;
    actorUid: string;
    input: MonthlyTerritoryAssignmentInput;
  }): Promise<void>;
  deleteMonthlyAssignment(payload: {
    congregationId: string;
    monthId: string;
    actorUid: string;
  }): Promise<void>;
  getActiveCongregationUsersForGroups(congregationId: string): Promise<AppUser[]>;
}
