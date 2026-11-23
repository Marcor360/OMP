import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';

import {
  DEFAULT_EVENT_TEAM_SIZE, EVENT_AUDIENCES, EVENT_CATEGORIES, EVENT_LIMITS, eventDay, validateEventSchedules,
  type EventAudience, type EventPerson,
} from '@/functions/src/shared/event-planning';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { useI18n } from '@/src/i18n';
import { getCleaningGroups } from '@/src/modules/cleaning/services/cleaning-service';
import {
  EventButton, EventDate, EventSection, EventText, ScheduleEditor, eventFieldStyles, useEventPeople,
} from '@/src/modules/events/components/EventPlanningFields';
import { clearEventDraft, eventDraftKey, loadEventDraft, saveEventDraft, type EventDraft } from '@/src/services/events/event-drafts';
import { listServiceGroups } from '@/src/services/events/event-planning-service';
import { createEvent, eventToFormValues, getEventById, normalizeEventEndDate, updateEvent } from '@/src/services/events/events-service';
import { EVENT_TYPE_LABELS, SINGLE_DAY_EVENT_TYPES, type CongregationEventFormValues } from '@/src/types/event';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { canManageEvents } from '@/src/utils/permissions/permissions';
import { confirmAlert, showAlert } from '@/src/utils/ui/alerts';

const TYPES = Object.keys(EVENT_TYPE_LABELS) as CongregationEventFormValues['type'][];
const CONFIRMED_ERRORS = new Set(['invalid-argument', 'failed-precondition', 'permission-denied', 'unauthenticated']);

export function EventFormScreen({ mode = 'create' }: { mode?: 'create' | 'edit' }) {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { uid, congregationId, appUser, loadingProfile } = useUser();
  const { t } = useI18n();

  if (loadingProfile) return <LoadingState message={t('events.loading')} />;
  if (!uid || !congregationId || !appUser?.isActive || !canManageEvents(appUser)) {
    return <ErrorState message={t('events.noPermission')} />;
  }
  if (mode === 'edit' && !id) return <ErrorState message={t('eventDetail.notFound')} />;
  const eventId = mode === 'edit' ? id ?? null : null;
  const draftKey = eventDraftKey(uid, congregationId, eventId);
  return <EventEditor key={draftKey} uid={uid} congregationId={congregationId} eventId={eventId}
    draftKey={draftKey} admin={appUser.role === 'admin'} />;
}

function EventEditor({ uid, congregationId, eventId, draftKey, admin }: {
  uid: string; congregationId: string; eventId: string | null; draftKey: string; admin: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [loaded, setLoaded] = useState<{ draft: EventDraft; restored: boolean; people: EventPerson[]; conflict: boolean }>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    const load = async () => {
      const [stored, event] = await Promise.all([
        loadEventDraft(draftKey),
        eventId ? getEventById(eventId) : Promise.resolve(null),
      ]);
      if (!current) return;
      if (eventId && (!event || event.congregationId !== congregationId)) {
        setError(t('eventDetail.notFound'));
        return;
      }
      const initial = {
        values: event ? eventToFormValues(event) : { ...eventToFormValues(), type: 'personalizado' as const },
        requestId: randomUUID(),
        revision: event ? event.revision ?? 0 : undefined,
      };
      setLoaded({
        draft: stored ?? initial,
        restored: Boolean(stored),
        people: [...new Map(event?.schedules?.flatMap((schedule) => schedule.people.map((person) => [person.uid, person] as const)) ?? []).values()],
        conflict: Boolean(event && stored && stored.revision !== initial.revision),
      });
    };
    void load().catch((cause) => { if (current) setError(formatFirestoreError(cause)); });
    return () => { current = false; };
  }, [attempt, congregationId, draftKey, eventId, t]);

  const retry = () => { setError(''); setLoaded(undefined); setAttempt((value) => value + 1); };
  const discard = async () => {
    if (!(await confirmAlert({ title: t('events.discardDraft'), message: t('events.discardExplanation'),
      confirmLabel: t('events.discardDraft'), cancelLabel: t('events.cancel'), destructive: true }))) return;
    try { await clearEventDraft(draftKey); retry(); } catch (cause) { showAlert(t('events.error'), formatFirestoreError(cause)); }
  };

  const close = () => router.canGoBack() ? router.back() : router.replace('/(protected)/dashboard');
  return (
    <ScreenContainer padded={false} scrollable={false}>
      <PageHeader title={t(eventId ? 'events.edit' : 'events.new')} showBack />
      {loaded ? <EventEditorForm key={attempt} {...loaded} uid={uid} congregationId={congregationId} eventId={eventId}
        admin={admin} draftKey={draftKey} close={close} discard={discard} />
        : error ? <ErrorState message={error} onRetry={retry} /> : <LoadingState message={t('events.loading')} />}
    </ScreenContainer>
  );
}

