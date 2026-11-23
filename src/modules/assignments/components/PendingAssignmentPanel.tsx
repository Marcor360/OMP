import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Button, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { useI18n } from '@/src/i18n/index';
import { reconcileAssignmentIntents, retryAssignmentIntent } from '@/src/services/assignments/pending-assignment-service';
import {
  forgetAssignmentIntent,
  readPendingAssignments,
  type PendingAssignment,
} from '@/src/services/assignments/pending-assignment-store';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { confirmAlert } from '@/src/utils/ui/alerts';

export function PendingAssignmentPanel({ uid, congregationId, onSaved }: {
  uid: string;
  congregationId: string;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [pending, setPending] = useState<PendingAssignment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const active = useRef(false);
  const action = useRef(false);

  const load = useCallback(async () => {
    const records = await readPendingAssignments({ uid, congregationId });
    if (active.current) setPending(records);
  }, [uid, congregationId]);

  useFocusEffect(useCallback(() => {
    active.current = true;
    void (async () => {
      try {
        await load();
        try {
          await reconcileAssignmentIntents({ uid, congregationId });
        } finally {
          await load();
        }
      } catch (requestError) {
        if (active.current) setError(formatFirestoreError(requestError));
      }
    })();
    return () => { active.current = false; };
  }, [uid, congregationId, load]));

  const run = async (operation: () => Promise<void>) => {
    if (action.current) return;
    action.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await operation();
      await load();
    } catch (requestError) {
      if (active.current) setError(formatFirestoreError(requestError));
    } finally {
      action.current = false;
      if (active.current) setBusy(false);
    }
  };

  if (!pending.length) return null;
  const scope = { uid, congregationId };
  return (
    <View style={{ padding: 16, gap: 8 }}>
      <ThemedText type="defaultSemiBold">{t('assignments.pendingSaves.title')}</ThemedText>
      {error ? <ThemedText accessibilityRole="alert">{error}</ThemedText> : null}
      {pending.map(({ intent, confirmed }) => (
        <View key={intent.requestId} style={{ gap: 6, paddingVertical: 6 }}>
          <ThemedText>{String(intent.assignmentData.title ?? '')}</ThemedText>
          <ThemedText>{t(confirmed ? 'assignments.pendingSaves.confirmed' : 'assignments.pendingSaves.pending')}</ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {!confirmed ? <Button title={t('assignments.pendingSaves.retry')} disabled={busy} onPress={() => {
              void run(async () => {
                await retryAssignmentIntent(scope, intent);
                if (active.current) onSaved();
              });
            }} /> : null}
            <Button title={t(confirmed ? 'assignments.pendingSaves.dismiss' : 'assignments.pendingSaves.forget')} disabled={busy} onPress={() => {
              void run(async () => {
                if (confirmed || await confirmAlert({
                  title: t('assignments.pendingSaves.forget'),
                  message: t('assignments.pendingSaves.forgetMessage'),
                  confirmLabel: t('assignments.pendingSaves.forget'),
                  cancelLabel: t('common.cancel'),
                })) {
                  await forgetAssignmentIntent(scope, intent.requestId);
                }
              });
            }} />
          </View>
        </View>
      ))}
    </View>
  );
}
