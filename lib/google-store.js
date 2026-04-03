const { getSupabaseConfig } = require('./google-config');

function getSupabaseHeaders(extra = {}) {
  const config = getSupabaseConfig();
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function fetchSharedState(select = '*') {
  const config = getSupabaseConfig();
  const url = `${config.url}/rest/v1/app_state?id=eq.${encodeURIComponent(config.workspace)}&select=${encodeURIComponent(select)}`;
  const response = await fetch(url, { headers: getSupabaseHeaders() });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || data?.error_description || 'Impossible de lire la base partagée');
  }
  return Array.isArray(data) ? data[0] || null : null;
}

async function upsertSharedState(patch) {
  const config = getSupabaseConfig();
  const payload = [{ id: config.workspace, ...patch, updated_at: new Date().toISOString() }];
  const response = await fetch(`${config.url}/rest/v1/app_state`, {
    method: 'POST',
    headers: getSupabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || data?.error_description || 'Impossible de mettre à jour la base partagée');
  }
  return Array.isArray(data) ? data[0] || null : data;
}

async function getGoogleState() {
  const row = await fetchSharedState('id,google_settings,google_oauth');
  return {
    settings: row?.google_settings && typeof row.google_settings === 'object' ? row.google_settings : {},
    oauth: row?.google_oauth && typeof row.google_oauth === 'object' ? row.google_oauth : {},
  };
}

async function saveGoogleState({ settings, oauth }) {
  const patch = {};
  if (settings) patch.google_settings = settings;
  if (oauth) patch.google_oauth = oauth;
  return upsertSharedState(patch);
}

module.exports = {
  fetchSharedState,
  getGoogleState,
  saveGoogleState,
  upsertSharedState,
};
