/**
 * English translations for OMP application
 */

export const en = {
  // General
  common: {
    loading: 'Loading...',
    error: 'Error',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    view: 'View',
    close: 'Close',
    back: 'Back',
    confirm: 'Confirm',
    yes: 'Yes',
    no: 'No',
  },

  // Settings - Title
  settings: {
    title: 'Settings',
  },

  // Settings - Sections
  'settings.section.account': 'Account',
  'settings.section.administration': 'Administration',
  'settings.section.organization': 'Organization',
  'settings.section.application': 'Application',
  'settings.section.legal': 'Legal',

  // Settings - Account
  'settings.account.fullName': 'Full name',
  'settings.account.email': 'Email address',
  'settings.account.role': 'Access role',

  // Settings - Administration
  'settings.admin.userManagement': 'User management',
  'settings.admin.meetingManagement': 'Meeting management',
  'settings.admin.assignmentManagement': 'Assignment management',
  'settings.admin.cleaningGroups': 'Cleaning groups',
  'settings.admin.hospitalityGroups': 'Hospitality groups',
  'settings.admin.notifications': 'Notifications',

  // Settings - Organization
  'settings.organization.meetingCalendar': 'Meeting calendar',
  'settings.organization.myAssignments': 'My assignments',
  'settings.organization.upcomingResponsibilities': 'Upcoming responsibilities',
  'settings.organization.assignmentHistory': 'Assignment history',

  // Settings - Application
  'settings.app.theme': 'Theme',
  'settings.app.language': 'Language',
  'settings.app.version': 'Version',

  // Settings - Legal
  'settings.legal.terms': 'Terms of use',
  'settings.legal.privacy': 'Privacy policy',
  'settings.legal.about': 'About the application',

  // Theme selector
  'theme.title': 'Theme',
  'theme.option.system': 'System',
  'theme.option.light': 'Light',
  'theme.option.dark': 'Dark',
  'theme.description': 'Choose how the app will look on your device.',

  // Language selector
  'language.title': 'Language',
  'language.option.es': 'Español',
  'language.option.en': 'English',
  'language.description': 'Select the language for the app interface.',

  // About screen
  'about.title': 'About OMP',
  'about.description': 'OMP is an internal digital tool to support the congregation organization. Its purpose is to centralize the management of meetings, assignments, cleaning groups, hospitality, and notifications, facilitating coordination of responsibilities and orderly access to information.',
  'about.version': 'Version',
  'about.build': 'Build',

  // Roles
  'role.admin': 'Administrator',
  'role.supervisor': 'Supervisor',
  'role.user': 'User',

  // Permission Row
  'permission.notifications.title': 'Notifications',
  'permission.notifications.description': 'Receive alerts about assignments, meetings, and cleaning groups.',
  'permission.status.granted': 'Granted',
  'permission.status.denied': 'Denied',
  'permission.status.undetermined': 'Undetermined',
  'permission.status.unavailable': 'Unavailable',
  'permission.action.allow': 'Allow',
  'permission.action.openSettings': 'Open Settings',

  // Operational window (2 months rule)
  'operational.expired': 'Expired',
  'operational.current': 'Current',
  'operational.upcoming': 'Upcoming',
  'operational.beyond': 'Beyond operational window',
} as const;

export type EnTranslations = typeof en;
