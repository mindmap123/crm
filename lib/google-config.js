const DEFAULT_SUPABASE_URL = 'https://colamwrmztblrsoioers.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvbGFtd3JtenRibHJzb2lvZXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MjE3NTgsImV4cCI6MjA5MDM5Nzc1OH0.2ozswhNiEbjzTMEDVu9zNwfy8pXJ5gzzWjclq0LDbGg';
const DEFAULT_WORKSPACE = 'atelier-crm';

function getGoogleConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
  };
}

function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY,
    workspace: process.env.SUPABASE_WORKSPACE || DEFAULT_WORKSPACE,
  };
}

module.exports = {
  DEFAULT_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_URL,
  DEFAULT_WORKSPACE,
  getGoogleConfig,
  getSupabaseConfig,
};
