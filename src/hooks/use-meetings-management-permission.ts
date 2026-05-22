import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';

import { useUser } from '@/src/context/user-context';
import { canManageMeetings, canViewCongregationModule } from '@/src/utils/permissions/permissions';

interface MeetingsManagementPermission {
  canManage: boolean;
  congregationId: string;
  uid: string;
  loading: boolean;
}

export function useMeetingsManagementPermission(requireManage = true): MeetingsManagementPermission {
  const { appUser, congregationId, uid, loadingProfile } = useUser();
  const router = useRouter();
  const redirectedRef = useRef(false);

  const canManage = canManageMeetings(appUser);
  const canOpen = requireManage ? canManage : canViewCongregationModule(appUser);

  useEffect(() => {
    if (loadingProfile) return;

    if (!canOpen && !redirectedRef.current) {
      redirectedRef.current = true;
      router.replace('/(protected)/unauthorized');
    }
  }, [canOpen, loadingProfile, router]);

  return {
    canManage,
    congregationId: congregationId ?? '',
    uid: uid ?? '',
    loading: loadingProfile,
  };
}
