# Estabilización de OMP para la versión completa

## Push y Firebase

- Un recibo o ticket tardío solo puede invalidar la versión exacta del token que se usó para el envío. Si la instalación se registró de nuevo, el recibo anterior no cambia ese registro. Si se eliminó, tampoco vuelve a crear el documento.
- El alta se reintenta con espera progresiva ante un fallo transitorio. También se revisa al volver al primer plano. En Ajustes se distinguen el permiso concedido por el teléfono y el registro confirmado por el servidor. Desde ahí se puede volver a intentar el alta.
- Las vistas previas de Push usan el idioma registrado en esa instalación. Muestran un aviso genérico y mantienen el contenido en la sesión autorizada de OMP. Los tokens anteriores que aún carecen de idioma conservan la vista previa bilingüe.
- Las reglas impiden que un cliente modifique o borre un registro de Push administrado por Functions, incluso si el propio usuario puede leer su estado. Se conserva el flujo anterior para registros legados. Los comprobantes privados de instalación y revocación quedan fuera del acceso directo de los clientes.

## Interfaces y traducción

- Inicio de sesión, el formulario de asignaciones, las secciones de Administración de reuniones y los pasos principales del editor de reuniones tienen etiquetas en español e inglés. Se complementó el foco mediante lectores de pantalla con nombres de campos, roles de botón y estados de selección.
- El motor de traducciones acepta los dos formatos de variables existentes en los catálogos y hay una prueba que verifica que tengan las mismas claves. El texto que una persona introduce se conserva en su idioma. Queda revisar textos fijos de componentes secundarios y mensajes de error procedentes de servicios.
- Las personas con permiso para gestionar asignaciones pueden abrir su editor desde el detalle. Un usuario ordinario recibe una vista de acceso restringido. Al editar una asignación existente se muestra su destinatario y se conserva el vínculo, incluidos los casos con grupos de limpieza.

## Criterios para salir de beta

| Punto | Evidencia requerida |
|---|---|
| Staging | Proyecto autorizado, runtime Node 24 confirmado en Google Cloud y pruebas de permisos por rol, por congregación y con sesiones inactivas. |
| Push real | Builds de Android e iOS con credenciales de prueba. Dos dispositivos y dos cuentas para comprobar entrega con la app abierta, en segundo plano y cerrada, cambio de cuenta, cierre sin red y recuperación. |
| App Check y pagos | Comprobar los proveedores y la renovación de App Check. Validar Checkout, Portal, cobro fallido y el reenvío del webhook en Stripe de pruebas. |
| Accesibilidad y entrega | Recorrido de los formularios con TalkBack, VoiceOver y texto ampliado. Verificar builds firmados, revisar la versión remota y preparar la publicación numérica. |

La fase actual usa `demo-omp` para validación local. El repositorio solo identifica el proyecto de producción. El despliegue y la validación real quedan pendientes de staging autorizado.

## Comprobaciones locales

- Pasaron 338 pruebas de la app, 371 de Functions y 92 de reglas Firestore. También pasaron lint, TypeScript, compilación de Functions, las 21 comprobaciones de Expo Doctor y la exportación web.
- Pasaron 10 recorridos en Chromium, entre ellos inicio de sesión y formulario en inglés, acceso restringido para un usuario ordinario, recuperación de asignaciones y calendario con teclado.
- El español y el inglés tienen 1,132 claves cada uno. Se verificaron nombres de variables en los dos catálogos y la sustitución de variables con ambos formatos de llaves.
