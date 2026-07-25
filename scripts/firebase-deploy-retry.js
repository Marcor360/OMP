const { spawnSync } = require('node:child_process');

// firebaserules.googleapis.com intermittently returns 503 on rule
// compilation, and firebase-tools' updateOrCreateRelease() blindly falls
// back to "create" (409) whenever the "update" call fails for any reason,
// including that transient 503. Both are upstream flakiness, not a real
// problem with our rules/functions, so a deploy that fails outright is
// usually fixed by simply retrying.
const MAX_ATTEMPTS = 4;
const BACKOFF_MS = [5000, 15000, 30000];

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/firebase-deploy-retry.js <firebase deploy args>');
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    console.log(`\n[deploy] Attempt ${attempt}/${MAX_ATTEMPTS}: firebase deploy ${args.join(' ')}`);
    const result = spawnSync('firebase', ['deploy', ...args], {
      stdio: 'inherit',
      shell: true,
    });

    if (result.status === 0) {
      console.log('[deploy] Succeeded.');
      return;
    }

    if (attempt === MAX_ATTEMPTS) {
      console.error(`[deploy] All ${MAX_ATTEMPTS} attempts failed.`);
      process.exit(result.status ?? 1);
    }

    const delay = BACKOFF_MS[attempt - 1];
    console.warn(
      `[deploy] Attempt ${attempt} failed (exit ${result.status}). Retrying in ${delay / 1000}s...`,
    );
    await sleep(delay);
  }
}

main();
