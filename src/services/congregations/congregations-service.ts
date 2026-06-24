import { firestoreCongregationRepository } from '@/src/services/repositories/firestore/firestore-congregation-repository';
import type { CongregationRepository } from '@/src/services/repositories/ports/congregation-repository.port';
import {
  CONGREGATION_PLAN_LABELS,
  CONGREGATION_PLAN_LIMITS,
  CongregationPlanId,
  CongregationPlanUsage,
} from '@/src/types/congregation-plan';
import {
  CONGREGATION_DEACTIVATION_REASON_LABELS,
  CongregationAccessState,
  CongregationDeactivationReason,
} from '@/src/types/congregation-access';
import { getActiveUsers } from '@/src/services/users/users-service';
import { resolveCongregationEmailDomain } from '@/src/utils/congregations/domain';

const MAX_ACCESS_BLOCK_MS = 5 * 60 * 60 * 1000;
const DEFAULT_PLAN_ID: CongregationPlanId = 'omp_80';

let congregationRepository: CongregationRepository = firestoreCongregationRepository;

export const __setCongregationRepositoryForTests = (repo: CongregationRepository): void => {
  congregationRepository = repo;
};

export const __resetCongregationRepositoryForTests = (): void => {
  congregationRepository = firestoreCongregationRepository;
};

const toTrimmedText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const isPlanId = (value: unknown): value is CongregationPlanId =>
  value === 'omp_80' || value === 'omp_150' || value === 'omp_250';

const normalizePlanId = (value: unknown): CongregationPlanId => {
  if (isPlanId(value)) return value;
  if (value === 'complete') return 'omp_250';
  if (value === 'intermediate') return 'omp_150';
  if (value === 'basic') return 'omp_80';
  return DEFAULT_PLAN_ID;
};

const normalizePlanLimit = (value: unknown, fallbackPlanId: CongregationPlanId): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return CONGREGATION_PLAN_LIMITS[fallbackPlanId];
  }

  const normalized = Math.max(0, Math.floor(value));
  if (normalized === 70) return CONGREGATION_PLAN_LIMITS.omp_80;
  if (normalized === 80) return CONGREGATION_PLAN_LIMITS.omp_80;
  if (normalized === 120) return CONGREGATION_PLAN_LIMITS.omp_150;
  if (normalized === 150) return CONGREGATION_PLAN_LIMITS.omp_150;
  if (normalized === 200) return CONGREGATION_PLAN_LIMITS.omp_250;
  if (normalized === 250) return CONGREGATION_PLAN_LIMITS.omp_250;
  return normalized;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const resolvePlanData = (
  congregationData: Record<string, unknown> | null | undefined,
  privatePlanData: Record<string, unknown> | null | undefined
): { planId: CongregationPlanId; activeUsersLimit: number } => {
  const billing = asRecord(congregationData?.billing);
  const planId = normalizePlanId(
    billing?.planKey ??
      congregationData?.planKey ??
      privatePlanData?.planKey ??
      privatePlanData?.planId
  );
  const activeUsersLimit = normalizePlanLimit(
    billing?.activeUsersLimit ??
      billing?.userLimit ??
      congregationData?.activeUsersLimit ??
      congregationData?.userLimit ??
      privatePlanData?.activeUsersLimit ??
      privatePlanData?.userLimit,
    planId
  );

  return { planId, activeUsersLimit };
};

const normalizeAccessText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeAccessToken = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_');
};

const normalizeDeactivationReason = (value: unknown): CongregationDeactivationReason => {
  const reason = normalizeAccessToken(value);

  if (
    reason === 'payment_overdue' ||
    reason === 'falta_pago' ||
    reason === 'falta_de_pago' ||
    reason === 'falta_de_pago_de_servicios' ||
    reason === 'servicios_vencidos'
  ) {
    return 'payment_overdue';
  }

  if (
    reason === 'policy_violation' ||
    reason === 'violacion_politicas' ||
    reason === 'violacion_de_politicas'
  ) {
    return 'policy_violation';
  }

  if (
    reason === 'temporary_deactivation' ||
    reason === 'desactivacion_temporal' ||
    reason === 'temporal'
  ) {
    return 'temporary_deactivation';
  }

  if (
    reason === 'system_maintenance' ||
    reason === 'mantenimiento' ||
    reason === 'mantenimiento_sistema' ||
    reason === 'mantenimiento_de_sistema'
  ) {
    return 'system_maintenance';
  }

  return 'unknown';
};

