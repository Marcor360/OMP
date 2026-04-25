import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';

import { useUser } from '@/src/context/user-context';
import { canManageCleaning } from '@/src/utils/permissions/permissions';

interface CleaningPermission {
  canManage: boolean;
  congregationId: string;
  uid: string;
}

/**
 * Hook que verifica si el usuario autenticado puede gestionar grupos de limpieza.
 * Redirige a /unauthorized si no tiene acceso.
 * Solo retorna valores cuando el permiso está confirmado.
 */
export function useCleaningPermission(): CleaningPermission & { loading: boolean } {
  const { role, servicePosition, serviceDepartment, congregationId, uid, loadingProfile } = useUser();
  const router = useRouter();
  const redirectedRef = useRef(false);

  const canManage = canManageCleaning(role, servicePosition, serviceDepartment);

  useEffect(() => {
    if (loadingProfile) return;
    if (!canManage && !redirectedRef.current) {
      redirectedRef.current = true;
      router.replace('/(protected)/unauthorized');
    }
  }, [canManage, loadingProfile, router]);

  return {
    loading: loadingProfile,
    canManage,
    congregationId: congregationId ?? '',
    uid: uid ?? '',
  };
}