function EventEditorForm({ draft, restored, people, conflict, uid, congregationId, eventId, admin, draftKey, close, discard }: {
  draft: EventDraft; restored: boolean; people: EventPerson[]; conflict: boolean; uid: string; congregationId: string;
  eventId: string | null; admin: boolean; draftKey: string; close: () => void; discard: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [values, setValues] = useState(draft.values);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(draft.pendingCreate === true);
  const [message, setMessage] = useState('');
  const busy = useRef(false);
  const source = useEventPeople(congregationId, people);
  const today = eventDay(new Date());
  const singleDay = SINGLE_DAY_EVENT_TYPES.includes(values.type);
  const isVisit = values.type === 'visita_superintendente';
  const schedules = values.schedules ?? [];
  const audience = values.audience ?? { kind: 'congregation' as const };
  const end = normalizeEventEndDate(values.type, values.startDate, values.endDate);
  const rosterHasPeople = schedules.some((schedule) => schedule.teams.some((team) => team.memberIds.length));
  const { load: loadPeople, status: directoryStatus } = source;

  useEffect(() => {
    if (restored && rosterHasPeople && directoryStatus === 'idle' && !pending && !conflict) void loadPeople();
  }, [conflict, directoryStatus, loadPeople, pending, restored, rosterHasPeople]);

  const change = (patch: Partial<CongregationEventFormValues>) => {
    if (busy.current) return;
    setMessage('');
    setValues((previous) => ({ ...previous, ...patch }));
  };

  const localDraft = async () => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try { await saveEventDraft(draftKey, { ...draft, values }); close(); } catch (cause) {
      setMessage(formatFirestoreError(cause));
    } finally { busy.current = false; setSaving(false); }
  };

  const publish = async () => {
    if (busy.current || conflict) return;
    if (!pending) {
      const planError = validateEventSchedules(schedules, values.startDate, end);
      const validation = !values.startDate || !end || values.startDate < today || end < values.startDate ? 'invalidDates'
        : !(isVisit ? values.superintendentName.trim() : values.title.trim()) ? 'requiredTitle'
          : values.type === 'personalizado' && !values.categories?.length ? 'requiredCategory'
            : audience.kind !== 'congregation' && !audience.groupId ? 'requiredGroup' : planError;
      if (validation) { setMessage(t(validation === 'scheduleDate' ? 'events.scheduleDateError' : `events.${validation}`)); return; }
    }
    busy.current = true;
    setSaving(true);
    setMessage('');
    let submitted = false;
    try {
      await saveEventDraft(draftKey, { ...draft, values, pendingCreate: !eventId });
      submitted = true;
      if (eventId) {
        await updateEvent({ eventId, values, congregationId, uid, expectedRevision: draft.revision ?? 0 });
      } else {
        await createEvent({ values, congregationId, uid, requestId: draft.requestId });
      }
      try {
        await clearEventDraft(draftKey);
      } catch {
        // The pending create can still be resumed with the same identifier.
      }
      close();
    } catch (cause) {
      const failure = cause as { code?: string; details?: { publicationNotCommitted?: boolean } };
      const code = String(failure?.code ?? '').split('/').pop() ?? '';
      const confirmedRejection = failure?.details?.publicationNotCommitted === true
        || (!pending && CONFIRMED_ERRORS.has(code));
      if (!eventId && submitted && !confirmedRejection) {
        setPending(true);
        setMessage(t('events.pending'));
      } else {
        if (!eventId && submitted) {
          setPending(false);
          await saveEventDraft(draftKey, { ...draft, values, pendingCreate: false }).catch(() => undefined);
        }
        setMessage(code === 'aborted' ? t('events.conflict') : formatFirestoreError(cause));
      }
    } finally { busy.current = false; setSaving(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {pending ? <ThemedText accessibilityRole="alert">{t('events.pending')}</ThemedText>
        : conflict ? <ThemedText accessibilityRole="alert">{t('events.conflict')}</ThemedText>
          : restored ? <ThemedText>{t('events.restored')}</ThemedText> : null}
      {!pending && !conflict && <>
        <EventSection>
          <ThemedText style={eventFieldStyles.title}>{t('events.type')}</ThemedText>
          <View style={eventFieldStyles.row}>
            {TYPES.map((type) => <EventButton key={type} label={t(`events.type.${type}`)} selected={type === values.type}
              onPress={() => change({ type, ...(SINGLE_DAY_EVENT_TYPES.includes(type) ? { endDate: values.startDate } : {}) })} />)}
          </View>
          {isVisit ? <>
            <EventText label={t('eventDetail.superintendent')} value={values.superintendentName} maxLength={200}
              onChangeText={(superintendentName) => change({ superintendentName })} />
            <EventText label={t('eventDetail.superintendentWife')} value={values.superintendentWifeName} maxLength={200}
              onChangeText={(superintendentWifeName) => change({ superintendentWifeName })} />
          </> : <EventText label={t('events.name')} value={values.title} maxLength={200} onChangeText={(title) => change({ title })} />}
          <EventText label={t('eventDetail.location')} value={values.location} maxLength={200} onChangeText={(location) => change({ location })} />
          <View style={eventFieldStyles.row}>
            <EventDate label={t('events.startDate')} value={values.startDate} minimum={today}
              onChange={(startDate) => change({
                startDate,
                endDate: singleDay ? startDate : values.endDate < startDate ? '' : values.endDate,
              })} />
            <EventDate label={t('events.endDate')} value={singleDay ? values.startDate : values.endDate}
              disabled={singleDay || !values.startDate} minimum={values.startDate || today}
              onChange={(endDate) => change({ endDate })} />
          </View>
          <ThemedText>{t('events.categories')}</ThemedText>
          <View style={eventFieldStyles.row}>
            {EVENT_CATEGORIES.map((category) => {
              const selected = values.categories?.includes(category) ?? false;
              return <EventButton key={category} label={t(`events.category.${category}`)} selected={selected}
                onPress={() => change({ categories: selected ? values.categories?.filter((entry) => entry !== category) : [...values.categories ?? [], category] })} />;
            })}
          </View>
        </EventSection>

        <EventAudienceEditor audience={audience} congregationId={congregationId} admin={admin}
          onChange={(next) => change({ audience: next })} openGroups={() => router.push('/(protected)/events/service-groups' as never)} />

        <ThemedText style={eventFieldStyles.title}>{t('events.schedules')}</ThemedText>
        <ThemedText>{t('events.scheduleHelp')}</ThemedText>
        {schedules.map((schedule, index) => (
          <ScheduleEditor key={index} schedule={schedule} start={values.startDate || today} end={end || undefined} source={source}
            onChange={(next) => change({ schedules: schedules.map((entry, position) => position === index ? next : entry) })}
            onRemove={() => change({ schedules: schedules.filter((_, position) => index !== position) })} />
        ))}
        <EventButton label={t('events.addSchedule')} disabled={!values.startDate || schedules.length >= EVENT_LIMITS.schedules}
          onPress={() => change({ schedules: [...schedules, {
            name: '', date: values.startDate, startTime: '09:00', endTime: '16:00', minutesPerShift: 60, teamSize: DEFAULT_EVENT_TEAM_SIZE,
            teams: Array.from({ length: 7 }, () => ({ memberIds: [] })),
          }] })} />
      </>}

      {message ? <ThemedText accessibilityRole="alert">{message}</ThemedText> : null}
      <View style={eventFieldStyles.row}>
        {!pending && !conflict && <EventButton label={t('events.saveDraft')} onPress={localDraft} disabled={saving} />}
        {!pending && (restored || conflict) && <EventButton label={t('events.discardDraft')} onPress={discard} disabled={saving} />}
        {!conflict && <EventButton label={t(saving ? 'events.saving' : pending ? 'events.confirmPending' : eventId ? 'events.saveChanges' : 'events.publish')}
          onPress={publish} disabled={saving} primary />}
      </View>
    </ScrollView>
  );
}

function EventAudienceEditor({ audience, congregationId, admin, onChange, openGroups }: {
  audience: EventAudience; congregationId: string; admin: boolean;
  onChange: (next: EventAudience) => void; openGroups: () => void;
}) {
  const { t } = useI18n();
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const request = useRef(0);
  const kind = audience.kind;
  const load = useCallback(() => {
    if (kind === 'congregation') return;
    const sequence = ++request.current;
    setStatus('loading');
    const result = kind === 'service' ? listServiceGroups(congregationId).then((items) => items.filter((group) => group.isActive))
      : getCleaningGroups(congregationId).then((items) => items.filter((group) => group.isActive && (group.groupType === 'family') === (kind === 'family')));
    void result.then((items) => {
      if (sequence === request.current) { setGroups(items); setStatus('ready'); }
    }).catch(() => { if (sequence === request.current) setStatus('error'); });
  }, [congregationId, kind]);
  useFocusEffect(useCallback(() => {
    load();
    return () => { request.current += 1; };
  }, [load]));
  return (
    <EventSection>
      <ThemedText style={eventFieldStyles.title}>{t('events.audience')}</ThemedText>
      <ThemedText>{t('events.audienceHelp')}</ThemedText>
      <View style={eventFieldStyles.row}>
        {EVENT_AUDIENCES.map((option) => <EventButton key={option} label={t(`events.audience.${option}`)} selected={kind === option}
          onPress={() => { if (kind !== option) { setStatus('loading'); onChange({ kind: option }); } }} />)}
      </View>
      {kind !== 'congregation' && (status === 'loading' ? <ThemedText>{t('events.loading')}</ThemedText>
        : status === 'error' ? <EventButton label={t('events.retryGroups')} onPress={load} />
          : groups.length ? <View style={eventFieldStyles.row}>{groups.map((group) => <EventButton key={group.id}
            label={group.name} selected={audience.groupId === group.id} onPress={() => onChange({ kind, groupId: group.id })} />)}</View>
            : <ThemedText>{t('events.noGroups')}</ThemedText>)}
      {kind === 'service' && admin && <EventButton label={t('events.serviceGroups')} onPress={openGroups} />}
    </EventSection>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 16, gap: 16, paddingBottom: 32 },
});
