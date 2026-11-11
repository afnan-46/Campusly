const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const store = require('../store');
const { notify } = require('../utils/notify');
const { hashPassword, checkPassword, toPublic, instPublic, instAccess } = require('../utils/users');
const { planByKey } = require('../config/plans');
const { requireAuth, signToken } = require('../middleware/auth');
const { HttpError, ah } = require('../utils/http');
const { TERMS } = require('../config/terms');

const router = express.Router();
const ROLES = ['student', 'faculty', 'staff', 'admin'];
const roleLabel = (role, t) => ({ student: 'Student', faculty: t.teacher, staff: 'Office staff', admin: 'Admin' }[role]);
const DEMO_PASSWORDS = { student: 'student123', faculty: 'faculty123', staff: 'staff123', admin: 'admin123' };
const demoMode = () => String(process.env.DEMO_MODE).toLowerCase() !== 'false';
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const SID_RE = /^[A-Za-z0-9][A-Za-z0-9\-/. ]{1,23}$/;

// Slow down password guessing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 80, standardHeaders: true, legacyHeaders: false,
  message: { message: 'Too many attempts. Please wait a few minutes and try again.' },
});

function needInst(id) {
  const inst = store.instById(id);
  if (!inst) throw new HttpError(400, 'Choose your institution first.');
  return inst;
}
// Finds a member of one institution by email or student ID / roll.
const findMember = (inst, id) => store.db.users.find((u) => u.institutionId === inst.id
  && ((u.email && u.email.toLowerCase() === id) || (u.sid && u.sid.toLowerCase() === id)));

// POST /api/auth/lookup  { identifier }  Step 1 of sign-in: which institution(s) is this email or ID at?
router.post('/lookup', authLimiter, (req, res) => {
  const id = String((req.body || {}).identifier || '').trim().toLowerCase();
  if (id.length < 3) throw new HttpError(400, 'Enter your email or student ID.');
  const matches = store.db.users
    .filter((u) => u.institutionId && ((u.email && u.email.toLowerCase() === id) || (u.sid && u.sid.toLowerCase() === id)))
    .map((u) => {
      const inst = store.instById(u.institutionId);
      return inst && { institution: { ...instPublic(inst), access: instAccess(inst) }, role: u.role, roleLabel: roleLabel(u.role, TERMS[inst.type]), status: u.status || 'active' };
    })
    .filter(Boolean)
    .sort((a, b) => a.institution.name.localeCompare(b.institution.name));
  const company = store.db.users.some((u) => (u.role === 'superadmin' || u.role === 'company') && u.email === id);
  if (!matches.length && !company) throw new HttpError(404, 'We could not find an account with this email or ID. Check it, or ask your institution\'s admin.');
  res.json({ matches, company });
});

// POST /api/auth/login  { institutionId, identifier, password, role? }
router.post('/login', authLimiter, ah(async (req, res) => {
  const { institutionId, role, identifier, password } = req.body || {};
  const inst = needInst(institutionId);
  const t = TERMS[inst.type];
  const id = String(identifier || '').trim().toLowerCase();
  if (!id || !password) throw new HttpError(400, 'Enter your ID or email and your password.');
  const user = findMember(inst, id);
  if (!user || !(await checkPassword(user, password))) throw new HttpError(401, `That password is not correct for ${inst.name}.`);
  if (user.status === 'pending') throw new HttpError(403, `Your account is waiting for approval by ${inst.name}'s admin. You can sign in once it is approved.`);
  if (user.status === 'rejected') throw new HttpError(403, `${inst.name}'s admin did not approve this account. Please contact your institution.`);
  if (role && user.role !== role) {
    throw new HttpError(400, `This is ${user.role === 'admin' ? 'an' : 'a'} ${roleLabel(user.role, t).toLowerCase()} account.`);
  }
  res.json({ token: signToken(user), user: toPublic(user) });
}));

// POST /api/auth/company-login  { email, password }  Campusly owner and company staff.
router.post(['/company-login', '/owner-login'], authLimiter, ah(async (req, res) => {
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  const user = store.db.users.find((u) => (u.role === 'superadmin' || u.role === 'company') && u.email === email);
  if (!user || !(await checkPassword(user, (req.body || {}).password || ''))) throw new HttpError(401, 'That email or password is not correct.');
  res.json({ token: signToken(user), user: toPublic(user) });
}));

// GET /api/auth/join/:code  Public: which institution and class a join code belongs to.
router.get('/join/:code', (req, res) => {
  const jc = findJoinCode(req.params.code);
  if (!jc) throw new HttpError(404, 'This join code is not valid. Check it with your teacher or admin.');
  const inst = store.instById(jc.institutionId);
  const adv = jc.advisorId ? store.userById(jc.advisorId) : null;
  res.json({ code: jc.code, institution: instPublic(inst), group: jc.group, advisor: adv ? adv.name : null, terms: TERMS[inst.type] });
});

