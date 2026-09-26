import { useEffect, useMemo, useState } from 'react';

import {
  getCongregationEmailDomain,
  getCongregationPlanUsage,
} from '@/src/services/congregations/congregations-service';
import { getAllUsers } from '@/src/services/users/users-service';
import type { AppUser } from '@/src/types/user';
import type { UserFormController } from '@/src/screens/users/user-form/user-form.types';

export function useUserFormDirectoryData(congregationId: string | null, isAdmin: boolean) {
  const [activeUsersState, setActiveUsersState] = useState({
    congregationId: null as string | null,
    users: [] as AppUser[],
  });
  const [emailDomainState, setEmailDomainState] = useState({
    congregationId: null as string | null,
    domain: 'congregacion.com',
  });
  const [planUsageState, setPlanUsageState] = useState<{
    congregationId: string | null;
    usage: UserFormController['state']['planUsage'];
  }>({ congregationId: null, usage: null });

  useEffect(() => {
    if (!congregationId) return;
    let active = true;
    void getCongregationEmailDomain(congregationId)
      .then((domain) => { if (active) setEmailDomainState({ congregationId, domain }); })
      .catch(() => { if (active) setEmailDomainState({ congregationId, domain: 'congregacion.com' }); });
    return () => { active = false; };
  }, [congregationId]);

  useEffect(() => {
    if (!congregationId || !isAdmin) return;
    let active = true;
    void getCongregationPlanUsage(congregationId, { forceServer: true })
      .then((usage) => { if (active) setPlanUsageState({ congregationId, usage }); })
      .catch(() => { if (active) setPlanUsageState({ congregationId, usage: null }); });
    return () => { active = false; };
  }, [congregationId, isAdmin]);

  useEffect(() => {
    if (!congregationId) return;
    let active = true;
    void getAllUsers(congregationId)
      .then((users) => {
        if (active) setActiveUsersState({ congregationId, users: users.filter((user) => user.isActive) });
      })
      .catch(() => { if (active) setActiveUsersState({ congregationId, users: [] }); });
    return () => { active = false; };
  }, [congregationId]);

  const activeUsers = useMemo(
    () => activeUsersState.congregationId === congregationId ? activeUsersState.users : [],
    [activeUsersState, congregationId]
  );

  return {
    activeUsers,
    allowedEmailDomain: emailDomainState.congregationId === congregationId
      ? emailDomainState.domain
      : 'congregacion.com',
    planUsage: isAdmin && planUsageState.congregationId === congregationId ? planUsageState.usage : null,
  };
}
