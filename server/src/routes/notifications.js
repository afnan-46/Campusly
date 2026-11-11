const express = require('express');
const store = require('../store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/notifications  Latest 20, plus the unread count.
router.get('/', (req, res) => {
  const mine = store.db.notifications.filter((n) => n.to === req.user.id);
  const latest = [...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
  res.json({
    unread: mine.filter((n) => !n.read).length,
    notifications: latest.map((n) => ({ id: n.id, text: n.text, link: n.link, read: n.read, at: n.createdAt })),
  });
});

// POST /api/notifications/read-all
router.post('/read-all', (req, res) => {
  let changed = false;
  store.db.notifications.forEach((n) => {
    if (n.to === req.user.id && !n.read) { n.read = true; changed = true; }
  });
  if (changed) store.save();
  res.json({ ok: true });
});

module.exports = router;
