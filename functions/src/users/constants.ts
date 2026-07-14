import type {
  BillingPlanKey,
  PermissionAction,
  PermissionDepartment,
  ServiceDepartment,
  TerritoryPermissionAction,
} from './types.js';

export const SERVICE_DEPARTMENT_LABELS: Record<ServiceDepartment, string> = {
  coordinacion: 'Coordinacion',
  secretaria: 'Secretaria',
  limpieza: 'Limpieza',
  literatura: 'Literatura',
  tesoreria: 'Tesoreria',
  mantenimiento: 'Mantenimiento',
  discursos: 'Discursos',
  reuniones: 'Reuniones',
  predicacion: 'Predicacion',
  territorios: 'Territorios',
  asignaciones: 'Asignaciones',
  hospitalidad: 'Hospitalidad',
  usuarios: 'Usuarios',
  configuracion: 'Configuracion',
  audio_video: 'Audio y Video',
  acomodadores_microfonos: 'Acomodadores y Microfonos',
};

export const SERVICE_DEPARTMENT_LABEL_TO_KEY: Record<string, ServiceDepartment> = Object.fromEntries(
  Object.entries(SERVICE_DEPARTMENT_LABELS).map(([key, value]) => [value, key as ServiceDepartment])
) as Record<string, ServiceDepartment>;

export const PLAN_LIMITS: Record<BillingPlanKey, number> = {
  omp_80: 80,
  omp_150: 150,
  omp_250: 250,
};

export const USERS_QUERY_PAGE_SIZE = 200;

export const PERMISSION_DEPARTMENTS: PermissionDepartment[] = [
  'usuarios',
  'reuniones',
  'limpieza',
  'departments',
  'predicacion',
  'tesoreria',
  'pagos',
  'configuracion',
  'avisos',
  'asignaciones',
  'organigrama',
  'acomodadores_microfonos',
];

export const PERMISSION_ACTIONS: PermissionAction[] = [
  'view',
  'create',
  'edit',
  'delete',
  'manage',
  'approve',
  'export',
];

export const TERRITORY_PERMISSION_ACTIONS: TerritoryPermissionAction[] = [
  'view',
  'create',
  'edit',
  'delete',
  'assign',
  'manage',
];
