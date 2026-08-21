const express = require('express');
const { User } = require('../db/db');
const { ClientOrg } = require('./models');
const { requireOps } = require('./auth');
const { clientAllowedBuildingIds, buildingsForEmployee, suggestedBuildingForEmployee } = require('./access');
const storage = require('./storage');

const router = express.Router();

router.get('/me', requireOps(['admin', 'employee', 'client']), async (req, res) => {
  try {
    const user = req.opsUser;
    const payload = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      photoRetentionDays: storage.retentionDays(),
      maxUploadBytes: storage.maxUploadBytes(),
      storageMode: storage.storageMode(),
    };
    if (user.role === 'client') {
      const org = user.clientOrgId ? await ClientOrg.findById(user.clientOrgId).lean() : null;
      payload.clientOrgId = user.clientOrgId;
      payload.clientOrgName = org ? org.name : '';
      payload.buildingIds = await clientAllowedBuildingIds(user);
    }
    if (user.role === 'employee' || user.role === 'admin') {
      payload.buildingIds = await buildingsForEmployee(user.id);
      payload.suggestedBuildingId = await suggestedBuildingForEmployee(user.id);
    }
    res.json(payload);
  } catch (err) {
    console.error('GET /api/ops/me', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.get('/staff', requireOps(['admin']), async (req, res) => {
  try {
    const users = await User.find(
      {
        active: { $ne: false },
        $or: [{ role: { $exists: false } }, { role: { $ne: 'client' } }],
      },
      { fullName: 1, username: 1, admin: 1, role: 1 }
    )
      .sort({ fullName: 1 })
      .lean();
    res.json(
      users.map((u) => ({
        id: u._id,
        fullName: u.fullName,
        username: u.username,
        admin: !!u.admin,
      }))
    );
  } catch (err) {
    console.error('GET /api/ops/staff', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.get('/audit', requireOps(['admin']), async (req, res) => {
  try {
    const { OpsAudit } = require('./models');
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const rows = await OpsAudit.find({}).sort({ createdAt: -1 }).limit(limit).lean();
    res.json(rows);
  } catch (err) {
    console.error('GET /api/ops/audit', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

module.exports = router;
