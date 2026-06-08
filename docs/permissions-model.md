# Modelo De Permisos

Este documento define el significado de cada campo usado para autorizacion y visibilidad.

## Roles Tecnicos

Valores internos permitidos:

```ts
type UserRole = 'admin' | 'supervisor' | 'user';
```

Etiquetas de UI:

- `admin`: Administrador.
- `supervisor`: Supervisor.
- `user`: Usuario.

Valores como `administrador` y `usuario` son legacy y deben migrarse a `admin` y `user`.

## Campos

| Campo | Uso |
| --- | --- |
| `role` | Nivel general dentro del sistema. |
| `permissions` | Acciones tecnicas permitidas por modulo. |
| `privileges` | Condicion interna/congregacional. |
| `serviceAssignments` | Responsabilidades por departamento. |
| `responsibilities` | Marcadores funcionales especiales. |

## Reglas De Separacion

- Un `admin` no es automaticamente anciano.
- Un anciano no es automaticamente `admin`.
- Un `supervisor` no es automaticamente siervo ministerial.
- Un encargado de departamento solo obtiene control amplio de su departamento.
- Un auxiliar obtiene acceso limitado.
- No basar seguridad real en labels como `Encargado de Limpieza`; usar campos estructurados.

## Migracion De Roles Legacy

Orden seguro:

1. Auditar documentos `/users/{uid}` con roles fuera de `admin`, `supervisor`, `user`.
2. Migrar `administrador` a `admin` y `usuario` a `user` con script administrativo.
3. Verificar que Functions y UI leen roles normalizados.
4. Endurecer `firestore.rules` para rechazar valores legacy nuevos.
5. Agregar pruebas de Rules para prevenir regresiones.

No endurecer reglas antes de migrar datos existentes.
