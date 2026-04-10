import { getDoc } from 'firebase/firestore';

import { congregationDocRef } from '@/src/lib/firebase/refs';
import { resolveCongregationEmailDomain } from '@/src/utils/congregations/domain';

export const getCongregationEmailDomain = async (congregationId: string): Promise<string> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return 'congregacion.com';
  }

  try {
    const snap = await getDoc(congregationDocRef(congregationId));
    const data = snap.exists() ? (snap.data() as Record<string, unknown>) : undefined;

    return resolveCongregationEmailDomain(congregationId, data);
  } catch {
    return resolveCongregationEmailDomain(congregationId);
  }
};
