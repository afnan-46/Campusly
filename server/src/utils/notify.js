const store = require('../store');

// Adds a notification. The caller saves the store afterwards.
function notify(to, text, link = '/') {
  if (!to) return;
  store.db.notifications.push({ id: store.newId(), to, text, link, read: false, createdAt: store.now() });
}

// Tell everyone who works in an office of this institution, plus its admins.
function notifyOffice(instId, dept, text) {
  store.db.users
    .filter((u) => u.institutionId === instId && ((u.role === 'staff' && u.office === dept) || u.role === 'admin'))
    .forEach((u) => notify(u.id, text, '/queue'));
}

module.exports = { notify, notifyOffice };

// Tell everyone at the Campusly company (owner and office staff).
function notifyCompany(text, link = '/') {
  store.db.users.filter((u) => u.role === 'superadmin' || u.role === 'company').forEach((u) => notify(u.id, text, link));
}

module.exports.notifyCompany = notifyCompany;
