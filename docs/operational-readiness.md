# Preparacion Operativa Sin Stripe

Este documento completa lo que puede dejarse preparado en el repositorio. Los
cambios en App Check, alertas, copias y dispositivos fisicos requieren la
consola de Firebase o Google Cloud y no deben activarse automaticamente:
una configuracion incompleta podria bloquear usuarios reales.

## Estado verificado

- Proyecto activo: `ormeprassig-public`.
- App web activa: `ORMEPRASSIG-Web`
  (`1:525513661085:web:bb6db6d331f3e864e89274`).
- Functions se ejecutan en `us-central1` y el outbox durable conserva los
  estados `pending`, `processing`, `sent`, `permanent_error` y `exhausted`.

## App Check

1. En Firebase Console, registrar proveedores para las aplicaciones Android,
   iOS y Web. Para Web, limitar el proveedor a los dominios de produccion y
   preproduccion aprobados.
2. Mantener App Check en modo de monitoreo y revisar durante al menos una
   semana el trafico valido/invalido de las tres plataformas.
3. Corregir los builds o dominios sin token valido. Probar una development
   build; Expo Go no es evidencia suficiente.
4. Exigir App Check primero en Functions sensibles de usuarios y reuniones.
   No exigirlo en Firestore hasta comprobar clientes reales. Los webhooks de
   terceros no usan App Check.
5. Documentar el responsable y el procedimiento de rollback antes de exigirlo.

## Observabilidad y alertas

En Google Cloud Monitoring, crear alertas para:

- Errores de Cloud Functions por encima del nivel habitual durante 15 minutos.
- Latencia p95 y agotamiento de instancias de Functions.
- Ejecuciones fallidas de `processPendingExpoPushDispatches` y
  `processPendingExpoPushReceipts`.
- Un incremento de dispatches `exhausted` o `permanent_error`.

Los logs deben filtrarse por `congregationId`, `notificationId` y
`operationId`; nunca incluir tokens Expo ni datos personales en las alertas.

## Backup y restauracion de Firestore

1. En Google Cloud Console habilitar una programacion diaria de backups de la
   base Firestore y conservarlos segun la politica de la organizacion.
2. Antes de declarar la restauracion lista, importar un backup en un proyecto
   aislado y verificar: usuarios, reuniones, asignaciones, grupos de limpieza,
   notificaciones y `dashboardSummary`.
3. Registrar fecha del ultimo ejercicio, duracion, responsable y resultado.
   No restaurar directamente sobre produccion como prueba.

## Prueba fisica de push

En una development build o release build, para Android y cuando exista iOS:

1. Iniciar sesion con un usuario de una congregacion y aceptar notificaciones.
2. Crear una notificacion dirigida solo a ese usuario/congregacion.
3. Confirmar recepcion, apertura de la ruta esperada y registro de receipt.
4. Reinstalar la app o invalidar el token y confirmar que `DeviceNotRegistered`
   desactiva el token sin reintentos infinitos.
5. Repetir con dos congregaciones y confirmar que nunca existe entrega cruzada.
