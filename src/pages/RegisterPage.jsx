import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { formatPhone } from '@/lib/plans'
import { CheckCircle, AlertCircle, Eye, EyeOff, Loader } from 'lucide-react'

const STEPS = ['verify', 'account', 'done']

export default function RegisterPage() {
  const [step,      setStep]      = useState('verify')  // verify → account → done
  const [code,      setCode]      = useState('')
  const [company,   setCompany]   = useState(null)
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [phone,     setPhone]     = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const navigate = useNavigate()

  // ── Step 1: Verify company code ───────────────────────────
  async function handleVerify(e) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true); setError('')

    // First check companies table (existing members)
    const { data, error: err } = await supabase
      .from('companies')
      .select('id, name, status, band, group_type, contact_name, contact_email, contact_phone')
      .eq('company_code', code.trim())
      .single()

    // If not found in companies, check prospects (accepted but not yet converted)
    if (err || !data) {
      const { data: prospect } = await supabase
        .from('prospects')
        .select('id, company_name, prospect_name, contact_name, contact_email, contact_phone, status, company_code')
        .eq('company_code', code.trim())
        .in('status', ['accepted', 'approved', 'submitted'])
        .maybeSingle()

      setLoading(false)

      if (!prospect) {
        setError('Company code not found. Please check with your KIAA administrator.')
        return
      }

      // Pre-fill from prospect record
      if (prospect.contact_name) {
        const parts = prospect.contact_name.trim().split(' ')
        setFirstName(parts[0] || '')
        setLastName(parts.slice(1).join(' ') || '')
      }
      setCompany({ ...prospect, name: prospect.company_name || prospect.prospect_name, fromProspect: true })
      setStep('account')
      return
    }

    setLoading(false)

    if (data.status === 'inactive') {
      setError('This company is inactive. Please contact your KIAA administrator.')
      return
    }

    // Pre-fill name and phone from company contact info as a convenience
    // Don't pre-fill email — each user registers with their own work email
    if (data.contact_name) {
      const parts = data.contact_name.trim().split(' ')
      setFirstName(parts[0] || '')
      setLastName(parts.slice(1).join(' ') || '')
    }
    if (data.contact_phone) setPhone(data.contact_phone)

    setCompany(data)
    setStep('account')
  }

  // ── Step 2: Create account ─────────────────────────────────
  async function handleRegister(e) {
    e.preventDefault()
    setError('')

    if (!firstName.trim() || !lastName.trim()) { setError('Please enter your full name.'); return }
    if (!email.trim()) { setError('Email address is required.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setLoading(true)

    // Use server-side registration (Vercel function) to bypass email confirmation
    // and avoid Supabase email rate limits — appropriate for this internal tool
    const res = await fetch('/api/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:      email.trim(),
        password,
        firstName:  firstName.trim(),
        lastName:   lastName.trim(),
        phone:      phone.trim() || null,
        companyId:  company.id,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok || data.error) {
      setError(data.error || 'Registration failed. Please try again.')
      return
    }

    setStep('done')
  }

  function strength(pw) {
    let s = 0
    if (pw.length >= 8)  s++
    if (pw.length >= 12) s++
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
    if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++
    return Math.min(s, 4)
  }
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e']
  const pwStrength = strength(password)

  return (
    <div className="min-h-screen bg-gradient-to-br from-kiaa-700 to-kiaa-600 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logowhite.png" alt="KIAA" className="mx-auto mb-4 block"
            style={{ width:'140px', height:'140px', objectFit:'contain', filter:'brightness(0) invert(1)' }}/>
          <h1 className="font-display text-2xl font-semibold text-white">KIAA Connect</h1>
          <p className="text-kiaa-200 text-sm mt-1">HR Portal Registration</p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[
            { id:'verify',  label:'Verify' },
            { id:'account', label:'Account' },
            { id:'done',    label:'Done' },
          ].map((s, i) => {
            const idx = STEPS.indexOf(step)
            const sIdx = STEPS.indexOf(s.id)
            const done    = sIdx < idx
            const current = sIdx === idx
            return (
              <div key={s.id} className="flex items-center gap-2">
                {i > 0 && <div className={`w-8 h-px ${done||current ? 'bg-kiaa-aqua' : 'bg-kiaa-600'}`}/>}
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    done    ? 'bg-kiaa-aqua text-kiaa-800' :
                    current ? 'bg-white text-kiaa-700'     :
                              'bg-kiaa-600 text-kiaa-400'
                  }`}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs ${current ? 'text-white font-semibold' : 'text-kiaa-300'}`}>{s.label}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="bg-white rounded-2xl shadow-modal p-6">

          {/* ── STEP 1: Verify code ── */}
          {step === 'verify' && (
            <>
              <h2 className="font-display text-lg font-semibold text-surface-800 mb-2">Enter your company code</h2>
              <p className="text-surface-400 text-sm mb-5">
                Your KIAA administrator provided a 6-character company code. Enter it below to get started.
              </p>
              {error && (
                <div className="flex items-start gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg mb-4">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5"/>
                  {error}
                </div>
              )}
              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="label">6-character company code</label>
                  <input
                    type="text" maxLength={6}
                    value={code}
                    onChange={e => { setCode(e.target.value.toUpperCase().slice(0,6)); setError('') }}
                    placeholder="A1B2C3" autoFocus
                    className="input text-center font-mono text-2xl tracking-widest"
                    style={{ letterSpacing:'0.3em' }}
                  />
                </div>
                <button type="submit" disabled={loading || !code.trim()}
                  className="btn btn-primary w-full justify-center py-2.5">
                  {loading ? <><Loader size={14} className="animate-spin"/> Verifying…</> : 'Verify company →'}
                </button>
              </form>
              <p className="text-xs text-surface-400 text-center mt-4">
                Already have an account? <Link to="/login" className="text-kiaa-600 hover:underline">Sign in</Link>
              </p>
            </>
          )}

          {/* ── STEP 2: Create account ── */}
          {step === 'account' && company && (
            <>
              <div className="bg-kiaa-50 border border-kiaa-200 rounded-xl px-3 py-2.5 mb-4">
                <div className="text-xs text-kiaa-600 font-medium uppercase tracking-wide mb-0.5">Registering for</div>
                <div className="font-display font-semibold text-kiaa-700">{company.name}</div>
              </div>
              {company.fromProspect && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4 text-xs text-amber-700">
                  Your enrollment is pending KIAA confirmation. Once approved by HMSA, your company will be fully activated in the portal.
                </div>
              )}
              <h2 className="font-display text-lg font-semibold text-surface-800 mb-1">Create your HR account</h2>
              <p className="text-surface-400 text-sm mb-4">
                Enter your details to create your account. Name and phone are pre-filled from KIAA's records — update as needed.
              </p>
              {error && (
                <div className="flex items-start gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg mb-4">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5"/>
                  {error}
                </div>
              )}
              <form onSubmit={handleRegister} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">First name *</label>
                    <input className="input" value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="Jane" autoFocus/>
                  </div>
                  <div>
                    <label className="label">Last name *</label>
                    <input className="input" value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="Smith"/>
                  </div>
                </div>
                <div>
                  <label className="label">Work email *</label>
                  <input className="input" type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"/>
                </div>
                <div>
                  <label className="label">Phone <span className="text-surface-400 font-normal">(optional)</span></label>
                  <input className="input" type="tel" value={phone}
                    onChange={e => setPhone(formatPhone(e.target.value))}
                    placeholder="(808) 555-0100"/>
                </div>
                <div>
                  <label className="label">Password *</label>
                  <div className="relative">
                    <input className="input pr-10"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"/>
                    <button type="button" onClick={() => setShowPw(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
                      {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-1.5">
                      <div className="flex gap-1 mb-1">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="h-1 flex-1 rounded-full transition-colors"
                            style={{ background: i <= pwStrength ? strengthColors[pwStrength] : '#e2e8f0' }}/>
                        ))}
                      </div>
                      <span className="text-xs text-surface-400">{strengthLabels[pwStrength]}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">Confirm password *</label>
                  <input className={`input ${confirm && password !== confirm ? 'border-red-300' : ''}`}
                    type={showPw ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    autoComplete="new-password"/>
                  {confirm && password !== confirm && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" className="btn flex-1 justify-center"
                    onClick={() => { setStep('verify'); setError('') }}>
                    ← Back
                  </button>
                  <button type="submit" disabled={loading || !firstName || !lastName || !email || !password || !confirm}
                    className="btn btn-primary flex-1 justify-center py-2.5">
                    {loading ? <><Loader size={14} className="animate-spin"/> Creating…</> : 'Create account'}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── STEP 3: Done ── */}
          {step === 'done' && (
            <div className="text-center py-4">
              <CheckCircle size={44} className="text-kiaa-500 mx-auto mb-3"/>
              <div className="font-display font-semibold text-surface-800 text-xl mb-2">You're registered!</div>
              <p className="text-surface-500 text-sm mb-6">
                Your HR account for <strong>{company?.name}</strong> has been created.
                You can now sign in to access your benefits portal.
              </p>
              <button className="btn btn-primary w-full justify-center py-2.5"
                onClick={() => navigate('/login')}>
                Go to sign in →
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-kiaa-300 text-xs mt-6">
          Questions? Contact KIAA at (808) 961-5422 · kiaahilo.org
          <br/>
          <a href="/terms-of-service" className="underline hover:opacity-80">Terms of Service</a>
          {' · '}
          <a href="/privacy-policy" className="underline hover:opacity-80">Privacy Policy</a>
        </p>
      </div>
    </div>
  )
}
