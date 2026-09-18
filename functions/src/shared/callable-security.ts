import { defineBoolean } from 'firebase-functions/params';

// La configuracion permanece desactivada hasta que Web, Android e iOS hayan
// demostrado enviar tokens validos. Es un parametro de deploy, no una decision
// tomada por la UI ni por datos que un cliente pueda escribir.
export const enforceCriticalCallableAppCheck = defineBoolean(
  'ENFORCE_APPCHECK_CRITICAL_CALLABLES',
  { default: false }
);

export const criticalCallableOptions = {
  region: 'us-central1' as const,
  enforceAppCheck: enforceCriticalCallableAppCheck,
};
