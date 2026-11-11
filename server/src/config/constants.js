// Shared settings. The client fetches the per-institution lists from GET /api/meta.

// Report categories, offices, classes/departments and places are stored per institution
// (see config/terms.js for the defaults a new institution starts with).

const REPORT_STEPS = ['Submitted', 'Acknowledged', 'In progress', 'Resolved'];
const PRIORITIES = ['Low', 'Normal', 'Urgent'];

const APPT_STATUSES = ['Pending', 'Confirmed', 'Declined', 'Cancelled', 'Completed', 'No-show'];
const ACTIVE_APPT = ['Pending', 'Confirmed'];

const SLOT_MINUTES = 20;
const WEEKEND_DAY = 5; // Friday: no office hours
const BOOKING_WINDOW_DAYS = 7;

module.exports = {
  REPORT_STEPS, PRIORITIES,
  APPT_STATUSES, ACTIVE_APPT, SLOT_MINUTES, WEEKEND_DAY, BOOKING_WINDOW_DAYS,
};
