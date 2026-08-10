# AGENTS.md - OMP Agent Rules

These instructions apply to all AI agents working in this repository.

## Project Identity

OMP - Organization, Ministry & Programs is a multiplatform app for internal congregation organization. It helps manage users, meetings, assignments, cleaning, hospitality, preaching, territories, notifications, and congregation-level administration.

OMP is not an official JW.ORG application. Do not present it as official, approved, endorsed, or affiliated with any official entity of Jehovah's Witnesses. Public copy, store descriptions, README text, legal screens, and landing pages must keep this separation explicit.

## Required Stack

Use the current stack unless the user explicitly requests a migration:

- Expo SDK 54.
- React 19 and React Native 0.81.
- TypeScript.
- Expo Router.
- NativeWind / Tailwind CSS.
- Firebase Authentication.
- Cloud Firestore.
- Firebase Cloud Functions.
- Expo Notifications and Firebase Admin Messaging.
- AsyncStorage plus local Firestore/cache layers.
- React Native Web through Expo.

Do not replace Firebase, Expo Router, NativeWind, or the Expo/React Native structure without a strong reason and explicit approval.

## Repository Structure

Respect the existing boundaries:

- `app/`: Expo Router routes.
- `app/(auth)/`: public authentication screens.
- `app/(protected)/`: authenticated screens.
- `app/(protected)/(tabs)/`: main protected tabs.
- `src/components/`: reusable UI.
- `src/screens/`: main screens.
- `src/services/`: Auth, Firestore, notifications, repositories, and app services.
- `src/modules/`: domain modules such as assignments, cleaning, and field service.
- `src/types/`: types and DTOs.
- `src/i18n/`: translations.
- `src/lib/firebase/`: Firebase initialization and Firestore refs.
- `src/utils/`: pure utilities.
- `functions/`: Firebase Cloud Functions.
- `docs/`: technical documentation.
- `firestore.rules`: real data security.
- `firestore.indexes.json`: Firestore indexes.

Do not mix UI, services, types, Firestore Rules, and backend logic. Touch the smallest reasonable set of files.

## Functional Domains

Prefer extending existing domains instead of creating duplicates:

- Users.
- Congregations.
- Meetings.
- Assignments.
- Cleaning.
- Preaching.
- Territories.
- Notifications.
- Dashboard.
- Settings.
- Internationalization.

## Firestore Data Model

Main paths:

- `/users/{uid}`
- `/users/{uid}/pushTokens/{tokenDocId}`
- `/congregations/{congregationId}`
- `/congregations/{congregationId}/persons/{personId}`
- `/congregations/{congregationId}/meetings/{meetingId}`
- `/congregations/{congregationId}/meetings/{meetingId}/assignments/{assignmentId}`
- `/congregations/{congregationId}/assignments/{assignmentId}`
- `/congregations/{congregationId}/cleaningGroups/{groupId}`
- `/congregations/{congregationId}/outgoingTalks/{outgoingTalkId}`
- `/congregations/{congregationId}/changeLogs/{changeLogId}`
- `/congregations/{congregationId}/notifications/{notificationId}`
- `/congregations/{congregationId}/preachingReports/{monthId}/submissions/{userId}`
- `/dashboardSummary/{congregationId}`
- `/system/{docId}`

Central rule: congregation data must be isolated by `congregationId`. Do not make global queries unless it is an explicit, protected superadmin flow.

## Security And Permissions

Security exists in two layers:

- Frontend route and UI visibility.
- Firestore Rules or Cloud Functions as the real enforcement layer.

Mandatory principles:

- Protected data requires authentication.
- `/users/{uid}` defines the real role, active status, and congregation.
- Do not rely on UI checks alone.
- Every congregation operation must validate same congregation access.
- Sensitive writes require admin, supervisor, or authorized department manager.
- `dashboardSummary` is client read-only.
- `/system/{docId}` must not be client-writable.
- Push tokens must belong to the authenticated user.
- Common users must not escalate their own permissions.
- Users must not change their own `role`, `isActive`, or `congregationId`.

## Roles, Privileges, And Departments

Technical roles:

```ts
type UserRole = 'admin' | 'supervisor' | 'user';
```

Expected scope:

- `admin`: broad administration inside their congregation.
- `supervisor`: limited access by assigned permissions.
- `user`: normal use.

Organizational privileges are not technical roles:

```ts
privileges: {
  isElder?: boolean;
  isMinisterialServant?: boolean;
  isRegularPioneer?: boolean;
  isAuxiliaryPioneer?: boolean;
}
```

Rules:

- An admin is not automatically an elder.
- An elder is not automatically an admin.
- A supervisor is not automatically a ministerial servant.
- Do not confuse technical roles with organizational privileges.
- Do not allow `isElder` and `isMinisterialServant` to both be true when rules restrict it.
- Do not allow `isRegularPioneer` and `isAuxiliaryPioneer` to both be true.
- Module permissions are separate from organizational privileges.

Department assignments:

