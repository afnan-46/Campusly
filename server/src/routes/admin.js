// Institution admin: manage people, classes/courses, offices and settings, and see everything.
const express = require('express');
const store = require('../store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { hashPassword, toPublic } = require('../utils/users');
const { HttpError, ah } = require('../utils/http');
const { notify } = require('../utils/notify');
const { instUsers, instUser, termsOf } = require('../utils/scope');
const { ACTIVE_APPT } = require('../config/constants');
const { isPast } = require('../utils/time');
const { planByKey, cycleByKey, PLANS, CYCLES, PAY_TO, priceFor, accessOf } = require('../config/plans');
const { tempPassword, readPayment, paymentOut } = require('../utils/company');
const bcrypt = require('bcryptjs');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const ROLES = ['student', 'faculty', 'staff', 'admin'];
const SID_RE = /^[A-Za-z0-9][A-Za-z0-9\-/. ]{1,23}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const clean = (v, max = 80) => String(v == null ? '' : v).trim().replace(/\s+/g, ' ').slice(0, max);
const byName = (a, b) => a.name.localeCompare(b.name);
const instCourses = (req) => store.db.courses.filter((c) => c.institutionId === req.inst.id);

// ---------- Overview ----------

// GET /api/admin/overview
router.get('/overview', (req, res) => {
  const inst = req.inst;
  const users = instUsers(req);
  const count = (role) => users.filter((u) => u.role === role).length;
  const appts = store.db.appointments.filter((a) => a.institutionId === inst.id);
  const reports = store.db.reports.filter((r) => r.institutionId === inst.id);
  const upcoming = appts.filter((a) => ACTIVE_APPT.includes(a.status) && !isPast(a.date, a.time));
  res.json({
    counts: {
      student: users.filter((u) => u.role === 'student' && u.status !== 'pending' && u.status !== 'rejected').length, faculty: count('faculty'), staff: count('staff'), admin: count('admin'),
      courses: instCourses(req).length, offices: inst.offices.length,
      upcoming: upcoming.length, pending: upcoming.filter((a) => a.status === 'Pending').length,
      openReports: reports.filter((r) => r.status !== 'Resolved').length,
      urgent: reports.filter((r) => r.status !== 'Resolved' && r.priority === 'Urgent').length,
      pendingPeople: users.filter((u) => u.status === 'pending').length,
    },
    // Setup checks shown as a to-do list on the admin dashboard.
    gaps: {
      noTeacherCourses: instCourses(req).filter((c) => !c.facultyId || !instUser(req, c.facultyId)).map((c) => c.code),
      noAdvisorStudents: users.filter((u) => u.role === 'student' && !(u.advisorId && instUser(req, u.advisorId))).length,
      officesWithoutStaff: inst.offices.filter((o) => !users.some((u) => u.role === 'staff' && u.office === o)),
      teachersWithoutHours: users.filter((u) => u.role === 'faculty' && !(u.hours || []).length).map((u) => u.name),
    },
  });
});

// GET /api/admin/appointments?status=upcoming|past|all
router.get('/appointments', (req, res) => {
  const { status = 'upcoming' } = req.query;
  let list = store.db.appointments.filter((a) => a.institutionId === req.inst.id);
  if (status === 'upcoming') list = list.filter((a) => ACTIVE_APPT.includes(a.status) && !isPast(a.date, a.time));
  if (status === 'past') list = list.filter((a) => !(ACTIVE_APPT.includes(a.status) && !isPast(a.date, a.time)));
  list = [...list].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  if (status !== 'upcoming') list.reverse();
  res.json({
    appointments: list.slice(0, 200).map((a) => {
      const s = store.userById(a.studentId) || {};
      const f = store.userById(a.facultyId) || {};
      return {
        id: a.id, type: a.type, course: a.course, date: a.date, time: a.time, mode: a.mode, agenda: a.agenda, status: a.status,
        past: isPast(a.date, a.time), studentName: s.name || 'Removed account', sid: s.sid, facultyName: f.name || 'Removed account', facultyRoom: f.room,
      };
    }),
  });
});

// ---------- People ----------

function personOut(req, u) {
  const out = { ...toPublic(u), createdAt: u.createdAt, isDemo: !!u.isDemo };
  if (u.role === 'student') {
    const adv = u.advisorId ? instUser(req, u.advisorId) : null;
    out.advisorName = adv ? adv.name : null;
  }
  if (u.role === 'faculty') {
    out.teaches = instCourses(req).filter((c) => c.facultyId === u.id).map((c) => c.code);
    out.advisees = instUsers(req, 'student').filter((s) => s.advisorId === u.id).length;
  }
  return out;
}

// GET /api/admin/people?role=student
router.get('/people', (req, res) => {
  const role = ROLES.includes(req.query.role) ? req.query.role : null;
  const all = instUsers(req).filter((u) => u.status !== 'rejected');
  const pending = all.filter((u) => u.status === 'pending');
  const list = all.filter((u) => u.status !== 'pending' && (!role || u.role === role)).sort(byName);
  res.json({
    people: list.map((u) => personOut(req, u)),
    pending: pending.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map((u) => personOut(req, u)),
    limits: limitsOut(req),
  });
});

// How many students and staff the plan allows, and how many exist.
function limitsOut(req) {
  const plan = planByKey(req.inst.subscription && req.inst.subscription.plan);
  const users = instUsers(req).filter((u) => u.status !== 'rejected');
  return {
    plan: plan ? plan.name : null,
    students: { used: users.filter((u) => u.role === 'student').length, max: plan ? plan.limits.students : null },
    staff: { used: users.filter((u) => u.role !== 'student').length, max: plan ? plan.limits.staff : null },
    canImport: !plan || !!plan.features.import,
  };
}
function checkLimit(req, role, adding = 1) {
  const l = limitsOut(req);
  const g = role === 'student' ? l.students : l.staff;
  if (g.max && g.used + adding > g.max) {
    throw new HttpError(403, `The ${l.plan} plan allows ${g.max} ${role === 'student' ? 'students' : 'teachers and staff'}. Upgrade on the Billing page to add more.`);
  }
}

// Checks and cleans the fields for one person. `existing` is set when editing.
function readPerson(req, body, role, existing) {
  const inst = req.inst;
  const t = termsOf(inst);
  const errs = {};
  const p = { name: clean(body.name), email: clean(body.email, 120).toLowerCase() };
  if (p.name.length < 3) errs.name = 'Enter the full name.';
  const taken = (field, value) => value && instUsers(req).some((u) => u.id !== (existing && existing.id) && u[field] && u[field].toLowerCase() === value.toLowerCase());

  if (role === 'student') {
    p.sid = clean(body.sid, 24);
    if (!SID_RE.test(p.sid)) errs.sid = `Enter a ${t.sid.toLowerCase()} (letters, numbers and dashes).`;
    else if (taken('sid', p.sid)) errs.sid = `Another student already has this ${t.sid.toLowerCase()}.`;
    p.dept = body.dept;
    if (!inst.groups.includes(p.dept)) errs.dept = `Choose a ${t.group.toLowerCase()}.`;
    p.advisorId = body.advisorId || null;
    if (p.advisorId) {
      const adv = instUser(req, p.advisorId);
      if (!adv || adv.role !== 'faculty') errs.advisorId = `Choose a ${t.advisor.toLowerCase()} from the list.`;
    }
    const codes = new Set(instCourses(req).map((c) => c.code));
    p.courses = [...new Set((Array.isArray(body.courses) ? body.courses : []).filter((c) => codes.has(c)))];
    if (p.email && !EMAIL_RE.test(p.email)) errs.email = 'Enter a valid email, or leave it empty.';
  } else {
    if (!EMAIL_RE.test(p.email)) errs.email = 'Enter a valid email. They sign in with it.';
    p.title = clean(body.title);
  }
  if (p.email && !errs.email && taken('email', p.email)) errs.email = 'Another account already uses this email.';
  if (role === 'faculty') p.room = clean(body.room, 40);
  if (role === 'staff') {
    p.office = body.office;
    if (!inst.offices.includes(p.office)) errs.office = 'Choose an office.';
  }
  if (!existing && body.password && String(body.password).length < 6) errs.password = 'Use at least 6 characters, or leave it empty to create one.';
  if (Object.keys(errs).length) throw new HttpError(400, 'Please fix the highlighted fields.', errs);
  return p;
}

// POST /api/admin/people  { role, name, email, password, ...role fields }
router.post('/people', ah(async (req, res) => {
  const body = req.body || {};
  if (!ROLES.includes(body.role)) throw new HttpError(400, 'Choose what kind of account to add.');
  const p = readPerson(req, body, body.role);
  checkLimit(req, body.role);
  const password = body.password || tempPassword();
  const user = {
    id: store.newId(), institutionId: req.inst.id, role: body.role, ...p, status: 'active',
    passwordHash: await hashPassword(password), mustChangePassword: true, isDemo: false, createdAt: store.now(),
  };
  if (body.role === 'faculty') user.hours = [];
  store.db.users.push(user);
  notify(user.id, `Welcome to Campusly at ${req.inst.name}. Your account was created by ${req.user.name}.`, '/');
  store.save();
  // The temporary password is shown once, so the admin can hand it over.
  res.status(201).json({ person: personOut(req, user), temporaryPassword: password });
}));

// PATCH /api/admin/people/:id
router.patch('/people/:id', (req, res) => {
  const u = instUser(req, req.params.id);
  if (!u) throw new HttpError(404, 'Person not found.');
  const p = readPerson(req, req.body || {}, u.role, u);
  Object.assign(u, p);
  store.save();
  res.json({ person: personOut(req, u) });
});

// POST /api/admin/people/:id/password  { password }
router.post('/people/:id/password', ah(async (req, res) => {
  const u = instUser(req, req.params.id);
  if (!u) throw new HttpError(404, 'Person not found.');
  const given = (req.body || {}).password;
  if (given && String(given).length < 6) throw new HttpError(400, 'Use at least 6 characters, or leave it empty to create one.');
  const password = given || tempPassword();
  u.passwordHash = await hashPassword(password);
  u.mustChangePassword = true;
  store.save();
  res.json({ message: `New temporary password set for ${u.name}. They must change it when they sign in.`, temporaryPassword: password });
}));

// DELETE /api/admin/people/:id  Upcoming meetings are cancelled; reports are kept.
router.delete('/people/:id', (req, res) => {
  const u = instUser(req, req.params.id);
  if (!u) throw new HttpError(404, 'Person not found.');
  if (u.id === req.user.id) throw new HttpError(400, 'You cannot remove your own account.');
  if (u.role === 'admin' && instUsers(req, 'admin').length <= 1) throw new HttpError(400, 'An institution needs at least one admin.');
  const { db } = store;
  const t = termsOf(req.inst);
  db.appointments
    .filter((a) => (a.studentId === u.id || a.facultyId === u.id) && ACTIVE_APPT.includes(a.status) && !isPast(a.date, a.time))
    .forEach((a) => {
      a.status = 'Cancelled';
      if (a.studentId !== u.id) notify(a.studentId, `Your meeting with ${u.name} was cancelled because the account was removed.`, '/appointments?tab=past');
      if (a.facultyId !== u.id) notify(a.facultyId, `${u.name}'s booking was cancelled because the account was removed.`, '/schedule');
    });
  if (u.role === 'faculty') {
    db.courses.filter((c) => c.institutionId === req.inst.id && c.facultyId === u.id).forEach((c) => { c.facultyId = null; });
    instUsers(req, 'student').filter((s) => s.advisorId === u.id).forEach((s) => {
      s.advisorId = null;
      notify(s.id, `Your ${t.advisor.toLowerCase()} changed. The admin will assign a new one.`, '/');
    });
  }
  db.notifications = db.notifications.filter((n) => n.to !== u.id);
  db.users = db.users.filter((x) => x.id !== u.id);
  store.save();
  res.json({ ok: true });
});

// ---------- Classes / courses ----------

function courseOut(req, c) {
  const f = c.facultyId ? instUser(req, c.facultyId) : null;
  const students = instUsers(req, 'student').filter((s) => (s.courses || []).includes(c.code));
  return {
    code: c.code, title: c.title, section: c.section, facultyId: f ? f.id : null, facultyName: f ? f.name : null,
    studentIds: students.map((s) => s.id), studentCount: students.length,
  };
}

function readCourse(req, body, existing) {
  const errs = {};
  const t = termsOf(req.inst);
  const out = { title: clean(body.title, 90), section: clean(body.section, 20) };
  if (!existing) {
    out.code = clean(body.code, 16).toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z0-9][A-Z0-9-]{1,15}$/.test(out.code)) errs.code = 'Use a short code with letters, numbers or dashes, e.g. MATH-8.';
    else if (instCourses(req).some((c) => c.code === out.code)) errs.code = 'This code is already used.';
  }
  if (out.title.length < 2) errs.title = `Enter the ${t.course.toLowerCase()} name.`;
  out.facultyId = body.facultyId || null;
  if (out.facultyId) {
    const f = instUser(req, out.facultyId);
    if (!f || f.role !== 'faculty') errs.facultyId = 'Choose a teacher from the list.';
  }
  if (Object.keys(errs).length) throw new HttpError(400, 'Please fix the highlighted fields.', errs);
  return out;
}

