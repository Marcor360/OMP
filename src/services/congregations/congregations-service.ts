import { congregationDocRef } from '@/src/lib/firebase/refs';
import { getDocumentCacheFirst } from '@/src/services/repositories/firestore-cache-first';
import { resolveCongregationEmailDomain } from '@/src/utils/congregations/domain';

const CONGREGATION_DOMAIN_CACHE_TTL_MS = 10 * 60 * 1000;
const CONGREGATION_NAME_CACHE_TTL_MS = 5 * 60 * 1000;

const toTrimmedText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
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
