# Seguimiento de Firestore y dependencias de OMP

Base de trabajo `a5f25f7` de `Marcor360/OMP`. La validación utiliza Node 22.22.0, Java 21 y el proyecto local `demo-omp`.

## A. Reglas

Al reactivar las tres pruebas con las reglas originales y el emulador 1.19.8, el permiso explícito `limpieza.manage` pasó. La rama de cargo y la de `serviceAssignmentKeys` agotaron el máximo de 1.000 expresiones. La creación combinaba dos predicados de acceso que volvían a obtener y validar el perfil activo, la congregación y el acceso administrativo.

La creación y edición de horarios e ítems comparten ahora `canManageCleaningSchedule`. El predicado comprueba perfil activo, autorización de limpieza, misma congregación, bloqueos de congregación y sistema y facturación administrativa. Los validadores de campos, autor e inmutabilidad de metadatos siguen aplicándose a cada escritura. Las comprobaciones comunes de acceso evalúan el vencimiento solamente cuando existe una señal de bloqueo que lo requiere.

Las tres pruebas se ejecutan sin `skip`. Se añadieron ocho escenarios que cubren documentos de sistema sanos con facturación activa, aislamiento, inactividad, restricciones de facturación, mantenimiento, vencimiento, metadatos de creación y escritura de ítems. Quedan pendientes la verificación en un proyecto remoto autorizado y los casos de frontera con documentos históricos que difieran de los fixtures.

## B. Consultas e índices

| Operación | Consulta relevante | Índice local |
|---|---|---|
| Vista y rango de reuniones | Rango por `meetingDate` o `startDate` en las reuniones de una congregación. | Índice de campo simple. Los compuestos existentes cubren también organizador, asistentes y fecha. |
| Detección de traslapes en Functions | `endDate >= inicio` y `startDate <= fin`, orden ascendente por `endDate` y `startDate`. | Compuesto de alcance `COLLECTION` añadido. El orden y el límite de 120 quedan explícitos. Las consultas de compatibilidad por campos independientes se conservan. |
| Rango de asignaciones de una reunión | `dueDate` ascendente y dentro del rango, con filtros opcionales por `assignedToUid` y `status`. | Campo simple sin filtros. Tres compuestos `COLLECTION` añadidos para los filtros individuales y combinados, con igualdades antes de `dueDate`. También sirven a las consultas por usuario o estado con el mismo orden. |
| Listener de asignaciones | `collectionGroup('assignments')` por `congregationId` y rango de `dueDate`. | Compuesto `COLLECTION_GROUP` existente `congregationId ASC, dueDate ASC`. |
| Planificación | Rango por `meetingDate`, búsquedas por fechas exactas y estado y consultas por fecha, tipo y estado de ítems. | El rango usa campo simple. Las igualdades por colección pueden combinar índices. El compuesto de ítems y el de salida a discursar ya existen para sus consultas relacionadas. |
| Historial y limpieza programada | `collectionGroup` filtrado y ordenado por la fecha de corte. | Overrides de alcance `COLLECTION_GROUP` ya declarados para fechas como `endDate` en reuniones y `dueDate` en asignaciones. |

El verificador comprueba los 21 pares colección/campo ya auditados y los cuatro nuevos compuestos con su alcance y orden. Los compuestos añaden almacenamiento, trabajo de construcción y mantenimiento de entradas al escribir. El orden inicial por `endDate` permite excluir periodos ya terminados en la búsqueda de traslapes. La selectividad y el coste efectivos deben medirse con Query Explain y datos representativos en el proyecto autorizado.

### Benchmark reproducible de asignaciones

```bash
./node_modules/.bin/firebase emulators:exec --only firestore --project demo-omp \
  'node scripts/benchmark-assignment-queries.cjs'
```

El script añade 24 reuniones y 192 asignaciones sintéticas, precalienta ambas estrategias y alterna 12 ejecuciones por estrategia. Comprueba las rutas exactas devueltas y elimina sus datos al terminar. Usa el SDK Admin y el emulador local. Las cifras son documentos devueltos y tiempo de la operación, no lecturas facturadas ni latencia remota.

| Estrategia | Consultas | Documentos devueltos | Asignaciones | p50 | p95 |
|---|---:|---:|---:|---:|---:|
| Rango por reunión | 25 | 216 | 192 | 54 ms | 101 ms |
| Consulta agrupada | 2 | 216 | 192 | 25 ms | 45 ms |

