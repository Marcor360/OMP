---
name: omp-firebase-security
description: Perform a defensive review of OMP authorization, Firestore rules, billing, secrets and push token lifecycle.
---

# OMP Firebase security review

Read [AGENTS.md](../../../AGENTS.md) and trace the real client call, server permission check and collection path for each changed operation. Check identity, active profile, congregation scope and role boundaries. Cover authorized and denied requests using synthetic data in `demo-omp`. Consider offline writes, retries, transaction consistency and idempotency.

- Review Firestore rules, generated output and index declarations together. Check for permission expansion, stale state and unbounded reads.
- For Stripe, check raw webhook signature verification, event deduplication, subscription mapping and server-managed billing fields. Review Expo Push token rotation and logout by installation.
- Keep credentials and private payloads out of logs and artifacts. Compare npm advisories against actual package paths and distinguish build tooling from deployed runtime.
- Use OWASP review categories for findings. Identify external checks separately and use approved environments for those checks. A local review cannot establish PCI-DSS or ISO 27001 compliance.