const getReasonFromData = (data: Record<string, unknown>): CongregationDeactivationReason =>
  normalizeDeactivationReason(
    data.deactivationReason ??
      data.disabledReason ??
      data.inactiveReason ??
      data.suspensionReason ??
      data.statusReason ??
      data.reason
  );

const isCongregationBlockedByData = (data: Record<string, unknown>): boolean => {
  if (data.disabled === true || data.deactivated === true || data.accessDisabled === true) {
    return true;
  }

  if (data.isActive === false || data.active === false || data.enabled === false) {
    return true;
  }

  const status = normalizeAccessToken(data.status ?? data.accessStatus);
  return (
    status === 'inactive' ||
    status === 'inactivo' ||
    status === 'disabled' ||
    status === 'desactivada' ||
    status === 'suspended' ||
    status === 'suspendida' ||
    status === 'maintenance' ||
    status === 'mantenimiento'
  );
};

const isSystemMaintenanceEnabled = (data: Record<string, unknown>): boolean =>
  data.maintenanceMode === true ||
  data.systemMaintenance === true ||
  data.disableCongregations === true ||
  data.allCongregationsDisabled === true ||
  data.congregationsDisabled === true ||
  data.isActive === false ||
  data.enabled === false;

const toAccessDate = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybeTimestamp = value as { toDate?: unknown };
    if (typeof maybeTimestamp.toDate === 'function') {
      const date = maybeTimestamp.toDate() as Date;
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

const getBlockStartDate = (data: Record<string, unknown>): Date | null =>
  toAccessDate(
    data.deactivatedAt ??
      data.disabledAt ??
      data.blockedAt ??
      data.maintenanceStartedAt ??
      data.startedAt ??
      data.updatedAt ??
      data.createdAt
  );

const getExplicitBlockEndDate = (data: Record<string, unknown>): Date | null =>
  toAccessDate(
    data.blockedUntil ??
      data.disabledUntil ??
      data.deactivatedUntil ??
      data.maintenanceUntil ??
      data.maintenanceEndsAt ??
      data.unlockAt ??
      data.reactivateAt ??
      data.reactivationAt ??
      data.expiresAt ??
      data.endsAt
  );

const getEffectiveBlockEndDate = (data: Record<string, unknown>): Date | null => {
  const explicitEnd = getExplicitBlockEndDate(data);
  const startedAt = getBlockStartDate(data);
  const maxEnd = startedAt ? new Date(startedAt.getTime() + MAX_ACCESS_BLOCK_MS) : null;

  if (explicitEnd && maxEnd) {
    return explicitEnd.getTime() <= maxEnd.getTime() ? explicitEnd : maxEnd;
  }

  return explicitEnd ?? maxEnd;
};

const isBlockedTimeExpired = (data: Record<string, unknown>): boolean => {
  const effectiveEnd = getEffectiveBlockEndDate(data);
  return Boolean(effectiveEnd && effectiveEnd.getTime() <= Date.now());
};

const buildAccessState = (params: {
  isBlocked: boolean;
  reason: CongregationDeactivationReason;
  congregationId: string;
  congregationName: string;
  firebaseName: string;
  blockedUntil?: Date | null;
  source: CongregationAccessState['source'];
}): CongregationAccessState => {
  const reasonLabel = CONGREGATION_DEACTIVATION_REASON_LABELS[params.reason];
  const message = params.isBlocked
    ? `La congregacion ${params.congregationName} (${params.firebaseName}) esta desactivada. Motivo: ${reasonLabel}.`
    : '';

  return {
    isBlocked: params.isBlocked,
    reason: params.reason,
    reasonLabel,
    message,
    congregationId: params.congregationId,
    congregationName: params.congregationName,
    firebaseName: params.firebaseName,
    blockedUntil: params.blockedUntil?.toISOString(),
    source: params.source,
  };
};

const resolveCongregationDisplayName = (
  congregationId: string,
  congregationData?: Record<string, unknown>
): string => {
  return (
    toTrimmedText(congregationData?.displayName) ??
    toTrimmedText(congregationData?.name) ??
    toTrimmedText(congregationData?.slug) ??
    congregationId
  );
};

export const getCongregationEmailDomain = async (
  congregationId: string,
  options?: { forceServer?: boolean }
): Promise<string> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return 'congregacion.com';
  }

  try {
    const data = await congregationRepository.getEmailDomainData(congregationId, options);
    return resolveCongregationEmailDomain(congregationId, data ?? undefined);
  } catch {
    return resolveCongregationEmailDomain(congregationId);
  }
};

