# Integridad y reconexión en OMP

El [seguimiento de recuperación y revisión](seguimiento-recuperacion-y-revision-2026-11-19.md) documenta la recuperación tras cerrar la app, el aviso de limpieza pendiente y la revisión de cambios y posibles duplicados.

## Guardado de asignaciones

El formulario conserva un identificador durante los reintentos de una misma creación, tanto para personas como para grupos de limpieza asignados desde este formulario. Si se envía dos veces o se pierde la respuesta tras el guardado, Functions devuelve el mismo ID. El servidor identifica la operación por congregación, reunión, usuario autenticado y clave de solicitud. Si ese usuario reutiliza la clave con datos diferentes después del guardado, recibe un conflicto y se conserva la asignación original. Una creación intencional independiente usa otra clave.

El guardado usa una transacción de Firestore que comprueba la reunión y la disponibilidad del asignado antes de crear el documento. Un reintento ya confirmado lee la asignación existente y evita repetir la consulta de disponibilidad y la escritura. La comprobación de perfil activo, rol o permisos de asignaciones, congregación y facturación sigue ejecutándose antes del reintento. Los clientes antiguos que omiten el identificador mantienen el contrato anterior.

La ruta sigue siendo `congregations/{congregationId}/meetings/{meetingId}/assignments/{assignmentId}`. Se usa la propia asignación para reconocer reintentos, con una huella de los datos de creación. No se agregaron colecciones, índices ni escuchas en tiempo real. Esta recuperación funciona mientras el formulario permanezca abierto y la asignación exista. Si el usuario cierra la pantalla, reinicia la app o alguien elimina el documento, la confirmación de aquella operación requiere un mecanismo persistente.

## Edición y publicación de reuniones

El editor de asignaciones y el panel de publicación envían la revisión de la reunión que el usuario vio. Si alguien guardó otra revisión, OMP avisa en español o inglés para reabrir el formulario o actualizar la lista. Al reabrir el formulario se intenta obtener la versión del servidor usando el flujo de caché existente como respaldo.

Las escrituras de edición y publicación también comprueban que siga vigente la lectura del servidor hasta el momento de guardar. Esto protege peticiones de clientes antiguos si se solapan en el servidor y conserva las secciones más recientes cuando se detecta un conflicto. Las reuniones antiguas sin `updatedAt` adquieren una revisión al guardar y cuentan con la comprobación de Firestore desde el primer guardado. El formulario de datos generales sigue usando la comprobación del servidor y el guardado seguido de sincronización de limpieza.

## Sincronización de limpieza

Las asignaciones automáticas de limpieza conservan su estado, sus personas asignadas y su autor original al volver a sincronizar el mismo grupo. Una tarea completada sigue completada y conserva el mismo ID. La operación mantiene la autorización de gestión de reuniones y la consulta existente por origen de la asignación.

## Validación

- Node 24.22.1 y `demo-omp`. Pasaron 330 pruebas de la app, 365 de Functions y 91 de reglas Firestore. Las pruebas de Functions cubren reintentos concurrentes, peticiones no autorizadas, dos editores, publicación obsoleta y resincronización de una tarea de limpieza completada.
- Cinco recorridos de Playwright repetidos dos veces en dos workers de Chromium. La prueba de reconexión comprueba la caída antes del guardado, la pérdida de la respuesta después del guardado, el rechazo de datos cambiados y el reintento con un único documento.
- Pasaron la comprobación de tipos, lint, 21 comprobaciones de Expo Doctor y la exportación web. Quedan pendientes la verificación en Android e iOS y las operaciones de staging.

## Siguiente trabajo y funciones propuestas

| Prioridad | Trabajo | Criterio de aceptación |
|---|---|---|
| Alta | Reconciliar la sincronización de limpieza por reunión. La reunión se guarda primero y después se sincronizan sus asignaciones de limpieza. Si falla la segunda operación, ambos conjuntos pueden quedar desalineados. | Mostrar «limpieza pendiente» cuando corresponda. Reintentar solo la sincronización y detectar si hubo una edición posterior de la reunión. |
| Alta | Mostrar guardados pendientes de confirmación y conservar su identificador al cerrar la app. Empezar por el formulario de asignaciones. | Abrir de nuevo la app después de una pérdida de red y consultar si la asignación ya existe antes de reintentar. Mantener las operaciones separadas por usuario y congregación. |
| Media | Mostrar qué cambió cuando dos editores guardan la misma reunión, reutilizando el historial de cambios cuando esté disponible. | Presentar las secciones modificadas y permitir recuperar el borrador para aplicar de nuevo los cambios que sigan siendo válidos. |
| Media | Añadir una vista de posibles duplicados para roles autorizados, con filtros de reunión, persona, fecha y categoría. | Mostrar coincidencias para revisión manual y permitir distinguir tareas deliberadamente parecidas. Cualquier corrección exige confirmación y queda en el historial. |

El seguimiento anterior mantiene los pendientes de Push por instalación, Stripe, App Check y validación en dispositivos. Las comprobaciones de este trabajo usan datos sintéticos en `demo-omp`. [Seguimiento de Node 24 y calidad](seguimiento-node24-y-calidad-2026-11-19.md)