// Sets exactly which students are enrolled in a course.
function setEnrolment(req, code, studentIds) {
  if (!Array.isArray(studentIds)) return;
  const want = new Set(studentIds);
  instUsers(req, 'student').forEach((s) => {
    const has = (s.courses || []).includes(code);
    if (want.has(s.id) && !has) s.courses = [...(s.courses || []), code];
    if (!want.has(s.id) && has) s.courses = s.courses.filter((x) => x !== code);
  });
}

// GET /api/admin/courses
router.get('/courses', (req, res) => {
  const list = [...instCourses(req)].sort((a, b) => a.code.localeCompare(b.code));
  res.json({ courses: list.map((c) => courseOut(req, c)) });
});

// POST /api/admin/courses  { code, title, section, facultyId, studentIds }
router.post('/courses', (req, res) => {
  const c = { institutionId: req.inst.id, ...readCourse(req, req.body || {}) };
  store.db.courses.push(c);
  setEnrolment(req, c.code, (req.body || {}).studentIds);
  store.save();
  res.status(201).json({ course: courseOut(req, c) });
});

// PATCH /api/admin/courses/:code  { title, section, facultyId, studentIds }
router.patch('/courses/:code', (req, res) => {
  const c = instCourses(req).find((x) => x.code === req.params.code);
  if (!c) throw new HttpError(404, 'Not found.');
  Object.assign(c, readCourse(req, req.body || {}, c));
  setEnrolment(req, c.code, (req.body || {}).studentIds);
  store.save();
  res.json({ course: courseOut(req, c) });
});

