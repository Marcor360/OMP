import { useWindowDimensions } from 'react-native';

import type { OrganizationLayoutMode } from '@/src/modules/organization/types/organization.types';

export const useResponsiveOrganizationLayout = (): {
  width: number;
  mode: OrganizationLayoutMode;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
} => {
  const { width } = useWindowDimensions();
  const mode: OrganizationLayoutMode = width >= 900 ? 'desktop' : width >= 768 ? 'tablet' : 'mobile';

  return {
    width,
    mode,
    isMobile: mode === 'mobile',
    isTablet: mode === 'tablet',
    isDesktop: mode === 'desktop',
  };
};
