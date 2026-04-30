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

  // Tabs
  'tabs.home': 'Home',
  'tabs.meetings': 'Meetings',
  'tabs.assignments': 'Assignments',
  'tabs.users': 'Users',
  'tabs.cleaning': 'Cleaning',
  'tabs.profile': 'Profile',
  'tabs.settings': 'Settings',

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
  'settings.section.devicePermissions': 'Device permissions',

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
  'settings.screen.theme': 'Theme',
  'settings.screen.language': 'Language',
  'settings.screen.about': 'About',

  // Theme selector
  'theme.title': 'Theme',
  'theme.option.system': 'System',
  'theme.option.light': 'Light',
  'theme.option.dark': 'Dark',
  'theme.description': 'Choose how the app will look on your device.',

  // Language selector
  'language.title': 'Language',
  'language.option.es': 'Espanol',
  'language.option.en': 'English',
  'language.option.fr': 'Francais',
  'language.option.ar': 'Arabic',
  'language.option.hi': 'Hindi',
  'language.option.zh': 'Mandarin Chinese',
  'language.description': 'Select the language for the app interface.',
  'language.info': 'Language updated. Some content may stay in another language if it is not translated yet.',
  'language.onboarding.title': 'Choose your language',
  'language.onboarding.subtitle': 'Select the app language before continuing. You can change it later in Settings.',
  'language.onboarding.continue': 'Continue',

  // Meetings management
  'meetings.management.title': 'Meetings management',
  'meetings.management.subtitle': 'Admin and Supervisor',
  'meetings.management.loading': 'Loading meetings management...',
  'meetings.management.noCongregation': 'The current profile congregation was not found.',
  'meetings.management.action.newWeekend': 'New weekend',
  'meetings.management.action.newMidweek': 'New Midweek',
  'meetings.management.filter.all': 'All',
  'meetings.management.filter.draft': 'Draft',
  'meetings.management.filter.published': 'Published',
  'meetings.management.row.view': 'View',
  'meetings.management.row.edit': 'Edit',
  'meetings.management.row.publish': 'Publish',
  'meetings.management.row.unpublish': 'Unpublish',
  'meetings.management.row.delete': 'Delete',
  'meetings.management.alert.validation': 'Validation',
  'meetings.management.alert.success': 'Success',
  'meetings.management.alert.published': 'Meeting published.',
  'meetings.management.alert.sentToDraft': 'Meeting sent to draft.',
  'meetings.management.alert.deleteTitle': 'Delete meeting',
  'meetings.management.alert.deleteMessage': 'This action will permanently delete the meeting. It cannot be undone.',
  'meetings.management.alert.deleted': 'Meeting deleted successfully.',
  'meetings.management.empty.title': 'No meetings',
  'meetings.management.empty.description': 'There are no meetings for the current filters.',

  // Meetings list
  'meetings.list.loading': 'Loading meetings...',
  'meetings.list.noCongregation': 'The current profile congregation was not found.',
  'meetings.list.publishedCount': 'published meetings',
  'meetings.list.manage': 'Manage',
  'meetings.list.empty.title': 'No published meetings',
  'meetings.list.empty.description': 'There are no published meetings created from today onward.',

  // Meeting labels
  'meeting.type.internal': 'Internal',
  'meeting.type.external': 'External',
  'meeting.type.review': 'Review',
  'meeting.type.training': 'Training',
  'meeting.type.midweek': 'Midweek',
  'meeting.type.weekend': 'Weekend',
  'meeting.status.pending': 'Pending',
  'meeting.status.scheduled': 'Scheduled',
  'meeting.status.in_progress': 'In progress',
  'meeting.status.completed': 'Completed',
  'meeting.status.cancelled': 'Cancelled',

  // About screen
  'about.title': 'About OMP',
  'about.description': 'OMP is an internal digital tool to support congregation organization. Its purpose is to centralize management of meetings, assignments, cleaning groups, hospitality, and notifications, making coordination and access to information easier.',
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
