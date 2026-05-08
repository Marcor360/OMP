import React from 'react';

import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { PreachingManagerPanel } from '@/src/components/preaching/PreachingManagerPanel';
import { useUser } from '@/src/context/user-context';
import { isPreachingManager } from '@/src/types/user';

export function PreachingManagerScreen() {
  const { appUser, congregationId, loadingProfile } = useUser();

  if (loadingProfile) return <LoadingState message="Cargando panel..." />;

  if (!appUser || !appUser.isActive || !isPreachingManager(appUser)) {
    return <ErrorState message="No tienes permisos para ver el panel de predicacion." />;
  }

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader title="Panel de predicacion" showBack />
      <PreachingManagerPanel congregationId={congregationId} enabled />
    </ScreenContainer>
  );
}
