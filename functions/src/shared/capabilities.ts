/**
 * Especificacion tipada de capacidades (piloto: dominio "avisos" / eventos).
 *
 * Espejo logico de src/shared/capabilities.ts (proyecto app Expo). No existe
 * hoy un mecanismo de import compartido entre la app y functions/ (proyecto
 * TS independiente con rootDir propio), asi que ambos archivos se mantienen
 * como implementaciones espejadas y su equivalencia se verifica con tests
 * de contrato que leen firestore-rules/fixtures/avisos.capability-cases.json
 * desde los tres entornos (frontend, functions, firestore-rules).
 *
 * Si cambias las reglas de negocio aqui, replica el cambio en:
 * - src/shared/capabilities.ts
 * - firestore.rules (funcion canManageEvents())
 * - firestore-rules/fixtures/avisos.capability-cases.json (si agregas casos)
 */

export type CapabilityRole = 'admin' | 'supervisor' | 'user';

export type CapabilityAction = 'view' | 'create' | 'edit' | 'delete' | 'manage' | 'approve' | 'export';

export type CapabilityServiceAssignment = {
  position?: string;
  department?: string;
};

export type CapabilityDepartmentPermissions = Partial<Record<CapabilityAction, boolean>>;

export type CapabilityPermissions = Partial<Record<string, CapabilityDepartmentPermissions>>;

/**
 * Forma estructural minima que necesita la spec. AppUser (frontend) y
 * RequesterProfile (functions) son ambos asignables a este tipo sin
 * conversion explicita (duck typing de TypeScript).
 */
export type CapabilityProfile = {
  role?: CapabilityRole;
  isActive?: boolean;
  permissions?: CapabilityPermissions;
  servicePosition?: string;
  serviceDepartment?: string;
  serviceAssignments?: CapabilityServiceAssignment[];
  protectedFromDeletion?: boolean;
  isSystemUser?: boolean;
  isPrimaryAdmin?: boolean;
  isRootAdmin?: boolean;
  systemProtected?: boolean;
};

/**
 * isActive es responsabilidad del llamador (ver assertEventManager en
 * ../events.ts), igual que en src/shared/capabilities.ts: ninguna
 * canManageX() gatea isActive por si misma, se valida antes en el gate de
 * la Cloud Function (getRequesterProfile ya lanza si el usuario esta
 * inactivo, y assertEventManager valida congregationId por separado).
 */
export const isActiveProfile = (profile: CapabilityProfile | null | undefined): boolean =>
  profile?.isActive === true;

export const hasServiceAssignment = (
  profile: CapabilityProfile | null | undefined,
  position: string,
  department?: string
): boolean =>
  Boolean(
    (
      profile?.servicePosition === position &&
      (department === undefined || profile.serviceDepartment === department)
    ) ||
      profile?.serviceAssignments?.some(
        (assignment) =>
          assignment.position === position &&
          (department === undefined || assignment.department === department)
      )
  );

/**
 * Coordinador/secretario y flags de sistema obtienen acceso amplio
 * equivalente al de isGlobalScreenAccess() en firestore.rules.
 */
export const isGlobalScreenAccess = (profile: CapabilityProfile | null | undefined): boolean =>
  Boolean(
    profile?.protectedFromDeletion === true ||
      profile?.isSystemUser === true ||
      profile?.isPrimaryAdmin === true ||
      profile?.isRootAdmin === true ||
      profile?.systemProtected === true ||
      hasServiceAssignment(profile, 'coordinador') ||
      hasServiceAssignment(profile, 'secretario')
  );

export const isAdminRole = (profile: CapabilityProfile | null | undefined): boolean =>
  profile?.role === 'admin';

export const hasDepartmentPermission = (
  profile: CapabilityProfile | null | undefined,
  department: string,
  action: CapabilityAction
): boolean =>
  Boolean(
    profile?.permissions?.[department]?.[action] === true ||
      (action !== 'manage' && profile?.permissions?.[department]?.manage === true)
  );

/**
 * Dominio piloto: avisos / eventos (events.ts assertEventManager,
 * firestore.rules match /events/{eventId}).
 *
 * Espejo logico de:
 * - firestore.rules: function canManageEvents() (sin el gate de billing
 *   administrativeWritesAllowed(), que se compone por separado en las
 *   reglas ya que es una capa de negocio distinta de la capacidad).
 */
export const canManageEvents = (profile: CapabilityProfile | null | undefined): boolean =>
  isAdminRole(profile) ||
  isGlobalScreenAccess(profile) ||
  hasDepartmentPermission(profile, 'avisos', 'manage') ||
  (
    hasDepartmentPermission(profile, 'avisos', 'create') &&
    hasDepartmentPermission(profile, 'avisos', 'edit')
  );