Una segunda ejecución, tras instalar los lockfiles finales y correr las suites, mantuvo 25 y 2 consultas y 216 documentos devueltos. El p50 fue 48 y 24 ms. El p95 fue 489 y 41 ms, respectivamente. La variación entre ejecuciones impide usar esos tiempos como previsión de producción.

Al añadir una asignación histórica sin `congregationId`, la consulta agrupada la omitió. El flujo de la vista también combina documentos de programa incrustados, asignaciones independientes y límites por reunión. Se conserva la lectura por reunión para evitar esa pérdida de cobertura. La medición no incluye uso de memoria aislado ni lecturas de entradas de índice. La vista actual usa límites fijos y carece de cursor para esas listas. La paginación completa requiere comprobar qué carga espera cada consumidor y cómo integrar las tres fuentes de asignaciones.

La consulta alternativa del repositorio tiene la misma forma para dos rangos con el mismo filtro y límite. Ahora usa la misma clave de caché, conserva el filtro del rango sobre el resultado y solo se intenta tras un `failed-precondition`, como sucede cuando falta un índice. Una prueba del repositorio confirmó una sola carga alternativa para dos rangos superpuestos, aislamiento entre usuarios y propagación de `permission-denied` sin una segunda consulta.

## C. Dependencias

| Dependencia | Anterior | Candidata | Riesgo y estado |
|---|---:|---:|---|
| Firebase CLI | 14.27.0 | 15.36.0 | Actualización mayor de herramienta de desarrollo. El emulador pasa de 1.19.8 a 1.22.0. Probada localmente con Node 22 y Java 21. Despliegue remoto pendiente de validación autorizada. |
| `tar` de Firebase CLI | 6.2.1 | 7.5.23 | Cambio transitivo provisto por la CLI. Retira la versión con aviso crítico. |
| Expo | 57.0.22 | 57.0.33 | Parche dentro de SDK 57. Compatibilidad y compilación web. |
| `expo-constants` | 57.0.18 | 57.0.24 | Parche del catálogo de SDK 57. |
| `expo-linking` | 57.0.10 | 57.0.14 | Parche del catálogo de SDK 57. |
| `expo-notifications` | 57.0.18 | 57.0.25 | Parche del catálogo. La entrega push en dispositivos sigue pendiente. |
| Expo Router | 57.0.21 | 57.0.31 | Parche del catálogo. Validación web y de sesión local. |
| `brace-expansion` | 2.1.4 / 5.0.9 | 2.1.8 / 5.0.13 | Parches dentro de rangos transitivos. La rama 1.1.18 sigue pendiente. |
| `@grpc/grpc-js` de `google-gax` | 1.14.4 | 1.14.7 | Parche en el árbol de herramientas. La rama fijada por Firebase JS requiere seguimiento de su proveedor. |
| `re2js` | 2.8.6 | 2.10.0 | Actualización compatible dentro de la dependencia del SDK web. Revalidado con pruebas de Firestore y compilación web. |
| `undici` de herramientas | 8.10.0 | 8.12.4 | Parche dentro de la versión mayor. |
| `undici` de Functions | 7.29.1 | 7.30.2 | Mitigación de avisos altos en la dependencia usada por Expo Server SDK. Envío remoto pendiente de prueba. |
| `body-parser` de Functions | 2.3.0 | 2.4.0 | Mitigación compatible con Express de Firebase Functions, con ajuste transitivo de `qs`. |
| Firebase JS / Admin / Functions | 12.19.0 / 14.4.0 / 7.4.0 | Las mismas | Firebase JS 13 y cualquier cambio de runtime requieren una evaluación separada. |
| React Native / TypeScript | 0.86.3 / 6.0.3 app y 5.9.3 Functions | Las mismas | El catálogo de SDK 57 conserva React Native 0.86.3. |

`npm audit` comparado en esta ronda con el lockfile de la base:

| Árbol | Antes | Después |
|---|---|---|
| App y herramientas de raíz | 1 crítico, 26 altos, 30 moderados | 0 críticos, 17 altos, 28 moderados |
| Functions | 0 críticos, 2 altos, 13 moderados, 1 bajo | 0 críticos, 0 altos, 12 moderados, 1 bajo |

Los avisos altos restantes se concentran en rutas como Firebase JS (`@grpc/grpc-js`) y herramientas de desarrollo (`@modelcontextprotocol/sdk`, `js-yaml`, `compression`). Quedan por analizar también `decode-uri-component`, `source-map-js`, `fast-uri`, `zod` y la rama 1.x de `brace-expansion`. Los avisos moderados de Functions incluyen dependencias de Google Cloud y tooling de lint. Las dos auditorías finalizaron con código 1 por avisos pendientes.

