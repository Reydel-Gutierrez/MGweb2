const express = require('express');
const mongoose = require('mongoose');
const https = require('https');
const http = require('http');

function httpsGetFollow(url, headers, redirectsLeft) {
  return new Promise((resolve, reject) => {
    const lib = String(url).startsWith('http://') ? http : https;
    lib
      .get(url, { headers }, (up) => {
        const code = up.statusCode || 0;
        if (code >= 300 && code < 400 && up.headers.location && redirectsLeft > 0) {
          up.resume();
          resolve(httpsGetFollow(up.headers.location, headers, redirectsLeft - 1));
          return;
        }
        resolve(up);
      })
      .on('error', reject);
  });
}
const { IncomingCall } = require('./models');
const { requireAdminApi } = require('./adminAuth');
const { CATEGORIES, CALLBACK_STATUSES } = require('./config');

const router = express.Router();

router.use(requireAdminApi);

function parseBool(v) {
  if (v === true || v === 'true' || v === '1') return true;
  if (v === false || v === 'false' || v === '0') return false;
  return null;
}

router.get('/', async (req, res) => {
  try {
    const q = {};
    const listened = parseBool(req.query.listened);
    if (listened !== null) q.listened = listened;
    if (req.query.category && CATEGORIES.includes(req.query.category)) {
      q.category = req.query.category;
    }
    if (req.query.callbackStatus && CALLBACK_STATUSES.includes(req.query.callbackStatus)) {
      q.callbackStatus = req.query.callbackStatus;
    }
    const calls = await IncomingCall.find(q).sort({ createdAt: -1 }).lean();
    res.json(calls);
  } catch (err) {
    console.error('GET /api/calls error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id/recording', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid call id' });
    }
    const call = await IncomingCall.findById(id).lean();
    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }
    if (!call.recordingUrl && !call.recordingSid) {
      return res.status(404).json({ error: 'No recording for this call' });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      return res.status(503).json({
        error: 'Recording playback is not configured (Twilio credentials missing).',
      });
    }

    let mediaUrl = String(call.recordingUrl || '').replace(/\.(json|xml)$/i, '');
    if (!mediaUrl && call.recordingSid) {
      mediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${call.recordingSid}`;
    }
    if (!/^https:\/\/api\.twilio\.com\//i.test(mediaUrl)) {
      return res.status(404).json({ error: 'Recording is not available (not a Twilio media URL).' });
    }
    if (!mediaUrl.endsWith('.mp3')) {
      mediaUrl = `${mediaUrl}.mp3`;
    }

    const auth = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const upstream = await httpsGetFollow(mediaUrl, { Authorization: auth }, 5);
    if (upstream.statusCode !== 200) {
      const code = upstream.statusCode === 404 ? 404 : 502;
      upstream.resume();
      return res.status(code).json({ error: 'Could not retrieve recording from Twilio.' });
    }

    const ctype = upstream.headers['content-type'] || 'audio/mpeg';
    res.setHeader('Content-Type', ctype);
    res.setHeader('Cache-Control', 'private, max-age=300');
    upstream.pipe(res);
  } catch (err) {
    console.error('GET /api/calls/:id/recording error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid call id' });
    }
    const call = await IncomingCall.findById(id).lean();
    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }
    res.json(call);
  } catch (err) {
    console.error('GET /api/calls/:id error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid call id' });
    }
    const body = req.body || {};
    const updates = {};

    if (body.listened !== undefined) {
      const listened = parseBool(body.listened);
      if (listened === null) {
        return res.status(400).json({ error: 'listened must be true or false' });
      }
      updates.listened = listened;
      if (listened) {
        updates.listenedAt = new Date();
        updates.listenedBy = (req.adminUser && req.adminUser.username) || '';
      } else {
        updates.listenedAt = null;
        updates.listenedBy = '';
      }
    }

    if (body.callbackStatus !== undefined) {
      if (!CALLBACK_STATUSES.includes(body.callbackStatus)) {
        return res.status(400).json({ error: 'Invalid callbackStatus' });
      }
      updates.callbackStatus = body.callbackStatus;
    }

    if (body.adminNotes !== undefined) {
      updates.adminNotes = String(body.adminNotes).slice(0, 8000);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update (listened, callbackStatus, adminNotes).',
      });
    }

    const updated = await IncomingCall.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
    if (!updated) {
      return res.status(404).json({ error: 'Call not found' });
    }
    res.json({ message: 'Updated', data: updated });
  } catch (err) {
    console.error('PATCH /api/calls/:id error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
