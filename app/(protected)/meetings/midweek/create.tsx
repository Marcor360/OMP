import React from 'react';
import { Redirect } from 'expo-router';

export default function MidweekCreateRedirect() {
  return <Redirect href={'/(protected)/meetings/create?type=midweek' as never} />;
}
