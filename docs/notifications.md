# Notificaciones

OMP usa tres piezas:

- Expo Notifications en el cliente.
- Firebase Admin Messaging / Cloud Functions para envio y limpieza.
- Firestore para notificaciones internas.

## Datos

- Tokens por usuario: `/users/{uid}/pushTokens/{tokenDocId}`.
- Notificaciones por congregacion: `/congregations/{congregationId}/notifications/{notificationId}`.

## Reglas

- El token pertenece al usuario autenticado.
- No guardar tokens globales sin usuario y congregacion.
- No enviar notificaciones masivas sin segmentar por congregacion.
- Nunca notificar usuarios de otra congregacion.
- Desactivar tokens cuando Expo devuelva `DeviceNotRegistered`.

## Pruebas

- Pedir permiso con explicacion previa.
- Probar en development build o release.
- Mantener canales Android.
- Confirmar deep links.
- Confirmar contador de no leidas.
- Confirmar marcado como leida.
