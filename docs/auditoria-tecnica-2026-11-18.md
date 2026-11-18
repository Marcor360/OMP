# Auditoría técnica de OMP

## A. Resumen ejecutivo

Auditoría de `Marcor360/OMP` sobre `98ec66f`, con validación local en Node 22 y Java 21. El inventario inicial contenía 834 archivos versionados. La revisión siguió rutas, servicios, repositorios, reglas y funciones de los flujos de reuniones, asignaciones, hospitalidad, autenticación, caché y notificaciones. Los demás dominios se inventariaron por sus rutas, servicios, documentación y pruebas disponibles. La revisión línea a línea de todos los módulos, las pruebas en dispositivos y la observación de producción quedan pendientes.

La separación entre Expo, repositorios de Firestore y Cloud Functions permite validar cada capa. La concurrencia entre dos caminos legítimos de escritura era el principal problema de integridad reproducido. Dos solicitudes podían crear reuniones distintas para la misma fecha y tipo. También se reprodujo una solicitud redundante de caché y se corrigió una prueba de integración que caducaba con el calendario.

## B. Mapa de arquitectura

| Capa | Código | Flujo y responsabilidad |
|---|---|---|
| Navegación y sesión | `app/`, `src/context/`, `src/lib/firebase/app.ts` | Expo Router protege las rutas según la sesión. Firebase Auth restaura la identidad. El perfil de usuario determina congregación, estado y acceso. |
| Reuniones y asignaciones | `src/screens/meetings/`, `src/modules/assignments/`, `src/services/meetings/` | Los editores forman DTO, el servicio llama a la función de administración y el repositorio vuelve a consultar después de invalidar. Hospitalidad se enlaza por ID de reunión y rol. |
| Datos y caché | `src/services/repositories/`, `src/services/session/` | Los repositorios combinan memoria, persistencia de OMP, caché del SDK y servidor. Web usa IndexedDB para la caché del SDK. La limpieza de sesión y el cambio de congregación forman parte del ciclo de lectura. |
| Autorización | `rules_src/`, `firestore.rules`, `functions/src/shared/` | Las reglas protegen lecturas y escrituras de cliente. Las mutaciones administrativas de reuniones y sus asignaciones anidadas pasan por funciones que comprueban rol, estado y congregación. |
| Backend y eventos | `functions/src/index.ts`, `functions/src/modules/`, `functions/src/billing/`, `functions/src/maintenance/` | Callables administrativos, triggers para proyecciones y notificaciones, trabajos programados para limpieza y reintentos, y webhooks de Stripe con registro de idempotencia. |
| Push | `src/services/notifications/`, `functions/src/modules/notifications/` | La app registra tokens Expo en dispositivos compatibles. El backend procesa envíos y recibos e invalida tokens que Expo marca como dados de baja. El registro remoto de Expo se omite en web. |
| Otros dominios | `src/modules/cleaning/`, `src/modules/field-service/`, `src/modules/organization/`, `src/services/` | Limpieza, predicación, territorios, organización, eventos, usuarios, facturación y panel de resumen tienen sus propios servicios. Los resultados de suites unitarias se limitan a los escenarios que estas cubren. |
| Entrega | `.github/workflows/ci.yml`, `firebase.json`, `eas.json`, `public/.htaccess` | CI valida app, Functions y reglas. Expo exporta el frontend web y EAS configura compilaciones móviles. Firebase despliega Functions y reglas por separado. |

### Flujos históricos examinados

- La generación de hospitalidad consulta por fecha y clasifica primero por categoría. Una reunión del mismo tipo ya reconocida conserva su ID y las asignaciones enlazadas. La regresión confirmada ocurría entre lecturas simultáneas. La asignación individual de hospitalidad usa la reunión seleccionada y un identificador derivado de reunión y rol.
- El autocompletado de reuniones consume planificación publicada de hospitalidad y limpieza por fecha y tipo. La búsqueda de personas y la publicación de una lista son flujos separados. La edición de reuniones conserva las secciones que controla asignaciones en el servidor. Queda pendiente probar la sincronización de punta a punta cuando se edita la fecha y existe planificación publicada.
- Presidencia, puerta, auditorio y acomodador extra tienen claves distintas. La política de elegibilidad requiere anciano o siervo ministerial para estos roles. Se revisaron los filtros de candidatos y las comprobaciones del servidor contra duplicados, presidencia previa y salida a discursar. La prueba existente comprueba el caso del presidente histórico guardado solo por nombre.
- `UserPickerModal.tsx` ya incluye lupa, etiqueta accesible y búsqueda por nombre o correo con normalización de acentos. `AssignmentFormScreen.tsx` ya utiliza `DatePickerModal` y tiene manejo de errores de guardado. La revisión fue estática para la interacción visual, el teclado y los lectores de pantalla.

