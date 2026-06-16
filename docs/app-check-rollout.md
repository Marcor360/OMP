# Plan De App Check

App Check debe activarse de forma gradual para no bloquear usuarios reales por configuracion incompleta.

## Fases

1. Configurar proveedores para Android, iOS y Web.
2. Activar modo monitoreo en Firebase.
3. Revisar trafico valido e invalido por plataforma.
4. Corregir builds o dominios que no generen token valido.
5. Activar enforcement primero en Functions criticas.
6. Activar enforcement en Firestore solo despues de validar clientes reales.
7. Monitorear errores y mantener rollback documentado.

## Functions Criticas

- Crear usuarios.
- Editar usuarios.
- Cambiar passwords.
- Desactivar/eliminar usuarios.
- Publicar reuniones.
- Publicar limpieza.
- Publicar acomodadores/microfonos.
- Crear Checkout/Portal de Stripe.
- Webhooks no dependen de App Check; dependen de firma Stripe.

## Criterio De Produccion

- Development build Android validado.
- iOS validado cuando exista build.
- Web validado con dominio final.
- No hay aumento de `permission-denied` sin causa conocida.
