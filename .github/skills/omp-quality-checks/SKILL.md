---
name: omp-quality-checks
description: Run OMP's local quality checks and review the change for correctness, test gaps and release readiness.
---

# OMP quality checks

Read [AGENTS.md](../../../AGENTS.md) and inspect the changed files. Review authorization, data integrity, races and breaking contracts before performance and maintainability. Ground findings in file and line references and state the impact, severity and evidence.

Use Node 24.12+ on the Node 24 line for the app and Node 22.13+ on the Node 22 line for Functions. In an environment with both versions installed, run from the repository root:

```bash
OMP_FUNCTIONS_NODE=/path/to/node22/bin/node npm run quality:check
```

The workflow runs lint, TypeScript, Jest, Functions build and integration tests, Firestore rules and index checks, the web export and Expo checks. Java 21 and Firebase emulators are required. Check the working directory, versions, and exit status. Exercise browser workflows using [omp-playwright-qa](../omp-playwright-qa/SKILL.md). Use the other OMP skills for React and Firebase reviews.

Use independent and deterministic Arrange–Act–Assert tests. Choose unit tests for logic, integration tests for boundaries and browser tests for critical journeys. Cover success, errors and relevant boundaries. Record checks that were skipped, blocked or outside the environment. Compare manifest versions and the Android version code when reviewing a release.
