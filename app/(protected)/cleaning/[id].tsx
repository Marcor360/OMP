import { useLocalSearchParams } from 'expo-router';
import { CleaningGroupDetailScreen } from '@/src/modules/cleaning';

export default function CleaningDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CleaningGroupDetailScreen groupId={id ?? ''} />;
}