function findJoinCode(code) {
  const c = String(code || '').trim().toUpperCase();
  const jc = c && store.db.joinCodes.find((j) => j.code === c && j.active);
  if (!jc || (jc.expiresAt && new Date(jc.expiresAt) < new Date())) return null;
  return store.instById(jc.institutionId) ? jc : null;
}

// POST /api/auth/register  Students sign themselves up.
// With a join code they are in at once; without one, the admin approves them first.
router.post('/register', authLimiter, ah(async (req, res) => {
  const { joinCode, name = '', sid = '', email = '', dept, advisorId, password = '', password2 = '' } = req.body || {};
  const jc = joinCode ? findJoinCode(joinCode) : null;
  if (joinCode && !jc) throw new HttpError(400, 'Please fix the highlighted fields.', { joinCode: 'This join code is not valid or has expired.' });
  const inst = jc ? store.instById(jc.institutionId) : needInst((req.body || {}).institutionId);
  const t = TERMS[inst.type];
  const { db } = store;
  if (instAccess(inst).state !== 'active') throw new HttpError(403, `${inst.name} is not accepting new sign-ups right now. Please contact your admin.`);
  const plan = planByKey(inst.subscription && inst.subscription.plan);
  const studentCount = db.users.filter((u) => u.institutionId === inst.id && u.role === 'student' && u.status !== 'rejected').length;
  if (plan && plan.limits.students && studentCount >= plan.limits.students) {
    throw new HttpError(403, `${inst.name} has reached its student limit. Please contact your admin.`);
  }
  const errs = {};
  const cleanName = String(name).trim().replace(/\s+/g, ' ');
  const cleanSid = String(sid).trim();
  const cleanEmail = String(email).trim().toLowerCase();
  if (cleanName.split(' ').length < 2) errs.name = 'Enter your full name, first and last.';
  if (!SID_RE.test(cleanSid)) errs.sid = `Enter your ${t.sid.toLowerCase()} (letters, numbers and dashes).`;
  else if (findMember(inst, cleanSid.toLowerCase())) errs.sid = `An account with this ${t.sid.toLowerCase()} already exists. Sign in instead.`;
  if (cleanEmail && !/^\S+@\S+\.\S+$/.test(cleanEmail)) errs.email = 'Enter a valid email, or leave it empty.';
  else if (cleanEmail && findMember(inst, cleanEmail)) errs.email = 'This email is already used by another account.';
  const group = jc ? jc.group : dept;
  if (!inst.groups.includes(group)) errs.dept = `Choose your ${t.group.toLowerCase()}.`;
  let advisor = null;
  const advId = jc ? jc.advisorId : advisorId;
  if (advId) {
    advisor = db.users.find((u) => u.id === advId && u.role === 'faculty' && u.institutionId === inst.id);
    if (!advisor && !jc) errs.advisor = `Choose your ${t.advisorLong.toLowerCase()} from the list.`;
  }
  if (String(password).length < 6) errs.pw = 'Use at least 6 characters.';
  if (password2 !== password) errs.pw2 = 'The passwords do not match.';
  if (Object.keys(errs).length) throw new HttpError(400, 'Please fix the highlighted fields.', errs);

  const passwordHash = await hashPassword(password);
  // Check again: another sign-up with the same ID may have finished while hashing.
  if (findMember(inst, cleanSid.toLowerCase())) {
    throw new HttpError(400, 'Please fix the highlighted fields.', { sid: `An account with this ${t.sid.toLowerCase()} already exists. Sign in instead.` });
  }
  const user = {
    id: store.newId(), institutionId: inst.id, role: 'student', name: cleanName, sid: cleanSid, email: cleanEmail,
    passwordHash, dept: group, advisorId: advisor ? advisor.id : null,
    courses: db.courses.filter((c) => c.institutionId === inst.id).map((c) => c.code),
    status: jc ? 'active' : 'pending', joinedWith: jc ? jc.code : null, isDemo: false, createdAt: store.now(),
  };
  db.users.push(user);
  if (jc) {
    jc.uses = (jc.uses || 0) + 1;
    notify(user.id, `Welcome to Campusly at ${inst.name}.${advisor ? ` Your ${t.advisor.toLowerCase()} is ${advisor.name}.` : ''}`, '/');
    store.save();
    return res.status(201).json({ token: signToken(user), user: toPublic(user) });
  }
  db.users.filter((u) => u.institutionId === inst.id && u.role === 'admin')
    .forEach((a) => notify(a.id, `${cleanName} (${cleanSid}) signed up and is waiting for your approval.`, '/people?tab=pending'));
  store.save();
  res.status(201).json({ pending: true, institution: inst.name, message: `Your account is waiting for approval by ${inst.name}'s admin. You can sign in once it is approved.` });
}));

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => res.json({ user: toPublic(req.user) }));

