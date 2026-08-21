const twilio = require('twilio');
const { envFlag, publicBaseUrl } = require('./config');

function validateTwilioRequest(req, res, next) {
  if (!envFlag('TWILIO_VALIDATE_SIGNATURE', false)) {
    return next();
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.get('X-Twilio-Signature') || '';
  const base = publicBaseUrl();

  if (!authToken) {
    console.error('TWILIO_VALIDATE_SIGNATURE is true but TWILIO_AUTH_TOKEN is missing');
    return res.status(500).type('text/plain').send('Twilio validation is misconfigured');
  }
  if (!base) {
    console.error('TWILIO_VALIDATE_SIGNATURE is true but PUBLIC_BASE_URL is missing');
    return res.status(500).type('text/plain').send('Twilio validation is misconfigured');
  }

  const url = `${base}${req.originalUrl}`;
  const params = req.body && typeof req.body === 'object' ? req.body : {};
  const ok = twilio.validateRequest(authToken, signature, url, params);

  if (!ok) {
    console.warn('Rejected Twilio webhook: invalid signature', req.path);
    return res.status(403).type('text/plain').send('Forbidden');
  }
  return next();
}

module.exports = { validateTwilioRequest };
