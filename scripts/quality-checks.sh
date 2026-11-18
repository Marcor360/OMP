#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major !== 24 || minor < 12) { console.error("OMP needs Node 24.12+ on the 24 line for app checks."); process.exit(1); }'

functions_node="${OMP_FUNCTIONS_NODE:-}"
if [[ ! -x "$functions_node" || "$(basename "$functions_node")" != node ]]; then
  printf '%s\n' 'Set OMP_FUNCTIONS_NODE to the absolute path to a Node 22 bin/node.' >&2
  exit 1
fi
"$functions_node" -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major !== 22 || minor < 13) { console.error("OMP Functions needs Node 22.13+ on the 22 line for its tools."); process.exit(1); }'
export OMP_FUNCTIONS_NODE_DIR
OMP_FUNCTIONS_NODE_DIR=$(cd "$(dirname "$functions_node")" && pwd)

npm run check:indexes
npm run check:rules
npm run lint
npm run typecheck
npm test -- --runInBand

PATH="$OMP_FUNCTIONS_NODE_DIR:$PATH" npm --prefix functions run lint
PATH="$OMP_FUNCTIONS_NODE_DIR:$PATH" npm --prefix functions run build
./node_modules/.bin/firebase emulators:exec --only firestore --project demo-omp \
  'PATH="$OMP_FUNCTIONS_NODE_DIR:$PATH" npm --prefix functions test -- --runInBand && npm exec -- jest --config jest.rules.config.js --runInBand --detectOpenHandles --forceExit'

npm exec -- expo install --check
npm exec -- expo-doctor
npm run build:web
