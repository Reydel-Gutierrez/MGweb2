const mongoose = require('mongoose');

function isOid(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

function fail(res, status, message) {
  return res.status(status).json({ error: message, message });
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user._id || user.id,
    fullName: user.fullName || '',
    username: user.username || '',
  };
}

module.exports = {
  isOid,
  fail,
  publicUser,
};
