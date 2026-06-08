# Arquitectura

OMP es una app Expo/React Native con backend Firebase. La app cliente solicita datos, aplica visibilidad de UI y cache local; Firestore Rules y Cloud Functions aplican la seguridad real.

## Capas

- `app/`: rutas Expo Router.
- `src/screens/`: pantallas de alto nivel.
- `src/components/`: componentes reutilizables.
- `src/modules/`: dominio funcional.
- `src/services/`: acceso a Firebase, repositorios, cache y servicios remotos.
- `src/types/`: contratos TypeScript.
- `src/i18n/`: textos traducibles.
- `functions/`: operaciones sensibles y trabajos programados.

## Principios

- Toda consulta de congregacion debe filtrar por `congregationId`.
- Las pantallas no deben contener logica sensible de autorizacion como unica defensa.
- Las operaciones sensibles deben ejecutarse en Cloud Functions.
- No duplicar dominios existentes; extender `users`, `meetings`, `assignments`, `cleaning`, `preaching`, `territories`, `notifications`, `dashboard` o `settings`.
- Usar cache-first cuando la vista no requiere tiempo real.

## Flujo Recomendado

1. La UI valida sesion y perfil activo.
2. El servicio de dominio llama a repositorios o Functions.
3. Firestore Rules validan identidad, congregacion y permisos.
4. Cloud Functions validan acciones administrativas y escriben datos sensibles.
5. Los servicios invalidan cache tras crear, editar, publicar o eliminar.

## Limites

- No mover creacion, edicion de roles, permisos, desactivacion o eliminacion de usuarios al cliente.
- No reintroducir importacion de documentos de reuniones sin aprobacion explicita.
- No consultar datos de todas las congregaciones salvo en panel superadmin separado.