```ts
serviceDepartment: 'limpieza' | 'predicacion' | 'discursos' | string;
servicePosition: 'encargado' | 'auxiliar' | string;
serviceAssignments: Array<{
  position: string;
  department: string;
  label: string;
}>;
```

Rules:

- A department manager may get broad control only for that department.
- An assistant must have limited access.
- Do not give global access to an assistant.
- Do not assume every supervisor can administer everything.
- UI visibility and backend authorization must both validate the real action.

## UI And Navigation

The app should be clean, clear, modern, mobile-first, theme-aware, and consistent with NativeWind/Tailwind. Use clear empty states, badges, confirmations before destructive actions, and filters for long lists.

Avoid:

- Copy that sounds official or institutionally affiliated with JW.ORG.
- Excessive religious or institutional language.
- Technical terms shown to end users.
- Dangerous buttons without confirmation.
- Dense screens without visual hierarchy.

Expo Router rules:

- Public screens go in `app/(auth)/`.
- Protected screens go in `app/(protected)/`.
- Main tabs live in `app/(protected)/(tabs)/`.
- Do not expose protected routes without session/profile validation.
- Hide tabs when the user lacks permission.
- Sensitive routes need UI validation and backend validation.

## Notifications

OMP uses Expo Notifications, Firebase Admin Messaging, per-user push tokens, `/users/{uid}/pushTokens`, and internal Firestore notifications.

Rules:

- Do not use Expo Go as the final push-notification test.
- Test push in development build or release.
- Ask notification permission with prior explanation.
- Keep Android notification channels.
- Disable invalid tokens when Expo returns `DeviceNotRegistered`.
- Never send mass notifications without congregation segmentation.
- Never notify users from another congregation.
- Do not store push tokens globally without user and congregation context.

## Firestore Costs And Cache

Firestore costs matter. Follow these rules:

- Use cache-first strategies when possible.
- Avoid `onSnapshot` unless real time is required.
- Do not mount duplicate listeners.
- Clean listeners on unmount.
- Use single-flight or equivalent guards to avoid duplicate simultaneous requests.
- Invalidate cache after create, edit, publish, or delete.
- Do not read full collections when a summary is enough.
- Always filter by `congregationId`.

## Meetings And Assignments

Rules:

- Keep midweek, weekend, and other meetings separate.
- Assignments may be linked to meetings or independent.
- Cleaning assignments may sync from meetings when applicable.
- Publishing or changing meetings should invalidate cache and trigger notifications when applicable.
- Do not introduce document-import flows for meetings. That feature has been removed and must not be re-added unless the user explicitly asks for a new implementation.
- Do not break filters by date, category, subtype, person, congregation, or status.

## Preaching, Reports, Territories

Rules:

- Preaching is available according to permissions.
- Allowed users can submit monthly reports.
- Pioneers can register hours where supported.
- The preaching manager can view submitted, missing, hours, studies, and courses.
- Territory administration must be permission-controlled.
- Local hour counters are device-local and must not be confused with remote official congregation reports.

Territory shape:

```ts
type Territory = {
  id: string;
  name: string;
  description?: string;
  assignedDay?: string;
  congregationId: string;
  isActive: boolean;
};
```

Keep territory descriptions short, preferably 100-160 characters.

## Cleaning

Rules:

- Cleaning groups belong to one congregation.
- Members must be valid users/persons in that same congregation.
- Support standard or family-style groups.
- Validate member counts.
- Show "my cleaning" for upcoming responsibilities.
- Create, edit, and delete only according to permissions.
- Do not mix legacy collections without a compatibility layer.

## Plans, Billing, And Limits

Plan limits are based on active users:

- OMP Basic: 80 active users.
- OMP Intermediate: 120 active users.
- OMP Complete: 200 active users.

Rules:

- Plans limit active users, not features.
- Show current plan in settings.
- Show active users and available seats.
- Block creation/activation when the active-user limit is exceeded.
- Allow deactivation to free a seat.
- Do not block historical reads because of seat limits.
- Billing is by congregation, not individual user.
- Congregations with billing disabled must not show debt or payment lock.
- Payment actions should target the coordinator/financial admin according to business rules.

## External Admin Panel

The external admin panel is planned and must use separate superadmin protection, not congregation `admin`.

Expected scope:

- Create and activate/deactivate congregations.
- View plan and usage.
- View active/inactive users and key roles.
- Manage congregation billing.
- View internal usage metrics.
- Avoid unnecessary exposure of sensitive personal data.
- Do not edit internal reports or assignments unless explicitly required.

## Cloud Functions

Cloud Functions must handle sensitive operations:

- Create users.
- Update users.
- Change passwords.
- Deactivate users.
- Delete users.
- Sync Firebase Auth and Firestore.
- Publish meetings.
- Create, edit, and delete meetings by manager.
- Sync cleaning assignments.
- Send notifications.
- Scheduled cleanup jobs.

Do not move sensitive admin operations to the client. The client may request; the backend validates and executes.

Do not reintroduce removed meeting document-import Cloud Functions unless explicitly requested.

## Internationalization

Rules:

