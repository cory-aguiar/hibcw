import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatPhone } from '@/lib/plans'
import { useAuth } from '@/lib/AuthContext'
import {
  Save, User, Mail, Phone, Building2,
  Shield, CheckCircle, KeyRound, Eye, EyeOff, AlertCircle, Loader, UserPlus
} from 'lucide-react'

export default function ProfilePage() {
  const { profile: authProfile } = useAuth()

  // ── Profile form ───────────────────────────────────────────
  const [form, setForm] = useState({ first_name:'', last_name:'', phone:'', company_name:'' })
  const [email,      setEmail]     = useState('')
  const [userId,     setUserId]    = useState(null)
  const [ready,      setReady]     = useState(false)
  const [saving,     setSaving]    = useState(false)
  const [saved,      setSaved]     = useState(false)
  const [saveError,  setSaveError] = useState('')

  // ── Password form ──────────────────────────────────────────
  const [pwForm,   setPwForm]   = useState({ current:'', next:'', confirm:'' })
  const [showPw,   setShowPw]   = useState({ current:false, next:false, confirm:false })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSaved,  setPwSaved]  = useState(false)
  const [pwError,  setPwError]  = useState('')

  // ── Invite ─────────────────────────────────────────────────
  const [inviteEmail,  setInviteEmail]  = useState('')
  const [inviteName,   setInviteName]   = useState('')
  const [inviteRole,   setInviteRole]   = useState('super_admin')
  const [inviting,     setInviting]     = useState(false)
  const [inviteOk,     setInviteOk]     = useState(false)
  const [inviteError,  setInviteError]  = useState('')

  const [localRole, setLocalRole] = useState('')

  // ── Load ───────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) return
      setEmail(user.email || '')
      setUserId(user.id)
      const { data: prof } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone, company_name, role')
        .eq('id', user.id)
        .single()
      if (prof) {
        setForm({ first_name: prof.first_name||'', last_name: prof.last_name||'', phone: prof.phone||'', company_name: prof.company_name||'' })
        setLocalRole(prof.role || '')
      }
      setReady(true)
    }
    load()
  }, [])

  function setField(key, val) { setForm(f => ({ ...f, [key]: val })); setSaved(false); setSaveError('') }

  // ── Save profile ───────────────────────────────────────────
  async function handleSave() {
    if (!ready || !userId) { setSaveError('Profile not loaded yet — please wait and try again.'); return }
    setSaveError(''); setSaving(true)
    const full_name = [form.first_name.trim(), form.last_name.trim()].filter(Boolean).join(' ') || null
    const { error } = await supabase.from('profiles').update({
      first_name: form.first_name.trim()||null, last_name: form.last_name.trim()||null,
      full_name, phone: form.phone.trim()||null, company_name: form.company_name.trim()||null, email,
    }).eq('id', userId)
    setSaving(false)
    if (error) { setSaveError(`Save failed: ${error.message}`); return }
    setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  // ── Change password ────────────────────────────────────────
  async function handlePasswordChange() {
    setPwError('')
    const { current, next, confirm } = pwForm
    if (!current || !next || !confirm) { setPwError('Please fill in all password fields.'); return }
    if (next.length < 8)               { setPwError('New password must be at least 8 characters.'); return }
    if (next !== confirm)              { setPwError('New passwords do not match.'); return }
    setPwSaving(true)
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: current })
    if (signInErr) { setPwSaving(false); setPwError('Current password is incorrect.'); return }
    const { error: updateErr } = await supabase.auth.updateUser({ password: next })
    setPwSaving(false)
    if (updateErr) { setPwError(updateErr.message); return }
    setPwSaved(true); setPwForm({ current:'', next:'', confirm:'' })
    setTimeout(() => setPwSaved(false), 4000)
  }

  // ── Invite admin ───────────────────────────────────────────
  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteError(''); setInviteOk(false)
    try {
      // Pre-assign role so it's set on first sign-in
      const { error: prErr } = await supabase
        .from('pending_roles')
        .upsert({ email: inviteEmail.trim().toLowerCase(), role: inviteRole }, { onConflict: 'email' })
      if (prErr) throw new Error(`Could not pre-assign role: ${prErr.message}`)

      // Send invite via Supabase functions client
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('invite-admin', {
        body: { email: inviteEmail.trim(), fullName: inviteName.trim(), role: inviteRole, redirectTo: `${window.location.origin}/reset-password` },
      })
      if (fnErr) throw new Error(fnErr.message || 'Edge function error')
      if (fnData?.error) throw new Error(fnData.error)
      setInviteOk(true); setInviteEmail(''); setInviteName('')
      setTimeout(() => setInviteOk(false), 5000)
    } catch (err) {
      setInviteError(err.message)
    } finally {
      setInviting(false)
    }
  }

  // ── Helpers ────────────────────────────────────────────────
  const roleLabel = { super_admin:'Super Admin', staff:'Staff', hr_client:'HR Client' }
  const roleColor = { super_admin:'badge-red', staff:'badge-amber', hr_client:'badge-blue' }
  const initials  = [form.first_name[0], form.last_name[0]].filter(Boolean).join('').toUpperCase() || email[0]?.toUpperCase() || 'U'
  const displayName = [form.first_name, form.last_name].filter(Boolean).join(' ') || email
  function togglePw(field) { setShowPw(s => ({ ...s, [field]: !s[field] })) }

  if (!ready) return (
    <div className="p-8 flex items-center gap-3 text-surface-400">
      <Loader size={16} className="animate-spin" /> Loading profile…
    </div>
  )

  return (
    <div className="p-8 page-enter max-w-2xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-kiaa-700">My profile</h1>
        <p className="text-surface-400 text-sm mt-0.5">Update your name, contact details, and password</p>
      </div>

      {/* Avatar card */}
      <div className="card flex items-center gap-5 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-kiaa-600 flex items-center justify-center font-display font-semibold text-white text-xl flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold text-kiaa-700 text-lg leading-tight">{displayName || 'Your name'}</div>
          <div className="text-surface-400 text-sm mt-0.5 truncate">{email}</div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className={`badge ${roleColor[authProfile?.role] || 'badge-gray'} flex items-center gap-1`}>
              <Shield size={11} />{roleLabel[authProfile?.role] || authProfile?.role}
            </span>
            {form.company_name && <span className="badge badge-gray">{form.company_name}</span>}
          </div>
        </div>
      </div>

      {/* ── Personal information ── */}
      <div className="card mb-5">
        <h2 className="section-title">Personal information</h2>
        {saveError && (
          <div className="flex items-start gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg mb-4">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /><span>{saveError}</span>
          </div>
        )}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First name</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input className="input pl-9" value={form.first_name} onChange={e => setField('first_name', e.target.value)} placeholder="Jane" />
              </div>
            </div>
            <div>
              <label className="label">Last name</label>
              <input className="input" value={form.last_name} onChange={e => setField('last_name', e.target.value)} placeholder="Doe" />
            </div>
          </div>
          <div>
            <label className="label">Email address</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input className="input pl-9 bg-surface-100 cursor-default" value={email} readOnly tabIndex={-1} />
            </div>
            <p className="text-xs text-surface-400 mt-1">Contact your KIAA administrator to change your email address.</p>
          </div>
          <div>
            <label className="label">Phone number</label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input className="input pl-9" type="tel" value={form.phone} onChange={e => setField('phone', formatPhone(e.target.value))} placeholder="(808) 555-0100" />
            </div>
          </div>
          <div>
            <label className="label">{authProfile?.role === 'hr_client' ? 'Your company' : 'Organization / company'}</label>
            <div className="relative">
              <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input className="input pl-9" value={form.company_name} onChange={e => setField('company_name', e.target.value)}
                placeholder={authProfile?.role === 'hr_client' ? 'Your company name' : 'Kanoelehua Industrial Area Association'} />
            </div>
          </div>
          <div className="border-t border-surface-100 pt-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-surface-400 text-xs mb-0.5">Role</div>
                <div className="text-surface-700 font-medium">{roleLabel[authProfile?.role] || authProfile?.role}</div>
              </div>
              <div>
                <div className="text-surface-400 text-xs mb-0.5">Member since</div>
                <div className="text-surface-700">
                  {authProfile?.created_at ? new Date(authProfile.created_at).toLocaleDateString('en-US', { month:'long', year:'numeric' }) : '—'}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !ready}>
              {saving ? <><Loader size={14} className="animate-spin" /> Saving…</> : saved ? <><CheckCircle size={14} /> Saved</> : <><Save size={14} /> Save changes</>}
            </button>
            {saved && <span className="text-sm text-kiaa-500 flex items-center gap-1.5"><CheckCircle size={13} /> Profile updated</span>}
          </div>
        </div>
      </div>

      {/* ── Change password ── */}
      <div className="card mb-5">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound size={16} className="text-kiaa-600" />
          <h2 className="section-title mb-0">Change password</h2>
        </div>
        {pwError && (
          <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg mb-4">
            <AlertCircle size={14} className="flex-shrink-0" />{pwError}
          </div>
        )}
        {pwSaved && (
          <div className="flex items-center gap-2 bg-kiaa-50 text-kiaa-700 text-sm px-3 py-2.5 rounded-lg mb-4">
            <CheckCircle size={14} className="flex-shrink-0" /> Password changed successfully.
          </div>
        )}
        <div className="space-y-4">
          {[
            { key:'current', label:'Current password',     placeholder:'Enter your current password', autoComplete:'current-password' },
            { key:'next',    label:'New password',          placeholder:'At least 8 characters',       autoComplete:'new-password' },
            { key:'confirm', label:'Confirm new password',  placeholder:'Re-enter new password',       autoComplete:'new-password' },
          ].map(({ key, label, placeholder, autoComplete }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <div className="relative">
                <input
                  className={`input pr-10 ${key === 'confirm' && pwForm.confirm && pwForm.next !== pwForm.confirm ? 'border-red-300 focus:border-red-400' : ''}`}
                  type={showPw[key] ? 'text' : 'password'}
                  value={pwForm[key]}
                  onChange={e => { setPwForm(f => ({ ...f, [key]: e.target.value })); setPwError('') }}
                  placeholder={placeholder} autoComplete={autoComplete}
                />
                <button type="button" onClick={() => togglePw(key)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
                  {showPw[key] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {key === 'next' && pwForm.next && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="h-1 flex-1 rounded-full transition-colors"
                        style={{ background: i <= passwordStrength(pwForm.next)
                          ? ['','#ef4444','#f97316','#eab308','#22c55e'][passwordStrength(pwForm.next)]
                          : 'var(--color-border-tertiary)' }} />
                    ))}
                  </div>
                  <span className="text-xs text-surface-400">{['','Weak','Fair','Good','Strong'][passwordStrength(pwForm.next)]}</span>
                </div>
              )}
              {key === 'confirm' && pwForm.confirm && pwForm.next !== pwForm.confirm && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>
          ))}
          <button className="btn btn-primary" onClick={handlePasswordChange} disabled={pwSaving}>
            <KeyRound size={14} />
            {pwSaving ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </div>

      {/* ── Invite team member — super_admin only ── */}
      {(authProfile?.role === 'super_admin' || localRole === 'super_admin') && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={16} className="text-kiaa-600" />
            <h2 className="section-title mb-0">Invite a team member</h2>
          </div>
          <p className="text-surface-400 text-sm mb-4">
            Send an invite email to a new KIAA staff member. They'll receive a link to set their password and will be assigned the selected role on first sign-in.
          </p>
          {inviteOk && (
            <div className="flex items-center gap-2 bg-kiaa-50 text-kiaa-700 text-sm px-3 py-2.5 rounded-lg mb-4">
              <CheckCircle size={14} className="flex-shrink-0" /> Invite sent successfully.
            </div>
          )}
          {inviteError && (
            <div className="flex items-start gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg mb-4">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">{inviteError}</div>
                <div className="text-xs mt-1 text-red-500">
                  You can also invite manually: Supabase → Authentication → Users → Invite user, then run:
                  <code className="block mt-1 bg-red-100 px-2 py-1 rounded font-mono text-xs break-all">
                    {`INSERT INTO pending_roles (email, role) VALUES ('${inviteEmail}', '${inviteRole}') ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role;`}
                  </code>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Full name</label>
                <input className="input" value={inviteName} placeholder="Jane Doe"
                  onChange={e => { setInviteName(e.target.value); setInviteError('') }} />
              </div>
              <div>
                <label className="label">Email address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input className="input pl-9" type="email" value={inviteEmail} placeholder="jane@kiaahilo.org"
                    onChange={e => { setInviteEmail(e.target.value); setInviteError('') }} />
                </div>
              </div>
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                <option value="super_admin">Super Admin — full access</option>
                <option value="staff">Staff — view & edit, no admin tools</option>
              </select>
            </div>
            <button className="btn btn-primary flex items-center gap-2" onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? <><Loader size={14} className="animate-spin" /> Sending invite…</> : <><UserPlus size={14} /> Send invite</>}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

function passwordStrength(pw) {
  let score = 0
  if (pw.length >= 8)  score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++
  return Math.min(score, 4)
}
