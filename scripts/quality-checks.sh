#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major !== 24 || minor < 12) { console.error("OMP needs Node 24.12+ on the 24 line for quality checks."); process.exit(1); }'

npm run check:indexes
npm run check:rules
npm run lint
npm run typecheck
npm test -- --runInBand

npm --prefix functions run lint
npm --prefix functions run build
./node_modules/.bin/firebase emulators:exec --only firestore --project demo-omp \
  'npm --prefix functions test -- --runInBand && npm exec -- jest --config jest.rules.config.js --runInBand --detectOpenHandles --forceExit'

npm exec -- expo install --check
npm exec -- expo-doctor
npm run build:web
