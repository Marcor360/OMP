/**
 * Estado de bloqueo local a nivel de modulo (no React). Vive fuera de cualquier
 * componente para sobrevivir a remounts de AppLockProvider dentro del mismo
 * proceso (p. ej. si el usuario cierra sesion y vuelve a entrar sin cerrar la
 * app), pero se reinicia solo con un cierre real del proceso (kill + reapertura),
 * que es exactamente cuando se debe volver a pedir biometria.
 *
 * auth-context.tsx marca este estado al iniciar sesion (login interactivo no
 * requiere biometria inmediata) y al cerrar sesion (limpia el estado). No
 * importa React ni Firebase para evitar dependencias circulares.
 */

let locallyUnlocked = false;
let backgroundedAtMs: number | null = null;

export const markLocallyUnlocked = (): void => {
  locallyUnlocked = true;
  backgroundedAtMs = null;
};

export const markLocallyLocked = (): void => {
  locallyUnlocked = false;
  backgroundedAtMs = null;
};

export const isCurrentlyLocallyUnlocked = (): boolean => locallyUnlocked;

export const recordBackgroundedAt = (at: number): void => {
  backgroundedAtMs = at;
};

/** Lee y limpia la marca de fondo en una sola operacion (se consume una vez por regreso a primer plano). */
export const consumeBackgroundedAt = (): number | null => {
  const value = backgroundedAtMs;
  backgroundedAtMs = null;
  return value;
};

/** Solo para pruebas: restablece el modulo a su estado inicial. */
export const __resetAppLockStateForTests = (): void => {
  locallyUnlocked = false;
  backgroundedAtMs = null;
};
