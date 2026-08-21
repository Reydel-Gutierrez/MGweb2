/**
 * Local Twilio webhook simulator (no real phone number required).
 * Usage:
 *   node scripts/simulate-call.js
 *   node scripts/simulate-call.js 2            (menu digit 1, 2, or 3; English)
 *   node scripts/simulate-call.js 2 2          (menu digit, language digit 1=en 2=es)
 *   node scripts/simulate-call.js --all        (language, menu, and retry coverage)
 *   node scripts/simulate-call.js --all --twiml (same, without recording/notify webhooks)
 */
require('dotenv').config();
const http = require('http');
const { URL } = require('url');
const twilio = require('twilio');
const { createAdminSessionToken, COOKIE_NAME } = require('../comms/adminAuth');
const { publicBaseUrl } = require('../comms/config');
const {
  COMPANY_NAME,
  LANGUAGE_PROMPT_EN,
  LANGUAGE_PROMPT_ES,
  MENU_PROMPT,
  VOICEMAIL_PROMPT,
} = require('../comms/config');

const BASE = process.env.MG_SIM_BASE || 'http://localhost:3000';

const CATEGORY_BY_DIGIT = {
  1: 'existing_customer',
  2: 'quote',
  3: 'other',
};

function fakeSid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function twilioSignatureHeaders(path, fields) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  const base = publicBaseUrl();
  if (!token || !base || !fields) return {};
  const url = `${base}${path.startsWith('/') ? path : '/' + path}`;
  return {
    'X-Twilio-Signature': twilio.getExpectedTwilioSignature(token, url, fields),
  };
}

