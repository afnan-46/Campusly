// The Campusly company portal: the owner and company office staff.
// Staff review applications and payments. Only the owner can pause institutions,
// change subscriptions by hand and manage the company team.
const express = require('express');
const store = require('../store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { hashPassword } = require('../utils/users');
const { HttpError, ah } = require('../utils/http');
const { notify } = require('../utils/notify');
const { instAccess } = require('../utils/users');
const { planByKey, cycleByKey, METHOD_LABEL, addDays, PLANS } = require('../config/plans');
const {
  clean, EMAIL_RE, tempPassword, paymentOut, extendSubscription, approveApplication,
} = require('../utils/company');

const router = express.Router();
router.use(requireAuth, requireRole('superadmin', 'company'));
const ownerOnly = requireRole('superadmin');

const newestFirst = (a, b) => String(b.createdAt).localeCompare(String(a.createdAt));
const adminsOf = (instId) => store.db.users.filter((u) => u.institutionId === instId && u.role === 'admin');
const notifyAdmins = (instId, text, link = '/billing') => adminsOf(instId).forEach((u) => notify(u.id, text, link));

function appOut(a) {
  const plan = planByKey(a.payment.plan);
  const cycle = cycleByKey(a.payment.cycle);
  return {
    ...a,
    planName: plan ? plan.name : '', cycleName: cycle ? cycle.name : '',
    methodLabel: METHOD_LABEL[a.payment.method] || '',
  };
}

function instOut(i) {
  const users = store.db.users.filter((u) => u.institutionId === i.id);
  const count = (role) => users.filter((u) => u.role === role).length;
  const paid = store.db.payments.filter((p) => p.institutionId === i.id && p.status === 'verified').reduce((s, p) => s + p.amount, 0);
  return {
    id: i.id, type: i.type, name: i.name, shortName: i.shortName, city: i.city, createdAt: i.createdAt,
    subscription: i.subscription || null, access: instAccess(i), suspendReason: i.suspendReason || null, totalPaid: paid,
    counts: {
      student: count('student'), faculty: count('faculty'), staff: count('staff'),
      openReports: store.db.reports.filter((r) => r.institutionId === i.id && r.status !== 'Resolved').length,
    },
    admins: users.filter((u) => u.role === 'admin').map((u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone || '' })),
  };
}

// ---------- Dashboard ----------

// GET /api/company/dashboard
router.get('/dashboard', (req, res) => {
  const { db } = store;
  const verified = db.payments.filter((p) => p.status === 'verified');
  const now = new Date();
  const sumWhere = (fn) => verified.filter((p) => fn(new Date(p.decidedAt || p.createdAt))).reduce((s, p) => s + p.amount, 0);
  const months = [];
  for (let k = 5; k >= 0; k -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    months.push({
      label: d.toLocaleString('en-GB', { month: 'short' }),
      amount: sumWhere((x) => x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth()),
    });
  }
  const states = db.institutions.map((i) => ({ i, a: instAccess(i) }));
  res.json({
    revenue: {
      month: months[months.length - 1].amount,
      year: sumWhere((x) => x.getFullYear() === now.getFullYear()),
      total: verified.reduce((s, p) => s + p.amount, 0),
      months,
    },
    institutions: {
      total: db.institutions.length,
      active: states.filter((x) => x.a.state === 'active' && !x.a.trial).length,
      trial: states.filter((x) => x.a.state === 'active' && x.a.trial).length,
      expired: states.filter((x) => x.a.state === 'expired').length,
      suspended: states.filter((x) => x.a.state === 'suspended').length,
    },
    people: {
      students: db.users.filter((u) => u.role === 'student').length,
      teachers: db.users.filter((u) => u.role === 'faculty').length,
    },
    pending: {
      applications: db.applications.filter((a) => ['new', 'reviewing'].includes(a.status)).length,
      payments: db.payments.filter((p) => p.status === 'pending').length,
    },
    expiringSoon: states
      .filter((x) => x.a.state === 'active' && x.a.daysLeft !== null && x.a.daysLeft <= 14)
      .sort((x, y) => x.a.daysLeft - y.a.daysLeft)
      .map((x) => ({ id: x.i.id, name: x.i.name, daysLeft: x.a.daysLeft, plan: x.a.plan, trial: x.a.trial })),
    recentApplications: [...db.applications].sort(newestFirst).slice(0, 5).map(appOut),
  });
});

// ---------- Applications ----------

// GET /api/company/applications?status=open|new|reviewing|approved|rejected|all
router.get('/applications', (req, res) => {
  const status = req.query.status || 'open';
  let list = store.db.applications;
  if (status === 'open') list = list.filter((a) => ['new', 'reviewing'].includes(a.status));
  else if (status !== 'all') list = list.filter((a) => a.status === status);
  const counts = {};
  ['new', 'reviewing', 'approved', 'rejected'].forEach((s) => { counts[s] = store.db.applications.filter((a) => a.status === s).length; });
  res.json({ applications: [...list].sort(newestFirst).map(appOut), counts });
});

