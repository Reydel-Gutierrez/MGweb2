const express = require('express');
const mongoose = require('mongoose');
const { User } = require('../db/db');
const { requireAdminApi } = require('./adminAuth');
const { normalizeToE164, incomingPrefs, getEligibleAdmins } = require('./notificationService');

const router = express.Router();
router.use(requireAdminApi);

function publicAdmin(user) {
  const prefs = incomingPrefs(user);
  return {
    _id: user._id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    phone: user.phone || '',
    admin: !!user.admin,
    active: user.active !== false,
    notifications: { incomingCalls: prefs },
  };
}

router.get('/', async (req, res) => {
  try {
    const users = await User.find({ admin: true })
      .select('fullName username email phone admin active notifications')
      .sort({ fullName: 1 })
      .lean();
    res.json(users.map(publicAdmin));
  } catch (err) {
    console.error('GET /api/admin-users error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/notification-recipients', async (req, res) => {
  try {
    const admins = await getEligibleAdmins();
    res.json(
      admins.map((u) => {
        const prefs = incomingPrefs(u);
        return {
          _id: u._id,
          username: u.username,
          fullName: u.fullName,
          email: prefs.email ? u.email : '',
          phone: prefs.sms ? normalizeToE164(u.phone) : '',
          emailEnabled: prefs.email,
          smsEnabled: prefs.sms,
        };
      })
    );
  } catch (err) {
    console.error('GET /api/admin-users/notification-recipients error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.patch('/:id/notifications', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.admin) {
      return res.status(400).json({ error: 'Call notifications are only available for administrator accounts.' });
    }

    const body = req.body || {};
    const updates = {};
    if (body.phone !== undefined) {
      const raw = String(body.phone).trim();
      const e164 = normalizeToE164(raw);
      updates.phone = e164 || raw;
    }

    const incoming =
      body.incomingCalls || (body.notifications && body.notifications.incomingCalls);
    if (incoming && typeof incoming === 'object') {
      if (incoming.enabled !== undefined) {
        updates['notifications.incomingCalls.enabled'] = Boolean(incoming.enabled);
      }
      if (incoming.email !== undefined) {
        updates['notifications.incomingCalls.email'] = Boolean(incoming.email);
      }
      if (incoming.sms !== undefined) {
        updates['notifications.incomingCalls.sms'] = Boolean(incoming.sms);
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No notification fields to update.' });
    }

    const updated = await User.findByIdAndUpdate(id, { $set: updates }, { new: true })
      .select('fullName username email phone admin active notifications')
      .lean();
    res.json({ message: 'Notification preferences updated', data: publicAdmin(updated) });
  } catch (err) {
    console.error('PATCH /api/admin-users/:id/notifications error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
