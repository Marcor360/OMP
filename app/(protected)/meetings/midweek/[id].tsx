import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function MidweekEditRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  if (!id) {
    return <Redirect href={'/(protected)/meetings/manage' as never} />;
  }

  return <Redirect href={`/(protected)/meetings/edit/${id}` as never} />;
}