function requestJson(method, path, { fields, json, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, BASE);
    let body = '';
    const headers = {};
    if (fields) {
      body = new URLSearchParams(fields).toString();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      Object.assign(headers, twilioSignatureHeaders(u.pathname + u.search, fields));
    } else if (json) {
      body = JSON.stringify(json);
      headers['Content-Type'] = 'application/json';
    }
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
    if (cookie) headers.Cookie = cookie;

    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname + u.search,
        method,
        headers,
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          text += c;
        });
        res.on('end', () => {
          let parsed = text;
          try {
            parsed = text ? JSON.parse(text) : text;
          } catch (e) {
            parsed = text;
          }
          resolve({ status: res.statusCode, text, json: parsed });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function fail(message) {
  console.error('\nFAIL:', message);
  process.exitCode = 1;
}

function assertContains(haystack, needle, label) {
  if (String(haystack).indexOf(needle) === -1) {
    fail(label + ' — missing: ' + needle);
    return false;
  }
  return true;
}

function assertNotContains(haystack, needle, label) {
  if (String(haystack).indexOf(needle) !== -1) {
    fail(label + ' — unexpected: ' + needle);
    return false;
  }
  return true;
}

async function postForm(path, fields, { quiet } = {}) {
  const res = await requestJson('POST', path, { fields });
  if (!quiet) {
    console.log(`\n${res.status} POST ${path}`);
    if (res.text) {
      console.log(String(res.text).slice(0, 900));
    }
  }
  return res;
}

function expectLanguageMenu(xml, label) {
  assertContains(xml, '/webhooks/twilio/voice/language', label + ' language action');
  assertContains(xml, LANGUAGE_PROMPT_EN, label + ' English language prompt');
  assertContains(xml, LANGUAGE_PROMPT_ES, label + ' Spanish language prompt');
  assertContains(xml, 'Polly.Joanna', label + ' English TTS');
  assertContains(xml, 'Polly.Lupe', label + ' Spanish TTS');
  assertContains(xml, 'language="en-US"', label + ' en-US');
  assertContains(xml, 'language="es-US"', label + ' es-US');
  assertContains(xml, 'numDigits="1"', label + ' one digit');
}

function expectCompanyNameSpokenInEnglish(xml, label) {
  assertContains(
    xml,
    '<Say voice="Polly.Joanna" language="en-US">' + COMPANY_NAME + '</Say>',
    label + ' company name uses Polly.Joanna en-US'
  );
  if (/<Say voice="Polly.Lupe"[^>]*>[^<]*MG Building Services/.test(String(xml))) {
    fail(label + ' company name must not be spoken by Polly.Lupe');
  }
}

function expectServiceMenu(xml, lang, label) {
  assertContains(xml, '/webhooks/twilio/voice/menu?lang=' + lang, label + ' menu action');
  if (lang === 'es') {
    assertContains(xml, 'Gracias por llamar a', label + ' Spanish menu before company name');
    assertContains(xml, 'Si ya es cliente', label + ' Spanish menu after company name');
    expectCompanyNameSpokenInEnglish(xml, label);
    assertContains(xml, 'Polly.Lupe', label + ' Spanish voice');
    assertContains(xml, 'language="es-US"', label + ' es-US');
    assertNotContains(xml, MENU_PROMPT.en, label + ' no English menu');
  } else {
    assertContains(xml, MENU_PROMPT.en, label + ' menu prompt');
    assertNotContains(xml, 'Thank you for calling', label + ' does not repeat the opening thank-you');
    assertContains(xml, 'Polly.Joanna', label + ' English voice');
    assertContains(xml, 'language="en-US"', label + ' en-US');
    assertNotContains(xml, MENU_PROMPT.es, label + ' no Spanish menu');
  }
}

function expectVoicemail(xml, lang, label) {
  assertContains(xml, VOICEMAIL_PROMPT[lang], label + ' voicemail prompt');
  if (lang === 'es') {
    assertContains(xml, 'oprima la tecla de numeral', label + ' Spanish pound-key instruction');
  } else {
    assertContains(xml, 'press the pound key', label + ' English pound-key instruction');
  }
  assertContains(xml, '<Record', label + ' Record verb');
  assertContains(xml, 'playBeep="true"', label + ' beep');
  assertContains(xml, 'finishOnKey="#"', label + ' pound key ends recording');
  assertContains(xml, '/webhooks/twilio/voice/recording', label + ' recording callback');
  assertContains(xml, 'recordingStatusCallbackEvent="completed"', label + ' completed-only recording callback');
  assertNotContains(xml, 'phone number', label + ' does not ask for phone number');
  if (lang === 'es') {
    assertContains(xml, 'Polly.Lupe', label + ' Spanish voicemail voice');
  } else {
    assertContains(xml, 'Polly.Joanna', label + ' English voicemail voice');
  }
}

async function simulateFlow({
  menuDigit = '2',
  langDigit = '1',
  record = true,
  checkInbox = true,
  quiet = false,
  label = 'call',
} = {}) {
  const callSid = fakeSid('CA');
  const recSid = fakeSid('RE');
  const from = '+13055550199';
  const to = process.env.TWILIO_PHONE_NUMBER || '+13055550000';
  const lang = String(langDigit) === '2' ? 'es' : 'en';
  const expectedCategory = CATEGORY_BY_DIGIT[String(menuDigit)] || 'quote';

  if (!quiet) {
    console.log('\n=== ' + label + ' ===');
    console.log('  CallSid:', callSid);
    console.log('  Language digit:', langDigit, '(' + lang + ')');
    console.log('  Menu digit:', menuDigit, '(' + expectedCategory + ')');
  }

  const voice = await postForm(
    '/webhooks/twilio/voice',
    { CallSid: callSid, From: from, To: to, CallStatus: 'ringing' },
    { quiet }
  );
  expectLanguageMenu(voice.text, label + ' /voice');

  const language = await postForm(
    '/webhooks/twilio/voice/language',
    { CallSid: callSid, From: from, To: to, Digits: String(langDigit) },
    { quiet }
  );
  expectServiceMenu(language.text, lang, label + ' /voice/language');

  const menu = await postForm(
    '/webhooks/twilio/voice/menu?lang=' + lang,
    { CallSid: callSid, From: from, To: to, Digits: String(menuDigit) },
    { quiet }
  );
  expectVoicemail(menu.text, lang, label + ' /voice/menu');

  if (record) {
    await postForm(
      '/webhooks/twilio/voice/recording',
      {
        CallSid: callSid,
        RecordingSid: recSid,
        RecordingUrl: `https://example.invalid/recordings/${recSid}`,
        RecordingDuration: '12',
        RecordingStatus: 'completed',
      },
      { quiet }
    );

    await new Promise((r) => setTimeout(r, 400));

    await postForm(
      '/webhooks/twilio/voice/recording',
      {
        CallSid: callSid,
        RecordingSid: recSid,
        RecordingUrl: `https://example.invalid/recordings/${recSid}`,
        RecordingDuration: '12',
        RecordingStatus: 'completed',
      },
      { quiet }
    );
  }

  const status = await postForm(
    '/webhooks/twilio/voice/status',
    { CallSid: callSid, From: from, To: to, CallStatus: 'completed' },
    { quiet }
  );
  if (lang === 'es') {
    assertContains(status.text, 'Gracias. Adiós.', label + ' Spanish goodbye');
  } else {
    assertContains(status.text, 'Thank you. Goodbye.', label + ' English goodbye');
  }

  if (!checkInbox) {
    return { callSid, lang, expectedCategory };
  }

  const secret = process.env.MG_SESSION_SECRET;
  if (!secret) {
    console.log('\nSkip /api/calls check (set MG_SESSION_SECRET in .env to test the inbox API).');
    return { callSid, lang, expectedCategory };
  }

  const token = createAdminSessionToken('sim-admin');
  const cookie = COOKIE_NAME + '=' + encodeURIComponent(token);
  const listRes = await requestJson('GET', '/api/calls?listened=false', { cookie });
  const list = listRes.json;
  const found = Array.isArray(list) && list.find((c) => c.twilioCallSid === callSid);
  if (!found) {
    fail(label + ' API list did not include simulated call. Status ' + listRes.status);
    return { callSid, lang, expectedCategory };
  }
  if (found.language !== lang) {
    fail(label + ' language saved as ' + found.language + ' expected ' + lang);
  }
  if (found.category !== expectedCategory) {
    fail(label + ' category saved as ' + found.category + ' expected ' + expectedCategory);
  }
  if (record && !found.recordingSid) {
    fail(label + ' recordingSid missing');
  }
  if (record && !found.notificationProcessedAt) {
    fail(label + ' notificationProcessedAt missing after recording');
  }
  console.log(
    '\nInbox API found call',
    found._id,
    found.category,
    found.language,
    found.from
  );
  if (record) {
    console.log('notificationProcessedAt:', found.notificationProcessedAt || '(missing)');
  }

  if (record) {
    const patchRes = await requestJson('PATCH', '/api/calls/' + found._id, {
      cookie,
      json: {
        adminNotes: 'Simulated call — notes OK',
        callbackStatus: 'called_back',
      },
    });
    const patched = patchRes.json || {};
    console.log('PATCH', patchRes.status, patched.message || patched.error);
    if (patchRes.status < 200 || patchRes.status >= 300) fail(label + ' PATCH failed');

    const recip = await requestJson('GET', '/api/admin-users/notification-recipients', { cookie });
    console.log('Notification recipients', recip.status, JSON.stringify(recip.json));
    const unauth = await requestJson('GET', '/api/calls');
    console.log('Unauth /api/calls', unauth.status);
    if (unauth.status !== 401) fail('Unauth /api/calls should be 401');
  }

  return { callSid, lang, expectedCategory, found };
}

async function simulateLanguageRetry() {
  const callSid = fakeSid('CA');
  const from = '+13055550199';
  const to = process.env.TWILIO_PHONE_NUMBER || '+13055550000';
  const fields = { CallSid: callSid, From: from, To: to };
  console.log('\n=== language retry / default English ===');

  const voice = await postForm('/webhooks/twilio/voice', fields);
  expectLanguageMenu(voice.text, 'retry language /voice');

  const invalid = await postForm('/webhooks/twilio/voice/language', Object.assign({ Digits: '9' }, fields));
  expectLanguageMenu(invalid.text, 'retry language invalid');
  assertContains(invalid.text, 'retry=1', 'retry language redirects with retry=1');
  assertNotContains(invalid.text, MENU_PROMPT.en, 'invalid language does not skip to menu yet');

  const timeout = await postForm('/webhooks/twilio/voice/language?retry=1', fields);
  expectServiceMenu(timeout.text, 'en', 'language timeout defaults to English');
  assertNotContains(timeout.text, '<Hangup', 'language timeout does not hang up');

  const secret = process.env.MG_SESSION_SECRET;
  if (secret) {
    const token = createAdminSessionToken('sim-admin');
    const cookie = COOKIE_NAME + '=' + encodeURIComponent(token);
    const listRes = await requestJson('GET', '/api/calls', { cookie });
    const found = Array.isArray(listRes.json) && listRes.json.find((c) => c.twilioCallSid === callSid);
    if (!found) {
      fail('language retry call missing from inbox');
    } else if (found.language !== 'en') {
      fail('language retry defaulted to ' + found.language + ' expected en');
    } else {
      console.log('Language retry saved language=en');
    }
  }
}

async function simulateMenuRetry(langDigit) {
  const callSid = fakeSid('CA');
  const from = '+13055550199';
  const to = process.env.TWILIO_PHONE_NUMBER || '+13055550000';
  const lang = String(langDigit) === '2' ? 'es' : 'en';
  const fields = { CallSid: callSid, From: from, To: to };
  console.log('\n=== menu retry (' + lang + ') / voicemail as other ===');

  await postForm('/webhooks/twilio/voice', fields, { quiet: true });
  const language = await postForm(
    '/webhooks/twilio/voice/language',
    Object.assign({ Digits: String(langDigit) }, fields)
  );
  expectServiceMenu(language.text, lang, 'menu retry after language');

  const invalid = await postForm(
    '/webhooks/twilio/voice/menu?lang=' + lang,
    Object.assign({ Digits: '9' }, fields)
  );
  expectServiceMenu(invalid.text, lang, 'menu retry invalid');
  assertContains(invalid.text, 'retry=1', 'menu retry redirects with retry=1');
  assertNotContains(invalid.text, '<Record', 'invalid menu does not go to voicemail yet');

  const timeout = await postForm('/webhooks/twilio/voice/menu?lang=' + lang + '&retry=1', fields);
  expectVoicemail(timeout.text, lang, 'menu timeout voicemail');
  assertNotContains(timeout.text, MENU_PROMPT[lang], 'second failed menu goes to voicemail');

  const secret = process.env.MG_SESSION_SECRET;
  if (secret) {
    const token = createAdminSessionToken('sim-admin');
    const cookie = COOKIE_NAME + '=' + encodeURIComponent(token);
    const listRes = await requestJson('GET', '/api/calls', { cookie });
    const found = Array.isArray(listRes.json) && listRes.json.find((c) => c.twilioCallSid === callSid);
    if (!found) {
      fail('menu retry call missing from inbox');
    } else if (found.category !== 'other') {
      fail('menu retry category ' + found.category + ' expected other');
    } else if (found.language !== lang) {
      fail('menu retry language ' + found.language + ' expected ' + lang);
    } else {
      console.log('Menu retry saved category=other language=' + lang);
    }
  }
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--all' && a !== '--twiml');
  const runAll = process.argv.includes('--all');
  const twimlOnly = process.argv.includes('--twiml');

  if (runAll) {
    await simulateFlow({
      menuDigit: '2',
      langDigit: '1',
      record: !twimlOnly,
      label: 'English quote (full recording)',
    });
    await simulateFlow({
      menuDigit: '2',
      langDigit: '2',
      record: !twimlOnly,
      label: 'Spanish quote (full recording)',
    });
    for (const menuDigit of ['1', '2', '3']) {
      await simulateFlow({
        menuDigit,
        langDigit: '1',
        record: false,
        checkInbox: true,
        quiet: true,
        label: 'English menu ' + menuDigit,
      });
      await simulateFlow({
        menuDigit,
        langDigit: '2',
        record: false,
        checkInbox: true,
        quiet: true,
        label: 'Spanish menu ' + menuDigit,
      });
      console.log('Menu digit', menuDigit, 'OK in English and Spanish');
    }
    await simulateLanguageRetry();
    await simulateMenuRetry('1');
    await simulateMenuRetry('2');
  } else {
    const menuDigit = String(args[0] || '2').trim();
    const langDigit = String(args[1] || '1').trim();
    await simulateFlow({ menuDigit, langDigit, record: true, label: 'simulated inbound call' });
  }

  if (process.exitCode) {
    console.error('\nSimulation finished with failures.');
    process.exit(process.exitCode);
  }
  console.log('\nDone. Open Admin Dashboard → Calls & Voicemail (sign in first).');
  console.log('Recording playback will be unavailable until a real Twilio RecordingUrl exists.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
