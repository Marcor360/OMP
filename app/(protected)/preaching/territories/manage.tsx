import { Redirect } from 'expo-router';

export default function LegacyTerritoriesManageRoute() {
  return <Redirect href="/(protected)/territories/manage" />;
}
