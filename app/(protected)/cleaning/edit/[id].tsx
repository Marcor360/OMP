import { useLocalSearchParams } from 'expo-router';
import { EditCleaningGroupScreen } from '@/src/modules/cleaning';

export default function CleaningEditPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditCleaningGroupScreen groupId={id ?? ''} />;
}