// DELETE /api/admin/courses/:code  Students are un-enrolled; past meetings keep the code.
router.delete('/courses/:code', (req, res) => {
  const c = instCourses(req).find((x) => x.code === req.params.code);
  if (!c) throw new HttpError(404, 'Not found.');
  setEnrolment(req, c.code, []);
  store.db.courses = store.db.courses.filter((x) => x !== c);
  store.save();
  res.json({ ok: true });
});

// ---------- Offices and report routing ----------

function officesOut(req) {
  const inst = req.inst;
  const staff = instUsers(req, 'staff');
  const reports = store.db.reports.filter((r) => r.institutionId === inst.id);
  return {
    offices: inst.offices.map((o) => ({
      name: o,
      staff: staff.filter((s) => s.office === o).map((s) => s.name),
      open: reports.filter((r) => r.dept === o && r.status !== 'Resolved').length,
      categories: inst.categories.filter((c) => c.dept === o).map((c) => c.name),
    })),
    categories: inst.categories,
  };
}

// GET /api/admin/offices
router.get('/offices', (req, res) => res.json(officesOut(req)));

// POST /api/admin/offices  { name }
router.post('/offices', (req, res) => {
  const name = clean((req.body || {}).name, 50);
  if (name.length < 2) throw new HttpError(400, 'Enter the office name.');
  if (req.inst.offices.some((o) => o.toLowerCase() === name.toLowerCase())) throw new HttpError(400, 'This office already exists.');
  req.inst.offices.push(name);
  store.save();
  res.status(201).json(officesOut(req));
});

