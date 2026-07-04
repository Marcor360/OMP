import './config/firebaseAdmin.js';

export {
  createUserByAdmin,
  listOrgChartUsersForCurrentCongregation,
  listUsersForCurrentCongregation,
  updateUserByAdmin,
  updateUserPasswordByAdmin,
  disableUserByAdmin,
  deleteUserByAdmin,
} from './users.js';

export {
  deleteAuthUserOnProfileDelete,
  deleteUserProfileOnAuthDelete,
} from "./users-sync.js";

export {
  notifyAssignmentUsers,
  notifyCongregationAssignmentUsers,
  notifyMeetingAssignmentUsers,
} from './modules/notifications/notifyAssignmentUsers.js';

export {
  sendExpoPushOnNotificationCreated,
} from './modules/notifications/sendExpoPushOnNotificationCreated.js';

export { setMeetingPublicationStatus } from './meetings-publication.js';
export {
  createMeetingByManager,
  updateMeetingByManager,
  deleteMeetingByManager,
  syncMeetingCleaningAssignmentsByManager,
  createMeetingAssignmentByManager,
  updateMeetingAssignmentByManager,
} from './meetings-management.js';

export {
  createOutgoingTalkByManager,
  updateOutgoingTalkByManager,
  cancelOutgoingTalkByManager,
  completeOutgoingTalkByManager,
} from './outgoing-talks.js';

export {
  notifyMeetingPublicationAndChanges,
  sendMeetingReminderThreeDaysBefore,
} from './meetings-notifications.js';

export {
  createEventByManager,
  updateEventByManager,
  deleteEventByManager,
  notifyEventChanges,
  scheduledEventsCleanup,
} from './events.js';

export {
  scheduledDataCleanup,
} from "./maintenance/scheduled-data-cleanup.js";

export {
  scheduledLegacyRootNotificationsMigration,
  scheduledNotificationsCleanup,
} from "./maintenance/scheduled-notifications-cleanup.js";

export {
  refreshDashboardSummaryForCurrentCongregation,
  scheduledDashboardSummaryRefresh,
} from "./dashboard-summary.js";

export {
  scheduledMonthlyTerritoryAssignmentsCleanup,
} from "./territories-maintenance.js";

export {
  remindNextMonthTerritoryAssignments,
} from "./territories-notifications.js";

export {
  createCleaningGroupByManager,
  listCleaningGroupsForCurrentUser,
} from './cleaning.js';

export {
  publishCleaningScheduleByManager,
  publishHospitalityScheduleByManager,
} from './planning-schedules.js';

export {
  createStripeCheckoutSession,
  createStripePortalSession,
  getStripeBillingUsage,
  scheduledBillingHistoryCleanup,
  sendBillingPaymentReminders,
  stripeWebhook,
} from './billing/stripe.js';

export { setBillingExemptionByRootAdmin } from './billing/admin-exemption.js';

export {
  reconcileOrgChartOnUserWrite,
  regenerateOrgChart,
} from './organization/triggers.js';
