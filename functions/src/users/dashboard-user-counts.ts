import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

type UserCountDelta = {
  total?: number;
  active?: number;
};

/**
 * Mantiene el contador que consumen Dashboard y Usuarios sin volver a leer toda
 * la colección. Si el resumen aún no existe, el job programado lo inicializa
 * con un recuento completo antes de que se empiecen a aplicar incrementos.
 */
export const updateDashboardUserCountsIfPresent = async (
  congregationId: string,
  delta: UserCountDelta
): Promise<void> => {
  const totalDelta = delta.total ?? 0;
  const activeDelta = delta.active ?? 0;
  if (!congregationId || (totalDelta === 0 && activeDelta === 0)) return;

  try {
    const ref = getFirestore().collection('dashboardSummary').doc(congregationId);
    const snap = await ref.get();
    const metrics = snap.data()?.metrics as Record<string, unknown> | undefined;

    if (
      !snap.exists ||
      typeof metrics?.totalUsers !== 'number' ||
      typeof metrics?.activeUsers !== 'number'
    ) {
      return;
    }

    const metricUpdates: Record<string, unknown> = {};
    if (totalDelta !== 0) metricUpdates.totalUsers = FieldValue.increment(totalDelta);
    if (activeDelta !== 0) metricUpdates.activeUsers = FieldValue.increment(activeDelta);

    await ref.set(
      {
        metrics: metricUpdates,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    logger.warn('No se pudo actualizar el contador de usuarios del dashboard.', {
      congregationId,
      totalDelta,
      activeDelta,
      error,
    });
  }
};