// PATCH /api/admin/offices  { from, to }  Rename an office everywhere it is used.
router.patch('/offices', (req, res) => {
  const inst = req.inst;
  const from = (req.body || {}).from;
  const to = clean((req.body || {}).to, 50);
  if (!inst.offices.includes(from)) throw new HttpError(404, 'Office not found.');
  if (to.length < 2) throw new HttpError(400, 'Enter the new name.');
  if (to !== from && inst.offices.some((o) => o.toLowerCase() === to.toLowerCase())) throw new HttpError(400, 'Another office already has this name.');
  inst.offices = inst.offices.map((o) => (o === from ? to : o));
  inst.categories.forEach((c) => { if (c.dept === from) c.dept = to; });
  instUsers(req, 'staff').forEach((s) => { if (s.office === from) s.office = to; });
  store.db.reports.forEach((r) => { if (r.institutionId === inst.id && r.dept === from) r.dept = to; });
  store.save();
  res.json(officesOut(req));
});

// DELETE /api/admin/offices  { name, moveTo }  Its reports, categories and staff move to another office.
router.delete('/offices', (req, res) => {
  const inst = req.inst;
  const { name, moveTo } = req.body || {};
  if (!inst.offices.includes(name)) throw new HttpError(404, 'Office not found.');
  if (inst.offices.length <= 1) throw new HttpError(400, 'Keep at least one office.');
  if (!inst.offices.includes(moveTo) || moveTo === name) throw new HttpError(400, 'Choose another office to take over its reports and staff.');
  inst.offices = inst.offices.filter((o) => o !== name);
  inst.categories.forEach((c) => { if (c.dept === name) c.dept = moveTo; });
  instUsers(req, 'staff').forEach((s) => { if (s.office === name) s.office = moveTo; });
  store.db.reports.forEach((r) => { if (r.institutionId === inst.id && r.dept === name) r.dept = moveTo; });
  store.save();
  res.json(officesOut(req));
});