La exposición difiere entre el tooling de desarrollo y CI, el SDK que integra el frontend, y las dependencias de producción de Functions. Los avisos propagados por el árbol no representan vulnerabilidades distintas. El resultado de npm tampoco establece alcance práctico sobre una ruta de OMP. Las propuestas de downgrade y de migración a Expo 58 requieren revisión separada.

## D. Modificaciones y validación

- `rules_src/` y `firestore.rules` contienen los cambios de acceso y su artefacto regenerado. `firestore-rules/cleaning-schedules.rules.test.ts` recupera la cobertura y añade casos de regresión.
- `firestore.indexes.json`, el verificador y `meetings-management.ts` documentan y ejercitan las formas de consulta. El repositorio de asignaciones y su prueba confirman la reutilización del fallback.
- Los lockfiles y `package.json` contienen las actualizaciones dirigidas. Se retiraron las exclusiones antiguas de Expo. `docs/testing.md` describe la cobertura vigente.
- `scripts/benchmark-assignment-queries.cjs` reproduce la comparación con datos sintéticos.

| Validación | Resultado probado |
|---|---|
| Instalación | `npm ci` en la raíz y en Functions con los lockfiles finales. |
| Lint, tipos y Jest de app | 52 suites, 324 pruebas aprobadas y 2 snapshots. |
| Lint y build de Functions | ESLint y TypeScript correctos en Node 22. |
| Functions contra Firestore | 35 suites, 354 pruebas aprobadas. |
| Reglas de Firestore | 8 suites, 91 pruebas aprobadas y cero omitidas. |
| Reglas generadas e índices | Archivo generado idéntico a las fuentes, 21 pares de campos y 4 compuestos verificados. |
| Exportación y compatibilidad Expo | Compilación web correcta, catálogo validado sin exclusiones, Expo Doctor 21 de 21. |
| Configuración nativa | Introspección de plugins de iOS y Android correcta. Compilación, instalación y recepción push en equipos físicos quedan pendientes. |
| E2E web con Auth, Firestore y Functions | 2 pruebas aprobadas en Chromium del sistema. Acceso a la app e inactividad con regreso al inicio de sesión. |

La primera ejecución E2E con Firebase CLI 15 falló al registrar un trigger local. El cliente de la CLI aplicaba su proxy incluso a la solicitud de loopback. La repetición con el emulador ya descargado, proyecto `demo-omp` y variables de proxy retiradas solo del proceso de prueba pasó las dos verificaciones. Se usó configuración temporal para Chromium y App Check local.

## E. Acciones externas

1. **Firebase CLI, consulta.** Con acceso al proyecto de pruebas, define `OMP_STAGING_PROJECT` con su ID autorizado y ejecuta `./node_modules/.bin/firebase firestore:indexes --project "$OMP_STAGING_PROJECT"`. Compara la salida con los cuatro compuestos locales y comunica cualquier diferencia al propietario.
2. **Firebase Console y Google Cloud, consulta.** En Firestore Database → Indexes → Composite, verifica los campos, el alcance y el estado. Como alternativa, con permisos de lectura en Google Cloud usa `gcloud firestore indexes composite list --project="$OMP_STAGING_PROJECT" --database='(default)'`. Espera a que el índice figure como habilitado antes de medir consultas reales. El emulador no requiere los índices compuestos como producción y no verifica el inventario remoto.
3. **Firebase CLI, con autorización de escritura.** Tras revisar el inventario y cualquier diferencia, publica los índices en pruebas con `./node_modules/.bin/firebase deploy --only firestore:indexes --project "$OMP_STAGING_PROJECT"`. Rechaza cualquier propuesta de borrar índices remotos que no esté revisada. Después de verificar que estén habilitados, publica las reglas con `./node_modules/.bin/firebase deploy --only firestore:rules --project "$OMP_STAGING_PROJECT"`. Ambas operaciones modifican recursos remotos. Repite las tres creaciones de limpieza y los casos denegados con usuarios de prueba. Para activar el orden explícito de traslapes debe entregarse también la versión actualizada de Functions mediante el procedimiento autorizado del repositorio.
4. **Medición remota.** Tras la autorización, registra el plan y las métricas de Query Explain para la búsqueda de traslapes y los rangos de asignaciones en pruebas. Una ejecución con análisis puede generar lecturas. Valida primero la equivalencia de resultados con documentos históricos y conserva el presupuesto y los tiempos como datos del proyecto medido.
