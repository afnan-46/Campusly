const bcrypt = require('bcryptjs');
const store = require('../store');
const { accessOf, planByKey } = require('../config/plans');

const hashPassword = (plain) => bcrypt.hash(String(plain), 10);
const checkPassword = (user, plain) => bcrypt.compare(String(plain), user.passwordHash);
const isAdmin = (u) => u.role === 'admin';

// The institution summary sent with every signed-in user.
const instPublic = (i) => (i ? { id: i.id, type: i.type, name: i.name, shortName: i.shortName, city: i.city } : null);

// The institution's plan and whether it is usable right now.
function instAccess(i) {
  if (!i) return null;
  const a = accessOf(i);
  const s = i.subscription || {};
  const plan = planByKey(s.plan);
  return { ...a, plan: plan ? plan.name : null, planKey: s.plan || null, endsAt: s.endsAt || null, trial: !!s.trial };
}

// What the browser is allowed to see about a user (never the password hash).
function toPublic(u) {
  const out = { id: u.id, role: u.role, name: u.name, email: u.email || '', mustChangePassword: !!u.mustChangePassword };
  if (u.role === 'superadmin' || u.role === 'company') {
    out.title = u.title || (u.role === 'superadmin' ? 'Owner' : 'Company staff');
    return out;
  }
  const inst = store.instById(u.institutionId);
  out.institution = instPublic(inst);
  out.access = instAccess(inst);
  if (u.role === 'student') {
    Object.assign(out, { sid: u.sid, dept: u.dept, advisorId: u.advisorId || null, courses: u.courses || [] });
  }
  if (u.role === 'faculty') Object.assign(out, { title: u.title || '', room: u.room || '', hours: u.hours || [] });
  if (u.role === 'staff') Object.assign(out, { title: u.title || '', office: u.office, isAdmin: false });
  if (u.role === 'admin') Object.assign(out, { title: u.title || 'Administrator', isAdmin: true });
  return out;
}

module.exports = { hashPassword, checkPassword, isAdmin, toPublic, instPublic, instAccess };
