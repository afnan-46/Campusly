const express = require('express');
const store = require('../store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { toPublic } = require('../utils/users');
const { HttpError } = require('../utils/http');
const { instUser } = require('../utils/scope');
const { availability, firstFree, toMin, liveBookings } = require('../utils/time');

const router = express.Router();
router.use(requireAuth);

const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Profile, office hours and free slots for the next working week.
function profileWithSlots(f) {
  const days = availability(f.hours, liveBookings(store.db.appointments, f.id));
  return { id: f.id, name: f.name, title: f.title, room: f.room, email: f.email, hours: f.hours || [], days, nextFree: firstFree(days) };
}

// GET /api/faculty/courses  Student: enrolled courses. Faculty: courses they teach.
router.get('/courses', (req, res) => {
  const u = req.user;
  let list = store.db.courses.filter((c) => c.institutionId === u.institutionId);
  if (u.role === 'student') list = list.filter((c) => (u.courses || []).includes(c.code));
  if (u.role === 'faculty') list = list.filter((c) => c.facultyId === u.id);
  const courses = [...list].sort((a, b) => a.code.localeCompare(b.code)).map((c) => {
    const f = c.facultyId ? instUser(req, c.facultyId) : null;
    return { code: c.code, title: c.title, section: c.section, faculty: f ? profileWithSlots(f) : null };
  });
  res.json({ courses });
});

// GET /api/faculty/:id
router.get('/:id', (req, res, next) => {
  const f = instUser(req, req.params.id);
  if (!f || f.role !== 'faculty') return next(new HttpError(404, 'Teacher not found.'));
  res.json({ faculty: profileWithSlots(f) });
});

// POST /api/faculty/me/hours  { day, start, end }
router.post('/me/hours', requireRole('faculty'), (req, res, next) => {
  const f = req.user;
  const day = Number(req.body.day);
  const { start, end } = req.body;
  if (!(day >= 0 && day <= 6) || day === 5) return next(new HttpError(400, 'Choose a working day.'));
  if (!/^\d{2}:\d{2}$/.test(start || '') || !/^\d{2}:\d{2}$/.test(end || '')) return next(new HttpError(400, 'Enter both a start and an end time.'));
  if (toMin(end) - toMin(start) < 20) return next(new HttpError(400, 'Office hours need to be at least 20 minutes long.'));
  f.hours = f.hours || [];
  if (f.hours.some((h) => h.day === day && toMin(start) < toMin(h.end) && toMin(end) > toMin(h.start))) {
    return next(new HttpError(400, `These hours overlap with your existing ${DAYS_LONG[day]} hours.`));
  }
  f.hours.push({ _id: store.newId(), day, start, end });
  store.save();
  res.status(201).json({ user: toPublic(f) });
});

// DELETE /api/faculty/me/hours/:hourId  Existing bookings are kept.
router.delete('/me/hours/:hourId', requireRole('faculty'), (req, res, next) => {
  const f = req.user;
  const before = (f.hours || []).length;
  f.hours = (f.hours || []).filter((h) => h._id !== req.params.hourId);
  if (f.hours.length === before) return next(new HttpError(404, 'Those office hours were not found.'));
  store.save();
  res.json({ user: toPublic(f) });
});

module.exports = router;
