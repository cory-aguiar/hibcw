/**
 * api/revoke-access.js — Vercel serverless function
 * Bans (or unbans) an HR user's login using the Supabase service role key.
 * This blocks sign-in at the auth level without deleting their account,
 * profile, or any data — fully reversible.
 *
 * POST /api/revoke-access
 * Body: { userId, action }   action: 'revoke' | 'restore'
 */

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl    = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase configuration missing' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    const { userId, action } = req.body

    if (!userId || !['revoke', 'restore'].includes(action)) {
      return res.status(400).json({ error: 'Missing or invalid userId/action' })
    }

    const isRevoke = action === 'revoke'

    // ban_duration accepts a duration string; '876000h' (100 years) is
    // Supabase's documented pattern for an effectively permanent ban.
    // 'none' clears any existing ban.
    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: isRevoke ? '876000h' : 'none',
    })

    if (authError) {
      return res.status(400).json({ error: authError.message })
    }

    const { error: profileError } = await admin
      .from('profiles')
      .update({ access_revoked: isRevoke })
      .eq('id', userId)

    if (profileError) {
      return res.status(500).json({ error: 'Auth updated but failed to sync profile flag: ' + profileError.message })
    }

    return res.status(200).json({ ok: true, access_revoked: isRevoke })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Request failed' })
  }
}
