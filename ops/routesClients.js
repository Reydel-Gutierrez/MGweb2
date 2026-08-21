const express = require('express');
const { User } = require('../db/db');
const { ClientOrg, Building, ClientBuildingAccess } = require('./models');
const { requireOps } = require('./auth');
const { logAudit } = require('./audit');
const { isOid, fail } = require('./http');
const { clientAllowedBuildingIds } = require('./access');
const { removeClientOrg } = require('./removeRecords');

const router = express.Router();

function clientPublic(user, buildingIds) {
  return {
    id: user._id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    active: user.active !== false,
    clientOrgId: user.clientOrgId,
    buildingIds: buildingIds || [],
  };
}

router.get('/clients', requireOps(['admin']), async (req, res) => {
  try {
    const orgs = await ClientOrg.find({}).sort({ name: 1 }).lean();
    const buildingCounts = await Building.aggregate([
      { $group: { _id: '$clientOrgId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(buildingCounts.map((row) => [String(row._id), row.count]));
    const userCounts = await User.aggregate([
      { $match: { role: 'client' } },
      { $group: { _id: '$clientOrgId', count: { $sum: 1 } } },
    ]);
    const userMap = new Map(userCounts.map((row) => [String(row._id), row.count]));
    res.json(
      orgs.map((org) => ({
        ...org,
        id: org._id,
        buildingCount: countMap.get(String(org._id)) || 0,
        userCount: userMap.get(String(org._id)) || 0,
      }))
    );
  } catch (err) {
    console.error('GET /api/ops/clients', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.post('/clients', requireOps(['admin']), async (req, res) => {
  try {
    const name = String((req.body && req.body.name) || '').trim();
    if (!name) return fail(res, 400, 'Client name is required.');
    const org = await ClientOrg.create({
      name,
      notes: String((req.body && req.body.notes) || '').trim(),
      active: req.body && req.body.active === false ? false : true,
    });
    await logAudit(req, {
      action: 'client.create',
      entityType: 'clientOrg',
      entityId: org._id,
      summary: `Created client ${name}`,
    });
    res.status(201).json({ ...org.toObject(), id: org._id, buildingCount: 0, userCount: 0 });
  } catch (err) {
    console.error('POST /api/ops/clients', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.patch('/clients/:id', requireOps(['admin']), async (req, res) => {
  try {
    if (!isOid(req.params.id)) return fail(res, 400, 'Invalid client id.');
    const current = await ClientOrg.findById(req.params.id);
    if (!current) return fail(res, 404, 'Client not found.');
    const updates = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return fail(res, 400, 'Client name is required.');
      updates.name = name;
    }
    if (req.body.notes !== undefined) updates.notes = String(req.body.notes).trim();
    if (req.body.active !== undefined) updates.active = Boolean(req.body.active);
    const updated = await ClientOrg.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).lean();
    await logAudit(req, {
      action: 'client.update',
      entityType: 'clientOrg',
      entityId: updated._id,
      summary: `Updated client ${updated.name}`,
      before: { name: current.name, active: current.active },
      after: updates,
    });
    res.json({ ...updated, id: updated._id });
  } catch (err) {
    console.error('PATCH /api/ops/clients/:id', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.delete('/clients/:id', requireOps(['admin']), async (req, res) => {
  try {
    if (!isOid(req.params.id)) return fail(res, 400, 'Invalid client id.');
    const current = await ClientOrg.findById(req.params.id);
    if (!current) return fail(res, 404, 'Client not found.');
    const removed = await removeClientOrg(current._id);
    await logAudit(req, {
      action: 'client.delete',
      entityType: 'clientOrg',
      entityId: current._id,
      summary: `Deleted client ${current.name}`,
      before: {
        name: current.name,
        buildingCount: removed.buildingCount,
        userCount: removed.userCount,
      },
    });
    res.json({ message: 'Client deleted', id: current._id });
  } catch (err) {
    console.error('DELETE /api/ops/clients/:id', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.get('/clients/:id/users', requireOps(['admin']), async (req, res) => {
  try {
    if (!isOid(req.params.id)) return fail(res, 400, 'Invalid client id.');
    const users = await User.find({ role: 'client', clientOrgId: req.params.id })
      .select('-password')
      .sort({ fullName: 1 })
      .lean();
    const resolved = await Promise.all(
      users.map(async (u) =>
        clientPublic(u, await clientAllowedBuildingIds({ id: u._id, clientOrgId: u.clientOrgId }))
      )
    );
    res.json(resolved);
  } catch (err) {
    console.error('GET /api/ops/clients/:id/users', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.post('/clients/:id/users', requireOps(['admin']), async (req, res) => {
  try {
    if (!isOid(req.params.id)) return fail(res, 400, 'Invalid client id.');
    const org = await ClientOrg.findById(req.params.id);
    if (!org) return fail(res, 404, 'Client not found.');
    const fullName = String((req.body && req.body.fullName) || '').trim();
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    const username = String((req.body && req.body.username) || '').trim();
    const password = String((req.body && req.body.password) || '');
    if (!fullName || !email || !username || !password) {
      return fail(res, 400, 'Full name, email, username, and password are required.');
    }
    const takenUser = await User.findOne({ username });
    if (takenUser) return fail(res, 400, 'Username already in use.');
    const takenEmail = await User.findOne({ email });
    if (takenEmail) return fail(res, 400, 'Email already in use.');
    const idNumber = `CLT-${username}`.slice(0, 40);
    const idTaken = await User.findOne({ idNumber });
    const safeId = idTaken ? `CLT-${Date.now().toString(36)}` : idNumber;
    const user = await User.create({
      fullName,
      email,
      username,
      password,
      idNumber: safeId,
      payRate: '',
      admin: false,
      role: 'client',
      clientOrgId: org._id,
      active: true,
    });
    const requested = Array.isArray(req.body.buildingIds) ? req.body.buildingIds : [];
    const validBuildings = await Building.find({
      _id: { $in: requested.filter(isOid) },
      clientOrgId: org._id,
    }).select('_id').lean();
    if (validBuildings.length) {
      await ClientBuildingAccess.insertMany(
        validBuildings.map((b) => ({ userId: user._id, buildingId: b._id }))
      );
    } else {
      const orgBuildings = await Building.find({ clientOrgId: org._id, active: { $ne: false } })
        .select('_id')
        .lean();
      if (orgBuildings.length) {
        await ClientBuildingAccess.insertMany(
          orgBuildings.map((b) => ({ userId: user._id, buildingId: b._id }))
        );
        validBuildings.push(...orgBuildings);
      }
    }
    await logAudit(req, {
      action: 'clientUser.create',
      entityType: 'user',
      entityId: user._id,
      summary: `Created client user ${username} for ${org.name}`,
      after: { buildingIds: validBuildings.map((b) => String(b._id)) },
    });
    res.status(201).json(clientPublic(user.toObject(), validBuildings.map((b) => String(b._id))));
  } catch (err) {
    console.error('POST /api/ops/clients/:id/users', err);
    if (err.code === 11000) return fail(res, 400, 'Username or email already in use.');
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.patch('/client-users/:id', requireOps(['admin']), async (req, res) => {
  try {
    if (!isOid(req.params.id)) return fail(res, 400, 'Invalid user id.');
    const current = await User.findOne({ _id: req.params.id, role: 'client' });
    if (!current) return fail(res, 404, 'Client user not found.');
    const updates = {};
    if (req.body.fullName !== undefined) updates.fullName = String(req.body.fullName).trim();
    if (req.body.email !== undefined) updates.email = String(req.body.email).trim().toLowerCase();
    if (req.body.username !== undefined) updates.username = String(req.body.username).trim();
    if (req.body.active !== undefined) updates.active = Boolean(req.body.active);
    if (req.body.password) updates.password = String(req.body.password);
    if (updates.email) {
      const taken = await User.findOne({ email: updates.email, _id: { $ne: current._id } });
      if (taken) return fail(res, 400, 'Email already in use.');
    }
    if (updates.username) {
      const taken = await User.findOne({ username: updates.username, _id: { $ne: current._id } });
      if (taken) return fail(res, 400, 'Username already in use.');
    }
    const updated = await User.findByIdAndUpdate(current._id, { $set: updates }, { new: true })
      .select('-password')
      .lean();
    const access = await ClientBuildingAccess.find({ userId: updated._id }).lean();
    await logAudit(req, {
      action: 'clientUser.update',
      entityType: 'user',
      entityId: updated._id,
      summary: `Updated client user ${updated.username}`,
    });
    res.json(clientPublic(updated, access.map((row) => String(row.buildingId))));
  } catch (err) {
    console.error('PATCH /api/ops/client-users/:id', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.put('/client-users/:id/buildings', requireOps(['admin']), async (req, res) => {
  try {
    if (!isOid(req.params.id)) return fail(res, 400, 'Invalid user id.');
    const user = await User.findOne({ _id: req.params.id, role: 'client' });
    if (!user) return fail(res, 404, 'Client user not found.');
    const requested = Array.isArray(req.body.buildingIds) ? req.body.buildingIds.filter(isOid) : [];
    const validBuildings = await Building.find({
      _id: { $in: requested },
      clientOrgId: user.clientOrgId,
    })
      .select('_id')
      .lean();
    const nextIds = validBuildings.map((b) => String(b._id));
    const previous = await ClientBuildingAccess.find({ userId: user._id }).lean();
    const prevIds = previous.map((row) => String(row.buildingId));
    await ClientBuildingAccess.deleteMany({ userId: user._id });
    if (validBuildings.length) {
      await ClientBuildingAccess.insertMany(
        validBuildings.map((b) => ({ userId: user._id, buildingId: b._id }))
      );
    }
    await logAudit(req, {
      action: 'clientAccess.change',
      entityType: 'user',
      entityId: user._id,
      summary: `Changed building access for ${user.username}`,
      before: { buildingIds: prevIds },
      after: { buildingIds: nextIds },
    });
    res.json({ id: user._id, buildingIds: nextIds });
  } catch (err) {
    console.error('PUT /api/ops/client-users/:id/buildings', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

module.exports = router;
