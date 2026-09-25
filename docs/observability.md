# Observabilidad operativa

OMP usa Cloud Functions logger estructurado. Las métricas operativas no deben
incluir correo, nombre, UID, token de notificación, contenido de una reunión ni
otro dato personal.

## Métricas de notificaciones

Los workers de Expo Push registran eventos `operational_metric` con:

- `metric`: `notifications.push_dispatch_worker` o
  `notifications.push_receipts_worker`.
- `processed`: trabajos procesados.
- `recovered`: leases vencidos recuperados (solo dispatch).
- `durationMs`: duración del worker.

En Cloud Logging se pueden crear métricas basadas en el filtro
`jsonPayload.metric="notifications.push_dispatch_worker"` y alertas para
duración anormal, procesados acumulados en cola o errores de Functions.

## Lecturas Firestore

El cliente registra origen de caché y ciclo de listeners solo en desarrollo con
`EXPO_PUBLIC_FIRESTORE_DEBUG`. Para producción, revisar las métricas nativas de
Firestore por proyecto y las cuotas de lecturas; no se envían telemetrías de
consultas desde el dispositivo porque podrían revelar hábitos de uso.

## Errores de cliente

El límite de errores de la aplicación muestra un código estable al usuario y
escribe el detalle únicamente en desarrollo. Antes de enviar errores de cliente
a un proveedor externo se debe aprobar el proveedor, el aviso de privacidad, la
retención y una lista de campos permitidos. Nunca enviar perfiles, rutas con
identificadores, tokens ni textos de notificaciones.
