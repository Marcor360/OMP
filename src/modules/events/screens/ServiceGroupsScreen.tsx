import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { randomUUID } from 'expo-crypto';

import { EVENT_LIMITS } from '@/functions/src/shared/event-planning';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { useI18n } from '@/src/i18n';
import {
  EventButton, EventField, EventSection, EventText, PeoplePicker, eventFieldStyles, useEventPeople,
} from '@/src/modules/events/components/EventPlanningFields';
import { listServiceGroups, saveServiceGroup, type ServiceGroup, type ServiceGroupValues } from '@/src/services/events/event-planning-service';
import { formatFirestoreError } from '@/src/utils/errors/errors';

const NEW_GROUP: ServiceGroupValues = { name: '', superintendentId: '', assistantId: '', memberIds: [], isActive: true };
type GroupEditor = { id: string; revision?: number; values: ServiceGroupValues };
type Selection = 'superintendentId' | 'assistantId' | 'memberIds';

export function ServiceGroupsScreen() {
  const { uid, appUser, congregationId, loadingProfile } = useUser();
  const { t } = useI18n();
  if (loadingProfile) return <LoadingState message={t('events.loading')} />;
  if (!uid || !congregationId || appUser?.role !== 'admin' || !appUser.isActive) {
    return <ErrorState message={t('events.noPermission')} />;
  }
  return <ServiceGroupsManager key={JSON.stringify([uid, congregationId])} congregationId={congregationId} />;
}

function ServiceGroupsManager({ congregationId }: { congregationId: string }) {
  const { t } = useI18n();
  const [groups, setGroups] = useState<ServiceGroup[]>([]);
  const [editor, setEditor] = useState<GroupEditor>();
  const [selection, setSelection] = useState<Selection>();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const directory = useEventPeople(congregationId);
  const names = new Map(directory.people.map((person) => [person.uid, person.name]));

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try { setGroups(await listServiceGroups(congregationId)); } catch (error) {
      setMessage(formatFirestoreError(error));
    } finally { setLoading(false); }
  }, [congregationId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const edit = (group?: ServiceGroup) => {
    setMessage('');
    if (group) {
      const { id, revision, name, superintendentId, assistantId, memberIds, isActive } = group;
      setEditor({ id, revision, values: { name, superintendentId, assistantId, memberIds, isActive } });
      void directory.load();
    } else {
      setEditor({ id: randomUUID(), values: NEW_GROUP });
    }
  };

  const change = (patch: Partial<ServiceGroupValues>) => {
    if (busy.current) return;
    setEditor((current) => current ? { ...current, values: { ...current.values, ...patch } } : current);
  };

  const save = async () => {
    if (!editor || busy.current) return;
    const { id, revision, values } = editor;
    if (!values.name.trim() || !values.superintendentId || !values.assistantId || values.superintendentId === values.assistantId) {
      setMessage(t('events.groupValidation'));
      return;
    }
    busy.current = true;
    setSaving(true);
    setMessage('');
    try {
      await saveServiceGroup({ ...values, id, congregationId, ...(revision !== undefined ? { expectedRevision: revision } : {}) });
      setEditor(undefined);
      await refresh();
    } catch (error) {
      setMessage(formatFirestoreError(error));
    } finally { busy.current = false; setSaving(false); }
  };

  const values = editor?.values;
  const pick = (field: Selection) => {
    setSelection(field);
    void directory.load();
  };
  const label = (id: string) => names.get(id) ?? t(id ? 'events.member' : 'events.choosePeople');
  const selected = !values || !selection ? [] : selection === 'memberIds' ? values.memberIds
    : values[selection] ? [values[selection]] : [];

  return (
    <ScreenContainer padded={false} scrollable={false}>
      <PageHeader title={t('events.serviceGroups')} showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {values ? <EventSection>
          <EventText label={t('events.groupName')} value={values.name} onChangeText={(name) => change({ name })} maxLength={100} />
          <EventField label={t('events.groupSuperintendent')}>
            <EventButton label={label(values.superintendentId)} onPress={() => pick('superintendentId')} disabled={saving} />
          </EventField>
          <EventField label={t('events.groupAssistant')}>
            <EventButton label={label(values.assistantId)} onPress={() => pick('assistantId')} disabled={saving} />
          </EventField>
          <EventField label={t('events.groupMembers')}>
            <EventButton label={`${t('events.choosePeople')} · ${values.memberIds.length}`} onPress={() => pick('memberIds')} disabled={saving} />
          </EventField>
          <View style={eventFieldStyles.row}>
            <EventButton label={t('events.groupActive')} selected={values.isActive} onPress={() => change({ isActive: true })} disabled={saving} />
            <EventButton label={t('events.groupInactive')} selected={!values.isActive} onPress={() => change({ isActive: false })} disabled={saving} />
          </View>
          <View style={eventFieldStyles.row}>
            <EventButton label={t('events.cancel')} onPress={() => { setEditor(undefined); setMessage(''); }} disabled={saving} />
            <EventButton label={t(saving ? 'events.saving' : 'events.groupSave')} onPress={save} disabled={saving} primary />
          </View>
        </EventSection> : <>
          <EventButton label={t('events.groupNew')} onPress={() => edit()} primary />
          {loading ? <ThemedText>{t('events.loading')}</ThemedText>
            : !groups.length && !message ? <ThemedText>{t('events.noActiveGroupSetup')}</ThemedText>
              : groups.map((group) => <EventButton key={group.id}
                label={`${group.name} · ${t(group.isActive ? 'events.groupActive' : 'events.groupInactive')}`}
                onPress={() => edit(group)} />)}
          {!!message && <EventButton label={t('events.retryGroups')} onPress={refresh} />}
        </>}
        {!!message && <ThemedText accessibilityRole="alert">{message}</ThemedText>}
      </ScrollView>
      {values && selection && <PeoplePicker
        title={t(selection === 'memberIds' ? 'events.groupMembers' : selection === 'superintendentId' ? 'events.groupSuperintendent' : 'events.groupAssistant')}
        value={selected} max={selection === 'memberIds' ? EVENT_LIMITS.people : 1} source={directory}
        onClose={() => setSelection(undefined)}
        onChange={(ids) => change(selection === 'memberIds' ? { memberIds: ids } : { [selection]: ids[0] ?? '' })} />}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16, gap: 12, paddingBottom: 32 },
});
