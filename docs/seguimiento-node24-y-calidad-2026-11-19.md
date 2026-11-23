# Seguimiento de Node 24 y calidad de OMP

El [seguimiento de integridad y reconexión](seguimiento-integridad-y-reconexion-2026-11-19.md) documenta las correcciones de reintentos y edición simultánea aplicadas después de esta revisión.

## Firebase Functions y Codex Cloud

`functions/package.json` declara Node 24 y usa los tipos de la misma rama. Firebase CLI 15.36.0 registra `nodejs24` como disponible de forma general y el emulador cargó las funciones con Node 24. CI y `npm run quality:check` usan una sola instalación de Node 24. La app requiere al menos Node 24.12 dentro de esa rama. El entorno local se verificó con Node 24.22.1 y npm 11.19.1.

Node 22 era correcto para `1.54.4`, que declaraba esa versión en Functions y usaba Node 24 para Expo y Firebase JS. La activación anterior de Codex Cloud anteponía Node 22 en el `PATH`, por lo que una terminal podía elegirlo también en la raíz.

La activación actual de `/workspace/.omp-setup/runtime.sh` antepone Node 24.22.1. El instalador se ejecutó con éxito para la raíz de OMP, Functions y el panel administrativo. Si se abre una rama histórica que declara Node 22 en Functions, el instalador usa Node 22 para ese `npm ci` y mantiene Node 24 como versión de la sesión. La configuración reutilizable quedó guardada como borrador de Codex Cloud. Su publicación y la prueba de restauración en una instancia nueva siguen pendientes.

## Verificación local

| Control | Resultado |
|---|---|
| `npm run quality:check` | 330 pruebas de la app, 360 de Functions y 91 de reglas Firestore con `demo-omp`. Pasaron lint, TypeScript, compilación de Functions, verificación de reglas e índices, 21 comprobaciones de Expo Doctor y exportación web. |
| Playwright | Los cinco recorridos pasaron dos veces con dos workers en Chromium. Los emuladores de Auth, Firestore y Functions usaron `demo-omp` y Functions ejecutó Node 24. |
| Panel administrativo | Cinco pruebas unitarias, validación y build de Vite en Node 24. El servidor local devolvió `401 NO_TOKEN` para `/api/me` sin sesión. |

## Hallazgos y criterios de cierre

| Prioridad | Hallazgo | Avance y trabajo pendiente |
|---|---|---|
| P1 | Push al cerrar sesión o cambiar de cuenta | Sigue pendiente la revocación por instalación, su reconciliación tras recuperar conexión y la verificación con dos cuentas y dos dispositivos. La otra instalación de la misma cuenta debe seguir recibiendo avisos. |
| P1 | Stripe Endive | Los webhooks con firma sintética pasan en la suite local. En staging faltan Checkout, Portal, cobro, fallo y reenvío de eventos contra una cuenta Stripe de pruebas. |
| P1 | App Check | Faltan la atestación real web y nativa y la verificación de renovación. El emulador también emitió una advertencia por la lectura de `ENFORCE_APPCHECK_CRITICAL_CALLABLES` durante el descubrimiento. Verificar cómo se resuelve ese parámetro para el despliegue y confirmar que las llamadas críticas se rechazan según la configuración antes de ampliar la imposición. |
| P1 | Edición simultánea | `updateMeetingByManager` lee la reunión y escribe las secciones y el estado de publicación fuera de una transacción. Una escritura intercalada puede dejar obsoleta esa lectura. Sigue pendiente reproducirlo con dos clientes y comprobar que se conserven los cambios compatibles o se informe el conflicto. |
| P2 | Caché y solicitudes en vuelo | Una lectura invalidada todavía puede completarse para su solicitante original. Su resultado ya no puede actualizar memoria ni iniciar una escritura persistente cuando ha perdido la vigencia. Dos regresiones verifican invalidación de clave y cierre de sesión. Falta probar dos pestañas, reconexión, inicio en frío y escrituras que el almacenamiento ya recibió cuando se invalida la sesión. |
| P2 | Aislamiento Playwright | Cada prueba obtiene una cuenta y congregación sintéticas propias. El entorno de reglas se inicializa por worker y las rutas de documentos son distintas por escenario. La simulación de inactividad parte del reloj del emulador y el calendario espera a que aparezca el diálogo activo antes de enviar las teclas. |
| P2 | Dependencias transitivas | La actualización de tipos de Node tiene alcance de desarrollo. Los avisos de la revisión original requieren seguimiento por separado. |
| P2 | Hosting e índices | Pendientes el inventario remoto y las comprobaciones de CDN en staging, incluidas respuestas HTTP 200/304 y pestañas abiertas con una versión anterior. |
| P2 | Móvil y accesibilidad | Pendientes los artefactos nativos firmados y las pruebas en dispositivos con TalkBack, VoiceOver, escala de texto y notificaciones. |

## Runtime desplegado en Google Cloud

La configuración de OMP ya selecciona Node 24. El runtime de Google Cloud se confirma tras desplegar en un proyecto autorizado. La configuración del repositorio solo identifica producción. Este seguimiento se ejecutó localmente con `demo-omp`.

Con un ID de staging autorizado en `OMP_STAGING_PROJECT`, registrar primero el inventario desde la raíz de OMP y el runtime de una función representativa.

```sh
./node_modules/.bin/firebase functions:list --project "${OMP_STAGING_PROJECT:?}"
gcloud functions describe createMeetingByManager --gen2 --region=us-central1 \
  --project="${OMP_STAGING_PROJECT:?}" --format='value(buildConfig.runtime)'
```

Desplegar primero un conjunto acotado de Functions en staging. Repetir la consulta para comprobar `nodejs24` y probar autorización, creación de reuniones, registros y latencia de arranque. Registrar los resultados antes de ampliar el despliegue. Si falla la validación, volver a desplegar el mismo conjunto desde la revisión previa de staging con su runtime anterior.
