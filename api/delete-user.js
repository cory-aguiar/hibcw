/**
 * api/delete-user.js — Vercel serverless function
 * Permanently deletes a user's auth account using the Supabase service
 * role key. profiles.id references auth.users with ON DELETE CASCADE,
 * so their profile row is removed automatically — no separate delete
 * needed. This is NOT reversible; use /api/revoke-access for a
 * reversible block instead.
 *
 * POST /api/delete-user
 * Body: { userId }
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
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' })
    }

    const { error } = await admin.auth.admin.deleteUser(userId)

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Request failed' })
  }
}
