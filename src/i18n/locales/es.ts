/**
 * Traducciones al español para la aplicación OMP
 */

export const es = {
  // General
  common: {
    loading: 'Cargando...',
    error: 'Error',
    cancel: 'Cancelar',
    save: 'Guardar',
    delete: 'Eliminar',
    edit: 'Editar',
    view: 'Ver',
    close: 'Cerrar',
    back: 'Volver',
    confirm: 'Confirmar',
    yes: 'Sí',
    no: 'No',
  },

  // Settings - Título
  settings: {
    title: 'Configuración',
  },

  // Settings - Secciones
  'settings.section.account': 'Cuenta',
  'settings.section.administration': 'Administración',
  'settings.section.organization': 'Organización',
  'settings.section.application': 'Aplicación',
  'settings.section.legal': 'Legal',

  // Settings - Cuenta
  'settings.account.fullName': 'Nombre completo',
  'settings.account.email': 'Correo electrónico',
  'settings.account.role': 'Rol de acceso',

  // Settings - Administración
  'settings.admin.userManagement': 'Gestión de usuarios',
  'settings.admin.meetingManagement': 'Gestión de reuniones',
  'settings.admin.assignmentManagement': 'Gestión de asignaciones',
  'settings.admin.cleaningGroups': 'Grupos de limpieza',
  'settings.admin.hospitalityGroups': 'Grupos de hospitalidad',
  'settings.admin.notifications': 'Notificaciones',

  // Settings - Organización
  'settings.organization.meetingCalendar': 'Calendario de reuniones',
  'settings.organization.myAssignments': 'Mis asignaciones',
  'settings.organization.upcomingResponsibilities': 'Próximas responsabilidades',
  'settings.organization.assignmentHistory': 'Historial de asignaciones',

  // Settings - Aplicación
  'settings.app.theme': 'Tema',
  'settings.app.language': 'Idioma',
  'settings.app.version': 'Versión',

  // Settings - Legal
  'settings.legal.terms': 'Términos de uso',
  'settings.legal.privacy': 'Política de privacidad',
  'settings.legal.about': 'Acerca de la aplicación',

  // Theme selector
  'theme.title': 'Tema',
  'theme.option.system': 'Sistema',
  'theme.option.light': 'Claro',
  'theme.option.dark': 'Oscuro',
  'theme.description': 'Elige cómo se verá la aplicación en tu dispositivo.',

  // Language selector
  'language.title': 'Idioma',
  'language.option.es': 'Español',
  'language.option.en': 'English',
  'language.description': 'Selecciona el idioma de la interfaz de la aplicación.',

  // About screen
  'about.title': 'Acerca de OMP',
  'about.description': 'OMP es una herramienta digital de uso interno para apoyar la organización de la congregación. Su propósito es centralizar la gestión de reuniones, asignaciones, grupos de limpieza, hospitalidad y notificaciones, facilitando la coordinación de responsabilidades y el acceso ordenado a la información.',
  'about.version': 'Versión',
  'about.build': 'Compilación',

  // Roles
  'role.admin': 'Administrador',
  'role.supervisor': 'Supervisor',
  'role.user': 'Usuario',

  // Permission Row
  'permission.notifications.title': 'Notificaciones',
  'permission.notifications.description': 'Recibe alertas sobre asignaciones, reuniones y grupos de limpieza.',
  'permission.status.granted': 'Concedido',
  'permission.status.denied': 'Denegado',
  'permission.status.undetermined': 'Sin definir',
  'permission.status.unavailable': 'No disponible',
  'permission.action.allow': 'Permitir',
  'permission.action.openSettings': 'Abrir Ajustes',

  // Operational window (2 months rule)
  'operational.expired': 'Vencido',
  'operational.current': 'Actual',
  'operational.upcoming': 'Próximo',
  'operational.beyond': 'Fuera de ventana operativa',
} as const;

export type EsTranslations = typeof es;
