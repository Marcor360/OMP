# App Check nativo: decisión e implementación futura

## Estado y arquitectura actual

OMP usa el SDK JavaScript de Firebase (`firebase/app`, `firebase/firestore` y
`firebase/functions`) tanto en Expo/React Native como en Web. El mismo
`FirebaseApp` se inicializa en `src/lib/firebase/app.ts`.

Web ya inicializa App Check con `ReCaptchaV3Provider` cuando existe
`EXPO_PUBLIC_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY`. Android e iOS todavía no
generan un token App Check. La protección de las callables administrativas se
prepara con el parámetro de Functions
`ENFORCE_APPCHECK_CRITICAL_CALLABLES`, cuyo valor por defecto es `false`.

No se habilita enforcement en Firestore ni Functions en esta entrega.

## Opciones evaluadas

| Opción | Resultado |
| --- | --- |
| reCAPTCHA v3 del SDK JS | Válida sólo para Web; no acredita una instalación nativa. |
| `CustomProvider` del SDK JS con bridge Expo nativo | Técnicamente posible: la tabla de compatibilidad del SDK JS enumera React Native con un proveedor personalizado y atestación nativa. Requiere crear y mantener el bridge, atestación Play Integrity/App Attest y un backend que valide el proof antes de emitir el token. No existe ninguno de esos componentes en OMP. |
| Instalar sólo `@react-native-firebase/app-check` | No es suficiente: el tráfico actual de Firestore/Functions sale del SDK JS, no de RNFirebase, por lo que un token obtenido por esa pila no demuestra que el mismo `FirebaseApp` JS lo adjunte. |
| Migrar Firestore/Functions a RNFirebase | Posible, pero es una migración transversal de persistencia, auth, pruebas y Web; queda fuera de una preparación segura de App Check. |

Firebase documenta `CustomProvider` para el SDK JS y exige que el proveedor
obtenga una prueba y la intercambie con un servicio seguro por un token; ese
servicio usa Admin SDK para emitirlo. Véanse la [compatibilidad del SDK
JavaScript](https://firebase.google.com/docs/web/environments-js-sdk), el
[proveedor personalizado web](https://firebase.google.com/docs/app-check/web/custom-provider)
y la guía de [proveedores personalizados](https://firebase.google.com/docs/app-check/custom-provider).

## Decisión

El bloqueador actual es la ausencia de un bridge nativo de atestación y de su
verificador de servidor. No se implementa un `CustomProvider` simulado ni se
instala RNFirebase como señal de seguridad: ambos podrían permitir activar
enforcement sin que Firestore/Functions del SDK JS reciban un token verificable.

La opción elegida para una fase posterior es un `CustomProvider` del SDK JS
alimentado por un módulo Expo nativo propio. El módulo debe obtener Play
Integrity en Android y App Attest/DeviceCheck en iOS; un endpoint autenticado y
con rate limit verificará cada prueba y emitirá un token App Check de TTL corto.
El provider se debe inicializar antes de `getFirestore(app)` y
`getFunctions(app)`.

## Cambios futuros y pruebas físicas obligatorias

1. Construir el módulo Expo nativo y el endpoint de intercambio; no exponer
   credenciales de Admin SDK al cliente.
2. Activarlo sólo tras una bandera de configuración para development builds.
3. En Android físico, iPhone físico y Web de producción, comprobar en métricas
   de App Check solicitudes válidas de Firestore y Cloud Functions del mismo
   `FirebaseApp` usado por OMP.
4. Probar token expirado, pérdida de red, reinstalación, simulador/emulador y
   refresh en segundo plano. CI y desarrollo deben usar proveedores debug
   permitidos explícitamente, nunca claves de producción.
5. Mantener al menos una ventana de monitorización sin enforcement y medir
   rechazos por plataforma.

## Rollout y rollback

Cuando las pruebas anteriores estén completas, desplegar Functions con
`ENFORCE_APPCHECK_CRITICAL_CALLABLES=true` para las cinco callables de usuarios
administrativas. Esa única configuración alimenta `criticalCallableOptions`;
no hay que editar cada handler. Verificar métricas y errores durante una ventana
controlada antes de ampliar a publicaciones y a Firestore.

Para rollback, redeplegar con el parámetro en `false`. El enforcement de
Firestore sólo se habilita desde Firebase Console después de la validación de
los tres clientes, y se revierte allí si el monitoreo detecta clientes legítimos
sin token. App Check complementa Auth y Firestore Rules; no sustituye los
guards por `congregationId`, billing ni autorización del servidor.
