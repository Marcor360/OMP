import React from 'react';
import { Stack } from 'expo-router';

import { CleaningCacheProvider } from '@/src/modules/cleaning/context/CleaningCacheContext';

export default function CleaningLayout() {
  return (
    <CleaningCacheProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </CleaningCacheProvider>
  );
}
