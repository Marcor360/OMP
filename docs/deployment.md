# Despliegue

## Validacion Local

```bash
npm run validate
```

## Firebase CLI

Usar siempre:

```bash
npx -y firebase-tools@latest --version
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use
```

## Firestore

```bash
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes
```

## Cloud Functions

```bash
npm --prefix functions run lint
npm --prefix functions run build
npm --prefix functions test
npx -y firebase-tools@latest deploy --only functions
```

## Web

```bash
npm run build:web
npm run preview:web
npx -y firebase-tools@latest deploy --only hosting
```

## Android

```bash
npm run android
npm run android:release
eas build --platform android
```

No usar Expo Go como validacion final de notificaciones.

## Produccion

Antes de publicar:

- Validar version.
- Verificar permisos Android.
- Confirmar variables de entorno.
- Confirmar que no hay secretos en Git.
- Probar Auth, Firestore, Functions, cache y notificaciones.
- Revisar `docs/predeploy-validation.md`.
