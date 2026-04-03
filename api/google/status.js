const { getGoogleState } = require('../../lib/google-store');
const { sendJson } = require('../../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const { settings } = await getGoogleState();
    sendJson(res, 200, {
      connected: Boolean(settings.connected),
      connectedEmail: settings.connectedEmail || '',
      calendarId: settings.calendarId || 'primary',
      connectedAt: settings.connectedAt || '',
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Erreur Google' });
  }
};