const findApp = (id) => {
  const a = store.db.applications.find((x) => x.id === id);
  if (!a) throw new HttpError(404, 'Application not found.');
  return a;
};
const mustBeOpen = (a) => {
  if (!['new', 'reviewing'].includes(a.status)) throw new HttpError(400, `This application is already ${a.status}.`);
};

// POST /api/company/applications/:id/review  Mark as being reviewed.
router.post('/applications/:id/review', (req, res) => {
  const a = findApp(req.params.id);
  mustBeOpen(a);
  a.status = 'reviewing';
  a.notes.push({ by: req.user.name, at: store.now(), text: 'Started reviewing.' });
  store.save();
  res.json({ application: appOut(a) });
});

// POST /api/company/applications/:id/note  { text }  Internal note, never shown to the institution.
router.post('/applications/:id/note', (req, res) => {
  const a = findApp(req.params.id);
  const text = clean((req.body || {}).text, 500);
  if (!text) throw new HttpError(400, 'Write a note first.');
  a.notes.push({ by: req.user.name, at: store.now(), text });
  store.save();
  res.json({ application: appOut(a) });
});

// POST /api/company/applications/:id/approve  Creates the institution and its first admin.
router.post('/applications/:id/approve', ah(async (req, res) => {
  const a = findApp(req.params.id);
  mustBeOpen(a);
  if (store.db.institutions.some((i) => i.name.toLowerCase() === a.institution.name.toLowerCase())) {
    throw new HttpError(400, 'An institution with this name already exists. Reject this application or ask them to use their existing account.');
  }
  const { inst, admin, password } = await approveApplication(a, req.user);
  a.notes.push({ by: req.user.name, at: store.now(), text: 'Approved. Institution and admin account created.' });
  store.save();
  res.json({
    application: appOut(a),
    institution: instOut(inst),
    credentials: { name: admin.name, email: admin.email, phone: admin.phone, password, institution: inst.name },
  });
}));

// POST /api/company/applications/:id/reject  { reason }
router.post('/applications/:id/reject', (req, res) => {
  const a = findApp(req.params.id);
  mustBeOpen(a);
  const reason = clean((req.body || {}).reason, 300);
  if (reason.length < 5) throw new HttpError(400, 'Give a short reason. The institution sees it when they check their application.');
  Object.assign(a, { status: 'rejected', rejectReason: reason, decidedAt: store.now(), decidedBy: req.user.name });
  a.notes.push({ by: req.user.name, at: store.now(), text: `Rejected: ${reason}` });
  store.save();
  res.json({ application: appOut(a) });
});

// ---------- Institutions ----------

// GET /api/company/institutions
router.get('/institutions', (req, res) => {
  const list = [...store.db.institutions].sort((a, b) => a.name.localeCompare(b.name));
  res.json({ institutions: list.map(instOut) });
});

const findInst = (id) => {
  const i = store.instById(id);
  if (!i) throw new HttpError(404, 'Institution not found.');
  return i;
};

// POST /api/company/institutions/:id/suspend  { reason }  Owner only.
router.post('/institutions/:id/suspend', ownerOnly, (req, res) => {
  const i = findInst(req.params.id);
  const reason = clean((req.body || {}).reason, 200);
  if (reason.length < 5) throw new HttpError(400, 'Give a short reason for pausing this institution.');
  i.suspended = true;
  i.suspendReason = reason;
  notifyAdmins(i.id, `Campusly paused ${i.name}'s access: ${reason}`);
  store.save();
  res.json({ institution: instOut(i) });
});

// POST /api/company/institutions/:id/reactivate  Owner only.
router.post('/institutions/:id/reactivate', ownerOnly, (req, res) => {
  const i = findInst(req.params.id);
  i.suspended = false;
  i.suspendReason = null;
  notifyAdmins(i.id, `${i.name}'s Campusly access is active again.`);
  store.save();
  res.json({ institution: instOut(i) });
});

// POST /api/company/institutions/:id/extend  { days }  Owner only: goodwill extension.
router.post('/institutions/:id/extend', ownerOnly, (req, res) => {
  const i = findInst(req.params.id);
  const days = Math.round(Number((req.body || {}).days));
  if (!(days >= 1 && days <= 365)) throw new HttpError(400, 'Enter between 1 and 365 days.');
  const base = i.subscription && new Date(i.subscription.endsAt) > new Date() ? i.subscription.endsAt : store.now();
  i.subscription = { ...(i.subscription || { plan: 'starter', cycle: 'monthly', startsAt: store.now() }), endsAt: addDays(base, days) };
  notifyAdmins(i.id, `Campusly extended ${i.name}'s plan by ${days} days.`);
  store.save();
  res.json({ institution: instOut(i) });
});

