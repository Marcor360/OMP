---
name: omp-playwright-qa
description: Validate OMP user journeys, deterministic Playwright tests and accessibility with the local Firebase emulators.
---

# OMP Playwright QA

Read [AGENTS.md](../../../AGENTS.md), `e2e/playwright.config.ts` and the flow's existing tests. Build Functions using Node 22. Run the app, Playwright and Expo with Node 24. Start Auth, Firestore and Functions for `demo-omp`, as documented in [testing](../../../docs/testing.md).

Use independent synthetic users and records. Prefer role and accessible-name locators. Wait on observable state and assert both the UI and persistence for writes. Simulate time and outages explicitly. Scope mocks to the boundary. Keep failure traces local or share them only after checking for private data.

Review keyboard navigation, focus restoration, control names and states and a narrow viewport. Distinguish automated checks from manual screen-reader, contrast and device checks. Use [omp-quality-checks](../omp-quality-checks/SKILL.md) for the remaining validation.
