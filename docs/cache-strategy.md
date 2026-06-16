# Estrategia De Cache

OMP usa dos capas propias sobre Firestore:

- Cache en memoria de sesion: `src/services/repositories/session-cache.ts`.
- Cache persistente controlado: `src/services/repositories/persistent-cache.ts`.

Firestore Rules y Cloud Functions siguen siendo la autoridad real. El cache solo mejora carga rapida y resiliencia ante fallos temporales.

## Orden De Lectura

`firestore-cache-first.ts` lee en este orden:

1. Memoria de sesion.
2. AsyncStorage persistente.
3. Cache local de Firestore.
4. Servidor Firestore.

Si `forceServer` es `true`, no se devuelve memoria persistente como resultado principal. Si el servidor falla, puede usarse como fallback siempre que el valor no este vencido ni incompleto.

## Cache Persistente

El cache persistente usa AsyncStorage con el prefijo:

```text
omp:persistent-cache:
```

Cada entrada guarda:

```ts
type PersistentCacheEntry<T> = {
  value: T;
  updatedAt: number;
  cycleKey: string;
};
```

La metadata del ciclo vive en:

```text
omp:persistent-cache:meta
```

La metadata incluye `schemaVersion`. Si cambia la version de esquema, la app limpia todo el cache persistente OMP y vuelve a escribir metadata actual. La limpieza total borra tambien la metadata y la recrea durante la inicializacion.

## Limites

El cache persistente esta acotado:

- Maximo 300 entradas persistentes.
- Maximo 250 KB aproximados por entrada.
- Si se supera el limite de entradas, se borran primero las mas antiguas por `updatedAt`.
- Si una entrada supera el limite de tamano, no se guarda.

AsyncStorage es una optimizacion. Si falla una lectura, escritura o limpieza de cache, la app debe continuar usando memoria, Firestore local o servidor.

## Ciclo Anual

El ciclo de cache va del 1 de septiembre al 31 de agosto.

Ejemplos:

- `2026-08-31` pertenece a `2025-2026`.
- `2026-09-01` pertenece a `2026-2027`.
- `2027-01-10` pertenece a `2026-2027`.

Al iniciar la app, `initializePersistentCacheCycle()` compara el ciclo guardado contra el actual. Si cambio, borra solo claves con prefijo `omp:persistent-cache:` y guarda la metadata nueva.

El arranque global no queda bloqueado indefinidamente por AsyncStorage: `app/_layout.tsx` aplica un timeout de seguridad de 2 segundos y permite renderizar aunque la inicializacion del cache persistente tarde o falle.

## Claves

Las claves persistentes deben separar datos por usuario o congregacion:

```text
user:{uid}:profile
congregation:{congregationId}:doc:...
congregation:{congregationId}:query:...
```

La capa central normaliza claves legacy de `firestore-cache-first.ts` para evitar mezclar congregaciones.

## Logout Y Cambio De Congregacion

Al cerrar sesion, `clearLocalSessionData()` limpia:

- cache de sesion;
- cache persistente OMP;
- caches temporales de AsyncStorage definidos para la sesion.

Si el perfil cambia de congregacion durante una sesion, se limpia la memoria de sesion y el prefijo persistente de la congregacion anterior.
La frontera explicita vive en `useCongregationCacheBoundary()`, que tambien marca una ventana breve para evitar usar cache local de Firestore justo despues del cambio.

La limpieza remota solicitada por backend usa `clearTemporaryCacheData()`. Ese flujo borra caches temporales, memoria y persistencia OMP, pero no ejecuta logout ni borra tokens de Firebase Auth.

## Datos Que No Deben Persistirse

No guardar en cache persistente:

- secretos de Stripe;
- tokens privados o push tokens;
- llaves privadas;
- billing como fuente de autoridad;
- permisos como fuente de autoridad;
- datos de otra congregacion;
- informacion sensible que no sea necesaria para carga rapida.

Para lecturas sensibles que usen `getDocumentCacheFirst` o `getQueryCacheFirst`, pasar:

```ts
persist: false
```

## Cuándo Persistir

| Tipo de dato                   |       Persistente | Motivo                              |
| ------------------------------ | ----------------: | ----------------------------------- |
| Perfil de usuario actual       |                No | Incluye rol, permisos y tokens      |
| Lista de usuarios activos      | No por defecto    | Puede incluir permisos/roles        |
| Reuniones publicadas por rango |                Si | Carga rapida                        |
| Borradores de reuniones        |    No por defecto | Pueden ser sensibles/dinamicos      |
| Billing/status de pago         |                No | Debe venir de servidor/webhook      |
| Permisos sensibles             | No como autoridad | Solo UI puede cachear temporalmente |
| Push tokens                    |                No | Seguridad                           |
| Secrets/Stripe                 |             Nunca | Seguridad                           |

## Invalidacion

Despues de crear, editar, publicar o eliminar datos:

- invalidar documentos puntuales con `invalidateCacheEntry(cacheKey)`;
- limpiar listas con `clearSessionCacheByPrefix(prefix)`;
- usar prefijos que incluyan la congregacion cuando aplique.

Las invalidaciones de memoria tambien limpian la contraparte persistente correspondiente.
`session-cache.ts` conoce el cache persistente solo para mantener compatibilidad con invalidaciones existentes. Si el sistema crece, puede extraerse una capa `cache-invalidation.ts` para separar memoria y persistencia sin cambiar los servicios.

Por eso, cuando un servicio ya llama `invalidateCacheEntry(cacheKey)` o `clearSessionCacheByPrefix(prefix)`, tambien se limpia el cache persistente normalizado. Para datos nuevos, preferir prefijos con congregacion:

```ts
buildCongregationCacheKey(congregationId, 'query:meetings:2026-09')
buildUserCacheKey(uid, 'profile')
```

## Pruebas

La prueba real vive en:

```text
src/services/repositories/__tests__/persistent-cache.test.ts
```

Se ejecuta con `npm run test` y tambien forma parte de `npm run validate`.
