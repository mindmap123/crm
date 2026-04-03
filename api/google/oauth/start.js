const crypto = require('crypto');
const { buildGoogleAuthUrl } = require('../../../lib/google-calendar');
const { buildCookie, redirect } = require('../../../lib/http');

module.exports = async function handler(req, res) {
  const state = crypto.randomBytes(16).toString('hex');
  const secure = !(req.headers.host || '').startsWith('127.0.0.1');
  res.setHeader('Set-Cookie', buildCookie('google_oauth_state', state, { maxAge: 900, secure }));
  redirect(res, buildGoogleAuthUrl(state));
};
