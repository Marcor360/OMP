import { getDocs, query, where } from 'firebase/firestore';
import {
  congregationDocRef,
  congregationPrivatePlanDocRef,
  usersCollectionRef,
} from '@/src/lib/firebase/refs';
import { getDocumentCacheFirst } from '@/src/services/repositories/firestore-cache-first';
import {
  CONGREGATION_PLAN_LABELS,
  CONGREGATION_PLAN_LIMITS,
  CongregationPlanId,
  CongregationPlanUsage,
} from '@/src/types/congregation-plan';
import { resolveCongregationEmailDomain } from '@/src/utils/congregations/domain';

const CONGREGATION_DOMAIN_CACHE_TTL_MS = 10 * 60 * 1000;
const CONGREGATION_NAME_CACHE_TTL_MS = 5 * 60 * 1000;
const CONGREGATION_PLAN_CACHE_TTL_MS = 60 * 1000;

const toTrimmedText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const normalizePlanId = (value: unknown): CongregationPlanId => {
  if (value === 'intermediate' || value === 'complete') return value;
  return 'basic';
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

  const usersSnap = await getDocs(
    query(
      usersCollectionRef(),
      where('congregationId', '==', congregationId),
      where('isActive', '==', true)
    )
  );

  const planId = normalizePlanId(planData?.planId);
  const activeUsersLimit =
    typeof planData?.activeUsersLimit === 'number' && Number.isFinite(planData.activeUsersLimit)
      ? Math.max(0, Math.floor(planData.activeUsersLimit))
      : CONGREGATION_PLAN_LIMITS[planId];
  const activeUsersCount = usersSnap.size;

  return {
    congregationId,
    planId,
    planLabel: CONGREGATION_PLAN_LABELS[planId],
    activeUsersLimit,
    activeUsersCount,
    remainingActiveUsers: Math.max(0, activeUsersLimit - activeUsersCount),
  };
};
