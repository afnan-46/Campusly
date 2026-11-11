const jwt = require('jsonwebtoken');
const store = require('../store');
const { HttpError } = require('../utils/http');
const { accessOf } = require('../config/plans');

// Company accounts (the Campusly owner and office staff) don't belong to an institution.
const COMPANY_ROLES = ['superadmin', 'company'];
// While an institution's plan is expired or suspended, these still work so the admin can renew.
const ALWAYS_ALLOWED = ['/api/admin/billing', '/api/auth/password', '/api/notifications'];

const secret = () => process.env.JWT_SECRET || store.db.secret;

// Requires a valid "Authorization: Bearer <token>" header and sets req.user.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Please sign in.'));
  let payload;
  try {
    payload = jwt.verify(token, secret());
  } catch {
    return next(new HttpError(401, 'Your session has expired. Please sign in again.'));
  }
  const user = store.userById(payload.sub);
  if (!user) return next(new HttpError(401, 'This account no longer exists.'));
  if (user.status && user.status !== 'active') return next(new HttpError(401, 'Your account is not active yet.'));
  req.user = user;
  // Everyone except Campusly company accounts belongs to exactly one institution.
  if (!COMPANY_ROLES.includes(user.role)) {
    req.inst = store.instById(user.institutionId);
    if (!req.inst) return next(new HttpError(401, 'Your institution no longer exists.'));
    req.access = accessOf(req.inst);
    // A paused institution can still be read, but nothing new can be booked or reported.
    if (req.access.state !== 'active' && req.method !== 'GET' && !ALWAYS_ALLOWED.some((p) => req.originalUrl.startsWith(p))) {
      const why = req.access.state === 'suspended' ? 'paused by Campusly' : 'paused because its plan has ended';
      return next(new HttpError(403, user.role === 'admin'
        ? `${req.inst.name}'s access is ${why}. Renew from Billing to continue.`
        : `${req.inst.name}'s Campusly access is ${why}. Please contact your admin.`));
    }
  }
  next();
}

// Only lets the listed roles through.
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have access to this.'));
  next();
};

const signToken = (user) => jwt.sign({ sub: user.id, role: user.role }, secret(), { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

module.exports = { requireAuth, requireRole, signToken, COMPANY_ROLES };
