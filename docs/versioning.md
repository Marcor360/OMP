# Versioning

`package.json` is the source of truth for the OMP application version.

Every release must keep these values synchronized:

- `package.json` `version`
- `app.json` `expo.version`
- `app.json` `expo.android.versionCode`
- `app.json` `expo.ios.buildNumber`
- Native Android `versionName` and `versionCode` when the Android project is present

## Build-number convention

OMP versions use numeric `MAJOR.MINOR.PATCH`, with `MINOR` and `PATCH`
between 0 and 99. Both mobile build identifiers derive from that version:

```text
build = MAJOR * 10000 + MINOR * 100 + PATCH
```

For example, version `1.13.4` maps to Android `versionCode` `11304` and
iOS `buildNumber` `"11304"`.

Run the consistency guard before every release:

```bash
npm run check:versions
```

Release commits use `chore(release): vX.Y.Z`. Other commits use the
`type(scope): description` format. A version number alone is never a valid
commit message.
