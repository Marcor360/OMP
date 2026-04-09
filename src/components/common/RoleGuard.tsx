import React from 'react';
import { useUser } from '@/src/context/user-context';
import { UserRole } from '@/src/types/user';
import { hasRole } from '@/src/utils/permissions/permissions';

interface RoleGuardProps {
  /** Rol mínimo requerido para ver el contenido */
  requiredRole?: UserRole;
  /** Roles específicos que pueden ver el contenido */
  allowedRoles?: UserRole[];
  /** Contenido a mostrar si tiene permiso */
  children: React.ReactNode;
  /** Contenido alternativo si NO tiene permiso (por defecto: null) */
  fallback?: React.ReactNode;
}

/**
 * Oculta o muestra contenido según el rol del usuario.
 * 
 * Uso:
 * <RoleGuard requiredRole="admin">...</RoleGuard>
 * <RoleGuard allowedRoles={['admin', 'supervisor']}>...</RoleGuard>
 */
export function RoleGuard({
  requiredRole,
  allowedRoles,
  children,
  fallback = null,
}: RoleGuardProps) {
  const { role } = useUser();

  let permitted = false;

  if (requiredRole) {
    permitted = hasRole(role, requiredRole);
  } else if (allowedRoles && allowedRoles.length > 0) {
    permitted = role ? allowedRoles.includes(role) : false;
  } else {
    permitted = true; // Sin restricción
  }

  return permitted ? <>{children}</> : <>{fallback}</>;
}
