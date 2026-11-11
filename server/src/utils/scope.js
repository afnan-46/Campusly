// Helpers that keep every request inside the signed-in user's institution.
const store = require('../store');
const { TERMS } = require('../config/terms');

const sameInst = (req) => (x) => x && x.institutionId === req.user.institutionId;
const instUsers = (req, role) => store.db.users.filter((u) => u.institutionId === req.user.institutionId && (!role || u.role === role));
// A user from the same institution, or null.
const instUser = (req, id) => {
  const u = store.userById(id);
  return u && u.institutionId === req.user.institutionId ? u : null;
};
const termsOf = (inst) => TERMS[(inst && inst.type) || 'university'];

module.exports = { sameInst, instUsers, instUser, termsOf };