// PATCH /api/admin/categories  { name, dept }  Which office receives a kind of report.
router.patch('/categories', (req, res) => {
  const { name, dept } = req.body || {};
  const c = req.inst.categories.find((x) => x.name === name);
  if (!c) throw new HttpError(404, 'Report type not found.');
  if (!req.inst.offices.includes(dept)) throw new HttpError(400, 'Choose an office.');
  c.dept = dept;
  store.save();
  res.json(officesOut(req));
});

// ---------- Institution settings ----------

const settingsOut = (inst) => ({
  name: inst.name, shortName: inst.shortName, city: inst.city, type: inst.type, groups: inst.groups, locations: inst.locations,
});

// GET /api/admin/settings
router.get('/settings', (req, res) => res.json({ settings: settingsOut(req.inst) }));

// PATCH /api/admin/settings  { city, groups: [], locations: [] }  The name is set by the Campusly owner.
router.patch('/settings', (req, res) => {
  const inst = req.inst;
  const b = req.body || {};
  const list = (v, max) => [...new Set((Array.isArray(v) ? v : []).map((x) => clean(x, 40)).filter(Boolean))].slice(0, max);
  if (b.city !== undefined) inst.city = clean(b.city, 40);
  if (b.groups !== undefined) {
    const groups = list(b.groups, 60);
    if (!groups.length) throw new HttpError(400, `Keep at least one ${termsOf(inst).group.toLowerCase()}.`);
    inst.groups = groups;
  }
  if (b.locations !== undefined) inst.locations = list(b.locations, 100);
  store.save();
  res.json({ settings: settingsOut(inst) });
});

