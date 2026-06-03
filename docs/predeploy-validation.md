# Predeploy validation

Run before deploying rules, indexes, Functions, or mobile builds.

## Local checks

```bash
npm run validate
```

## Firebase checks

- Deploy Firestore rules and indexes together.
- Verify the `notifications` composite index for `userId` plus `createdAt desc` is active.
- After Functions deploy, confirm these functions exist:
  - `scheduledLegacyRootNotificationsMigration`
  - `scheduledDashboardSummaryRefresh`
  - `refreshDashboardSummaryForCurrentCongregation`
  - `sendExpoPushOnNotificationCreated`

## Manual role checks

- User: can read and mark only their own `/congregations/{congregationId}/notifications`.
- Admin/supervisor: can see congregation notification administration screens.
- User from another congregation: cannot read users, notifications, meetings, assignments, cleaning, or dashboard data.

## Push notification checks

- Do not use Expo Go as final validation.
- Test on a development build or release build.
- Register a token under `/users/{uid}/pushTokens/{tokenDocId}`.
- Create an assignment/event notification and verify the push arrives.
- Mark the notification as read and verify unread count and badge update.
- Remove or invalidate a token and verify it is deactivated/removed after Expo returns `DeviceNotRegistered`.
