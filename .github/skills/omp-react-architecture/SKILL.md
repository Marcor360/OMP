---
name: omp-react-architecture
description: Review or change OMP React Native, Expo Router, TypeScript, NativeWind, accessibility and UI data flow.
---

# OMP frontend architecture

Read [AGENTS.md](../../../AGENTS.md). Follow the existing path from Expo Router under `app/` to screens and domain modules in `src/`, then to services and repositories. Keep persistence outside reusable UI and apply sensitive authorization in the Firebase boundary.

- Check React effect dependencies, listener cleanup, stale requests, cache invalidation and the loading, empty, error and success states.
- Preserve Expo SDK 57 compatibility and the mobile and web layouts. Reuse themed components and Spanish/English translations.
- Check accessible names, role and state, keyboard focus, small viewports, and actionable error messages.
- Validate changes with type checking, supported Expo versions, component tests and the relevant browser journey. Record the difference between export, installation and physical-device verification.
