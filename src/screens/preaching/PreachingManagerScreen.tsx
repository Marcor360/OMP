import React from 'react';

import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { PreachingManagerPanel } from '@/src/components/preaching/PreachingManagerPanel';
import { useUser } from '@/src/context/user-context';
import { useI18n } from '@/src/i18n';
import { isPreachingManager } from '@/src/types/user';

export function PreachingManagerScreen() {
  const { appUser, congregationId, loadingProfile } = useUser();
  const { t } = useI18n();

  if (loadingProfile) return <LoadingState message={t('fieldService.managerPanel.loadingReports')} />;

  if (!appUser || !appUser.isActive || !isPreachingManager(appUser)) {
    return <ErrorState message={t('fieldService.managerPanel.noPermissions')} />;
  }

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader title={t('fieldService.managerPanel.title')} showBack />
      <PreachingManagerPanel congregationId={congregationId} enabled />
    </ScreenContainer>
  );
}
