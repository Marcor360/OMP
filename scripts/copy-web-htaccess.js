const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const source = path.join(rootDir, 'public', '.htaccess');
const targetDir = path.join(rootDir, 'dist');
const target = path.join(targetDir, '.htaccess');

if (!fs.existsSync(source)) {
  throw new Error(`Missing web rewrite file: ${source}`);
}

if (!fs.existsSync(targetDir)) {
  throw new Error(`Missing web build directory: ${targetDir}`);
}

fs.copyFileSync(source, target);
console.log('Copied public/.htaccess to dist/.htaccess');
