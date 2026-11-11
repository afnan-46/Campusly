// Public pages: plans and prices, and applications from institutions.
const express = require('express');
const rateLimit = require('express-rate-limit');
const store = require('../store');
const { HttpError } = require('../utils/http');
const { notifyCompany } = require('../utils/notify');
const { TYPES } = require('../config/terms');
const { PLANS, CYCLES, TRIAL_DAYS, PAY_TO, priceFor, planByKey, cycleByKey, METHOD_LABEL } = require('../config/plans');
const { clean, EMAIL_RE, PHONE_RE, readPayment } = require('../utils/company');

const router = express.Router();
const applyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { message: 'Too many applications from this network. Please try again later.' },
});

// GET /api/public/plans
router.get('/plans', (req, res) => {
  res.json({
    plans: PLANS.map((p) => ({ ...p, prices: Object.fromEntries(CYCLES.map((c) => [c.key, priceFor(p.key, c.key)])) })),
    cycles: CYCLES,
    trialDays: TRIAL_DAYS,
    payTo: PAY_TO,
  });
});

// GET /api/public/stats  Numbers for the home page.
router.get('/stats', (req, res) => {
  const { db } = store;
  res.json({
    institutions: db.institutions.length,
    students: db.users.filter((u) => u.role === 'student').length,
    teachers: db.users.filter((u) => u.role === 'faculty').length,
  });
});

// POST /api/public/apply  An institution asks to use Campusly.
router.post('/apply', applyLimiter, (req, res) => {
  const b = req.body || {};
  const errs = {};
  const inst = {
    type: b.type, name: clean(b.name, 90), shortName: clean(b.shortName, 12).toUpperCase(),
    city: clean(b.city, 40), address: clean(b.address, 160),
  };
  if (!TYPES.includes(inst.type)) errs.type = 'Choose school, college or university.';
  if (inst.name.length < 3) errs.name = 'Enter the full name of your institution.';
  else if (store.db.institutions.some((i) => i.name.toLowerCase() === inst.name.toLowerCase())) errs.name = 'This institution already uses Campusly. Its admin can sign in.';
  else if (store.db.applications.some((a) => ['new', 'reviewing'].includes(a.status) && a.institution.name.toLowerCase() === inst.name.toLowerCase())) errs.name = 'An application for this institution is already being reviewed.';
  if (inst.city.length < 2) errs.city = 'Enter the city or district.';

  const contact = {
    name: clean(b.contactName), designation: clean(b.designation, 60),
    email: clean(b.email, 120).toLowerCase(), phone: clean(b.phone, 16).replace(/[\s-]/g, ''),
  };
  if (contact.name.length < 3) errs.contactName = 'Enter the full name of the contact person.';
  if (!EMAIL_RE.test(contact.email)) errs.email = 'Enter a valid email. The admin account will use it.';
  if (!PHONE_RE.test(contact.phone)) errs.phone = 'Enter a Bangladeshi mobile number, for example 01712345678.';
  const students = Number(b.students);
  if (!(students > 0 && students < 200000)) errs.students = 'Enter roughly how many students you have.';
  const payment = readPayment(b, errs, { allowTrial: true });
  const plan = planByKey(payment.plan);
  if (plan && plan.limits.students && students > plan.limits.students && !errs.students) {
    errs.plan = `${plan.name} allows up to ${plan.limits.students} students. Choose a bigger plan.`;
  }
  if (Object.keys(errs).length) throw new HttpError(400, 'Please fix the highlighted fields.', errs);

  const { db } = store;
  db.counters.application = (db.counters.application || 1000) + 1;
  const app = {
    id: store.newId(), code: `APP-${db.counters.application}`, status: 'new',
    institution: inst, contact, students, message: clean(b.message, 600),
    payment, notes: [], createdAt: store.now(),
  };
  db.applications.push(app);
  const what = payment.trial ? 'free trial' : `${plan.name}, ${cycleByKey(payment.cycle).name}, ৳${payment.amount} by ${METHOD_LABEL[payment.method]}`;
  notifyCompany(`New application ${app.code}: ${inst.name} (${what}).`, '/applications');
  store.save();
  res.status(201).json({ code: app.code, status: app.status });
});

// GET /api/public/apply/:code?email=...  Check an application's progress.
router.get('/apply/:code', (req, res) => {
  const app = store.db.applications.find((a) => a.code === String(req.params.code).toUpperCase().trim());
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!app || app.contact.email !== email) throw new HttpError(404, 'No application matches this number and email.');
  res.json({
    code: app.code, status: app.status, institution: app.institution.name, createdAt: app.createdAt,
    decidedAt: app.decidedAt || null, rejectReason: app.status === 'rejected' ? app.rejectReason : null,
  });
});

module.exports = router;
