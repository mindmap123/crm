const { connectGoogleAccountFromCode } = require('../../../lib/google-calendar');
const { buildCookie, getRequestUrl, parseCookies, sendHtml } = require('../../../lib/http');

function renderResult({ ok, message, email }) {
  return `<!doctype html>
  <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Connexion Google</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; background: #f6f6f8; color: #161618; display:flex; min-height:100vh; align-items:center; justify-content:center; padding:24px; }
        .card { background:white; border-radius:22px; padding:28px; max-width:420px; box-shadow:0 24px 80px rgba(0,0,0,.12); text-align:center; }
        h1 { font-size:22px; margin:0 0 10px; }
        p { margin:0; color:#6b6b72; line-height:1.6; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>${ok ? 'Google connecté' : 'Connexion Google échouée'}</h1>
        <p>${message}${email ? `<br><strong>${email}</strong>` : ''}</p>
      </div>
      <script>
        if (window.opener) {
          window.opener.postMessage(${JSON.stringify({ source: 'atelier-google-oauth', ok, message, email })}, window.location.origin);
          setTimeout(() => window.close(), 400);
        }
      </script>
    </body>
  </html>`;
}

module.exports = async function handler(req, res) {
  const secure = !(req.headers.host || '').startsWith('127.0.0.1');
  res.setHeader('Set-Cookie', buildCookie('google_oauth_state', '', { maxAge: 1, secure }));
  try {
    const url = getRequestUrl(req);
    const cookies = parseCookies(req);
    const state = url.searchParams.get('state') || '';
    const code = url.searchParams.get('code') || '';
    if (!code || !state || !cookies.google_oauth_state || cookies.google_oauth_state !== state) {
      sendHtml(res, 400, renderResult({ ok: false, message: 'État OAuth invalide. Relance la connexion Google.' }));
      return;
    }
    const settings = await connectGoogleAccountFromCode(code);
    sendHtml(res, 200, renderResult({ ok: true, message: 'Le calendrier partagé est prêt.', email: settings.connectedEmail }));
  } catch (error) {
    sendHtml(res, 500, renderResult({ ok: false, message: error.message || 'Erreur de connexion Google.' }));
  }
};
