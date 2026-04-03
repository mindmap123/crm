const { sendGoogleInvitationEmail } = require('../../../lib/google-calendar');
const { readJsonBody, sendJson } = require('../../../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    if (!body.to || !body.startDateTime) {
      sendJson(res, 400, { error: 'Email destinataire ou date manquants.' });
      return;
    }
    const result = await sendGoogleInvitationEmail(body);
    sendJson(res, 200, { id: result.id || '', threadId: result.threadId || '' });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Erreur Gmail' });
  }
};
