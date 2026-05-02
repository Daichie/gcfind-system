import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.SITE_URL || '';

function json(res, status, payload) {
  return res.status(status).json(payload);
}

async function requireSystemAdmin(req, admin) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Missing admin session token.');

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) throw new Error('Invalid admin session token.');

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id,email,role,full_name')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile || profile.role !== 'system_admin') {
    throw new Error('Only System Administrator accounts can use this action.');
  }

  return profile;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(res, 500, { error: 'Missing Vercel environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const actor = await requireSystemAdmin(req, admin);
    const { email } = req.body || {};
    if (!email) return json(res, 400, { error: 'Email is required.' });

    const normalizedEmail = String(email).trim().toLowerCase();
    const redirectTo = SITE_URL ? `${SITE_URL.replace(/\/$/, '')}/reset-password.html` : undefined;

    const { error } = await admin.auth.resetPasswordForEmail(
      normalizedEmail,
      redirectTo ? { redirectTo } : undefined
    );
    if (error) throw error;

    await admin.from('audit_logs').insert({
      actor_id: actor.id,
      action: 'Password Reset Sent by System Administrator',
      target_type: 'auth_user',
      target_id: null,
      details: normalizedEmail
    });

    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, 500, { error: err.message || 'Unable to send reset email.' });
  }
}