// POST /api/company/institutions/:id/admins  { name, email }  Adds another admin with a first password.
router.post('/institutions/:id/admins', ah(async (req, res) => {
  const i = findInst(req.params.id);
  const name = clean((req.body || {}).name);
  const email = clean((req.body || {}).email, 120).toLowerCase();
  const errs = {};
  if (name.length < 3) errs.name = "Enter the admin's full name.";
  if (!EMAIL_RE.test(email)) errs.email = 'Enter a valid email.';
  else if (store.db.users.some((u) => u.institutionId === i.id && u.email === email)) errs.email = 'Someone at this institution already uses this email.';
  if (Object.keys(errs).length) throw new HttpError(400, 'Please fix the highlighted fields.', errs);
  const password = tempPassword();
  store.db.users.push({
    id: store.newId(), institutionId: i.id, role: 'admin', name, email, title: 'Administrator', status: 'active',
    passwordHash: await hashPassword(password), mustChangePassword: true, isDemo: false, createdAt: store.now(),
  });
  store.save();
  res.status(201).json({ institution: instOut(i), credentials: { name, email, password, institution: i.name } });
}));

// ---------- Payments (renewals and upgrades) ----------

// GET /api/company/payments?status=pending|verified|rejected|all
router.get('/payments', (req, res) => {
  const status = req.query.status || 'pending';
  const list = store.db.payments.filter((p) => status === 'all' || p.status === status);
  res.json({ payments: [...list].sort(newestFirst).map(paymentOut) });
});

const findPayment = (id) => {
  const p = store.db.payments.find((x) => x.id === id);
  if (!p) throw new HttpError(404, 'Payment not found.');
  if (p.status !== 'pending') throw new HttpError(400, `This payment is already ${p.status}.`);
  return p;
};

// POST /api/company/payments/:id/verify  The money arrived: extend or upgrade the plan.
router.post('/payments/:id/verify', (req, res) => {
  const p = findPayment(req.params.id);
  const inst = findInst(p.institutionId);
  extendSubscription(inst, { plan: p.plan, cycle: p.cycle, trial: false });
  Object.assign(p, { status: 'verified', decidedAt: store.now(), decidedBy: req.user.name });
  const plan = planByKey(p.plan);
  notifyAdmins(inst.id, `Payment ${p.trxId} confirmed. ${inst.name} is on ${plan.name} until ${new Date(inst.subscription.endsAt).toDateString()}.`);
  store.save();
  res.json({ payment: paymentOut(p), institution: instOut(inst) });
});

// POST /api/company/payments/:id/reject  { reason }
router.post('/payments/:id/reject', (req, res) => {
  const p = findPayment(req.params.id);
  const reason = clean((req.body || {}).reason, 200);
  if (reason.length < 5) throw new HttpError(400, 'Give a short reason, for example "Transaction ID not found".');
  Object.assign(p, { status: 'rejected', rejectReason: reason, decidedAt: store.now(), decidedBy: req.user.name });
  notifyAdmins(p.institutionId, `Campusly could not confirm payment ${p.trxId}: ${reason}`);
  store.save();
  res.json({ payment: paymentOut(p) });
});

// ---------- Company team (owner only) ----------

const teamOut = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, title: u.title || '', createdAt: u.createdAt });

// GET /api/company/team
router.get('/team', (req, res) => {
  const list = store.db.users.filter((u) => u.role === 'superadmin' || u.role === 'company').sort((a, b) => a.name.localeCompare(b.name));
  res.json({ team: list.map(teamOut), canManage: req.user.role === 'superadmin' });
});

// POST /api/company/team  { name, email, title }
router.post('/team', ownerOnly, ah(async (req, res) => {
  const name = clean((req.body || {}).name);
  const email = clean((req.body || {}).email, 120).toLowerCase();
  const title = clean((req.body || {}).title, 60) || 'Company staff';
  const errs = {};
  if (name.length < 3) errs.name = 'Enter their full name.';
  if (!EMAIL_RE.test(email)) errs.email = 'Enter a valid email.';
  else if (store.db.users.some((u) => (u.role === 'superadmin' || u.role === 'company') && u.email === email)) errs.email = 'This email is already on the team.';
  if (Object.keys(errs).length) throw new HttpError(400, 'Please fix the highlighted fields.', errs);
  const password = tempPassword();
  const u = {
    id: store.newId(), role: 'company', name, email, title, status: 'active',
    passwordHash: await hashPassword(password), mustChangePassword: true, isDemo: false, createdAt: store.now(),
  };
  store.db.users.push(u);
  store.save();
  res.status(201).json({ member: teamOut(u), credentials: { name, email, password } });
}));

// DELETE /api/company/team/:id
router.delete('/team/:id', ownerOnly, (req, res) => {
  const u = store.userById(req.params.id);
  if (!u || u.role !== 'company') throw new HttpError(404, 'Team member not found.');
  store.db.users = store.db.users.filter((x) => x.id !== u.id);
  store.db.notifications = store.db.notifications.filter((n) => n.to !== u.id);
  store.save();
  res.json({ ok: true });
});

// GET /api/company/plans
router.get('/plans', (req, res) => res.json({ plans: PLANS }));

module.exports = router;