// ---------- Sign-up approvals ----------

// POST /api/admin/people/:id/approve
router.post('/people/:id/approve', (req, res) => {
  const u = instUser(req, req.params.id);
  if (!u || u.status !== 'pending') throw new HttpError(404, 'This request is no longer waiting.');
  checkLimit(req, u.role);
  u.status = 'active';
  u.approvedAt = store.now();
  notify(u.id, `Your account at ${req.inst.name} was approved. You can sign in now.`, '/');
  store.save();
  res.json({ person: personOut(req, u) });
});

// POST /api/admin/people/:id/reject  { reason }
router.post('/people/:id/reject', (req, res) => {
  const u = instUser(req, req.params.id);
  if (!u || u.status !== 'pending') throw new HttpError(404, 'This request is no longer waiting.');
  u.status = 'rejected';
  u.rejectReason = clean((req.body || {}).reason, 200);
  store.save();
  res.json({ ok: true });
});

// POST /api/admin/people/approve-all
router.post('/pending/approve-all', (req, res) => {
  const list = instUsers(req).filter((u) => u.status === 'pending');
  let done = 0;
  for (const u of list) {
    try { checkLimit(req, u.role); } catch (e) { break; }
    u.status = 'active';
    u.approvedAt = store.now();
    notify(u.id, `Your account at ${req.inst.name} was approved. You can sign in now.`, '/');
    done += 1;
  }
  store.save();
  res.json({ approved: done, left: list.length - done });
});

// ---------- Import from Excel / CSV ----------
// The browser reads the file and sends its rows as JSON. "preview" only checks them;
// "commit" creates the accounts that passed the check.

const IMPORT_MAX = 2000;
const HEADER_ALIASES = {
  name: ['name', 'full name', 'student name', 'teacher name'],
  sid: ['id', 'student id', 'roll', 'roll no', 'roll number', 'sid', 'registration no'],
  email: ['email', 'email address', 'e-mail'],
  group: ['class', 'group', 'department', 'dept', 'section', 'program', 'programme'],
  advisor: ['advisor', 'adviser', 'class teacher', 'guide teacher', 'advisor email', 'teacher email'],
  title: ['title', 'designation', 'position'],
  room: ['room'],
  phone: ['phone', 'mobile'],
};
function normaliseRow(raw) {
  const low = {};
  Object.keys(raw || {}).forEach((k) => { low[String(k).trim().toLowerCase()] = raw[k]; });
  const out = {};
  Object.entries(HEADER_ALIASES).forEach(([field, names]) => {
    const hit = names.find((n) => low[n] !== undefined && String(low[n]).trim() !== '');
    if (hit) out[field] = clean(low[hit], 120);
  });
  return out;
}

function checkImportRows(req, role, rows) {
  const inst = req.inst;
  const t = termsOf(inst);
  const users = instUsers(req);
  const seenSid = new Set();
  const seenEmail = new Set();
  const groupOf = (v) => inst.groups.find((g) => g.toLowerCase() === String(v || '').toLowerCase());
  const teachers = users.filter((u) => u.role === 'faculty');
  const results = rows.map((raw, i) => {
    const r = normaliseRow(raw);
    const errors = [];
    if (!r.name || r.name.length < 3) errors.push('Name is missing');
    const email = (r.email || '').toLowerCase();
    if (role === 'student') {
      if (!r.sid || !SID_RE.test(r.sid)) errors.push(`${t.sid} is missing or has odd characters`);
      else if (users.some((u) => u.sid && u.sid.toLowerCase() === r.sid.toLowerCase()) || seenSid.has(r.sid.toLowerCase())) errors.push(`${t.sid} already exists`);
      const g = groupOf(r.group);
      if (!g) errors.push(`${t.group} "${r.group || ''}" is not set up in your institution`);
      else r.group = g;
      if (email && !EMAIL_RE.test(email)) errors.push('Email is not valid');
      let adv = null;
      if (r.advisor) {
        const a = r.advisor.toLowerCase();
        adv = teachers.find((x) => (x.email || '').toLowerCase() === a || x.name.toLowerCase() === a);
        if (!adv) errors.push(`${t.advisor} "${r.advisor}" was not found`);
      }
      r.advisorId = adv ? adv.id : null;
    } else if (!EMAIL_RE.test(email)) errors.push('A valid email is needed');
    if (email && !errors.includes('Email is not valid')) {
      if (users.some((u) => (u.email || '').toLowerCase() === email) || seenEmail.has(email)) errors.push('Email already used by another account');
    }
    if (!errors.length) {
      if (r.sid) seenSid.add(r.sid.toLowerCase());
      if (email) seenEmail.add(email);
    }
    return { line: i + 2, ...r, email, errors };
  });
  return results;
}

