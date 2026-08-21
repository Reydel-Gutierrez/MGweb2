/**
 * Real Microsoft Graph sendMail test for selected admin recipients.
 * Usage: node scripts/test-graph-email.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
require('../db/db');
const {
  emailConfigured,
  getEligibleAdmins,
  incomingPrefs,
  getGraphAccessToken,
  sendEmail,
} = require('../comms/notificationService');

async function main() {
  const required = ['MS_TENANT_ID', 'MS_CLIENT_ID', 'MS_CLIENT_SECRET', 'MS_SENDER_EMAIL'];
  const missing = required.filter((k) => !String(process.env[k] || '').trim());
  if (missing.length) {
    console.error('Missing Microsoft Graph env vars:', missing.join(', '));
    process.exit(1);
  }
  if (!emailConfigured()) {
    console.error('Microsoft Graph is not fully configured.');
    process.exit(1);
  }
  console.log('Microsoft Graph env vars: present (values not printed)');

  await mongoose.connection.asPromise();

  console.log('Requesting app-only Graph token...');
  await getGraphAccessToken();
  console.log('Microsoft authentication succeeded.');

  const admins = await getEligibleAdmins();
  const recipients = admins.filter((u) => incomingPrefs(u).email && String(u.email || '').trim());
  const addresses = recipients.map((u) => String(u.email).trim());
  console.log('Selected admin recipient emails:', addresses.length ? addresses.join(', ') : '(none)');

  if (!addresses.length) {
    console.error('No eligible admin email recipients in the database.');
    process.exit(1);
  }

  const call = {
    from: '+13055550199',
    category: 'quote',
    createdAt: new Date(),
    twilioCallSid: 'CA-graph-test',
  };

  const results = [];
  for (const to of addresses) {
    try {
      const r = await sendEmail(to, call);
      console.log(`Graph sendMail to ${to}: HTTP ${r.status}`);
      results.push({ to, status: r.status, ok: true });
    } catch (err) {
      const status = err && err.status ? err.status : 'error';
      console.error(`Graph sendMail to ${to}: HTTP ${status}`);
      console.error(err && err.message ? err.message : err);
      results.push({ to, status, ok: false });
    }
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    process.exit(1);
  }
  console.log('Real Graph email test succeeded.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
