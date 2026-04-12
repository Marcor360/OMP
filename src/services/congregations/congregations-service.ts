import { congregationDocRef } from '@/src/lib/firebase/refs';
import { getDocumentCacheFirst } from '@/src/services/repositories/firestore-cache-first';
import { resolveCongregationEmailDomain } from '@/src/utils/congregations/domain';

const CONGREGATION_DOMAIN_CACHE_TTL_MS = 10 * 60 * 1000;

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