export const getCongregationDisplayName = async (
  congregationId: string,
  options?: { forceServer?: boolean }
): Promise<string> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return 'Sin congregacion';
  }

  try {
    const data = await congregationRepository.getDisplayNameData(congregationId, options);
    return resolveCongregationDisplayName(congregationId, data ?? undefined);
  } catch {
    return resolveCongregationDisplayName(congregationId);
  }
};

export const getCongregationAccessState = async (
  congregationId: string
): Promise<CongregationAccessState> => {
  const fallbackName = congregationId || 'Sin congregacion';

  if (!congregationId || typeof congregationId !== 'string') {
    return buildAccessState({
      isBlocked: true,
      reason: 'unknown',
      congregationId: '',
      congregationName: fallbackName,
      firebaseName: fallbackName,
      source: 'none',
    });
  }

  let congregationData: Record<string, unknown> = {};
  let congregationName = fallbackName;

  try {
    congregationData = await congregationRepository.getAccessData(congregationId) ?? {};
    congregationName = resolveCongregationDisplayName(congregationId, congregationData);
  } catch {
    congregationName = fallbackName;
  }

  const firebaseName =
    normalizeAccessText(congregationData.slug) ??
    normalizeAccessText(congregationData.firebaseName) ??
    congregationId;

  const systemDocIds = ['maintenance', 'congregationAccess', 'platform'];

  for (const systemDocId of systemDocIds) {
    try {
      const systemData = await congregationRepository.getSystemData(systemDocId);
      if (!systemData) continue;

      if (!isSystemMaintenanceEnabled(systemData)) continue;
      if (isBlockedTimeExpired(systemData)) continue;

      return buildAccessState({
        isBlocked: true,
        reason: normalizeDeactivationReason(
          systemData.reason ?? systemData.deactivationReason ?? 'system_maintenance'
        ),
        congregationId,
        congregationName,
        firebaseName,
        blockedUntil: getEffectiveBlockEndDate(systemData),
        source: 'system',
      });
    } catch {
      continue;
    }
  }

  const isBlocked = isCongregationBlockedByData(congregationData) &&
    !isBlockedTimeExpired(congregationData);

  return buildAccessState({
    isBlocked,
    reason: isBlocked ? getReasonFromData(congregationData) : 'unknown',
    congregationId,
    congregationName,
    firebaseName,
    blockedUntil: isBlocked ? getEffectiveBlockEndDate(congregationData) : null,
    source: isBlocked ? 'congregation' : 'none',
  });
};

export const getCongregationPlanUsage = async (
  congregationId: string,
  options?: { forceServer?: boolean }
): Promise<CongregationPlanUsage | null> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return null;
  }

  const congregationData = await congregationRepository.getBillingPlanData(
    congregationId,
    options
  );

  let privatePlanData: Record<string, unknown> | null = null;
  try {
    privatePlanData = await congregationRepository.getPrivatePlanData(congregationId, options);
  } catch {
    privatePlanData = null;
  }

  const activeUsers = await getActiveUsers(congregationId);

  const { planId, activeUsersLimit } = resolvePlanData(congregationData, privatePlanData);
  const activeUsersCount = activeUsers.length;

  return {
    congregationId,
    planId,
    planLabel: CONGREGATION_PLAN_LABELS[planId],
    activeUsersLimit,
    activeUsersCount,
    remainingActiveUsers: Math.max(0, activeUsersLimit - activeUsersCount),
  };
};
