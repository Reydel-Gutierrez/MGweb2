const { User } = require('../db/db');
const {
  parseCookies,
  sessionSecret,
  COOKIE_NAME,
  PORTAL_COOKIE_NAME,
  verifyAdminSessionToken,
  verifyPortalSessionToken,
} = require('../comms/adminAuth');

function resolveRole(user) {
  if (!user) return 'employee';
  if (user.role === 'client') return 'client';
  if (user.admin === true || user.role === 'admin') return 'admin';
  return 'employee';
}

function staffFilter() {
  return { $or: [{ role: { $exists: false } }, { role: { $ne: 'client' } }] };
}

async function loadOpsUser(req) {
  if (!sessionSecret()) return { errorStatus: 503, error: 'Session secret is not configured.' };
  const cookies = parseCookies(req);
  const admin = verifyAdminSessionToken(cookies[COOKIE_NAME]);
  const portal = verifyPortalSessionToken(cookies[PORTAL_COOKIE_NAME]);
  const username = (admin && admin.username) || (portal && portal.username);
  if (!username) {
    return { errorStatus: 401, error: 'Sign-in required.' };
  }
  const user = await User.findOne({ username }).lean();
  if (!user || user.active === false) {
    return { errorStatus: 401, error: 'Sign-in required.' };
  }
  const role = resolveRole(user);
  return {
    user: {
      id: user._id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role,
      clientOrgId: user.clientOrgId || null,
    },
  };
}

function requireOps(allowedRoles) {
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return async function opsAuth(req, res, next) {
    try {
      const loaded = await loadOpsUser(req);
      if (loaded.error) {
        return res.status(loaded.errorStatus).json({ error: loaded.error, message: loaded.error });
      }
      if (!allowed.includes(loaded.user.role)) {
        return res.status(403).json({
          error: 'You do not have permission to use this page.',
          message: 'You do not have permission to use this page.',
        });
      }
      req.opsUser = loaded.user;
      return next();
    } catch (err) {
      console.error('ops auth error:', err);
      return res.status(500).json({ error: 'Internal Server Error', message: 'Internal Server Error' });
    }
  };
}

module.exports = {
  resolveRole,
  staffFilter,
  loadOpsUser,
  requireOps,
};
