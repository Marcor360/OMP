import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { ThemedView } from '@/src/components/themed-view';
import { useOptionalI18n } from '@/src/i18n';

export default function ModalScreen() {
  const i18n = useOptionalI18n();
  const t = i18n ? i18n.t : (key: string) => key;
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{t('system.modal.title')}</ThemedText>
      <Link href="/" dismissTo style={styles.link}>
        <ThemedText type="link">{t('system.modal.goHome')}</ThemedText>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});

