import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    const { email, password, full_name, role, department } = req.body || {};

    if (!email || !password || !full_name || !role) {
      return json(res, 400, { error: 'Missing required fields.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { data, error } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name, role, department }
    });
    if (error) throw error;

    const userId = data.user?.id;
    if (userId) {
      const { error: profileError } = await admin.from('profiles').upsert({
        id: userId,
        full_name,
        email: normalizedEmail,
        role,
        department: department || 'General'
      });
      if (profileError) throw profileError;

      await admin.from('audit_logs').insert({
        actor_id: actor.id,
        action: 'Account Created by System Administrator',
        target_type: 'profile',
        target_id: userId,
        details: normalizedEmail
      });
    }

    return json(res, 200, { ok: true, user: data.user });
  } catch (err) {
    return json(res, 500, { error: err.message || 'Unable to create account.' });
  }
}
