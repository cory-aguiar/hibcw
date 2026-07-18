/**
 * api/register.js — Vercel serverless function
 * Creates a new HR user account using the Supabase service role key.
 * POST /api/register
 * Body: { email, password, firstName, lastName, phone, companyId }
 */

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl     = process.env.VITE_SUPABASE_URL
  const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase configuration missing' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    const { email, password, firstName, lastName, phone, companyId } = req.body

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Create the auth user
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email:             email.trim(),
      password,
      email_confirm:     true,
    })

    if (authError) {
      if (authError.message?.includes('already registered')) {
        return res.status(400).json({ error: 'An account with this email already exists.' })
      }
      return res.status(400).json({ error: authError.message })
    }

    const userId = authData.user.id

    // Create the profile
    const { error: profileError } = await admin.from('profiles').upsert({
      id:         userId,
      email:      email.trim(),
      first_name: firstName.trim(),
      last_name:  lastName.trim(),
      phone:      phone?.trim() || null,
      company_id: companyId || null,
      role:       'hr_client',
    })

    if (profileError) {
      // Clean up auth user if profile creation fails
      await admin.auth.admin.deleteUser(userId)
      return res.status(500).json({ error: 'Failed to create profile. Please try again.' })
    }

    return res.status(200).json({ ok: true, userId })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Registration failed' })
  }
}