// POST /api/admin/people/import  { role: 'student'|'faculty', mode: 'preview'|'commit', rows: [...] }
router.post('/people/import', express.json({ limit: '4mb' }), ah(async (req, res) => {
  const { role, mode, rows } = req.body || {};
  if (!['student', 'faculty'].includes(role)) throw new HttpError(400, 'Choose students or teachers to import.');
  if (!limitsOut(req).canImport) throw new HttpError(403, 'Importing from Excel is part of the Standard and Premium plans. You can add people one by one, or upgrade on the Billing page.');
  if (!Array.isArray(rows) || !rows.length) throw new HttpError(400, 'The file has no rows.');
  if (rows.length > IMPORT_MAX) throw new HttpError(400, `Import up to ${IMPORT_MAX} people at a time.`);
  const checked = checkImportRows(req, role, rows);
  const good = checked.filter((r) => !r.errors.length);
  if (mode !== 'commit') {
    return res.json({ total: checked.length, valid: good.length, invalid: checked.length - good.length, rows: checked.slice(0, 500), limits: limitsOut(req) });
  }
  checkLimit(req, role, good.length);
  const created = [];
  for (const r of good) {
    const password = tempPassword();
    const user = {
      id: store.newId(), institutionId: req.inst.id, role, name: r.name, email: r.email, status: 'active',
      passwordHash: await bcrypt.hash(password, 8), mustChangePassword: true, isDemo: false, createdAt: store.now(), importedAt: store.now(),
    };
    if (role === 'student') {
      Object.assign(user, {
        sid: r.sid, dept: r.group, advisorId: r.advisorId,
        courses: [],
      });
    } else Object.assign(user, { title: r.title || 'Teacher', room: r.room || '', hours: [] });
    store.db.users.push(user);
    created.push({ name: user.name, sid: user.sid || '', email: user.email, password });
  }
  store.save();
  res.json({ created: created.length, skipped: checked.length - good.length, credentials: created, errors: checked.filter((r) => r.errors.length).slice(0, 500) });
}));

// ---------- Join codes ----------

const codeOut = (req, j) => {
  const adv = j.advisorId ? instUser(req, j.advisorId) : null;
  return { id: j.id, code: j.code, group: j.group, advisorId: j.advisorId || null, advisorName: adv ? adv.name : null,
    active: !!j.active, expiresAt: j.expiresAt || null, uses: j.uses || 0, createdAt: j.createdAt };
};
const instCodes = (req) => store.db.joinCodes.filter((j) => j.institutionId === req.inst.id);

function newCode(inst) {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    let c = '';
    for (let i = 0; i < 6; i += 1) c += letters[Math.floor(Math.random() * letters.length)];
    if (!store.db.joinCodes.some((j) => j.code === c)) return c;
  }
}

// GET /api/admin/join-codes
router.get('/join-codes', (req, res) => res.json({ codes: instCodes(req).map((j) => codeOut(req, j)) }));

