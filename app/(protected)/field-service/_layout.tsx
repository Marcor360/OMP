/**
 * Layout de field-service.
 * Patrón idéntico a cleaning: Provider + Stack sin header.
 */
import React from 'react';
import { Stack } from 'expo-router';
import { FieldServiceProvider } from '@/src/modules/field-service/context/FieldServiceContext';

export default function FieldServiceLayout() {
  return (
    <FieldServiceProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </FieldServiceProvider>
  );
}
