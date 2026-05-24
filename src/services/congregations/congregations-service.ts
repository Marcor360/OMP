import { doc, getDocFromServer } from 'firebase/firestore';
import {
  congregationDocRef,
  congregationPrivatePlanDocRef,
} from '@/src/lib/firebase/refs';
import { db } from '@/src/lib/firebase/app';
import { getDocumentCacheFirst } from '@/src/services/repositories/firestore-cache-first';
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

const CONGREGATION_DOMAIN_CACHE_TTL_MS = 10 * 60 * 1000;
const CONGREGATION_NAME_CACHE_TTL_MS = 5 * 60 * 1000;
const CONGREGATION_PLAN_CACHE_TTL_MS = 60 * 1000;
const MAX_ACCESS_BLOCK_MS = 5 * 60 * 60 * 1000;

const toTrimmedText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const normalizePlanId = (value: unknown): CongregationPlanId => {
  if (value === 'intermediate' || value === 'complete') return value;
  return 'basic';
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
    const domain = await getDocumentCacheFirst<string>({
      cacheKey: `congregations/${congregationId}/email-domain`,
      ref: congregationDocRef(congregationId),
      maxAgeMs: CONGREGATION_DOMAIN_CACHE_TTL_MS,
      forceServer: options?.forceServer,
      mapSnapshot: (snapshot) =>
        resolveCongregationEmailDomain(
          congregationId,
          snapshot.data() as Record<string, unknown>
        ),
      isIncomplete: (value) => value.trim().length === 0,
    });

    return domain ?? resolveCongregationEmailDomain(congregationId);
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
    const displayName = await getDocumentCacheFirst<string>({
      cacheKey: `congregations/${congregationId}/display-name`,
      ref: congregationDocRef(congregationId),
      maxAgeMs: CONGREGATION_NAME_CACHE_TTL_MS,
      forceServer: options?.forceServer,
      mapSnapshot: (snapshot) =>
        resolveCongregationDisplayName(
          congregationId,
          snapshot.data() as Record<string, unknown>
        ),
      isIncomplete: (value) => value.trim().length === 0,
    });

    return displayName ?? resolveCongregationDisplayName(congregationId);
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
    const congregationSnap = await getDocFromServer(congregationDocRef(congregationId));
    congregationData = congregationSnap.exists()
      ? (congregationSnap.data() as Record<string, unknown>)
      : {};
    congregationName = resolveCongregationDisplayName(congregationId, congregationData);
  } catch {
    congregationName = fallbackName;
  }

  const firebaseName =
    normalizeAccessText(congregationData.slug) ??
    normalizeAccessText(congregationData.firebaseName) ??
    congregationId;

  const systemDocRefs = [
    doc(db, 'system', 'maintenance'),
    doc(db, 'system', 'congregationAccess'),
    doc(db, 'system', 'platform'),
  ];

  for (const systemDocRef of systemDocRefs) {
    try {
      const systemSnap = await getDocFromServer(systemDocRef);
      if (!systemSnap.exists()) continue;

      const systemData = systemSnap.data() as Record<string, unknown>;
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

  const planData = await getDocumentCacheFirst<Record<string, unknown>>({
    cacheKey: `congregations/${congregationId}/private/plan`,
    ref: congregationPrivatePlanDocRef(congregationId),
    maxAgeMs: CONGREGATION_PLAN_CACHE_TTL_MS,
    forceServer: options?.forceServer,
    mapSnapshot: (snapshot) => snapshot.data() as Record<string, unknown>,
  });

  const activeUsers = await getActiveUsers(congregationId);

  const planId = normalizePlanId(planData?.planId);
  const activeUsersLimit =
    typeof planData?.activeUsersLimit === 'number' && Number.isFinite(planData.activeUsersLimit)
      ? Math.max(0, Math.floor(planData.activeUsersLimit))
      : CONGREGATION_PLAN_LIMITS[planId];
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
