const express = require('express');
const twilio = require('twilio');
const { IncomingCall } = require('./models');
const { validateTwilioRequest } = require('./twilioValidate');
const {
  notifyAfterRecording,
  isCompletedVoicemailCallback,
} = require('./notificationService');
const {
  TTS,
  COMPANY_NAME,
  LANGUAGE_PROMPT_EN,
  LANGUAGE_PROMPT_ES,
  MENU_PROMPT,
  VOICEMAIL_PROMPT,
  NO_MESSAGE_PROMPT,
  GOODBYE_PROMPT,
  SORRY_PROMPT,
  DIGIT_LANGUAGE,
  DIGIT_CATEGORY,
  RECORD_MAX_SECONDS,
  absoluteUrl,
  normalizeLang,
} = require('./config');

const router = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

function twimlSend(res, twiml) {
  res.type('text/xml').send(twiml.toString());
}

function say(node, lang, text) {
  if (normalizeLang(lang) === 'es') {
    saySpanishKeepingCompanyEnglish(node, text);
    return;
  }
  node.say(TTS.en, text);
}

function saySpanishKeepingCompanyEnglish(node, text) {
  const chunks = String(text || '').split(COMPANY_NAME);
  if (chunks.length === 1) {
    node.say(TTS.es, text);
    return;
  }
  chunks.forEach((raw, i) => {
    const piece = String(raw || '')
      .replace(/^\s*[.,;:]\s*/, '')
      .trim();
    if (piece) node.say(TTS.es, piece);
    if (i < chunks.length - 1) {
      node.say(TTS.en, COMPANY_NAME);
    }
  });
}

function categoryFromDigits(digits) {
  const key = String(digits || '').trim();
  return DIGIT_CATEGORY[key] || null;
}

function languageFromDigits(digits) {
  const key = String(digits || '').trim();
  return DIGIT_LANGUAGE[key] || null;
}

