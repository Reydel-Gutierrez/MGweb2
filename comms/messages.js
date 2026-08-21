const express = require('express');
const twilio = require('twilio');
const { validateTwilioRequest } = require('./twilioValidate');

const router = express.Router();
const MessagingResponse = twilio.twiml.MessagingResponse;

/** Future SMS inbox. V1 does not send replies or persist messages. */
router.post('/sms', validateTwilioRequest, (req, res) => {
  const twiml = new MessagingResponse();
  res.type('text/xml').send(twiml.toString());
});

module.exports = router;
