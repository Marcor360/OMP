# Informes, barridos y OMP Admin

## Informes y descargas de OMP

El encargado de predicación puede descargar dos plantillas desde su panel del mes. El resumen CSV contiene los indicadores y el detalle distingue los informes recibidos de los pendientes. El CSV incluye los campos necesarios para llevar el control y excluye comentarios privados, correos e identificadores internos. Se escapan comillas, separadores y valores que una hoja de cálculo interpretaría como fórmulas.

La descarga toma los datos que ya están en pantalla. Web usa un archivo local y Android/iOS usan la opción de compartir del sistema con un archivo temporal. El mes se presenta en el idioma activo y la navegación impide avanzar a meses futuros. El formulario admite horas decimales con punto o coma, bloquea envíos simultáneos y conserva los datos si el guardado falla.

El panel reutiliza por hasta un minuto el último resultado del mes en memoria de sesión, comparte la consulta mientras está en curso e invalida el resultado tras un guardado local. Si vence el minuto o se pulsa Actualizar, pide el mes al servidor y muestra el error si falla. Las respuestas tardías de otro mes o congregación no reemplazan los datos activos.

## Barridos existentes

- Los informes quedan fuera de las rutas elegibles. La retención de seis meses se calcula con el calendario de Ciudad de México. Para una reunión se usa su fecha válida más reciente. Los perfiles protegidos se conservan y un perfil inactivo requiere una fecha de desactivación explícita. Si existen varias, se usa la más reciente.
- El barrido usa la versión leída como condición de borrado. La limpieza posterior conserva una reunión que se recreó antes de procesar su evento de borrado. Los archivos se consideran solo dentro del bucket configurado y de la carpeta de la congregación. Si la referencia es ambigua o el archivo no se puede borrar, se conserva el registro para revisión.
- Los avisos expirados limpian sus registros internos de envío antes de eliminar su documento principal. La migración de avisos legados conserva los que carecen de datos para ubicarlos y avanza por cursor. El barrido de eventos también avanza aunque encuentre un registro sin congregación válida. Los territorios de meses anteriores se borran por lotes acotados y con el mes calculado en la zona operativa.

Se mantienen las programaciones existentes. No se activaron tareas, Firestore TTL, buckets ni planes de pago. Estas funciones siguen sujetas a las cuotas y condiciones del proyecto donde se desplieguen. La revisión y las pruebas de borrado se realizaron sobre datos sintéticos.

## OMP Admin

La lista de congregaciones permite buscar por nombre, clave o dominio y filtrar por estado sin volver a consultar Firestore. Dashboard, lista y resumen de congregación comparten lecturas concurrentes y conservan el resultado durante 30 segundos por proceso. Las mutaciones del panel invalidan el caché, incluso si fallan tras una escritura parcial. Cada ruta conserva la validación del propietario antes de acceder a los datos.

El Excel de datos generales y usuarios tiene encabezados fijos y filtro en la hoja de usuarios. El servidor termina de generar el archivo antes de responder y la descarga comprueba que la respuesta sea un Excel. Si falla, la interfaz interrumpe el flujo de eliminación. El archivo excluye reuniones, informes y otros datos operativos. Su descarga tampoco constituye una confirmación de que el navegador guardó el archivo en disco.

## Validación

- OMP pasó 340 pruebas de aplicación, 373 de Functions y 92 de reglas de Firestore. También pasaron la comprobación de tipos, lint y la compilación web.
- Pasaron los 11 recorridos en Chromium. El del encargado de predicación verificó ambas descargas y comprobó que el detalle omite comentarios privados y neutraliza fórmulas.
- OMP Admin pasó sus 7 pruebas y compiló con Vite. La ruta de congregaciones devolvió HTTP 401 al probarla sin token.
- Expo Doctor pasó 20 de 21 comprobaciones con acceso a Expo. El catálogo remoto solicita cinco versiones de parche más recientes y npm rechazó `expo-notifications` con el mínimo de siete días que establece `.npmrc`. Las versiones instaladas pasaron la comprobación con el catálogo local del SDK.
- La validación usó emuladores y datos sintéticos. Quedan por verificar el compartir archivos en Android e iOS y el comportamiento en staging con datos de prueba.