## C. Inventario de hallazgos

| ID | Problema | Ubicación | Severidad | Impacto | Estado |
|---|---|---|---|---|---|
| BUG-001 | Reuniones duplicadas o reintento de planificación fallido | `functions/src/meetings-management.ts`, `functions/src/planning-schedules.ts` | P1 | Dos calendarios pueden mostrar documentos distintos para la misma reunión y dividir asignaciones por ID. | Corregido mediante transacciones y verificado en emulador. |
| PERF-001 | La invalidación y finalización de lecturas dejan de deduplicar solicitudes | `src/services/repositories/session-cache.ts` | P2 | Lecturas redundantes y resultados compartidos de una solicitud anterior a la invalidación. | Corregido y verificado en Jest. |
| QA-001 | Datos fijos vencen en una prueba de hospitalidad | `functions/src/__tests__/hospitality-callables.emulator.test.ts` | P2 | El escenario de borrador, publicación y archivo falla por calendario. | Corregido y verificado en emulador. |
| SEC-001 | Avisos críticos en dependencias transitivas | `package-lock.json`, `functions/package-lock.json` | P1 en seguimiento de dependencias | Afecta a las herramientas o paquetes de los que dependen. La exposición de cada ruta en un artefacto desplegado requiere verificación. | Tres parches aplicados. Persiste el aviso crítico de `tar` en la raíz. |
| LOGIC-001 | Riesgo de sobrescritura concurrente en edición de reuniones | `updateMeetingByManager` | P1 potencial | La edición de reunión preserva secciones de una lectura previa. Una escritura de asignaciones intercalada podría quedar desplazada. | Pendiente de una prueba determinista y de revisar los dos editores. |
| PERF-002 | Lecturas de asignaciones por reunión cuando se usa la ruta alternativa | `firestore-assignment-repository.ts` | P3 | El número de consultas depende del número de reuniones de la vista en esa ruta. | Estructura confirmada. Impacto real pendiente de medir. |
| OPS-001 | Revalidación de HTML del despliegue web pendiente de comprobar | `public/.htaccess`, `scripts/copy-web-htaccess.js` | P3 | El servidor externo o su CDN pueden determinar cuánto tarda un navegador en recibir HTML nuevo. | Política efectiva sin verificar. La configuración versionada aporta reglas de reescritura. |

## D. Cambios implementados

- **BUG-001, tipo A.** La validación del rango y la escritura se hacen en la misma transacción. Planificación conserva la lectura agrupada de fechas y vuelve a calcular los contadores durante un reintento de Firestore. Se conservaron los formatos de ID y el enlace de asignaciones por ID. Antes del cambio fallaban una prueba con dos solicitudes de planificación y otra con creación manual simultánea. Se añadió también una prueba de reutilización de la reunión existente. El riesgo operativo es mayor contención ante muchas peticiones sobre el mismo rango. El emulador verifica el resultado de los casos ensayados. Para la edición de fechas concurrente y datos históricos sin `meetingDate` queda una revisión específica.
- **PERF-001, tipo A.** Se invalida la clave de solicitud correspondiente a la clave de datos y una promesa finalizada solo elimina su propia entrada. El caso de regresión devolvía «duplicate» donde el consumidor debía unirse a la lectura de reemplazo. La prueba comprueba que ambos consumidores compartan exactamente la misma promesa. La protección del registro de solicitudes y la consistencia de las escrituras tardías de valores persistentes son aspectos distintos. Revisar el segundo caso requiere pruebas adicionales de almacenamiento.
- **QA-001, tipo A.** Las fechas de los borradores de prueba se calculan a partir de dos sábados futuros. La prueba conserva sus llamadas y aserciones sobre guardar, publicar y archivar. Las fechas de fixtures históricos que no dependen de la ventana siguen siendo fijas.
- **SEC-001, tipo A.** Se actualizaron dependencias transitivas dentro de los rangos aceptados por sus consumidores. El informe de avisos describe el árbol instalado y no demuestra un problema explotable en OMP.

