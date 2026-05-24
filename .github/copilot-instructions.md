# Copilot Instructions For OMP

Follow `AGENTS.md` in the repository root.

OMP is built with Expo SDK 54, React 19, React Native 0.81, TypeScript, Expo Router, NativeWind, Firebase Auth, Firestore, Cloud Functions, Expo Notifications, and React Native Web.

Do:

- Keep congregation data scoped by `congregationId`.
- Use existing modules, services, types, and i18n structure.
- Validate sensitive actions in Firestore Rules or Cloud Functions.
- Keep roles `admin`, `supervisor`, `user` separate from organizational privileges.
- Prefer cache-first reads and avoid unnecessary `onSnapshot`.
- Keep UI mobile-first, clear, and theme-aware.

Do not:

- Present OMP as an official JW.ORG app.
- Add global congregation queries without superadmin protection.
- Add Android permissions without strong reason.
- Hardcode user-facing text when translations apply.
- Commit secrets, logs, builds, credentials, or keystores.
- Reintroduce meeting document-import flows unless explicitly requested.
