const crypto = require('crypto');
const { getGoogleConfig } = require('./google-config');
const { getGoogleState, saveGoogleState } = require('./google-store');

function requireGoogleConfig() {
  const config = getGoogleConfig();
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error('Configuration Google manquante sur le serveur.');
  }
  return config;
}

function buildGoogleAuthUrl(state) {
  const config = requireGoogleConfig();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('scope', [
    'https://www.googleapis.com/auth/calendar',
    'openid',
    'email',
  ].join(' '));
  url.searchParams.set('state', state);
  return url.toString();
}

async function exchangeCodeForTokens(code) {
  const config = requireGoogleConfig();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error_description || data?.error || 'Échec de connexion Google');
  return data;
}

async function refreshAccessToken(refreshToken) {
  const config = requireGoogleConfig();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error_description || data?.error || 'Impossible de rafraîchir Google');
  return data;
}

async function fetchGoogleIdentity(accessToken) {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error_description || 'Impossible de lire le compte Google');
  return data;
}

async function getValidGoogleAccessToken() {
  const { oauth, settings } = await getGoogleState();
  if (!oauth.refreshToken) throw new Error('Google Agenda n’est pas encore connecté.');

  const now = Date.now();
  if (oauth.accessToken && oauth.expiresAt && now < oauth.expiresAt - 60000) {
    return { accessToken: oauth.accessToken, settings, oauth };
  }

  const refreshed = await refreshAccessToken(oauth.refreshToken);
  const nextOauth = {
    ...oauth,
    accessToken: refreshed.access_token,
    tokenType: refreshed.token_type || oauth.tokenType || 'Bearer',
    expiresAt: Date.now() + ((refreshed.expires_in || 3600) * 1000),
    scope: refreshed.scope || oauth.scope || '',
  };
  await saveGoogleState({ oauth: nextOauth });
  return { accessToken: nextOauth.accessToken, settings, oauth: nextOauth };
}

function extractMeetLink(event) {
  const entryPoints = event?.conferenceData?.entryPoints || [];
  return entryPoints.find(entry => entry.entryPointType === 'video')?.uri || '';
}

async function waitForConference(accessToken, calendarId, eventId) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const event = await response.json().catch(() => ({}));
    if (response.ok && extractMeetLink(event)) return event;
    await new Promise(resolve => setTimeout(resolve, 700));
  }
  return null;
}

async function createGoogleCalendarEvent(payload) {
  const config = requireGoogleConfig();
  const { accessToken, settings } = await getValidGoogleAccessToken();
  const calendarId = settings.calendarId || config.calendarId;
  const attendees = payload.attendeeEmail ? [{ email: payload.attendeeEmail, displayName: payload.attendeeName || undefined }] : [];
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=${attendees.length ? 'all' : 'none'}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      summary: payload.summary,
      description: payload.description || '',
      start: {
        dateTime: payload.startDateTime,
        timeZone: payload.timeZone || 'Europe/Paris',
      },
      end: {
        dateTime: payload.endDateTime,
        timeZone: payload.timeZone || 'Europe/Paris',
      },
      attendees,
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    }),
  });
  const event = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(event?.error?.message || 'Impossible de créer le rendez-vous Google');
  const fullEvent = extractMeetLink(event) ? event : (await waitForConference(accessToken, calendarId, event.id)) || event;
  return {
    eventId: fullEvent.id,
    htmlLink: fullEvent.htmlLink || '',
    meetLink: extractMeetLink(fullEvent),
    startDateTime: fullEvent.start?.dateTime || payload.startDateTime,
    endDateTime: fullEvent.end?.dateTime || payload.endDateTime,
  };
}

async function connectGoogleAccountFromCode(code) {
  const tokenData = await exchangeCodeForTokens(code);
  const existing = await getGoogleState();
  const accessToken = tokenData.access_token;
  const identity = await fetchGoogleIdentity(accessToken);
  const config = requireGoogleConfig();
  const oauth = {
    refreshToken: tokenData.refresh_token || existing.oauth.refreshToken || '',
    accessToken,
    tokenType: tokenData.token_type || 'Bearer',
    expiresAt: Date.now() + ((tokenData.expires_in || 3600) * 1000),
    scope: tokenData.scope || '',
  };
  if (!oauth.refreshToken) {
    throw new Error('Google n’a pas renvoyé de refresh token. Reconnecte le compte avec consentement complet.');
  }
  const settings = {
    connected: true,
    connectedEmail: identity.email || '',
    calendarId: config.calendarId,
    connectedAt: new Date().toISOString(),
  };
  await saveGoogleState({ oauth, settings });
  return settings;
}

module.exports = {
  buildGoogleAuthUrl,
  connectGoogleAccountFromCode,
  createGoogleCalendarEvent,
  getGoogleState,
};
