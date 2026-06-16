# QA De Notificaciones

No usar Expo Go como prueba final. Validar en development build o release.

## Preparacion

- Firebase project correcto seleccionado.
- Android channel creado.
- Permiso de notificaciones otorgado desde la app.
- Usuario activo con `congregationId`.
- Token guardado en `/users/{uid}/pushTokens/{tokenDocId}`.
- No existen tokens globales sin usuario/congregacion.

## Casos

| Caso | Rol | Plataforma | Resultado esperado |
| --- | --- | --- | --- |
| Registrar token nuevo | Usuario normal | Android fisico | Se crea subdocumento propio de push token |
| Token invalido | Usuario normal | Android fisico | Backend desactiva token ante `DeviceNotRegistered` |
| Notificacion de reunion | Usuario destinatario | Android/iOS | Llega push y deep link abre pantalla correcta |
| Notificacion de limpieza | Usuario asignado | Android/iOS | Llega solo a la congregacion correcta |
| Notificacion de billing | Usuario autorizado | Android/iOS/Web | Solo usuarios con visibilidad de cobro ven aviso |
| Contador no leidas | Usuario normal | Android/iOS/Web | Badge incrementa y baja al marcar leido |
| Marcar una como leida | Destinatario | Android/iOS/Web | Solo cambia la notificacion del usuario |
| Marcar todas como leidas | Destinatario | Android/iOS/Web | No afecta usuarios de otra congregacion |
| Deep link protegido | Sin sesion | Android/iOS | Redirige a login y conserva destino seguro |

## Evidencia Minima

- Captura de token en Firestore.
- Captura de push recibido.
- Captura de pantalla destino abierta por deep link.
- Log de Functions para envio exitoso y token invalido.
