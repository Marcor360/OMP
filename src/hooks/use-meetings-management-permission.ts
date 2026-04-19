import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';

import { useUser } from '@/src/context/user-context';
import { canManageMeetings } from '@/src/utils/permissions/permissions';

interface MeetingsManagementPermission {
  canManage: boolean;
  congregationId: string;
  uid: string;
  loading: boolean;
}

export function useMeetingsManagementPermission(): MeetingsManagementPermission {
  const { role, congregationId, uid, loadingProfile } = useUser();
  const router = useRouter();
  const redirectedRef = useRef(false);

  const canManage = canManageMeetings(role);

  useEffect(() => {
    if (loadingProfile) return;

    if (!canManage && !redirectedRef.current) {
      redirectedRef.current = true;
      router.replace('/(protected)/unauthorized');
    }
  }, [canManage, loadingProfile, router]);

  return {
    canManage,
    congregationId: congregationId ?? '',
    uid: uid ?? '',
    loading: loadingProfile,
  };
}