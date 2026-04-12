import { Redirect } from 'expo-router';

export default function AssignmentEditRedirect() {
  return <Redirect href='/(protected)/(tabs)/assignments' />;
}
