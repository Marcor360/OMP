import type { ActiveCongregationUser } from '@/src/services/users/active-users-service';
import type { HospitalityRoleKey } from '@/src/types/hospitality-microphones';

// Matriz explicita de la regla de negocio vigente: los puestos operativos de
// una misma reunion son simultaneos. Por tanto, una persona solo puede ocupar
// uno. `attendantDoor` es el roleKey real de "Acomodador de puerta".
const INCOMPATIBLE_ROLES: Record<HospitalityRoleKey, readonly HospitalityRoleKey[]> = {
  chairman: ['microphoneOne', 'microphoneTwo', 'microphoneThree', 'attendantDoor', 'attendantAuditorium', 'attendantExtra', 'audioVideo', 'watchtowerReader', 'midweekBibleStudyReader'],
  microphoneOne: ['chairman', 'microphoneTwo', 'microphoneThree', 'attendantDoor', 'attendantAuditorium', 'attendantExtra', 'audioVideo', 'watchtowerReader', 'midweekBibleStudyReader'],
  microphoneTwo: ['chairman', 'microphoneOne', 'microphoneThree', 'attendantDoor', 'attendantAuditorium', 'attendantExtra', 'audioVideo', 'watchtowerReader', 'midweekBibleStudyReader'],
  microphoneThree: ['chairman', 'microphoneOne', 'microphoneTwo', 'attendantDoor', 'attendantAuditorium', 'attendantExtra', 'audioVideo', 'watchtowerReader', 'midweekBibleStudyReader'],
  attendantDoor: ['chairman', 'microphoneOne', 'microphoneTwo', 'microphoneThree', 'attendantAuditorium', 'attendantExtra', 'audioVideo', 'watchtowerReader', 'midweekBibleStudyReader'],
  attendantAuditorium: ['chairman', 'microphoneOne', 'microphoneTwo', 'microphoneThree', 'attendantDoor', 'attendantExtra', 'audioVideo', 'watchtowerReader', 'midweekBibleStudyReader'],
  attendantExtra: ['chairman', 'microphoneOne', 'microphoneTwo', 'microphoneThree', 'attendantDoor', 'attendantAuditorium', 'audioVideo', 'watchtowerReader', 'midweekBibleStudyReader'],
  audioVideo: ['chairman', 'microphoneOne', 'microphoneTwo', 'microphoneThree', 'attendantDoor', 'attendantAuditorium', 'attendantExtra', 'watchtowerReader', 'midweekBibleStudyReader'],
  watchtowerReader: ['chairman', 'microphoneOne', 'microphoneTwo', 'microphoneThree', 'attendantDoor', 'attendantAuditorium', 'attendantExtra', 'audioVideo', 'midweekBibleStudyReader'],
  midweekBibleStudyReader: ['chairman', 'microphoneOne', 'microphoneTwo', 'microphoneThree', 'attendantDoor', 'attendantAuditorium', 'attendantExtra', 'audioVideo', 'watchtowerReader'],
};

export const isHospitalityRoleIncompatible = (left: HospitalityRoleKey, right: HospitalityRoleKey): boolean =>
  INCOMPATIBLE_ROLES[left].includes(right);

export const occupiedHospitalityUserIds = (
  roleKey: HospitalityRoleKey,
  assignments: Partial<Record<HospitalityRoleKey, string>>
): Set<string> => new Set(
  Object.entries(assignments)
    .filter(([assignedRole, userId]) => Boolean(userId) && isHospitalityRoleIncompatible(roleKey, assignedRole as HospitalityRoleKey))
    .map(([, userId]) => userId!)
);

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
  roleKey: HospitalityRoleKey | undefined,
  existingAssignments: Partial<Record<HospitalityRoleKey, string>> = {}
): ActiveCongregationUser[] =>
  roleKey
    ? users.filter((user) =>
      isEligibleForHospitalityRole(user, roleKey) && !occupiedHospitalityUserIds(roleKey, existingAssignments).has(user.uid)
    )
    : [];
