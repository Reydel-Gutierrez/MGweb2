const crypto = require('crypto');

const COOKIE_NAME = 'mg_admin_session';
const PORTAL_COOKIE_NAME = 'mg_portal_session';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PORTAL_ROLES = ['employee', 'client'];

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch (e) {
      out[key] = val;
    }
  });
  return out;
}

function sessionSecret() {
  return process.env.MG_SESSION_SECRET || '';
}

function sign(payloadB64) {
  return crypto.createHmac('sha256', sessionSecret()).update(payloadB64).digest('base64url');
}

function createAdminSessionToken(username) {
  const payload = Buffer.from(
    JSON.stringify({
      u: String(username),
      exp: Date.now() + TTL_MS,
      p: 'admin',
    }),
    'utf8'
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifyAdminSessionToken(token) {
  if (!token || !sessionSecret()) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
  if (!data || data.p !== 'admin' || !data.u || data.exp < Date.now()) return null;
  return { username: data.u };
}

function setAdminSessionCookie(res, username) {
  const secret = sessionSecret();
  if (!secret) {
    console.warn('MG_SESSION_SECRET is not set; /api/calls will reject requests until it is configured');
    return;
  }
  const token = createAdminSessionToken(username);
  const secure = String(process.env.PUBLIC_BASE_URL || '').startsWith('https');
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(TTL_MS / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function clearAdminSessionCookie(res) {
  res.append(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

function createPortalSessionToken(username, role) {
  const portal = PORTAL_ROLES.includes(role) ? role : 'employee';
  const payload = Buffer.from(
    JSON.stringify({
      u: String(username),
      exp: Date.now() + TTL_MS,
      p: portal,
    }),
    'utf8'
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifyPortalSessionToken(token) {
  if (!token || !sessionSecret()) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
  if (!data || !PORTAL_ROLES.includes(data.p) || !data.u || data.exp < Date.now()) return null;
  return { username: data.u, role: data.p };
}

function cookieSecure() {
  return String(process.env.PUBLIC_BASE_URL || '').startsWith('https');
}

function setPortalSessionCookie(res, username, role) {
  const secret = sessionSecret();
  if (!secret) {
    console.warn('MG_SESSION_SECRET is not set; employee/client ops APIs will reject requests until it is configured');
    return;
  }
  const token = createPortalSessionToken(username, role);
  const parts = [
    `${PORTAL_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(TTL_MS / 1000)}`,
  ];
  if (cookieSecure()) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function clearPortalSessionCookie(res) {
  res.append(
    'Set-Cookie',
    `${PORTAL_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

function requireAdminApi(req, res, next) {
  if (!sessionSecret()) {
    return res.status(503).json({
      error: 'Admin API is not configured (MG_SESSION_SECRET missing). Sign in again after it is set.',
    });
  }
  const cookies = parseCookies(req);
  const session = verifyAdminSessionToken(cookies[COOKIE_NAME]);
  if (!session) {
    return res.status(401).json({
      error: 'Admin sign-in required. Use the administrator portal, then refresh this page.',
    });
  }
  req.adminUser = session;
  return next();
}

module.exports = {
  COOKIE_NAME,
  PORTAL_COOKIE_NAME,
  parseCookies,
  sessionSecret,
  createAdminSessionToken,
  setAdminSessionCookie,
  clearAdminSessionCookie,
  requireAdminApi,
  createPortalSessionToken,
  setPortalSessionCookie,
  clearPortalSessionCookie,
  verifyAdminSessionToken,
  verifyPortalSessionToken,
};
