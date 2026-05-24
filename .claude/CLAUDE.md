# OMP Claude Instructions

Follow the root `AGENTS.md` as the source of truth.

OMP is an internal congregation organization app built with Expo, React Native, TypeScript, Expo Router, NativeWind, and Firebase. It is not an official JW.ORG app and must never be described as official, approved, endorsed, or affiliated.

Key constraints:

- Keep data isolated by `congregationId`.
- Enforce sensitive permissions with Firestore Rules or Cloud Functions, not UI alone.
- Use roles `admin`, `supervisor`, `user`.
- Do not confuse technical roles with privileges such as elder, ministerial servant, regular pioneer, or auxiliary pioneer.
- Avoid unnecessary real-time listeners and global reads.
- Respect existing modules and do not duplicate domains.
- Keep Spanish and English i18n.
- Do not add Android permissions or Firebase indexes without need.
- Do not commit secrets, logs, builds, keystores, or credentials.
- Meeting document import is removed; do not add it back unless explicitly requested.

For any code change, include summary, security notes, Firestore paths, cost impact, manual tests, and risks.