async function upsertCall(body) {
  const sid = String(body.CallSid || '').trim();
  if (!sid) return null;
  const from = String(body.From || body.Caller || '').trim();
  const to = String(body.To || body.Called || '').trim();
  const set = {};
  if (from) set.from = from;
  if (to) set.to = to;
  const update = {
    $setOnInsert: {
      twilioCallSid: sid,
      category: 'unknown',
      callStatus: 'in_progress',
      callbackStatus: 'new',
      listened: false,
      language: 'en',
    },
  };
  if (Object.keys(set).length) update.$set = set;
  return IncomingCall.findOneAndUpdate(
    { twilioCallSid: sid },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function setCallFields(sid, fields) {
  if (!sid || !fields || !Object.keys(fields).length) return null;
  return IncomingCall.findOneAndUpdate({ twilioCallSid: sid }, { $set: fields }, { new: true });
}

async function langForCall(req) {
  const q = String(req.query.lang || '').toLowerCase();
  if (q === 'en' || q === 'es') return q;
  const sid = String((req.body && req.body.CallSid) || '').trim();
  if (!sid) return 'en';
  const call = await IncomingCall.findOne({ twilioCallSid: sid }).select('language').lean();
  return normalizeLang(call && call.language);
}

function gatherLanguage(twiml, retry) {
  const action = retry
    ? '/webhooks/twilio/voice/language?retry=1'
    : '/webhooks/twilio/voice/language';
  const gather = twiml.gather({
    numDigits: 1,
    timeout: 8,
    action,
    method: 'POST',
  });
  say(gather, 'en', LANGUAGE_PROMPT_EN);
  say(gather, 'es', LANGUAGE_PROMPT_ES);
}

function gatherMenu(twiml, lang, retry) {
  const safe = normalizeLang(lang);
  const action = retry
    ? `/webhooks/twilio/voice/menu?lang=${safe}&retry=1`
    : `/webhooks/twilio/voice/menu?lang=${safe}`;
  const gather = twiml.gather({
    numDigits: 1,
    timeout: 8,
    action,
    method: 'POST',
  });
  say(gather, safe, MENU_PROMPT[safe]);
}

function addVoicemail(twiml, lang) {
  const safe = normalizeLang(lang);
  say(twiml, safe, VOICEMAIL_PROMPT[safe]);
  twiml.record({
    maxLength: RECORD_MAX_SECONDS,
    playBeep: true,
    timeout: 6,
    finishOnKey: '#',
    action: '/webhooks/twilio/voice/status',
    method: 'POST',
    recordingStatusCallback: absoluteUrl('/webhooks/twilio/voice/recording'),
    recordingStatusCallbackMethod: 'POST',
    recordingStatusCallbackEvent: ['completed'],
  });
  say(twiml, safe, NO_MESSAGE_PROMPT[safe]);
  twiml.hangup();
}

function addServiceMenu(twiml, lang) {
  gatherMenu(twiml, lang, false);
  twiml.redirect(
    { method: 'POST' },
    `/webhooks/twilio/voice/menu?lang=${normalizeLang(lang)}&retry=1`
  );
}

router.post('/voice', validateTwilioRequest, async (req, res) => {
  try {
    await upsertCall(req.body || {});
    const twiml = new VoiceResponse();
    gatherLanguage(twiml, false);
    twiml.redirect({ method: 'POST' }, '/webhooks/twilio/voice/language?retry=1');
    twimlSend(res, twiml);
  } catch (err) {
    console.error('Twilio /voice error:', err);
    const twiml = new VoiceResponse();
    say(twiml, 'en', SORRY_PROMPT.en);
    twiml.hangup();
    twimlSend(res, twiml);
  }
});

router.post('/voice/language', validateTwilioRequest, async (req, res) => {
  try {
    const body = req.body || {};
    const retry = String(req.query.retry || '') === '1';
    await upsertCall(body);

    const mapped = languageFromDigits(body.Digits);
    const twiml = new VoiceResponse();
    const sid = String(body.CallSid || '').trim();

    if (mapped) {
      await setCallFields(sid, { language: mapped });
      addServiceMenu(twiml, mapped);
      return twimlSend(res, twiml);
    }

    if (!retry) {
      gatherLanguage(twiml, true);
      twiml.redirect({ method: 'POST' }, '/webhooks/twilio/voice/language?retry=1');
      return twimlSend(res, twiml);
    }

    await setCallFields(sid, { language: 'en' });
    addServiceMenu(twiml, 'en');
    twimlSend(res, twiml);
  } catch (err) {
    console.error('Twilio /voice/language error:', err);
    const twiml = new VoiceResponse();
    say(twiml, 'en', SORRY_PROMPT.en);
    twiml.hangup();
    twimlSend(res, twiml);
  }
});

router.post('/voice/menu', validateTwilioRequest, async (req, res) => {
  try {
    const body = req.body || {};
    const retry = String(req.query.retry || '') === '1';
    await upsertCall(body);
    const lang = await langForCall(req);

    const mapped = categoryFromDigits(body.Digits);
    const twiml = new VoiceResponse();
    const sid = String(body.CallSid || '').trim();

    if (mapped) {
      await setCallFields(sid, {
        digits: String(body.Digits).trim(),
        category: mapped,
        language: lang,
      });
      addVoicemail(twiml, lang);
      return twimlSend(res, twiml);
    }

    if (!retry) {
      gatherMenu(twiml, lang, true);
      twiml.redirect(
        { method: 'POST' },
        `/webhooks/twilio/voice/menu?lang=${lang}&retry=1`
      );
      return twimlSend(res, twiml);
    }

    await setCallFields(sid, {
      digits: String(body.Digits || '').trim(),
      category: 'other',
      language: lang,
    });
    addVoicemail(twiml, lang);
    twimlSend(res, twiml);
  } catch (err) {
    console.error('Twilio /voice/menu error:', err);
    const twiml = new VoiceResponse();
    say(twiml, 'en', SORRY_PROMPT.en);
    twiml.hangup();
    twimlSend(res, twiml);
  }
});

router.post('/voice/recording', validateTwilioRequest, async (req, res) => {
  try {
    const body = req.body || {};
    const sid = String(body.CallSid || '').trim();
    const recordingSid = String(body.RecordingSid || '').trim();
    const recordingUrl = String(body.RecordingUrl || '').trim();
    const duration = Number(body.RecordingDuration);
    const recStatus = String(body.RecordingStatus || '').toLowerCase();
    const idempotency = req.get('I-Twilio-Idempotency-Token') || '';

    let updated = null;
    if (sid) {
      const set = {};
      if (recordingSid) set.recordingSid = recordingSid;
      if (recordingUrl) set.recordingUrl = recordingUrl;
      if (!Number.isNaN(duration) && duration >= 0) set.recordingDuration = duration;
      if (recStatus === 'completed' || recordingSid) {
        set.callStatus = duration === 0 ? 'no_message' : 'completed';
      } else if (recStatus === 'failed' || recStatus === 'absent') {
        set.callStatus = 'failed';
      }
      if (Object.keys(set).length) {
        updated = await IncomingCall.findOneAndUpdate({ twilioCallSid: sid }, { $set: set }, { new: true });
      }
    }

    const shouldNotify = Boolean(updated && isCompletedVoicemailCallback(body));
    console.log(
      '[ivr] /voice/recording',
      JSON.stringify({
        CallSid: sid,
        RecordingSid: recordingSid,
        RecordingStatus: recStatus || '(none)',
        RecordingDuration: Number.isNaN(duration) ? null : duration,
        IncomingCallId: updated ? String(updated._id) : null,
        idempotency,
        shouldNotify,
      })
    );

    res.status(204).end();
    if (shouldNotify) {
      notifyAfterRecording(updated).catch((err) => {
        console.error('Call notification failed:', err && err.message ? err.message : err);
      });
    }
  } catch (err) {
    console.error('Twilio /voice/recording error:', err);
    res.status(204).end();
  }
});

router.post('/voice/status', validateTwilioRequest, async (req, res) => {
  try {
    const body = req.body || {};
    const sid = String(body.CallSid || '').trim();
    const twilioStatus = String(body.CallStatus || body.DialCallStatus || '').toLowerCase();
    let lang = 'en';

    console.log(
      '[ivr] /voice/status',
      JSON.stringify({
        CallSid: sid,
        CallStatus: twilioStatus || '(none)',
        RecordingSid: String(body.RecordingSid || '').trim() || null,
        RecordingStatus: String(body.RecordingStatus || '').trim() || null,
        RecordingDuration: body.RecordingDuration == null || body.RecordingDuration === '' ? null : Number(body.RecordingDuration),
      })
    );

    if (sid) {
      const existing = await IncomingCall.findOne({ twilioCallSid: sid });
      if (existing && existing.language) lang = normalizeLang(existing.language);
      const set = {};
      if (twilioStatus === 'failed' || twilioStatus === 'busy' || twilioStatus === 'no-answer') {
        set.callStatus = 'failed';
      } else if (!existing || existing.callStatus === 'in_progress') {
        if (existing && existing.recordingSid) {
          set.callStatus = existing.recordingDuration === 0 ? 'no_message' : 'completed';
        } else if (twilioStatus === 'completed') {
          set.callStatus = 'no_message';
        }
      }
      if (body.From || body.To) {
        if (body.From) set.from = String(body.From);
        if (body.To) set.to = String(body.To);
      }
      if (Object.keys(set).length) {
        await IncomingCall.findOneAndUpdate({ twilioCallSid: sid }, { $set: set });
      }
    }

    const twiml = new VoiceResponse();
    say(twiml, lang, GOODBYE_PROMPT[lang]);
    twiml.hangup();
    twimlSend(res, twiml);
  } catch (err) {
    console.error('Twilio /voice/status error:', err);
    const twiml = new VoiceResponse();
    twiml.hangup();
    twimlSend(res, twiml);
  }
});

module.exports = router;
