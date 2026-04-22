/**
 * Traducciones en espanol para la aplicacion OMP
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
    yes: 'Si',
    no: 'No',
  },

  // Tabs
  'tabs.home': 'Inicio',
  'tabs.meetings': 'Reuniones',
  'tabs.assignments': 'Asignaciones',
  'tabs.users': 'Usuarios',
  'tabs.cleaning': 'Limpieza',
  'tabs.profile': 'Perfil',
  'tabs.settings': 'Configuracion',

  // Settings - Titulo
  settings: {
    title: 'Configuracion',
  },

  // Settings - Secciones
  'settings.section.account': 'Cuenta',
  'settings.section.administration': 'Administracion',
  'settings.section.organization': 'Organizacion',
  'settings.section.application': 'Aplicacion',
  'settings.section.legal': 'Legal',
  'settings.section.devicePermissions': 'Permisos del dispositivo',

  // Settings - Cuenta
  'settings.account.fullName': 'Nombre completo',
  'settings.account.email': 'Correo electronico',
  'settings.account.role': 'Rol de acceso',

  // Settings - Administracion
  'settings.admin.userManagement': 'Gestion de usuarios',
  'settings.admin.meetingManagement': 'Gestion de reuniones',
  'settings.admin.assignmentManagement': 'Gestion de asignaciones',
  'settings.admin.cleaningGroups': 'Grupos de limpieza',
  'settings.admin.hospitalityGroups': 'Grupos de hospitalidad',
  'settings.admin.notifications': 'Notificaciones',

  // Settings - Organizacion
  'settings.organization.meetingCalendar': 'Calendario de reuniones',
  'settings.organization.myAssignments': 'Mis asignaciones',
  'settings.organization.upcomingResponsibilities': 'Proximas responsabilidades',
  'settings.organization.assignmentHistory': 'Historial de asignaciones',

  // Settings - Aplicacion
  'settings.app.theme': 'Tema',
  'settings.app.language': 'Idioma',
  'settings.app.version': 'Version',

  // Settings - Legal
  'settings.legal.terms': 'Terminos de uso',
  'settings.legal.privacy': 'Politica de privacidad',
  'settings.legal.about': 'Acerca de la aplicacion',
  'settings.screen.theme': 'Tema',
  'settings.screen.language': 'Idioma',
  'settings.screen.about': 'Acerca de',

  // Theme selector
  'theme.title': 'Tema',
  'theme.option.system': 'Sistema',
  'theme.option.light': 'Claro',
  'theme.option.dark': 'Oscuro',
  'theme.description': 'Elige como se vera la aplicacion en tu dispositivo.',

  // Language selector
  'language.title': 'Idioma',
  'language.option.es': 'Espanol',
  'language.option.en': 'English',
  'language.option.fr': 'Frances',
  'language.option.ar': 'Arabe',
  'language.option.hi': 'Hindi',
  'language.option.zh': 'Chino mandarin',
  'language.description': 'Selecciona el idioma de la interfaz de la aplicacion.',
  'language.info': 'El idioma se ha actualizado. Algunos contenidos pueden verse en otro idioma si aun no tienen traduccion.',
  'language.onboarding.title': 'Elige tu idioma',
  'language.onboarding.subtitle': 'Selecciona el idioma de la aplicacion antes de continuar. Luego podras cambiarlo desde Configuracion.',
  'language.onboarding.continue': 'Continuar',

  // Meetings management
  'meetings.management.title': 'Gestion de reuniones',
  'meetings.management.subtitle': 'Admin y Supervisor',
  'meetings.management.loading': 'Cargando gestion de reuniones...',
  'meetings.management.noCongregation': 'No se encontro la congregacion del perfil actual.',
  'meetings.management.action.newWeekend': 'Nueva fin de semana',
  'meetings.management.action.newMidweek': 'Nueva VyMC',
  'meetings.management.action.importMidweekPdf': 'Importar PDF VyMC',
  'meetings.management.filter.all': 'Todas',
  'meetings.management.filter.draft': 'Borrador',
  'meetings.management.filter.published': 'Publicada',
  'meetings.management.row.view': 'Ver',
  'meetings.management.row.edit': 'Editar',
  'meetings.management.row.publish': 'Publicar',
  'meetings.management.row.unpublish': 'Despublicar',
  'meetings.management.row.delete': 'Eliminar',
  'meetings.management.alert.validation': 'Validacion',
  'meetings.management.alert.success': 'Exito',
  'meetings.management.alert.published': 'Reunion publicada.',
  'meetings.management.alert.sentToDraft': 'Reunion enviada a borrador.',
  'meetings.management.alert.deleteTitle': 'Eliminar reunion',
  'meetings.management.alert.deleteMessage': 'Esta accion eliminara la reunion de forma permanente. No se puede deshacer.',
  'meetings.management.alert.deleted': 'Reunion eliminada correctamente.',
  'meetings.management.empty.title': 'Sin reuniones',
  'meetings.management.empty.description': 'No hay reuniones para los filtros actuales.',

  // Meetings list
  'meetings.list.loading': 'Cargando reuniones...',
  'meetings.list.noCongregation': 'No se encontro la congregacion del perfil actual.',
  'meetings.list.publishedCount': 'reuniones publicadas',
  'meetings.list.manage': 'Gestion',
  'meetings.list.empty.title': 'Sin reuniones publicadas',
  'meetings.list.empty.description': 'No hay reuniones publicadas creadas a partir de hoy.',

  // Meeting labels
  'meeting.type.internal': 'Interna',
  'meeting.type.external': 'Externa',
  'meeting.type.review': 'Revision',
  'meeting.type.training': 'Capacitacion',
  'meeting.type.midweek': 'Entre semana',
  'meeting.type.weekend': 'Fin de semana',
  'meeting.status.pending': 'Pendiente',
  'meeting.status.scheduled': 'Programada',
  'meeting.status.in_progress': 'En curso',
  'meeting.status.completed': 'Completada',
  'meeting.status.cancelled': 'Cancelada',

  // About screen
  'about.title': 'Acerca de OMP',
  'about.description': 'OMP es una herramienta digital de uso interno para apoyar la organizacion de la congregacion. Su proposito es centralizar la gestion de reuniones, asignaciones, grupos de limpieza, hospitalidad y notificaciones.',
  'about.version': 'Version',
  'about.build': 'Compilacion',

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
  'operational.upcoming': 'Proximo',
  'operational.beyond': 'Fuera de ventana operativa',
} as const;

export type EsTranslations = typeof es;