// POST /api/admin/join-codes  { group, advisorId, expiresAt }
router.post('/join-codes', (req, res) => {
  const b = req.body || {};
  const errs = {};
  if (!req.inst.groups.includes(b.group)) errs.group = `Choose a ${termsOf(req.inst).group.toLowerCase()}.`;
  if (b.advisorId) {
    const a = instUser(req, b.advisorId);
    if (!a || a.role !== 'faculty') errs.advisorId = 'Choose a teacher from the list.';
  }
  let expiresAt = null;
  if (b.expiresAt) {
    const d = new Date(b.expiresAt);
    if (Number.isNaN(d.getTime()) || d < new Date()) errs.expiresAt = 'Choose a date in the future, or leave it empty.';
    else expiresAt = new Date(d.setHours(23, 59, 59, 999)).toISOString();
  }
  if (Object.keys(errs).length) throw new HttpError(400, 'Please fix the highlighted fields.', errs);
  const j = {
    id: store.newId(), institutionId: req.inst.id, code: newCode(req.inst), group: b.group, advisorId: b.advisorId || null,
    active: true, expiresAt, uses: 0, createdAt: store.now(),
  };
  store.db.joinCodes.push(j);
  store.save();
  res.status(201).json({ code: codeOut(req, j) });
});

// PATCH /api/admin/join-codes/:id  { active }
router.patch('/join-codes/:id', (req, res) => {
  const j = instCodes(req).find((x) => x.id === req.params.id);
  if (!j) throw new HttpError(404, 'Code not found.');
  j.active = !!(req.body || {}).active;
  store.save();
  res.json({ code: codeOut(req, j) });
});

// DELETE /api/admin/join-codes/:id
router.delete('/join-codes/:id', (req, res) => {
  const j = instCodes(req).find((x) => x.id === req.params.id);
  if (!j) throw new HttpError(404, 'Code not found.');
  store.db.joinCodes = store.db.joinCodes.filter((x) => x !== j);
  store.save();
  res.json({ ok: true });
});

// ---------- Billing ----------

function billingOut(req) {
  const inst = req.inst;
  const s = inst.subscription || {};
  const payments = store.db.payments.filter((p) => p.institutionId === inst.id)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map(paymentOut);
  return {
    access: accessOf(inst), subscription: inst.subscription || null,
    plan: planByKey(s.plan), cycle: cycleByKey(s.cycle),
    limits: limitsOut(req), payments, payTo: PAY_TO,
    plans: PLANS.map((p) => ({ ...p, prices: Object.fromEntries(CYCLES.map((c) => [c.key, priceFor(p.key, c.key)])) })),
    cycles: CYCLES, pendingPayment: payments.some((p) => p.status === 'pending'),
  };
}

// GET /api/admin/billing
router.get('/billing', (req, res) => res.json(billingOut(req)));

// POST /api/admin/billing/renew  { plan, cycle, method, trxId, payerNumber }
router.post('/billing/renew', (req, res) => {
  const errs = {};
  const pay = readPayment(req.body || {}, errs, { allowTrial: false });
  const plan = planByKey(pay.plan);
  if (plan && plan.limits.students) {
    const l = limitsOut(req);
    if (l.students.used > plan.limits.students) errs.plan = `You have ${l.students.used} students. ${plan.name} allows ${plan.limits.students}. Choose a bigger plan.`;
  }
  if (Object.keys(errs).length) throw new HttpError(400, 'Please fix the highlighted fields.', errs);
  if (store.db.payments.some((p) => p.institutionId === req.inst.id && p.status === 'pending')) {
    throw new HttpError(400, 'A payment is already waiting to be checked. We usually confirm within one working day.');
  }
  const p = {
    id: store.newId(), institutionId: req.inst.id, kind: (req.inst.subscription || {}).plan === pay.plan ? 'renew' : 'change',
    plan: pay.plan, cycle: pay.cycle, amount: pay.amount, method: pay.method, trxId: pay.trxId, payerNumber: pay.payerNumber,
    status: 'pending', createdAt: store.now(),
  };
  store.db.payments.push(p);
  require('../utils/notify').notifyCompany(`${req.inst.name} sent a payment of ৳${p.amount} (${p.trxId}). Please check it.`, '/payments');
  store.save();
  res.status(201).json(billingOut(req));
});

module.exports = router;