- Maintain Spanish and English.
- Do not hardcode new user-facing text when the i18n structure exists.
- Add translation keys.
- Keep terms consistent:
  - admin -> Administrador.
  - supervisor -> Supervisor.
  - user -> Usuario.
  - assignments -> Asignaciones.
  - cleaning -> Limpieza.
  - field service -> Predicacion.

## Versioning, Builds, And Android Permissions

Current detected app version is `1.36.1` in `package.json` and `app.json`. Verify the intended release version before release changes.

Rules:

- Update `package.json`, `app.json`, Android `versionName`, and `versionCode` together for releases.
- Regenerate AAB after version or permission changes.
- Do not commit keystores, credentials, private env files, logs, or generated builds.
- Do not add Android permissions without a clear functional reason.

Allowed Android permissions currently include:

- `android.permission.VIBRATE`
- `android.permission.POST_NOTIFICATIONS`

Blocked sensitive permissions include external storage, audio recording, overlay, boot completed, and exact alarm.

## Dependency Audit — Accepted Risk (2026-08)

`npm audit` reports residual vulnerabilities that are intentionally not closed. Do not attempt to close them with `npm audit fix --force` or forced overrides; they are toolchain/transitive issues with no compatible fix upstream yet.

App (root), 19 moderate:

- All inside `@expo/cli`, `@expo/config`, `@expo/config-plugins`, `@expo/metro-config`, `@expo/prebuild-config`, `xcode`, `expo-asset`, and `firebase-tools` (via `@google-cloud/pubsub`, `@opentelemetry/core`, `gaxios`, `uuid`).
- These are build toolchain dependencies; they do not ship in the bundle that reaches end users. The real exposure is CI supply chain, not the shipped app.
- `npm audit`'s suggested fix (`firebase-tools@14.23.0`) is a downgrade — do not apply it.
- The only real closure path is the Expo SDK 57 migration (multi-step, not part of routine dependency maintenance).

`functions/`, 7 moderate:

- All inside `@google-cloud/storage@7.21.0` (latest published), via `gaxios@6.7.1 -> teeny-request@9 -> uuid@9` and `retry-request@7.0.2`.
- The `gaxios` 6.x line closed at 6.7.1, which is vulnerable; the fix only exists in `gaxios@7.x`, which requires a `@google-cloud/storage` major Google has not published yet. Forcing an override would break Cloud Storage.
- `npm audit`'s suggested fix (`firebase-admin@10.3.0`) is a downgrade — do not apply it.

Review monthly whether Google has published `@google-cloud/storage@8`; if so, re-run the audit and re-evaluate.

`expo-doctor`, 1 accepted mismatch:

- `@react-navigation/native` is pinned to `^7.3.15`, one minor ahead of the `^7.1.8` Expo SDK 54 expects. This is intentional (routine minor bump, same major, no breaking API changes) and causes `expo-doctor`'s "Check that packages match versions required by installed Expo SDK" to report 17/18 instead of 18/18. All tests, `tsc --noEmit`, and lint pass clean. Do not "fix" this by running `npx expo install --check` unless re-evaluating on a real SDK migration (see below).

## Never Do These Things

- Do not present OMP as an official religious app.
- Do not remove the independence notice from JW.ORG.
- Do not change the main stack without instruction.
- Do not query congregation data globally without superadmin protection.
- Do not rely only on frontend validation.
- Do not grant admin access based on organizational privileges.
- Do not mix technical roles with elder/ministerial servant/pioneer privileges.
- Do not store secrets in the client.
- Do not commit `.env`, certificates, logs, keystores, or build artifacts.
- Do not add unnecessary real-time listeners.
- Do not load whole collections for dashboards when summaries are enough.
- Do not duplicate existing modules.
- Do not break i18n with hardcoded text.
- Do not use Expo Go as final push validation.
- Do not modify Firestore Rules without checking real flows for all roles.
- Do not let users self-activate, change their role, or change their congregation.
- Do not mix local preaching counters with remote congregation reports.
- Do not implement meeting document-import flows unless explicitly requested.

## Checklist Before Implementing A Feature

Answer these internally before changing code:

- Which congregation owns this data?
- Which roles can view it?
- Which roles can create it?
- Which roles can edit it?
- Which roles can delete it?
- Does it require a Cloud Function?
- Does it require Firestore Rules changes?
- Does it require a Firestore index?
- Should it generate a notification?
- Should it invalidate cache?
- Does it need translations?
- Does it affect read/listener costs?
- Does it affect Android, iOS, or Web?
- Does it affect congregation plans or limits?

If these cannot be answered, do not implement yet.

## Required Change Report Format

When an agent changes code, include:

Resumen:
- What changed.
- Why it changed.
- Files touched.

Seguridad:
- Rules/validations respected.
- Roles that can use the function.

Datos:
- Firestore collections/paths used.
- Indexes that may be required.

Costos:
- Whether it uses `onSnapshot` or `getDocs`.
- How unnecessary reads are avoided.

Pruebas:
- Manual cases to test.
- Roles to test.
- Platforms to test: Android, iOS, Web.

Riesgos:
- What may break.
- What remains pending.
