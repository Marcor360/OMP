# Carga de asignaciones, Push y comparación de borradores

## Asignaciones y conexión

«Mis asignaciones» carga el programa y las tareas de reunión por un lado y las tareas independientes por otro. Si falla una fuente, conserva lo que ya se mostró y ofrece un reintento de las fuentes pendientes. Un resultado local vacío que nunca se verificó en el servidor tampoco cuenta como una lectura correcta de asignaciones independientes. El refresco se identifica por cuenta, congregación y rango. Una respuesta anterior ya no puede reemplazar la vista activa.

El programa usa la misma proyección y el mismo identificador en lista y detalle. Los enlaces antiguos con reunión y clave todavía tienen una ruta de lectura. Las asignaciones del programa se siguen editando en el editor de la reunión y los documentos individuales conservan sus rutas. Las consultas siguen dentro de la congregación y no se agregan índices ni escuchas de Firestore.

En Chromium se observaron tres consultas distintas al servidor para una congregación sintética con una reunión. La carga consultó el rango de reuniones, las asignaciones de esa reunión y las asignaciones independientes. Con más reuniones se añade una consulta por reunión dentro de la ventana y los límites actuales. Esta medición cuenta consultas y no lecturas facturadas de documentos.

En «Guardados por confirmar», la consulta recorre los intentos en grupos de cuatro. Un error queda visible y el resto del grupo y los siguientes grupos se siguen comprobando. Cada consulta tiene un tiempo máximo. En web vuelve a comprobarse cuando vuelve la conexión. El reintento de escritura mantiene la clave original.

## Notificaciones por instalación

Functions asocia cada token Expo con la cuenta activa. Para cambiar el dueño de un token ya vinculado a otra cuenta, el dispositivo presenta la credencial aleatoria de la vinculación anterior. Una comprobación de sesión y congregación respalda el alta. Al salir, se registra localmente la desvinculación y se reintenta al recuperar conexión, incluso después de cerrar sesión. El servidor retira solo esa instalación. Una petición tardía de desvinculación queda limitada a la vinculación que la originó.

Durante un cierre sin red, el servidor puede conservar la vinculación hasta recibir el reintento. El aviso remoto usa un título y un texto genéricos para que ese intervalo no revele el contenido en la pantalla bloqueada. Los detalles siguen en la app. Los registros de versiones anteriores todavía requieren una actualización del dispositivo para entrar al flujo de vinculación.

El registro y los comprobantes de revocación se almacenan en colecciones privadas para Functions. El servidor conserva una huella de la credencial. Queda pendiente verificar Android e iOS con dos cuentas y dos dispositivos reales, incluida la rotación del token y el cierre sin conexión.

El recorrido de dispositivos debe verificar que la cuenta A recibe avisos en ambos, que al salir de A en uno de ellos el otro sigue recibiendo, y que al iniciar B en el primero llega solo el aviso de B. Conviene repetir el cierre sin red y recuperar la conexión en la pantalla de inicio de sesión. Los detalles de una notificación deben permanecer en la cuenta que puede abrirlos.

## Revisión de reuniones

Al detectar un conflicto, el editor consulta la reunión directamente en el servidor y muestra «Mi borrador» y «Versión actual». En el editor de asignaciones se pueden conservar las secciones que cambió solo una persona y elegir de forma explícita cuando ambos editaron la misma. Aplicar el resultado actualiza el borrador local y la versión de referencia. El guardado posterior vuelve a comprobar la versión en Firebase. En el editor general, la comparación de secciones se ofrece como consulta.

La revisión de posibles duplicados muestra cuántas asignaciones se analizaron y el límite de 200. Se pueden filtrar los grupos por fecha y por el estado de al menos una asignación. El grupo sigue completo para comparar registros con estados distintos.

## Validación local

- Pasaron 336 pruebas de la app, 369 de Functions y 91 de reglas Firestore con el proyecto sintético `demo-omp`. Las regresiones cubren la respuesta tardía, el reintento parcial, 25 intentos de guardado con una consulta fallida, la comparación de secciones y la desvinculación de dos cuentas y dos instalaciones simuladas.
- Pasaron ocho recorridos en Chromium, incluidas la recuperación tras recargar y la revisión de duplicados. También pasaron lint, tipos, la compilación de Functions, las 21 comprobaciones de Expo Doctor y la exportación web.
- El despliegue en staging y la entrega en dispositivos físicos quedan pendientes.
