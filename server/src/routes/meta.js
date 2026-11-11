const express = require('express');
const store = require('../store');
const C = require('../config/constants');
const { TERMS, TYPES } = require('../config/terms');
const { instPublic } = require('../utils/users');

const router = express.Router();

// GET /api/meta/institutions?type=school  Public list for the sign-in picker.
router.get('/institutions', (req, res) => {
  const type = TYPES.includes(req.query.type) ? req.query.type : null;
  const list = store.db.institutions
    .filter((i) => !type || i.type === type)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(instPublic);
  res.json({ institutions: list });
});

// GET /api/meta?institution=ID  Lookup data for one institution's forms
// (report categories, offices, classes or departments, teachers for sign-up).
router.get('/', (req, res) => {
  const inst = store.instById(req.query.institution);
  const base = { steps: C.REPORT_STEPS, demoMode: String(process.env.DEMO_MODE).toLowerCase() !== 'false' };
  if (!inst) return res.json({ ...base, institution: null });
  const advisors = store.db.users
    .filter((u) => u.institutionId === inst.id && u.role === 'faculty')
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => ({ id: a.id, name: a.name }));
  res.json({
    ...base,
    institution: instPublic(inst),
    terms: TERMS[inst.type],
    categories: inst.categories,
    depts: inst.offices,
    locations: inst.locations,
    programs: inst.groups,
    advisors,
  });
});

module.exports = router;
