// Date and slot helpers. The server runs in APP_TZ (set in index.js), so
// local Date methods give campus time.
const { SLOT_MINUTES, WEEKEND_DAY, BOOKING_WINDOW_DAYS, ACTIVE_APPT } = require('../config/constants');

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const fromMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

function isPast(date, time) {
  const d = parseYmd(date);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d < new Date();
}

// The next n days that are not the weekend, starting today.
function workDays(n = BOOKING_WINDOW_DAYS) {
  const out = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (out.length < n) {
    if (d.getDay() !== WEEKEND_DAY) out.push(ymd(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// The working day `back` days before today.
function lastWorkDay(back) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  let n = 0;
  while (n < back) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() !== WEEKEND_DAY) n += 1;
  }
  return ymd(d);
}

// Every 20-minute slot start inside a faculty member's office hours on a date.
function slotsFor(hours, date) {
  const day = parseYmd(date).getDay();
  const res = [];
  (hours || [])
    .filter((h) => h.day === day)
    .forEach((h) => {
      for (let t = toMin(h.start); t + SLOT_MINUTES <= toMin(h.end); t += SLOT_MINUTES) res.push(fromMin(t));
    });
  return [...new Set(res)].sort();
}

// Availability for the booking window, given the faculty's live bookings.
function availability(hours, liveBookings) {
  const taken = new Set(liveBookings.map((a) => `${a.date} ${a.time}`));
  return workDays().map((date) => {
    const slots = slotsFor(hours, date)
      .filter((t) => !isPast(date, t))
      .map((time) => ({ time, taken: taken.has(`${date} ${time}`) }));
    return { date, total: slots.length, free: slots.filter((s) => !s.taken).length, slots };
  });
}

function firstFree(days, skip = 0) {
  let n = 0;
  for (const d of days) {
    for (const s of d.slots) {
      if (s.taken) continue;
      if (n === skip) return { date: d.date, time: s.time };
      n += 1;
    }
  }
  return null;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(s) {
  const d = parseYmd(s);
  return `${s === ymd(new Date()) ? 'Today, ' : ''}${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
function fmtTime(t) {
  let [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${pad(m)} ${ap}`;
}

// Bookings that still hold a slot (Pending or Confirmed, today or later).
const liveBookings = (appointments, facultyId) => {
  const today = ymd(new Date());
  return appointments.filter((a) => a.facultyId === facultyId && ACTIVE_APPT.includes(a.status) && a.date >= today);
};

module.exports = {
  pad, ymd, parseYmd, toMin, fromMin, isPast, workDays, lastWorkDay, slotsFor,
  availability, firstFree, fmtDate, fmtTime, liveBookings,
};
