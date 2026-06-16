# Plan De Refactor Estructural

Este plan identifica pantallas con mucha logica y propone dividirlas sin cambiar comportamiento en la misma PR.

## Prioridad Alta

| Area | Archivo actual | Extraccion sugerida |
| --- | --- | --- |
| Reuniones | `src/screens/meetings/MeetingFormScreen.tsx` | `useMeetingFormState`, `useMeetingValidation`, `useMeetingPublishFlow`, `meeting-form.mapper`, `meeting-form.validators` |
| Usuarios | `src/screens/users/UserFormScreen.tsx` | `useUserFormState`, `user-form.validators`, `user-form.mapper` |
| Billing | `src/screens/billing/BillingScreen.tsx` | `useBillingSummary`, `billing-actions.service` |
| Limpieza | `src/modules/cleaning/screens/CleaningScheduleScreen.tsx` | `useCleaningScheduleForm`, `cleaning-schedule.validators` |
| Territorios | Pantallas de territories | `useTerritoryPermissions`, `territory-form.validators` |

## Reglas

- No mezclar refactor con cambios de reglas o billing.
- Mantener textos i18n existentes.
- Agregar pruebas de mappers/validators antes de mover logica sensible.
- Validar Android, iOS y Web despues de cada extraccion.
