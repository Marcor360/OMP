# Matriz De Permisos

Esta matriz mantiene alineados UI, Cloud Functions y Firestore Rules. Las reglas reales siguen en `firestore.rules` y las operaciones sensibles deben validarse tambien en Functions.

## Principios

- `admin`, `supervisor` y `user` son roles tecnicos.
- Privilegios como anciano, siervo ministerial o precursor no otorgan permisos tecnicos por si solos.
- Encargados y auxiliares tienen alcance por departamento, no acceso global.
- La UI puede ocultar acciones, pero Firestore Rules o Cloud Functions son la autoridad.
- Todo acceso a datos congregacionales debe validar misma `congregationId`.

## Matriz

| Modulo | Ver | Crear | Editar | Eliminar | Publicar/Aprobar | Administrar | Validacion backend |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Usuarios | Admin, supervisor, coordinador/secretario, `usuarios.view` | Admin, `usuarios.create/manage` | Admin, `usuarios.edit/manage` | Admin, `usuarios.delete/manage` | N/A | Admin, `usuarios.manage` | Functions + Rules |
| Reuniones | Usuario activo de la congregacion | Admin, encargado reuniones, `reuniones.create/manage` | Admin, encargado reuniones, `reuniones.edit/manage` | Admin | Encargado reuniones, admin | Admin, `reuniones.manage` | Functions + Rules |
| Asignaciones | Usuario activo de la congregacion | Admin, encargado discursos, `asignaciones.create/manage` | Admin, encargado discursos, `asignaciones.edit/manage` | Admin | Encargado modulo | Admin, `asignaciones.manage` | Functions + Rules |
| Limpieza | Usuario activo de la congregacion | Admin, encargado limpieza | Admin, encargado limpieza, auxiliar limitado | Admin | Encargado limpieza | Admin, `limpieza.manage` | Functions + Rules |
| Acomodadores y microfonos | Usuario activo de la congregacion | Admin, encargado modulo | Admin, encargado, auxiliar limitado | Admin | Encargado modulo | Admin, `acomodadores_microfonos.manage` | Functions + Rules |
| Predicacion | Usuario activo segun modulo | Usuario activo puede reportar donde aplique | Encargado predicacion | Encargado/admin | Encargado predicacion | `predicacion.manage` | Rules + servicios |
| Territorios | Usuario activo puede ver segun modulo | Encargado predicacion, `territories.create` | Encargado, `territories.edit` | Desactivacion controlada | Asignar: encargado, `territories.assign` | `territories.manage` | Rules + servicios |
| Organigrama | Usuario activo con congregacion | Admin, coordinador/secretario, `organigrama.create/manage` | Admin, coordinador/secretario, `organigrama.edit/manage` | Admin | N/A | `organigrama.manage` | Rules + servicios |
| Billing | Admin ve estado; pagos segun cargo/permisos | Coordinador, secretario, tesoreria, `pagos.create/manage` | Stripe webhook | N/A | Stripe webhook | `pagos.manage` | Functions + Stripe webhook |
| Notificaciones | Usuario activo destinatario | Funciones autorizadas | Marcar leido por destinatario | No destructivo desde cliente | Backend | Backend | Functions + Rules |
| Configuracion | Admin, supervisor, `configuracion.view` | Admin | Admin, `configuracion.edit/manage` | Admin | N/A | `configuracion.manage` | Rules |

## Pendientes De Endurecimiento

- Ejecutar migracion legacy de roles y planes en dry-run.
- Ejecutar migracion con `--write` despues de revisar salida.
- Confirmar que no queden `administrador`, `usuario`, `basic`, `intermediate`, `complete` ni limites legacy.
- Endurecer `isValidRole()` en `firestore.rules` para aceptar solo `admin`, `supervisor`, `user`.
- Agregar pruebas de Rules para creacion/edicion/eliminacion por modulo.
