# Recuperación de guardados y revisión de reuniones

El [seguimiento de conexiones y comparación](seguimiento-conexiones-y-comparacion-2026-11-19.md) amplía la carga parcial, los reintentos y la resolución de conflictos.

## Guardados por confirmar

Antes de crear una asignación, OMP conserva la clave de solicitud y los datos enviados en el almacenamiento de la app, bajo la cuenta y congregación activas. Cuando se abre la app o se vuelve a Asignaciones, consulta el resultado de los intentos recientes. Si Firebase confirma que se guardó, conserva un aviso y retira el contenido del borrador. Si falta confirmarlo, **Comprobar y reintentar** vuelve a consultar el resultado antes de enviar los datos originales con la misma clave. La comprobación automática solo lee el resultado.

Functions guarda la asignación y su comprobante en una sola transacción. El comprobante permanece mientras exista la reunión, incluso si después se elimina la asignación. El mismo intento no vuelve a crearla. El servidor verifica cuenta, permisos y congregación. Las solicitudes viejas sin clave conservan su comportamiento anterior. Las solicitudes con clave creadas antes de este cambio se reconocen por su asignación original mientras esta exista.

El borrador local se recupera en el mismo dispositivo y perfil de navegador. En un dispositivo compartido, la pantalla solo carga intentos de la cuenta y congregación activas. Quitar un intento local requiere confirmación. Ese paso solo descarta la copia de recuperación.

## Limpieza pendiente

Cuando los cambios de una reunión requieren sincronizar sus tareas de limpieza, la misma escritura deja un indicador en la reunión. Si falla la segunda operación, la lista de **Administrar reuniones** muestra **Limpieza pendiente · Reintentar**. Functions usa el plan que está guardado cuando ejecuta el reintento y actualiza las tareas y el indicador en una transacción. Un reintento de una sincronización ya confirmada no repite la escritura. Los registros de limpieza existentes conservan estado, autor y personas asignadas.

La marca se genera con los guardados nuevos. Los planes históricos sin marca no se revisan de forma retroactiva.

## Historial y coincidencias

En **Editar reunión**, el historial muestra los últimos 20 cambios registrados por los flujos de edición de reuniones, de asignaciones del programa y de publicación. Identifica secciones añadidas, modificadas y eliminadas, con fecha y una indicación de si el cambio fue propio o de otro editor. Ante un conflicto, el formulario abre el historial sin perder el borrador que estaba en pantalla. La actualización y el evento se confirman juntos.

En **Asignaciones → Posibles duplicados**, una persona con permiso para gestionar asignaciones elige una reunión de la ventana operativa. El panel busca coincidencias entre las primeras 200 asignaciones por fecha registrada, categoría, título normalizado y persona o grupo. Los resultados son indicios. Cada fila permite abrir el detalle o editar la asignación y el panel deja la decisión a la persona autorizada. El historial también se puede consultar desde esa pantalla.

Las consultas están limitadas a la congregación. Los comprobantes y el historial viven en subcolecciones de la reunión y se accede a ellos mediante Functions. Se conservan las reglas de Firestore existentes y se usan consultas puntuales con los índices de campo disponibles.

## Validación local

- En Node 24.22.1 con `demo-omp` pasaron 330 pruebas de la app, 368 de Functions y 91 de reglas Firestore. También pasaron lint, tipos, compilación de Functions, Expo Doctor y exportación web.
- En Chromium pasaron ocho recorridos. Se verificó recuperar la misma asignación cuando se pierde la respuesta después del guardado, reintentar tras una recarga cuando la solicitud original no llega y recuperar una sincronización de limpieza pendiente. También se comprobó la consulta del historial y las coincidencias desde la pantalla de revisión.
- Functions verificó permisos insuficientes, consultas fuera de la congregación y un reintento posterior a la eliminación de la asignación. Quedan pendientes staging y las pruebas en dispositivos Android e iOS.
