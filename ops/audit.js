const { OpsAudit } = require('./models');

async function logAudit(req, fields) {
  try {
    const user = (req && req.opsUser) || {};
    await OpsAudit.create({
      actorUsername: user.username || '',
      actorRole: user.role || '',
      action: fields.action,
      entityType: fields.entityType || '',
      entityId: fields.entityId ? String(fields.entityId) : '',
      summary: fields.summary || '',
      before: fields.before,
      after: fields.after,
    });
  } catch (err) {
    console.error('ops audit write failed:', err.message || err);
  }
}

module.exports = { logAudit };
