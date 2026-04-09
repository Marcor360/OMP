import { Redirect } from 'expo-router';

/** El dashboard ahora vive en (tabs)/index. Esta ruta redirige. */
export default function DashboardRedirect() {
  return <Redirect href={'/(protected)/(tabs)/' as any} />;
}
