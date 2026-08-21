const https = require('https');
const { URL } = require('url');
const twilio = require('twilio');
const { User } = require('../db/db');
const { IncomingCall } = require('./models');
const { envFlag, absoluteUrl } = require('./config');

const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
const GRAPH_TIMEOUT_MS = 20000;

const CATEGORY_LABEL = {
  existing_customer: 'Existing customer',
  quote: 'Quote',
  other: 'Other',
  unknown: 'Unknown',
};

const SMS_CATEGORY = {
  existing_customer: 'existing-customer call',
  quote: 'quote inquiry',
  other: 'other inquiry',
  unknown: 'inquiry',
};

const LANGUAGE_LABEL = {
  en: 'English',
  es: 'Spanish',
};

function languageLabel(call) {
  return LANGUAGE_LABEL[call && call.language] || LANGUAGE_LABEL.en;
}

function normalizeToE164(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const digits = s.replace(/\D/g, '');
  if (!digits) return '';
  if (s.startsWith('+') && digits.length >= 10 && digits.length <= 15) {
    return '+' + digits;
  }
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  if (digits.length >= 11 && digits.length <= 15) return '+' + digits;
  return '';
}

function formatUsPhone(e164) {
  const d = String(e164 || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return e164 || '';
}

function incomingPrefs(user) {
  const n = (user && user.notifications && user.notifications.incomingCalls) || {};
  return {
    enabled: n.enabled === true,
    email: n.email === true,
    sms: n.sms === true,
  };
}

function isCompletedVoicemailCallback(body) {
  const recStatus = String((body && body.RecordingStatus) || '').toLowerCase();
  const duration = Number(body && body.RecordingDuration);
  return recStatus === 'completed' && Number.isFinite(duration) && duration > 0;
}

async function getEligibleAdmins() {
  const users = await User.find({
    admin: true,
    active: { $ne: false },
    'notifications.incomingCalls.enabled': true,
  })
    .select('fullName email phone username notifications admin active')
    .lean();
  const eligible = users.filter((u) => incomingPrefs(u).enabled);
  const seen = new Set();
  return eligible.filter((u) => {
    const key = String(u.email || '')
      .trim()
      .toLowerCase() || 'user:' + String(u._id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function emailConfigured() {
  return Boolean(
    process.env.MS_TENANT_ID &&
      process.env.MS_CLIENT_ID &&
      process.env.MS_CLIENT_SECRET &&
      process.env.MS_SENDER_EMAIL
  );
}

function smsConfigured() {
  return (
    envFlag('CALL_SMS_NOTIFICATIONS_ENABLED', false) &&
    Boolean(process.env.TWILIO_ACCOUNT_SID) &&
    Boolean(process.env.TWILIO_AUTH_TOKEN) &&
    Boolean(process.env.TWILIO_PHONE_NUMBER)
  );
}

function httpsRequest(urlString, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const payload = body == null ? null : Buffer.from(String(body), 'utf8');
    const reqHeaders = Object.assign({}, headers);
    if (payload) reqHeaders['Content-Length'] = payload.length;

    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method,
        headers: reqHeaders,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            text: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );
    req.setTimeout(GRAPH_TIMEOUT_MS, () => {
      req.destroy(new Error('Microsoft Graph request timed out'));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function parseJsonSafe(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_err) {
    return null;
  }
}

function graphErrorMessage(res) {
  const json = parseJsonSafe(res.text);
  const err = json && json.error;
  if (err && typeof err === 'object') {
    const code = err.code || err.error || '';
    const message = err.message || err.error_description || '';
    return `Graph ${res.status}${code ? ' ' + code : ''}${message ? ': ' + message : ''}`.trim();
  }
  if (json && json.error) {
    const desc = json.error_description || json.error;
    return `Graph ${res.status}: ${desc}`;
  }
  return `Graph ${res.status}${res.text ? ': ' + res.text.slice(0, 300) : ''}`;
}

let cachedToken = null;
let tokenExpiresAt = 0;

function clearTokenCache() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

async function getGraphAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60 * 1000) {
    return cachedToken;
  }

  const tenant = String(process.env.MS_TENANT_ID || '').trim();
  const clientId = String(process.env.MS_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.MS_CLIENT_SECRET || '').trim();
  if (!tenant || !clientId || !clientSecret) {
    throw new Error('Microsoft Graph is not configured');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: GRAPH_SCOPE,
  }).toString();

  const res = await httpsRequest(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const json = parseJsonSafe(res.text) || {};
  if (res.status !== 200 || !json.access_token) {
    clearTokenCache();
    throw new Error(graphErrorMessage(res));
  }

  const expiresInSec = Number(json.expires_in) || 3599;
  cachedToken = json.access_token;
  tokenExpiresAt = Date.now() + expiresInSec * 1000;
  return cachedToken;
}

function dashboardCallsUrl() {
  return absoluteUrl('/AdminDash/pages/calls.html');
}

function buildEmail(call) {
  const category = CATEGORY_LABEL[call.category] || call.category || 'Unknown';
  const when = call.createdAt
    ? new Date(call.createdAt).toLocaleString('en-US', { timeZone: 'America/New_York' })
    : new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const caller = formatUsPhone(call.from) || call.from || 'Unknown number';
  const link = dashboardCallsUrl();
  const subject = `New MG Call — ${category}`;
  const language = languageLabel(call);
  const text = [
    'MG Building Services',
    '',
    'A new voicemail is waiting in the Calls & Voicemail inbox.',
    `Caller: ${caller}`,
    `Category: ${category}`,
    `Language: ${language}`,
    `Received: ${when}`,
    '',
    `Open inbox: ${link}`,
  ].join('\n');
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:560px;">
      <h2 style="margin:0 0 8px;">MG Building Services</h2>
      <p style="margin:0 0 16px;color:#555;">A voicemail is waiting in the admin dashboard.</p>
      <table style="border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Caller</td><td>${escapeHtml(caller)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Category</td><td>${escapeHtml(category)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Language</td><td>${escapeHtml(language)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Received</td><td>${escapeHtml(when)}</td></tr>
      </table>
      <p style="margin:20px 0 0;">
        <a href="${escapeHtml(link)}" style="background:#111;color:#fff;padding:10px 16px;text-decoration:none;border-radius:4px;">
          Open Calls &amp; Voicemail
        </a>
      </p>
    </div>`;
  return { subject, text, html };
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildSms(call) {
  const kind = SMS_CATEGORY[call.category] || 'inquiry';
  const caller = formatUsPhone(call.from) || call.from || 'unknown number';
  return `MG: New ${kind} from ${caller}. Language: ${languageLabel(call)}. Voicemail waiting in the dashboard.`;
}

async function graphSendMail(to, mail, token) {
  const sender = String(process.env.MS_SENDER_EMAIL || '').trim();
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`;
  const body = JSON.stringify({
    message: {
      subject: mail.subject,
      body: {
        contentType: 'HTML',
        content: mail.html,
      },
      toRecipients: [{ emailAddress: { address: to } }],
    },
    saveToSentItems: true,
  });
  return httpsRequest(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body,
  });
}

async function sendEmail(to, call) {
  const mail = buildEmail(call);
  if (!emailConfigured()) {
    console.warn(
      'Call email skipped: Microsoft Graph is not configured (set MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_SENDER_EMAIL).'
    );
    return { ok: false, skipped: 'graph_unconfigured' };
  }

  let token = await getGraphAccessToken();
  let res = await graphSendMail(to, mail, token);
  if (res.status === 401) {
    clearTokenCache();
    token = await getGraphAccessToken();
    res = await graphSendMail(to, mail, token);
  }

  if (res.status === 202 || res.status === 200) {
    return { ok: true, status: res.status };
  }

  const error = new Error(graphErrorMessage(res));
  error.status = res.status;
  throw error;
}

async function sendSms(toE164, call) {
  if (!smsConfigured()) {
    console.warn('Call SMS skipped: CALL_SMS_NOTIFICATIONS_ENABLED is false or Twilio SMS env is incomplete.');
    return { ok: false, skipped: 'sms_disabled' };
  }
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: toE164,
    body: buildSms(call),
  });
  return { ok: true };
}

async function sendNotifications(call) {
  const admins = await getEligibleAdmins();
  const results = { emailed: 0, sms: 0, errors: 0 };
  const emailedTo = new Set();
  for (const admin of admins) {
    const prefs = incomingPrefs(admin);
    if (prefs.email) {
      const addr = String(admin.email || '').trim();
      const addrKey = addr.toLowerCase();
      if (!addr) {
        console.warn(`Call email skipped for ${admin.username}: no email address.`);
      } else if (emailedTo.has(addrKey)) {
        console.warn(`[ivr-notify] skip duplicate recipient ${addr} for ${call.twilioCallSid}`);
      } else {
        emailedTo.add(addrKey);
        try {
          const r = await sendEmail(addr, call);
          if (r.ok) results.emailed += 1;
          console.log(
            '[ivr-notify] sendMail',
            JSON.stringify({
              CallSid: call.twilioCallSid,
              IncomingCallId: call._id ? String(call._id) : null,
              to: addr,
              username: admin.username,
              status: r.status,
              ok: r.ok,
            })
          );
        } catch (err) {
          results.errors += 1;
          console.error(`Call email failed for ${admin.username}:`, err && err.message ? err.message : err);
        }
      }
    }
    if (prefs.sms) {
      const e164 = normalizeToE164(admin.phone);
      if (!e164) {
        console.warn(`Call SMS skipped for ${admin.username}: no valid phone number.`);
      } else {
        try {
          const r = await sendSms(e164, call);
          if (r.ok) results.sms += 1;
        } catch (err) {
          results.errors += 1;
          console.error(`Call SMS failed for ${admin.username}:`, err && err.message ? err.message : err);
        }
      }
    }
  }
  console.log(
    `Call notifications for ${call.twilioCallSid}: ${admins.length} admin(s), ${results.emailed} email(s), ${results.sms} SMS, ${results.errors} error(s).`
  );
  return results;
}

const notifyInflight = new Map();

function unclaimedNotificationFilter(extra) {
  return Object.assign(
    {
      $or: [{ notificationProcessedAt: null }, { notificationProcessedAt: { $exists: false } }],
    },
    extra || {}
  );
}

async function claimCallNotification(call) {
  const sid = String((call && call.twilioCallSid) || '').trim();
  if (sid) {
    return IncomingCall.findOneAndUpdate(
      unclaimedNotificationFilter({ twilioCallSid: sid }),
      { $set: { notificationProcessedAt: new Date() } },
      { new: true }
    );
  }
  if (call && call._id) {
    return IncomingCall.findOneAndUpdate(
      unclaimedNotificationFilter({ _id: call._id }),
      { $set: { notificationProcessedAt: new Date() } },
      { new: true }
    );
  }
  return null;
}

async function claimAndNotify(call) {
  const claimed = await claimCallNotification(call);
  console.log(
    '[ivr-notify] claim',
    JSON.stringify({
      CallSid: call && call.twilioCallSid,
      IncomingCallId: call && call._id ? String(call._id) : null,
      RecordingSid: call && call.recordingSid ? call.recordingSid : null,
      claimed: Boolean(claimed),
      claimedId: claimed && claimed._id ? String(claimed._id) : null,
    })
  );
  if (!claimed) {
    return { claimed: false };
  }
  try {
    const results = await sendNotifications(claimed);
    return { claimed: true, results };
  } catch (err) {
    console.error('Call notification processing error:', err && err.message ? err.message : err);
    return { claimed: true, error: true };
  }
}

async function notifyAfterRecording(call) {
  if (!call || (!call.twilioCallSid && !call._id)) return { claimed: false };
  const key = String(call.twilioCallSid || call._id);
  if (notifyInflight.has(key)) {
    console.log('[ivr-notify] join-inflight', key);
    return notifyInflight.get(key);
  }
  const work = claimAndNotify(call).finally(() => {
    notifyInflight.delete(key);
  });
  notifyInflight.set(key, work);
  return work;
}

module.exports = {
  normalizeToE164,
  formatUsPhone,
  incomingPrefs,
  getEligibleAdmins,
  emailConfigured,
  smsConfigured,
  getGraphAccessToken,
  sendEmail,
  notifyAfterRecording,
  claimCallNotification,
  isCompletedVoicemailCallback,
  sendNotifications,
  buildEmail,
  buildSms,
};
