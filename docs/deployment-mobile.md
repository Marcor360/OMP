# Despliegue Android/iOS

OMP usa Expo. Para builds reales se recomienda EAS Build con Firebase configurado por ambiente.

## Variables de entorno (obligatorio)

Las `EXPO_PUBLIC_FIREBASE_*` viven en `.env` local, que esta en `.gitignore` y
por lo tanto **no se sube a EAS Build**. Sin ellas, el cliente cae al proyecto
por defecto y se registra un warning en consola. Hay que cargarlas una vez por
entorno:

```bash
eas env:create --scope project --environment preview --environment production \
  --visibility plaintext --name EXPO_PUBLIC_FIREBASE_API_KEY --value "<valor>"
```

Repetir para: `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`,
`EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`, `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`,
`EXPO_PUBLIC_FIREBASE_APP_ID` y, si aplica web,
`EXPO_PUBLIC_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY`.

Verificar antes de cada build:

```bash
eas env:list --environment preview
```

## Android

1. Instalar EAS CLI y autenticar:
   ```bash
   npm install -g eas-cli
   eas login
   ```
2. Verificar `app.json` y credenciales Android.
3. Crear build:
   ```bash
   eas build --platform android
   ```
4. Probar en dispositivo fisico antes de distribuir, especialmente Auth, Firestore, Functions y notificaciones.

## iOS

1. Requiere cuenta Apple Developer.
2. Crear build:
   ```bash
   eas build --platform ios
   ```
3. Validar permisos de notificaciones y certificados APNs.

## Firebase antes de publicar

```bash
cd functions && npm run build
npx -y firebase-tools@latest deploy --only functions,firestore:rules,firestore:indexes
```

Configurar App Check en Firebase Console para Android/iOS/Web antes de exigir tokens.