## E. Rendimiento

La regresión de caché pasa de tres ejecuciones de la fábrica a dos en el escenario de invalidación reproducido. Las dos solicitudes corresponden al estado previo y posterior a invalidar. No se midió una reducción de latencia ni de facturación. La planificación conserva una consulta de rango por intento de transacción. Firestore puede repetirla bajo contención. Para PERF-002, medir cantidad de consultas y p95 con una congregación de prueba y datos representativos antes de modificar los índices o quitar el respaldo de compatibilidad.

## F. Dependencias

| Dependencia | Anterior | Nueva | Motivo y compatibilidad |
|---|---:|---:|---|
| `proxy-addr` | 2.0.7 | 2.0.8 | Parche de seguridad dentro del rango que usa Express en Firebase CLI. |
| `shell-quote` | 1.10.0 | 1.12.0 | Corrección de avisos en el rango aceptado por React DevTools. |
| `handlebars` | 4.7.9 | 4.7.10 | Parche aceptado por la dependencia de pruebas `ts-jest`. |
| `expo-splash-screen` | 57.0.9 | 57.0.11 | Versión esperada por Expo SDK 57. Actualiza dependencias del plugin nativo. Validado con introspección de configuración, con compilación nativa pendiente. |
| `jest-expo` | 57.0.5 | 57.0.6 | Versión esperada por Expo SDK 57. Validada con la suite de la aplicación. |

`npm ci` instaló ambos lockfiles. `npm audit` pasó de 62 a 57 entradas en la raíz y de 17 a 16 en Functions. Las entradas críticas pasaron de 3 a 1 en la raíz y de 1 a 0 en Functions. Son conteos de paquetes reportados por npm. La auditoría conserva salida distinta de cero por avisos pendientes.

`npm outdated` identificó 48 entradas en la raíz antes de los cambios. Entre las actualizaciones dentro del SDK actual figuraban Expo 57.0.22 → 57.0.33 y Expo Router 57.0.21 → 57.0.31. Expo 58, React Native 0.88, Firebase JS 13 y Firebase CLI 15 requieren una evaluación de compatibilidad independiente. Para `tar@6.2.1`, el arreglo propuesto por npm cambia de versión mayor de Firebase CLI. Conviene validar una versión mantenida de la CLI con emuladores y el flujo de despliegue en un entorno de pruebas, sin aplicar `npm audit fix --force`.

## G. Firebase y Google Cloud

- **Código.** Se modificaron las funciones de creación manual y generación de planificación. Estas correcciones usan las colecciones y las consultas existentes.
- **Firebase CLI, tipo B.** La entrega a un entorno de pruebas requiere que el propietario identifique y autorice ese proyecto. Con Node 22, Firebase CLI instalada, sesión válida e IAM de lectura, ejecuta `./node_modules/.bin/firebase functions:list --project "$OMP_STAGING_PROJECT"` para comprobar el destino y los nombres. Es una consulta. Para publicar exclusivamente las dos funciones, con aprobación e IAM de despliegue, ejecuta primero `npm --prefix functions run build` y luego `./node_modules/.bin/firebase deploy --project "$OMP_STAGING_PROJECT" --only functions:createMeetingByManager,functions:ensurePlanningMeetingsByManager`. El segundo comando cambia funciones remotas. Verifica con el listado y una prueba concurrente en una congregación de prueba. Las reuniones duplicadas anteriores requieren reconciliación de sus referencias antes de considerar una fusión.
- **Firebase Console, tipo C.** No se confirmó un ajuste obligatorio para estas correcciones. Para verificar el índice opcional de traslape, selecciona el proyecto de pruebas y abre Firestore Database → Indexes → Composite. Revisa los índices activos y contrasta cualquier error de la consulta de `startDate` y `endDate` durante el smoke test. Leer el inventario no cambia recursos. Crear un índice requiere aprobación, compilación y revisión de costos. La lista local de índices y el emulador no establecen qué índices están desplegados. El arranque local también emitió un aviso del SDK al resolver el parámetro de App Check durante el descubrimiento de funciones. Para verificar App Check antes de cualquier imposición, abre Firebase Console → App Check en el proyecto autorizado, revisa el registro de las aplicaciones y valida tokens en web, Android e iOS según `docs/app-check-rollout.md`. La prueba local utilizó la configuración predeterminada del proyecto demo.
- **Google Cloud, tipos D/E.** La auditoría local no confirmó cambios de infraestructura requeridos. Tras un eventual despliegue autorizado, abre Logs Explorer en el proyecto de pruebas y selecciona los servicios de las dos funciones. Comprueba errores, reintentos y latencias con datos sintéticos. Esta consulta requiere acceso de lectura a logs. Mantén cualquier dato personal fuera de los resultados compartidos.

