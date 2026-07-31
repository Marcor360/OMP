const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const source = path.join(rootDir, 'public', '.htaccess');
const targetDir = path.join(rootDir, 'dist');
const target = path.join(targetDir, '.htaccess');
const assetLinksSource = path.join(rootDir, 'public', '.well-known', 'assetlinks.json');
const assetLinksTargetDir = path.join(targetDir, '.well-known');
const assetLinksTarget = path.join(assetLinksTargetDir, 'assetlinks.json');

if (!fs.existsSync(source)) {
  throw new Error(`Missing web rewrite file: ${source}`);
}

if (!fs.existsSync(targetDir)) {
  throw new Error(`Missing web build directory: ${targetDir}`);
}

if (!fs.existsSync(assetLinksSource)) {
  throw new Error(`Missing Digital Asset Links file: ${assetLinksSource}`);
}

fs.copyFileSync(source, target);
fs.mkdirSync(assetLinksTargetDir, { recursive: true });
fs.copyFileSync(assetLinksSource, assetLinksTarget);
console.log('Copied web metadata files to dist');
