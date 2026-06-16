# QA De Navegacion Movil

El Stack protegido usa `headerShown: false`; por eso cada pantalla profunda debe exponer su propio header o boton de regreso.

## Pantallas A Validar

| Ruta | Header/Regreso | Estado |
| --- | --- | --- |
| `users/create` | PageHeader o boton volver | Pendiente QA |
| `users/edit/[id]` | PageHeader o boton volver | Pendiente QA |
| `users/[id]` | PageHeader o boton volver | Pendiente QA |
| `meetings/create` | PageHeader o boton volver | Pendiente QA |
| `meetings/edit/[id]` | PageHeader o boton volver | Pendiente QA |
| `meetings/[id]` | PageHeader o boton volver | Pendiente QA |
| `cleaning/schedule` | PageHeader o boton volver | Pendiente QA |
| `assignments/hospitality-microphones` | PageHeader o boton volver | Pendiente QA |
| `territories/manage` | PageHeader o boton volver | Pendiente QA |
| `organization-chart` | PageHeader o boton volver | Pendiente QA |
| `billing/index` | PageHeader o boton volver | Pendiente QA |
| `settings/*` | PageHeader o boton volver | Pendiente QA |

## Criterios

- Android pequeno, Android grande, iOS y Web responsive.
- El usuario puede volver sin usar gestos del sistema.
- Errores se muestran con texto humano.
- Estados vacios no bloquean navegacion.
- Rutas protegidas redirigen a login si no hay sesion.
- Usuarios sin permisos no ven acciones peligrosas.