// POST /api/auth/password  { current, password }  Change your own password.
router.post('/password', requireAuth, ah(async (req, res) => {
  const { current = '', password = '' } = req.body || {};
  if (!(await checkPassword(req.user, current))) throw new HttpError(400, 'Your current password is not correct.');
  if (String(password).length < 6) throw new HttpError(400, 'Use at least 6 characters for the new password.');
  if (String(password) === String(current)) throw new HttpError(400, 'Choose a new password that is different from the current one.');
  req.user.passwordHash = await hashPassword(password);
  req.user.mustChangePassword = false;
  store.save();
  res.json({ message: 'Password changed.', user: toPublic(req.user) });
}));

// POST /api/auth/forgot  { email, institutionId? }
router.post('/forgot', authLimiter, (req, res, next) => {
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return next(new HttpError(400, 'Enter a valid email address.'));
  const instId = (req.body || {}).institutionId;
  const user = store.db.users.find((u) => u.email === email && (!instId || u.institutionId === instId) && (u.status || 'active') === 'active');
  const out = { message: `If an account uses ${email}, a reset link is on its way.` };
  if (user) {
    const token = crypto.randomBytes(24).toString('hex');
    user.resetTokenHash = sha(token);
    user.resetTokenExpires = Date.now() + 30 * 60 * 1000;
    store.save();
    const link = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset/${token}`;
    // No email service is connected: print the link, and in demo mode return it.
    console.log(`Password reset link for ${email}: ${link}`);
    if (demoMode()) out.resetLink = link;
  }
  res.json(out);
});

// POST /api/auth/reset  { token, password }
router.post('/reset', authLimiter, ah(async (req, res) => {
  const { token = '', password = '' } = req.body || {};
  if (String(password).length < 6) throw new HttpError(400, 'Use at least 6 characters.');
  const hash = sha(token);
  const user = store.db.users.find((u) => u.resetTokenHash === hash && u.resetTokenExpires > Date.now());
  if (!user) throw new HttpError(400, 'This reset link is invalid or has expired. Request a new one.');
  user.passwordHash = await hashPassword(password);
  user.mustChangePassword = false;
  delete user.resetTokenHash;
  delete user.resetTokenExpires;
  store.save();
  res.json({ message: 'Password updated. You can sign in now.' });
}));

// GET /api/auth/demo-accounts?institution=ID&role=student  (only in demo mode)
router.get('/demo-accounts', (req, res) => {
  if (!demoMode()) return res.json({ enabled: false, accounts: [] });
  if (req.query.role === 'company' || req.query.role === 'superadmin') {
    const team = store.db.users.filter((u) => (u.role === 'superadmin' || u.role === 'company') && u.isDemo);
    return res.json({
      enabled: true,
      accounts: team.map((u) => ({ id: u.id, name: u.name, identifier: u.email, sub: u.role === 'superadmin' ? 'Owner' : u.title, password: u.role === 'superadmin' ? 'owner123' : 'company123' })),
    });
  }
  // Without an institution: a few accounts from each, for the sign-in page's demo list.
  if (!req.query.institution) {
    const pick = ['admin', 'faculty', 'student', 'staff'];
    const groups = store.db.institutions.filter((i) => store.db.users.some((u) => u.institutionId === i.id && u.isDemo)).map((i) => ({
      institution: instPublic(i),
      accounts: pick.map((role) => store.db.users.find((u) => u.institutionId === i.id && u.role === role && u.isDemo)).filter(Boolean)
        .map((u) => ({ id: u.id, name: u.name, role: u.role, roleLabel: roleLabel(u.role, TERMS[i.type]), identifier: u.role === 'student' ? u.sid : u.email, password: DEMO_PASSWORDS[u.role] })),
    }));
    return res.json({ enabled: true, groups });
  }
  const inst = store.instById(req.query.institution);
  if (!inst) return res.json({ enabled: true, accounts: [] });
  const role = ROLES.includes(req.query.role) ? req.query.role : 'student';
  const users = store.db.users.filter((u) => u.institutionId === inst.id && u.role === role && u.isDemo);
  res.json({
    enabled: true,
    password: DEMO_PASSWORDS[role],
    accounts: users.map((u) => ({
      id: u.id,
      name: u.name,
      identifier: role === 'student' ? u.sid : u.email,
      sub: role === 'student' ? `${u.sid}, ${u.dept}` : role === 'faculty' ? `${u.email}, ${u.title}` : role === 'staff' ? `${u.email}, ${u.office}` : u.email,
    })),
  });
});

module.exports = router;
