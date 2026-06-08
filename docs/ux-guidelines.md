# Guia UX/UI

OMP debe sentirse claro, moderno, movil primero, theme-aware y utilitario.

## Navegacion Movil

- Toda pantalla secundaria debe tener flecha de regreso.
- Toda pantalla profunda debe tener header.
- Las pantallas modales deben tener boton cerrar.
- No depender solo del gesto del sistema.
- En desktop la navegacion puede adaptarse, pero mobile debe ser consistente.

## Dashboard Por Perfil

- Usuario normal: mis asignaciones, mi limpieza, mis horas.
- Supervisor: modulos asignados, pendientes y alertas.
- Admin: usuarios, permisos, cobros y actividad.
- Coordinador/Secretario: reuniones, organigrama y administracion.
- Encargado de predicacion: informes, territorios y faltantes.
- Encargado de limpieza: grupos y proximas limpiezas.

## Estados Vacios

Usar mensajes humanos:

- No hay territorios asignados esta semana.
- Cuando el encargado publique la planificacion, aparecera aqui.
- Aun no tienes asignaciones proximas.
- Cuando se publique una nueva asignacion, la veras en esta seccion.

## Errores

Evitar mostrar errores tecnicos crudos:

- `permission-denied`
- `document not found`
- `invalid role`

Preferir:

- No tienes permiso para editar esta seccion.
- Si crees que es un error, contacta a un administrador.
