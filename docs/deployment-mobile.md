# Despliegue Android/iOS

OMP usa Expo. Para builds reales se recomienda EAS Build con Firebase configurado por ambiente.

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
