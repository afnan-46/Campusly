const express = require('express');
const store = require('../store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { isAdmin } = require('../utils/users');

const router = express.Router();
router.use(requireAuth, requireRole('staff', 'admin'));

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

// GET /api/insights  Response times and where students ask for help.
router.get('/', (req, res) => {
  const u = req.user;
  const admin = isAdmin(u);
  const { db } = store;
  const inst = req.inst;
  const reports = db.reports.filter((r) => r.institutionId === inst.id && (admin || r.dept === u.office));
  const appts = db.appointments.filter((a) => a.institutionId === inst.id);
  const faculty = db.users.filter((x) => x.role === 'faculty' && x.institutionId === inst.id).sort((a, b) => a.name.localeCompare(b.name));

  // Hours from submission to the first time a report reached a status.
  const hoursTo = (status) => reports.map((r) => {
    const s = r.history.find((h) => h.status === 'Submitted' && !h.kind);
    const k = r.history.find((h) => h.status === status && !h.kind);
    return s && k ? (new Date(k.at) - new Date(s.at)) / 36e5 : null;
  }).filter((x) => x != null);

  const decided = appts.filter((a) => !['Pending', 'Cancelled'].includes(a.status));
  const accepted = decided.filter((a) => a.status !== 'Declined').length;

  res.json({
    scope: admin ? 'All offices' : u.office,
    avgAckHours: avg(hoursTo('Acknowledged')),
    avgResolveHours: avg(hoursTo('Resolved')),
    received: reports.length,
    acceptRate: decided.length ? Math.round((accepted / decided.length) * 100) : null,
    byCategory: inst.categories.map((c) => [c.name, reports.filter((r) => r.category === c.name).length]),
    openByOffice: inst.offices.map((d) => [d, reports.filter((r) => r.dept === d && r.status !== 'Resolved').length]),
    byFaculty: faculty.map((f) => [f.name, appts.filter((a) => a.facultyId === f.id && a.status !== 'Cancelled').length]),
  });
});

module.exports = router;