## H. Resultados de pruebas

| Prueba | Resultado | Evidencia y observaciones |
|---|---|---|
| Lint, TypeScript y Jest de la app | Correcto | 51 suites y 322 pruebas aprobadas, con 2 snapshots. |
| Lint y compilación de Functions | Correcto | ESLint y TypeScript completaron. |
| Jest de Functions con Firestore | Correcto | 35 suites y 354 pruebas aprobadas, incluidos los casos de generación concurrente y hospitalidad. |
| Reglas e índices locales | Correcto con omisiones existentes | 21 combinaciones de campos comprobadas. El archivo generado coincide con `rules_src`. 8 suites de reglas, 80 pruebas aprobadas y 3 omitidas. |
| Compilación web | Correcto | Exportación de Expo y copia de los archivos web completadas. |
| Compatibilidad Expo y Doctor | Correcto | Compatibilidad dentro del SDK 57 con las exclusiones establecidas por OMP. Expo Doctor aprobó 21 comprobaciones. |
| E2E web con Auth, Firestore y Functions | Correcto | 2 pruebas de Playwright con Chromium del sistema. Inicio de sesión de prueba y expiración por inactividad en `demo-omp`. Se usó un archivo temporal de configuración para Chromium y un parámetro local de App Check. |
| Configuración nativa | Análisis local | Expo evaluó los plugins Android e iOS con `expo config --type introspect`. Compilación e instalación en dispositivo pendientes. |

Para repetir las suites de Firestore en un proyecto de demostración usa Node 22 y Java 21 en la raíz de OMP:

```bash
npm --prefix functions run build
npm run check:indexes
npm run check:rules
./node_modules/.bin/firebase emulators:exec --only firestore --project demo-omp   'npm --prefix functions test -- --runInBand && npm exec -- jest --config jest.rules.config.js --runInBand --detectOpenHandles --forceExit'
```

## I. Riesgos pendientes

- Revisar la edición concurrente entre datos de reunión, asignaciones y publicación. Añadir casos de edición intercalada, traslado de fecha con asignaciones existentes y registros históricos.
- Verificar las tres variantes de creación de horarios de limpieza omitidas en la suite de reglas. El repositorio documenta límites de evaluación de expresiones. Las omisiones dejan esos casos positivos sin evidencia de ejecución.
- Completar la evaluación de avisos transitivos de nivel alto, de la instalación nativa, de las entregas de Expo Push y de la renovación de tokens en dispositivos. El análisis estático de registro y despacho no cubre primer y segundo plano en un dispositivo real.
- Comprobar en el hosting de pruebas los encabezados y la actualización de una pestaña ya abierta. Las reglas de reescritura locales no permiten inferir los encabezados del CDN.
- Completar la revisión funcional y de accesibilidad de módulos secundarios y las pruebas visuales en móvil.

## J. Continuidad

1. Verificar concurrencia de edición y publicación. Medir los registros históricos candidatos a duplicado en un proyecto autorizado antes de tocar datos.
2. Recuperar cobertura de las tres reglas omitidas y evaluar la actualización mantenida de Firebase CLI junto con los avisos restantes de dependencias de aplicación.
3. Medir las consultas alternativas de asignaciones y probar actualización web, persistencia sin conexión y notificaciones en dispositivo.
4. Ampliar escenarios funcionales y de teclado para selección, calendario y confirmación de operaciones en los módulos inventariados.
