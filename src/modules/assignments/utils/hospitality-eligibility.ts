import type { ActiveCongregationUser } from '@/src/services/users/active-users-service';
import type { HospitalityRoleKey } from '@/src/types/hospitality-microphones';

/**
 * Punto unico de verdad de elegibilidad por rol. Si un rol cambia de criterio,
 * se modifica AQUI y en su espejo del backend
 * (functions/src/planning-schedules.ts -> assertHospitalityRoleEligibility).
 *
 * 'elder' y 'ministerialServant' son privilegios de servicio, NO roles del
 * sistema (admin/supervisor/usuario). No mezclar ambos conceptos.
 */
export type HospitalityEligibility = 'elderOrServant';

export const HOSPITALITY_ROLE_ELIGIBILITY: Record<HospitalityRoleKey, HospitalityEligibility> = {
  chairman: 'elderOrServant',
  microphoneOne: 'elderOrServant',
  microphoneTwo: 'elderOrServant',
  microphoneThree: 'elderOrServant',
  attendantDoor: 'elderOrServant',
  attendantAuditorium: 'elderOrServant',
  attendantExtra: 'elderOrServant',
  audioVideo: 'elderOrServant',
  watchtowerReader: 'elderOrServant',
  midweekBibleStudyReader: 'elderOrServant',
};

export const isEligibleForHospitalityRole = (
  user: Pick<ActiveCongregationUser, 'isElder' | 'isMinisterialServant'>,
  roleKey: HospitalityRoleKey
): boolean =>
  HOSPITALITY_ROLE_ELIGIBILITY[roleKey] === 'elderOrServant'
    ? user.isElder || user.isMinisterialServant
    : false;

export const filterEligibleUsers = (
  users: ActiveCongregationUser[],
  roleKey: HospitalityRoleKey | undefined
): ActiveCongregationUser[] =>
  roleKey ? users.filter((user) => isEligibleForHospitalityRole(user, roleKey)) : [];
