# OMP Agent Rules

Read and follow the root `AGENTS.md` before making changes.

Critical reminders:

- OMP is not an official JW.ORG app. Do not present it as official or affiliated.
- Keep the current Expo, React Native, TypeScript, Expo Router, NativeWind, and Firebase stack.
- Isolate all congregation data by `congregationId`.
- Do not rely only on UI checks; sensitive operations need Firestore Rules or Cloud Functions validation.
- Technical roles are `admin`, `supervisor`, and `user`; do not confuse them with elder, ministerial servant, or pioneer privileges.
- Do not add global queries unless it is an explicit protected superadmin flow.
- Avoid unnecessary `onSnapshot` listeners and full collection reads.
- Use cache-first patterns and invalidate cache after writes.
- Do not add Android permissions without a clear reason.
- Do not hardcode user-facing strings when i18n applies.
- Do not commit secrets, keystores, builds, logs, or credentials.
- Meeting document import is removed. Do not reintroduce those flows unless explicitly requested.

When changing code, report summary, security, data paths, cost impact, tests, and risks.
