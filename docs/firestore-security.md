# Seguridad Firestore

Firestore Rules son la barrera real para datos leidos o escritos por cliente. La UI solo mejora experiencia y reduce acciones visibles.

## Principios

- Requerir autenticacion para datos protegidos.
- Usar `/users/{uid}` como fuente de rol, estado activo y congregacion.
- Validar misma congregacion en lecturas y escrituras.
- Bloquear escrituras directas a campos sensibles.
- Mantener `/system/{docId}` sin escritura cliente.
- Mantener `dashboardSummary` como lectura cliente y escritura backend.
- Push tokens solo bajo `/users/{uid}/pushTokens`.

## Acciones Sensibles

Deben pasar por Cloud Functions:

- Crear usuarios.
- Actualizar roles.
- Cambiar permisos.
- Desactivar usuarios.
- Eliminar usuarios.
- Cambiar planes.
- Registrar pagos.
- Activar o suspender congregaciones.
- Publicar reuniones si dispara sincronizacion o notificaciones.

## Auditoria Requerida

Antes de endurecer reglas:

- Comparar reglas `create` y `update`.
- Revisar que la autoridad no venga de `request.resource.data` en campos sensibles.
- Validar tipos y limites de strings/listas.
- Confirmar que cada write valida identidad y congregacion.
- Probar usuario activo, inactivo, otra congregacion, admin, supervisor y usuario normal.

## Riesgo Actual Con Roles Legacy

Las reglas aun aceptan `administrador` y `usuario` por compatibilidad. Esto debe eliminarse despues de una migracion real de datos; hacerlo antes puede bloquear cuentas antiguas.
