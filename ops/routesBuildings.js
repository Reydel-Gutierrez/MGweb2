const express = require('express');
const { Building, ClientOrg, RecurringSchedule, DocumentationEntry } = require('./models');
const { requireOps } = require('./auth');
const { logAudit } = require('./audit');
const { isOid, fail } = require('./http');
const { removeBuildingRecords } = require('./removeRecords');

const router = express.Router();

async function withClientName(buildings) {
  const orgIds = [...new Set(buildings.map((b) => String(b.clientOrgId || '')).filter(Boolean))];
  const orgs = await ClientOrg.find({ _id: { $in: orgIds } }).select('name').lean();
  const names = new Map(orgs.map((o) => [String(o._id), o.name]));
  return buildings.map((b) => ({
    ...b,
    id: b._id,
    clientName: names.get(String(b.clientOrgId)) || '',
  }));
}

router.get('/buildings', requireOps(['admin']), async (req, res) => {
  try {
    const q = {};
    if (req.query.active === 'true') q.active = { $ne: false };
    if (req.query.active === 'false') q.active = false;
    if (req.query.clientOrgId && isOid(req.query.clientOrgId)) q.clientOrgId = req.query.clientOrgId;
    const buildings = await Building.find(q).sort({ name: 1 }).lean();
    res.json(await withClientName(buildings));
  } catch (err) {
    console.error('GET /api/ops/buildings', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.post('/buildings', requireOps(['admin']), async (req, res) => {
  try {
    const name = String((req.body && req.body.name) || '').trim();
    const clientOrgId = req.body && req.body.clientOrgId;
    if (!name) return fail(res, 400, 'Building name is required.');
    if (!isOid(clientOrgId)) return fail(res, 400, 'A client is required.');
    const org = await ClientOrg.findById(clientOrgId);
    if (!org) return fail(res, 400, 'Client not found.');
    const doc = await Building.create({
      name,
      clientOrgId,
      address: String((req.body && req.body.address) || '').trim(),
      notes: String((req.body && req.body.notes) || '').trim(),
      active: req.body && req.body.active === false ? false : true,
    });
    await logAudit(req, {
      action: 'building.create',
      entityType: 'building',
      entityId: doc._id,
      summary: `Created building ${name}`,
      after: { name, clientOrgId: String(clientOrgId) },
    });
    const [out] = await withClientName([doc.toObject()]);
    res.status(201).json(out);
  } catch (err) {
    console.error('POST /api/ops/buildings', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.get('/buildings/:id', requireOps(['admin']), async (req, res) => {
  try {
    if (!isOid(req.params.id)) return fail(res, 400, 'Invalid building id.');
    const building = await Building.findById(req.params.id).lean();
    if (!building) return fail(res, 404, 'Building not found.');
    const [out] = await withClientName([building]);
    const scheduleCount = await RecurringSchedule.countDocuments({
      buildingId: building._id,
      active: { $ne: false },
    });
    const photoEntryCount = await DocumentationEntry.countDocuments({ buildingId: building._id });
    res.json({ ...out, scheduleCount, photoEntryCount });
  } catch (err) {
    console.error('GET /api/ops/buildings/:id', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.patch('/buildings/:id', requireOps(['admin']), async (req, res) => {
  try {
    if (!isOid(req.params.id)) return fail(res, 400, 'Invalid building id.');
    const current = await Building.findById(req.params.id);
    if (!current) return fail(res, 404, 'Building not found.');
    const updates = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return fail(res, 400, 'Building name is required.');
      updates.name = name;
    }
    if (req.body.address !== undefined) updates.address = String(req.body.address).trim();
    if (req.body.notes !== undefined) updates.notes = String(req.body.notes).trim();
    if (req.body.active !== undefined) updates.active = Boolean(req.body.active);
    if (req.body.clientOrgId !== undefined) {
      if (!isOid(req.body.clientOrgId)) return fail(res, 400, 'Invalid client.');
      const org = await ClientOrg.findById(req.body.clientOrgId);
      if (!org) return fail(res, 400, 'Client not found.');
      updates.clientOrgId = req.body.clientOrgId;
    }
    const updated = await Building.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).lean();
    await logAudit(req, {
      action: 'building.update',
      entityType: 'building',
      entityId: updated._id,
      summary: `Updated building ${updated.name}`,
      before: {
        name: current.name,
        clientOrgId: String(current.clientOrgId),
        active: current.active,
      },
      after: updates,
    });
    const [out] = await withClientName([updated]);
    res.json(out);
  } catch (err) {
    console.error('PATCH /api/ops/buildings/:id', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

router.delete('/buildings/:id', requireOps(['admin']), async (req, res) => {
  try {
    if (!isOid(req.params.id)) return fail(res, 400, 'Invalid building id.');
    const current = await Building.findById(req.params.id);
    if (!current) return fail(res, 404, 'Building not found.');
    const removed = await removeBuildingRecords(current._id);
    await logAudit(req, {
      action: 'building.delete',
      entityType: 'building',
      entityId: current._id,
      summary: `Deleted building ${current.name}`,
      before: {
        name: current.name,
        clientOrgId: String(current.clientOrgId),
        scheduleCount: removed.scheduleCount,
      },
    });
    res.json({ message: 'Building deleted', id: current._id });
  } catch (err) {
    console.error('DELETE /api/ops/buildings/:id', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
  }
});

module.exports = router;
