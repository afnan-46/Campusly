// Campusly plans. Institutions pay; students and teachers always use Campusly for free.
// Prices are in Bangladeshi taka (BDT) per month.

const PLANS = [
  {
    key: 'starter', name: 'Starter', monthly: 2000, bestFor: 'Small schools',
    limits: { students: 300, staff: 30 },
    features: { import: false, insights: 'Basic', support: 'Email' },
  },
  {
    key: 'standard', name: 'Standard', monthly: 5000, bestFor: 'Colleges and large schools', popular: true,
    limits: { students: 1500, staff: 150 },
    features: { import: true, insights: 'Full', support: 'Email and phone' },
  },
  {
    key: 'premium', name: 'Premium', monthly: 12000, bestFor: 'Universities',
    limits: { students: null, staff: null }, // null = unlimited
    features: { import: true, insights: 'Full, with export', support: 'Dedicated account manager', campusServer: true },
  },
];

// How long an institution pays for, and the discount for paying ahead.
const CYCLES = [
  { key: 'monthly', name: 'Monthly', months: 1, discount: 0 },
  { key: 'halfyear', name: '6 months', months: 6, discount: 0.1 },
  { key: 'yearly', name: 'Yearly', months: 12, discount: 0.15 },
];

const TRIAL_DAYS = 14;
const PAYMENT_METHODS = ['bkash', 'nagad', 'trial'];
const METHOD_LABEL = { bkash: 'bKash', nagad: 'Nagad', trial: 'Free trial' };
// Where institutions send money. Shown on the Apply and Billing pages.
const PAY_TO = { bkash: '01711-000000', nagad: '01811-000000', type: 'Merchant' };

const planByKey = (k) => PLANS.find((p) => p.key === k) || null;
const cycleByKey = (k) => CYCLES.find((c) => c.key === k) || null;

// Total for a plan and billing period, rounded to the nearest 10 taka.
function priceFor(planKey, cycleKey) {
  const p = planByKey(planKey);
  const c = cycleByKey(cycleKey);
  if (!p || !c) return null;
  return Math.round((p.monthly * c.months * (1 - c.discount)) / 10) * 10;
}

function addMonths(iso, months) {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}
const addDays = (iso, days) => new Date(new Date(iso).getTime() + days * 864e5).toISOString();

// Where an institution's subscription stands right now.
function accessOf(inst) {
  const s = inst && inst.subscription;
  if (!s) return { state: 'active', daysLeft: null };
  if (inst.suspended) return { state: 'suspended', daysLeft: 0 };
  const ms = new Date(s.endsAt) - Date.now();
  const daysLeft = Math.ceil(ms / 864e5);
  return { state: ms > 0 ? 'active' : 'expired', daysLeft: Math.max(0, daysLeft) };
}

module.exports = {
  PLANS, CYCLES, TRIAL_DAYS, PAYMENT_METHODS, METHOD_LABEL, PAY_TO,
  planByKey, cycleByKey, priceFor, addMonths, addDays, accessOf,
};
