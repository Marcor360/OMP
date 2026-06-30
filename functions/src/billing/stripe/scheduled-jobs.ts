import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { getBillingReminderTargets } from './authorization.js';
import {
  isBillingExempt,
  listBillingEnabledCongregationDocs,
  timestampFromMillis,
  toMillis,
  type BillingState,
} from './billing-state.js';
import {
  BILLING_HISTORY_COLLECTION,
  BILLING_HISTORY_RETENTION_DAYS,
  REGION,
} from './stripe-client.js';
import { createBillingNotificationForSchedule } from './webhook-handlers.js';

const daysUntil = (targetMillis: number, now = new Date()): number => {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = new Date(targetMillis);
  const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.ceil((targetUtc - todayUtc) / 86400000);
};

export const sendBillingPaymentReminders = onSchedule(
  {
    region: REGION,
    schedule: 'every day 08:00',
    timeZone: 'America/Mexico_City',
  },
  async () => {
    const congregationDocs = await listBillingEnabledCongregationDocs();
    let created = 0;

    for (const congregationDoc of congregationDocs) {
      const data = congregationDoc.data() as Record<string, unknown>;
      if (isBillingExempt(data)) continue;

      const billing = data.billing as BillingState | undefined;
      const nextPaymentMillis = toMillis(billing?.nextPaymentDate);
      if (!nextPaymentMillis) continue;

      const days = daysUntil(nextPaymentMillis);
      if (days !== 5 && days !== 0) continue;

      const reminderKey = `${congregationDoc.id}:${new Date(nextPaymentMillis).toISOString().slice(0, 10)}:${days}`;
      const sentKeys = Array.isArray((billing as Record<string, unknown> | undefined)?.reminderKeys)
        ? ((billing as Record<string, unknown>).reminderKeys as unknown[])
        : [];
      if (sentKeys.includes(reminderKey)) continue;

      const userIds = await getBillingReminderTargets(congregationDoc.id);
      if (userIds.length === 0) continue;

      const title = days === 5 ? 'Pago proximo de OMP' : 'Pago de OMP vence hoy';
      const body =
        days === 5
          ? 'Se aproxima la fecha de cobro de OMP Suite para tu congregacion. El pago mensual se realizara el dia 1.'
          : 'El pago mensual de OMP Suite vence hoy.';

      await createBillingNotificationForSchedule({
        congregationId: congregationDoc.id,
        userIds,
        title,
        body,
        metadata: {
          billingReminder: true,
          daysUntilPayment: days,
          nextPaymentDate: new Date(nextPaymentMillis).toISOString(),
        },
      });
      await congregationDoc.ref.set(
        {
          'billing.reminderKeys': FieldValue.arrayUnion(reminderKey),
          'billing.updatedAt': FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      created += 1;
    }

    logger.info('[billing] payment reminders processed', { created });
  }
);

export const scheduledBillingHistoryCleanup = onSchedule(
  {
    region: REGION,
    schedule: 'every day 03:30',
    timeZone: 'America/Mexico_City',
    timeoutSeconds: 300,
    memory: '256MiB',
  },
  async () => {
    const cutoff = timestampFromMillis(
      Date.now() - BILLING_HISTORY_RETENTION_DAYS * 86400000
    );
    const snap = await getFirestore()
      .collectionGroup(BILLING_HISTORY_COLLECTION)
      .where('createdAt', '<', cutoff)
      .orderBy('createdAt', 'asc')
      .limit(250)
      .get();

    if (snap.empty) {
      logger.info('[billing] history cleanup skipped; no expired records');
      return;
    }

    const batch = getFirestore().batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();

    logger.info('[billing] history cleanup completed', {
      deleted: snap.size,
    });
  }
);
