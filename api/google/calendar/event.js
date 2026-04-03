const { createGoogleCalendarEvent } = require('../../../lib/google-calendar');
const { readJsonBody, sendJson } = require('../../../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    if (!body.summary || !body.startDateTime || !body.endDateTime) {
      sendJson(res, 400, { error: 'Résumé ou date/heure manquants.' });
      return;
    }
    const event = await createGoogleCalendarEvent(body);
    sendJson(res, 200, event);
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Erreur Google Calendar' });
  }
};
