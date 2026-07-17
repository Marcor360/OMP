import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const readJson = async (relativePath) => {
  const absolutePath = join(rootDir, relativePath);
  const source = await readFile(absolutePath, 'utf8');
  return JSON.parse(source);
};

const errors = [];

try {
  const [packageJson, appJson] = await Promise.all([
    readJson('package.json'),
    readJson('app.json'),
  ]);

  const packageVersion = packageJson.version;
  const versionMatch =
    typeof packageVersion === 'string'
      ? /^(0|[1-9]\d*)\.(0|[1-9]\d{0,1})\.(0|[1-9]\d{0,1})$/.exec(packageVersion)
      : null;

  if (!versionMatch) {
    errors.push(
      `package.json version must use numeric MAJOR.MINOR.PATCH with MINOR and PATCH between 0 and 99; received ${JSON.stringify(packageVersion)}.`
    );
  } else {
    const [, majorText, minorText, patchText] = versionMatch;
    const expectedBuild =
      Number(majorText) * 10_000 + Number(minorText) * 100 + Number(patchText);
    const expo = appJson.expo;

    if (!expo || typeof expo !== 'object' || Array.isArray(expo)) {
      errors.push('app.json must contain an expo object.');
    } else {
      if (expo.version !== packageVersion) {
        errors.push(
          `app.json expo.version must match package.json version ${packageVersion}; received ${JSON.stringify(expo.version)}.`
        );
      }

      if (!Number.isSafeInteger(expectedBuild) || expectedBuild > 2_100_000_000) {
        errors.push(
          `Version ${packageVersion} produces invalid Android versionCode ${expectedBuild}.`
        );
      }

      if (expo.android?.versionCode !== expectedBuild) {
        errors.push(
          `app.json android.versionCode must be ${expectedBuild} for version ${packageVersion}; received ${JSON.stringify(expo.android?.versionCode)}.`
        );
      }

      const expectedIosBuild = String(expectedBuild);
      if (expo.ios?.buildNumber !== expectedIosBuild) {
        errors.push(
          `app.json ios.buildNumber must be "${expectedIosBuild}" for version ${packageVersion}; received ${JSON.stringify(expo.ios?.buildNumber)}.`
        );
      }
    }

    if (errors.length === 0) {
      console.log(
        `OK: package.json ${packageVersion}; app.json version ${packageVersion}; Android/iOS build ${expectedBuild}.`
      );
    }
  }
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exitCode = 1;
}
