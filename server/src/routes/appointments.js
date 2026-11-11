const express = require('express');
const store = require('../store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { notify } = require('../utils/notify');
const { HttpError } = require('../utils/http');
const { isPast, slotsFor, workDays, fmtDate, fmtTime } = require('../utils/time');
const { ACTIVE_APPT } = require('../config/constants');
const { instUser, termsOf } = require('../utils/scope');

const router = express.Router();
router.use(requireAuth);

const what = (a, inst) => { const t = termsOf(inst); return a.type === 'Advising' ? t.advisingAppt : `${a.course} ${t.courseAppt}`; };

function serialize(a) {
  const s = store.userById(a.studentId) || {};
  const f = store.userById(a.facultyId) || {};
  return {
    id: a.id, type: a.type, course: a.course, date: a.date, time: a.time, mode: a.mode, agenda: a.agenda,
    status: a.status, note: a.note, createdAt: a.createdAt, past: isPast(a.date, a.time),
    studentId: a.studentId, studentName: s.name, sid: s.sid,
    facultyId: a.facultyId, facultyName: f.name, facultyRoom: f.room,
  };
}

// Finds an appointment that belongs to the signed-in user (as student or faculty).
function loadOwned(req, field) {
  const a = store.db.appointments.find((x) => x.id === req.params.id);
  if (!a || a[field] !== req.user.id || a.institutionId !== req.user.institutionId) throw new HttpError(404, 'Appointment not found.');
  return a;
}

const sortDT = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);

// GET /api/appointments
router.get('/', requireRole('student', 'faculty'), (req, res) => {
  const field = req.user.role === 'student' ? 'studentId' : 'facultyId';
  const list = store.db.appointments.filter((a) => a[field] === req.user.id).sort(sortDT);
  res.json({ appointments: list.map(serialize) });
});

// POST /api/appointments  { facultyId, type, course, date, time, mode, agenda }
router.post('/', requireRole('student'), (req, res) => {
  const u = req.user;
  const { db } = store;
  const { facultyId, type, course = null, date, time, mode = 'In person', agenda = '' } = req.body || {};
  const f = instUser(req, facultyId);
  if (!f || f.role !== 'faculty') throw new HttpError(404, 'Teacher not found.');
  const t = termsOf(req.inst);

  let courseCode = null;
  if (type === 'Advising') {
    if (u.advisorId !== f.id) throw new HttpError(403, `You can only book this with your own ${t.advisor.toLowerCase()}.`);
  } else if (type === 'Course') {
    courseCode = String(course || '').toUpperCase();
    const c = db.courses.find((x) => x.code === courseCode && x.institutionId === u.institutionId);
    if (!c || !(u.courses || []).includes(c.code) || c.facultyId !== f.id) {
      throw new HttpError(403, `You can only book time for ${t.course.toLowerCase()}s you are enrolled in.`);
    }
  } else {
    throw new HttpError(400, 'Unknown appointment type.');
  }
  if (!['In person', 'Online'].includes(mode)) throw new HttpError(400, 'Choose in person or online.');
  if (String(agenda).trim().length < 5) {
    throw new HttpError(400, `Add a short agenda so your ${type === 'Advising' ? t.advisor.toLowerCase() : 'teacher'} knows what to prepare.`);
  }
  // Must be a real office-hour slot in the booking window, and not in the past.
  if (!workDays().includes(date) || !slotsFor(f.hours, date).includes(time) || isPast(date, time)) {
    throw new HttpError(409, 'That slot is no longer available. Pick another time.');
  }
  // Node handles one request at a time here (no waiting between the check and the save),
  // so two students can never both get the same slot.
  if (db.appointments.some((a) => a.facultyId === f.id && a.date === date && a.time === time && ACTIVE_APPT.includes(a.status))) {
    throw new HttpError(409, 'Someone just booked that slot. Pick another time.');
  }
  const a = {
    id: store.newId(), institutionId: u.institutionId, studentId: u.id, facultyId: f.id, type, course: courseCode, date, time, mode,
    agenda: String(agenda).trim().slice(0, 600), status: 'Pending', note: '', createdAt: store.now(),
  };
  db.appointments.push(a);
  notify(f.id, `${u.name} requested a ${type === 'Advising' ? t.advisingAppt : `${courseCode} ${t.courseAppt}`} on ${fmtDate(date)} at ${fmtTime(time)}.`, '/');
  store.save();
  res.status(201).json({ appointment: serialize(a) });
});

// PATCH /api/appointments/:id/cancel  Student cancels an upcoming booking.
router.patch('/:id/cancel', requireRole('student'), (req, res) => {
  const a = loadOwned(req, 'studentId');
  if (!ACTIVE_APPT.includes(a.status) || isPast(a.date, a.time)) throw new HttpError(400, 'Only upcoming appointments can be cancelled.');
  a.status = 'Cancelled';
  notify(a.facultyId, `${req.user.name} cancelled the ${what(a, req.inst)} on ${fmtDate(a.date)} at ${fmtTime(a.time)}.`, '/schedule');
  store.save();
  res.json({ appointment: serialize(a) });
});

// Faculty actions
function facultyAction(req, allowed, when, apply) {
  const a = loadOwned(req, 'facultyId');
  if (!allowed.includes(a.status)) throw new HttpError(400, `This appointment is already ${a.status.toLowerCase()}.`);
  if (when === 'future' && isPast(a.date, a.time)) throw new HttpError(400, 'This appointment time has already passed.');
  if (when === 'past' && !isPast(a.date, a.time)) throw new HttpError(400, 'This meeting has not happened yet.');
  apply(a);
  return a;
}
const noteOf = (req) => String((req.body || {}).note || '').trim().slice(0, 400);
const facultyName = (a) => store.userById(a.facultyId).name;

router.patch('/:id/accept', requireRole('faculty'), (req, res) => {
  const a = facultyAction(req, ['Pending'], 'future', (x) => { x.status = 'Confirmed'; });
  notify(a.studentId, `${facultyName(a)} confirmed your ${what(a, req.inst)} on ${fmtDate(a.date)} at ${fmtTime(a.time)}.`, '/appointments');
  store.save();
  res.json({ appointment: serialize(a) });
});

router.patch('/:id/decline', requireRole('faculty'), (req, res) => {
  const a = facultyAction(req, ['Pending'], 'future', (x) => { x.status = 'Declined'; x.note = noteOf(req); });
  notify(a.studentId, `${facultyName(a)} declined your request for ${fmtDate(a.date)}${a.note ? `: ${a.note}` : '. Please pick another time.'}`, '/appointments?tab=past');
  store.save();
  res.json({ appointment: serialize(a) });
});

router.patch('/:id/complete', requireRole('faculty'), (req, res) => {
  const a = facultyAction(req, ['Confirmed'], 'past', (x) => { x.status = 'Completed'; x.note = noteOf(req); });
  notify(a.studentId, `Your ${what(a, req.inst)} on ${fmtDate(a.date)} is marked completed${a.note ? `. Note: ${a.note}` : '.'}`, '/appointments?tab=past');
  store.save();
  res.json({ appointment: serialize(a) });
});

router.patch('/:id/no-show', requireRole('faculty'), (req, res) => {
  const a = facultyAction(req, ['Confirmed'], 'past', (x) => { x.status = 'No-show'; });
  store.save();
  res.json({ appointment: serialize(a) });
});

module.exports = router;
