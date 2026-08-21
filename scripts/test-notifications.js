/**
 * Isolated notification-recipient matrix. Creates and deletes temporary admin users.
 * Usage: node scripts/test-notifications.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../db/db');
const { IncomingCall } = require('../comms/models');
    const {
      getEligibleAdmins,
      incomingPrefs,
      buildEmail,
      buildSms,
      claimCallNotification,
      isCompletedVoicemailCallback,
    } = require('../comms/notificationService');

const stamp = Date.now().toString(36);
const prefix = '__mg_notify_test_' + stamp;

function spec(letter, incoming) {
  return {
    fullName: 'Notify Test ' + letter,
    idNumber: prefix + letter,
    email: prefix + letter + '@example.invalid',
    username: prefix + letter,
    password: 'unused-test-password',
    admin: true,
    active: true,
    phone: letter === 'A' ? '+13055550101' : letter === 'B' ? '' : '+13055550103',
    notifications: { incomingCalls: incoming },
  };
}

async function main() {
  await mongoose.connection.asPromise();
  const created = [];
  try {
    const a = await User.create(
      spec('A', { enabled: true, email: true, sms: true })
    );
    const b = await User.create(
      spec('B', { enabled: true, email: true, sms: false })
    );
    const c = await User.create(
      spec('C', { enabled: false, email: true, sms: true })
    );
    created.push(a, b, c);

    const eligible = await getEligibleAdmins();
    const ours = eligible.filter((u) => String(u.username).startsWith(prefix));
    const names = ours.map((u) => u.username.slice(-1)).sort();
    if (names.join('') !== 'AB') {
      throw new Error('Expected recipients A,B got ' + names.join(',') + ' prefs=' + JSON.stringify(ours.map((u) => incomingPrefs(u))));
    }
    const aPrefs = incomingPrefs(ours.find((u) => u.username.endsWith('A')));
    const bPrefs = incomingPrefs(ours.find((u) => u.username.endsWith('B')));
    if (!aPrefs.email || !aPrefs.sms) throw new Error('A should have email+sms');
    if (!bPrefs.email || bPrefs.sms) throw new Error('B should have email only');
    console.log('Recipient matrix OK: A email+sms, B email only, C excluded');

    const esMail = buildEmail({
      from: '+13055550199',
      category: 'quote',
      language: 'es',
      createdAt: new Date('2026-08-21T14:00:00Z'),
    });
    const missingLangMail = buildEmail({
      from: '+13055550199',
      category: 'unknown',
      createdAt: new Date('2026-08-21T14:00:00Z'),
    });
    const esSms = buildSms({ from: '+13055550199', category: 'quote', language: 'es' });
    if (!esMail.text.includes('Language: Spanish') || !esMail.html.includes('Spanish')) {
      throw new Error('email should include Language: Spanish');
    }
    if (!missingLangMail.text.includes('Language: English')) {
      throw new Error('email should default missing language to English');
    }
    if (!esSms.includes('Language: Spanish')) {
      throw new Error('SMS should include Language: Spanish');
    }
    if (esSms.length > 160) {
      throw new Error('SMS is longer than 160 characters: ' + esSms.length);
    }
    console.log('Notification language copy OK');
    console.log('  SMS:', esSms);

    const call = await IncomingCall.create({
      twilioCallSid: 'CA' + prefix,
      from: '+13055550199',
      to: '+13055550000',
      category: 'quote',
      digits: '2',
      callStatus: 'completed',
      recordingSid: 'RE' + prefix,
      recordingDuration: 12,
    });
    if (call.language !== 'en') {
      throw new Error('new IncomingCall language should default to en, got ' + call.language);
    }

    if (!isCompletedVoicemailCallback({ RecordingStatus: 'completed', RecordingDuration: '12' })) {
      throw new Error('completed voicemail callback should notify');
    }
    if (isCompletedVoicemailCallback({ RecordingSid: 'REx', RecordingDuration: '12' })) {
      throw new Error('action/status-style payload without RecordingStatus=completed must not notify');
    }
    if (isCompletedVoicemailCallback({ RecordingStatus: 'in-progress', RecordingSid: 'REx', RecordingDuration: '0' })) {
      throw new Error('in-progress recording must not notify');
    }
    console.log('Recording notify gate OK');

    // Claim the same slot notifyAfterRecording uses. Do not send here: this
    // script creates @example.invalid users and must not email production admins.
    const first = await claimCallNotification(call);
    const second = await claimCallNotification(call);
    if (!first) throw new Error('first notify should claim');
    if (second) throw new Error('duplicate notify should not claim');

    const parallelCall = await IncomingCall.create({
      twilioCallSid: 'CA' + prefix + 'p',
      from: '+13055550199',
      to: '+13055550000',
      category: 'quote',
      callStatus: 'completed',
      recordingSid: 'RE' + prefix + 'p',
      recordingDuration: 12,
    });
    const parallel = await Promise.all(
      Array.from({ length: 12 }, () => claimCallNotification(parallelCall))
    );
    const wins = parallel.filter(Boolean);
    if (wins.length !== 1) {
      throw new Error('parallel claims should win exactly once, got ' + wins.length);
    }
    console.log('Idempotency OK (sequential + 12-way parallel)');

    await IncomingCall.deleteOne({ _id: call._id });
    await IncomingCall.deleteOne({ _id: parallelCall._id });
  } finally {
    await User.deleteMany({ username: { $in: created.map((u) => u.username) } });
    await IncomingCall.deleteMany({
      twilioCallSid: { $in: ['CA' + prefix, 'CA' + prefix + 'p'] },
    });
  }
  console.log('Temp users removed.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
