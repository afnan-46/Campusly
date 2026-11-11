// Shared logic for plans, applications, payments and subscriptions.
const crypto = require('crypto');
const store = require('../store');
const { hashPassword } = require('./users');
const { notify } = require('./notify');
const { defaultsFor } = require('../config/terms');
const {
  planByKey, cycleByKey, priceFor, addMonths, addDays, accessOf, TRIAL_DAYS, METHOD_LABEL,
} = require('../config/plans');

const clean = (v, max = 80) => String(v == null ? '' : v).trim().replace(/\s+/g, ' ').slice(0, max);
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PHONE_RE = /^(\+?88)?01[3-9]\d{8}$/;
const TRX_RE = /^[A-Za-z0-9]{8,12}$/;

// A first password that is easy to read out over the phone. The person must change it on first sign-in.
function tempPassword() {
  const words = ['Rose', 'Lotus', 'River', 'Mango', 'Tiger', 'Sun', 'Hill', 'Rain'];
  return `${words[crypto.randomInt(words.length)]}-${crypto.randomInt(1000, 9999)}`;
}

const trxTaken = (trx) => {
  const t = String(trx || '').toUpperCase();
  return !!t && (store.db.payments.some((p) => p.trxId === t && p.status !== 'rejected')
    || store.db.applications.some((a) => a.payment && a.payment.trxId === t && a.status !== 'rejected'));
};

// Checks the payment part of an application or renewal.
function readPayment(b, errs, { allowTrial }) {
  const plan = planByKey(b.plan);
  const cycle = cycleByKey(b.cycle);
  if (!plan) errs.plan = 'Choose a plan.';
  if (!cycle) errs.cycle = 'Choose how long to pay for.';
  const trial = allowTrial && (b.trial === true || b.trial === 'true' || b.method === 'trial');
  const out = { plan: plan && plan.key, cycle: cycle && cycle.key, trial, amount: plan && cycle ? priceFor(plan.key, cycle.key) : null };
  if (trial) return { ...out, method: 'trial', trxId: null, payerNumber: null };
  const method = ['bkash', 'nagad'].includes(b.method) ? b.method : null;
  if (!method) errs.method = 'Choose bKash or Nagad.';
  const trxId = clean(b.trxId, 20).toUpperCase().replace(/\s/g, '');
  if (!TRX_RE.test(trxId)) errs.trxId = 'Enter the transaction ID from your payment SMS (8 to 12 letters and numbers).';
  else if (trxTaken(trxId)) errs.trxId = 'This transaction ID has already been used.';
  const payerNumber = clean(b.payerNumber, 16).replace(/[\s-]/g, '');
  if (!PHONE_RE.test(payerNumber)) errs.payerNumber = 'Enter the number you paid from, for example 01712345678.';
  return { ...out, method, trxId, payerNumber };
}

function paymentOut(p) {
  const inst = store.instById(p.institutionId);
  return {
    ...p,
    methodLabel: METHOD_LABEL[p.method] || p.method,
    planName: (planByKey(p.plan) || {}).name,
    cycleName: (cycleByKey(p.cycle) || {}).name,
    institutionName: inst ? inst.name : p.institutionName || '',
  };
}

// Starts or extends an institution's subscription after a payment is verified.
function extendSubscription(inst, { plan, cycle, trial }) {
  const c = cycleByKey(cycle);
  const s = inst.subscription;
  const stillRunning = s && accessOf(inst).state === 'active' && !s.trial;
  const from = stillRunning ? s.endsAt : store.now();
  inst.subscription = {
    plan, cycle, trial: !!trial,
    startsAt: stillRunning ? s.startsAt : store.now(),
    endsAt: trial ? addDays(store.now(), TRIAL_DAYS) : addMonths(from, c.months),
  };
  inst.suspended = false;
  inst.expiryNotified = null;
}

// Approving an application creates the institution, its first admin and the payment record.
async function approveApplication(app, by) {
  const a = app.institution;
  const inst = {
    id: store.newId(), type: a.type, name: a.name,
    shortName: a.shortName || a.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 6),
    city: a.city, address: a.address || '', createdAt: store.now(), applicationId: app.id,
    ...defaultsFor(a.type),
  };
  extendSubscription(inst, app.payment);
  store.db.institutions.push(inst);

  const password = tempPassword();
  const admin = {
    id: store.newId(), institutionId: inst.id, role: 'admin', name: app.contact.name, email: app.contact.email,
    phone: app.contact.phone, title: app.contact.designation || 'Administrator', status: 'active',
    passwordHash: await hashPassword(password), mustChangePassword: true, isDemo: false, createdAt: store.now(),
  };
  store.db.users.push(admin);
  notify(admin.id, `Welcome to Campusly. ${inst.name} is ready: start by adding teachers, students and offices.`, '/');

  if (!app.payment.trial) {
    store.db.payments.push({
      id: store.newId(), institutionId: inst.id, applicationId: app.id, kind: 'new',
      plan: app.payment.plan, cycle: app.payment.cycle, amount: app.payment.amount,
      method: app.payment.method, trxId: app.payment.trxId, payerNumber: app.payment.payerNumber,
      status: 'verified', createdAt: app.createdAt, decidedAt: store.now(), decidedBy: by.name,
    });
  }
  Object.assign(app, { status: 'approved', institutionId: inst.id, decidedAt: store.now(), decidedBy: by.name });
  return { inst, admin, password };
}

module.exports = {
  clean, EMAIL_RE, PHONE_RE, tempPassword, readPayment, paymentOut, extendSubscription, approveApplication, trxTaken,
};
