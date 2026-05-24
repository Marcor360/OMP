import { Redirect } from 'expo-router';

export default function LegacyTerritoriesRoute() {
  return <Redirect href="/(protected)/territories/index" />;
}
