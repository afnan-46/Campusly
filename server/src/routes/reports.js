const express = require('express');
const fs = require('fs');
const store = require('../store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadPhoto } = require('../middleware/upload');
const { notify, notifyOffice } = require('../utils/notify');
const { isAdmin } = require('../utils/users');
const { HttpError } = require('../utils/http');
const { REPORT_STEPS, PRIORITIES } = require('../config/constants');

const router = express.Router();
router.use(requireAuth);

const isReporter = (u, r) => r.reporterId === u.id;
const canStaffSee = (u, r) => r.institutionId === u.institutionId && (isAdmin(u) || (u.role === 'staff' && r.dept === u.office));
const visible = (u) => store.db.reports.filter((r) => r.institutionId === u.institutionId && (isAdmin(u) || r.dept === u.office));
const newestFirst = (a, b) => b.createdAt.localeCompare(a.createdAt);

// Offices never learn who filed an anonymous report.
function serialize(r, viewer) {
  const mine = isReporter(viewer, r);
  return {
    id: r.code, title: r.title, category: r.category, location: r.location, description: r.description,
    priority: r.priority, anonymous: r.anonymous, reporterName: r.anonymous && !mine ? 'Anonymous' : r.reporterName,
    mine, dept: r.dept, photo: r.photo || null, status: r.status, createdAt: r.createdAt, history: r.history,
  };
}

function findByCode(req, code) {
  const r = store.db.reports.find((x) => x.institutionId === req.user.institutionId && x.code === String(code).toUpperCase());
  if (!r) throw new HttpError(404, 'Report not found.');
  return r;
}
function loadForStaff(req) {
  const r = findByCode(req, req.params.code);
  if (!canStaffSee(req.user, r)) throw new HttpError(404, 'Report not found.');
  return r;
}
function loadForReporter(req) {
  const r = findByCode(req, req.params.code);
  if (!isReporter(req.user, r)) throw new HttpError(404, 'Report not found.');
  return r;
}
const noteOf = (req) => String((req.body || {}).note || '').trim().slice(0, 600);
const addHistory = (r, status, note, by, kind = null) => r.history.push({ status, at: store.now(), note, by, kind });

// ---------- Reporter (students and faculty) ----------

// GET /api/reports/mine
router.get('/mine', requireRole('student', 'faculty'), (req, res) => {
  const list = store.db.reports.filter((r) => r.reporterId === req.user.id && r.institutionId === req.user.institutionId).sort(newestFirst);
  res.json({ reports: list.map((r) => serialize(r, req.user)) });
});

// POST /api/reports  multipart/form-data with an optional "photo" file
router.post('/', requireRole('student', 'faculty'), (req, res, next) => uploadPhoto(req, res, (err) => {
  if (err) return next(err.status ? err : new HttpError(400, err.code === 'LIMIT_FILE_SIZE' ? 'The photo must be smaller than 5 MB.' : 'The photo could not be uploaded.'));
  next();
}), (req, res) => {
  const u = req.user;
  const b = req.body || {};
  const inst = req.inst;
  const cat = inst.categories.find((c) => c.name === b.category);
  const errs = {};
  if (!cat) errs.category = 'Choose the kind of problem.';
  if (String(b.title || '').trim().length < 6) errs.title = 'Add a title of at least 6 characters.';
  if (!String(b.location || '').trim()) errs.location = 'Say where the problem is.';
  if (String(b.description || '').trim().length < 15) errs.description = 'Describe the problem in a sentence or two.';
  if (Object.keys(errs).length) {
    if (req.file) fs.unlink(req.file.path, () => {});
    throw new HttpError(400, 'Please fix the highlighted fields.', errs);
  }
  const { db } = store;
  const anonymous = b.anonymous === true || b.anonymous === 'true';
  const priority = PRIORITIES.includes(b.priority) ? b.priority : 'Normal';
  inst.reportCounter = (inst.reportCounter || 1000) + 1;
  const r = {
    institutionId: inst.id,
    code: `CP-${inst.reportCounter}`,
    title: String(b.title).trim().slice(0, 90),
    category: cat.name,
    location: String(b.location).trim().slice(0, 80),
    description: String(b.description).trim().slice(0, 2000),
    priority, anonymous,
    reporterId: u.id, reporterName: u.name,
    dept: cat.dept,
    photo: req.file ? { url: `/uploads/${req.file.filename}`, name: req.file.originalname } : null,
    status: 'Submitted',
    createdAt: store.now(),
    history: [],
  };
  addHistory(r, 'Submitted', '', anonymous ? 'Anonymous' : u.name);
  db.reports.push(r);
  notifyOffice(inst.id, cat.dept, `${priority === 'Urgent' ? 'Urgent report' : 'New report'} ${r.code}: ${r.title}.`);
  store.save();
  res.status(201).json({ report: serialize(r, u) });
});

// POST /api/reports/:code/comment  { note }
router.post('/:code/comment', requireRole('student', 'faculty'), (req, res) => {
  const r = loadForReporter(req);
  const note = noteOf(req);
  if (!note) throw new HttpError(400, 'Write something before adding it to the report.');
  if (r.status === 'Resolved') throw new HttpError(400, 'This report is resolved. Reopen it instead.');
  addHistory(r, r.status, note, r.anonymous ? 'Anonymous' : req.user.name, 'comment');
  notifyOffice(r.institutionId, r.dept, `More information added to ${r.code}.`);
  store.save();
  res.json({ report: serialize(r, req.user) });
});

// POST /api/reports/:code/reopen
router.post('/:code/reopen', requireRole('student', 'faculty'), (req, res) => {
  const r = loadForReporter(req);
  if (r.status !== 'Resolved') throw new HttpError(400, 'Only resolved reports can be reopened.');
  r.status = 'Acknowledged';
  addHistory(r, 'Acknowledged', 'Reporter says the problem is not fixed yet.', r.anonymous ? 'Anonymous' : req.user.name, 'reopen');
  notifyOffice(r.institutionId, r.dept, `${r.code} was reopened by the reporter.`);
  store.save();
  res.json({ report: serialize(r, req.user) });
});

// ---------- Office staff ----------

// GET /api/reports?status=open|all|Submitted|...&dept=...
router.get('/', requireRole('staff', 'admin'), (req, res) => {
  const u = req.user;
  const { status = 'open', dept = 'all' } = req.query;
  let list = visible(u);
  if (status === 'open') list = list.filter((r) => r.status !== 'Resolved');
  else if (REPORT_STEPS.includes(status)) list = list.filter((r) => r.status === status);
  if (isAdmin(u) && req.inst.offices.includes(dept)) list = list.filter((r) => r.dept === dept);
  // Urgent open reports first, then newest.
  const urgentOpen = (r) => (r.priority === 'Urgent' && r.status !== 'Resolved' ? 1 : 0);
  list = [...list].sort(newestFirst).sort((a, b) => urgentOpen(b) - urgentOpen(a));
  res.json({ reports: list.map((r) => serialize(r, u)) });
});

// GET /api/reports/summary
router.get('/summary', requireRole('staff', 'admin'), (req, res) => {
  const u = req.user;
  const all = [...visible(u)].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const counts = Object.fromEntries(REPORT_STEPS.map((s) => [s, all.filter((r) => r.status === s).length]));
  const urgent = all.filter((r) => r.priority === 'Urgent' && r.status !== 'Resolved').reverse();
  const weekAgo = Date.now() - 7 * 864e5;
  const resolvedWeek = all.filter((r) => r.status === 'Resolved' && new Date(r.history[r.history.length - 1].at) > weekAgo).length;
  const top = urgent[0] || all.find((r) => r.status === 'Submitted') || null;
  res.json({
    total: all.length, counts, resolvedWeek,
    urgent: urgent.map((r) => ({ id: r.code, title: r.title })),
    top: top ? serialize(top, u) : null,
  });
});

// GET /api/reports/:code  Staff in the right office, or the reporter.
router.get('/:code', (req, res) => {
  const r = findByCode(req, req.params.code);
  if (!isReporter(req.user, r) && !canStaffSee(req.user, r)) throw new HttpError(404, 'Report not found.');
  res.json({ report: serialize(r, req.user) });
});

// POST /api/reports/:code/advance  { note }
router.post('/:code/advance', requireRole('staff', 'admin'), (req, res) => {
  const r = loadForStaff(req);
  const next = REPORT_STEPS[REPORT_STEPS.indexOf(r.status) + 1];
  if (!next) throw new HttpError(400, 'This report is already resolved.');
  const note = noteOf(req);
  r.status = next;
  addHistory(r, next, note, r.dept);
  notify(r.reporterId, `${r.code} is now ${next.toLowerCase()}${note ? `: ${note}` : '.'}`, '/reports');
  store.save();
  res.json({ report: serialize(r, req.user) });
});

// POST /api/reports/:code/message  { note }
router.post('/:code/message', requireRole('staff', 'admin'), (req, res) => {
  const r = loadForStaff(req);
  const note = noteOf(req);
  if (!note) throw new HttpError(400, 'Write a message for the reporter first.');
  addHistory(r, r.status, note, r.dept, 'update');
  notify(r.reporterId, `Message about ${r.code}: ${note}`, '/reports');
  store.save();
  res.json({ report: serialize(r, req.user) });
});

// PATCH /api/reports/:code/dept  { dept }
router.patch('/:code/dept', requireRole('staff', 'admin'), (req, res) => {
  const r = loadForStaff(req);
  const dept = (req.body || {}).dept;
  if (!req.inst.offices.includes(dept)) throw new HttpError(400, 'Choose an office.');
  if (dept === r.dept) return res.json({ report: serialize(r, req.user), stillVisible: true });
  r.dept = dept;
  addHistory(r, r.status, `Now handled by ${dept}.`, req.user.name, 'reassign');
  notifyOffice(r.institutionId, dept, `${r.code} was moved to your office: ${r.title}.`);
  store.save();
  res.json({ report: serialize(r, req.user), stillVisible: canStaffSee(req.user, r) });
});

module.exports = router;
