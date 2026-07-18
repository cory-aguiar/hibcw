import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { KeyRound, Eye, EyeOff, CheckCircle, AlertCircle, Loader } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [done,      setDone]      = useState(false)
  const [error,     setError]     = useState('')
  const [ready,     setReady]     = useState(false)
  const [isInvite,  setIsInvite]  = useState(false)
  const navigate = useNavigate()

  // Supabase puts the recovery token in the URL hash.
  // onAuthStateChange fires with PASSWORD_RECOVERY for resets, SIGNED_IN for invites.
  useEffect(() => {
    const params    = new URLSearchParams(window.location.search)
    const tokenHash = params.get('token_hash')
    const type      = params.get('type') || 'recovery'

    if (tokenHash) {
      window.history.replaceState(null, '', window.location.pathname)
      supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        .then(async ({ data, error }) => {
          if (error) {
            setError('Link expired or invalid. Please request a new one.')
          } else if (data?.session?.user) {
            await handleSessionReady(data.session)
          } else {
            setError('Link expired or invalid. Please request a new one.')
          }
        })
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session?.user) {
        await handleSessionReady(session)
      }
      if (event === 'SIGNED_IN' && done) {
        setTimeout(() => navigate('/'), 2000)
      }
    })
    return () => subscription.unsubscribe()
  }, [done])

  async function handleSessionReady(session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', session.user.id)
      .maybeSingle()

    if (!profile) {
      await supabase.from('profiles').insert({
        id:         session.user.id,
        email:      session.user.email,
        first_name: session.user.user_metadata?.first_name || '',
        last_name:  session.user.user_metadata?.last_name  || '',
        role:       'staff',
      })
      setIsInvite(true)
    }
    setReady(true)
  }

  async function handleReset(e) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) {
      setError(err.message)
      return
    }

    setDone(true)
    setTimeout(() => navigate('/'), 2500)
  }

  function strength(pw) {
    let s = 0
    if (pw.length >= 8)  s++
    if (pw.length >= 12) s++
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
    if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++
    return Math.min(s, 4)
  }
  const strengthLabels = ['','Weak','Fair','Good','Strong']
  const strengthColors = ['','#ef4444','#f97316','#eab308','#22c55e']

  return (
    <div className="min-h-screen bg-gradient-to-br from-kiaa-700 to-kiaa-600 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
            <img src="/logowhite.png" alt="KIAA" className="mx-auto mb-4 block" style={{width:'200px',height:'200px',objectFit:'contain',filter:'brightness(0) invert(1)'}}/>
          <h1 className="font-display text-2xl font-semibold text-white">KIAA Connect</h1>
          <p className="text-kiaa-200 text-sm mt-1">{isInvite ? 'Set your password to get started' : 'Set your new password'}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-modal p-6">

          {done ? (
            <div className="text-center py-4">
              <CheckCircle size={40} className="text-kiaa-500 mx-auto mb-3" />
              <div className="font-display font-semibold text-surface-800 text-lg mb-1">
                {isInvite ? 'Account activated!' : 'Password updated!'}
              </div>
              <p className="text-surface-400 text-sm">
                {isInvite ? 'Welcome to KIAA Connect. Redirecting you to the dashboard…' : 'Redirecting you to the dashboard…'}
              </p>
            </div>
          ) : !ready ? (
            <div className="text-center py-4">
              <Loader size={32} className="text-kiaa-500 mx-auto mb-3 animate-spin" />
              <div className="font-medium text-surface-700 mb-1">Verifying reset link…</div>
              <p className="text-surface-400 text-sm">
                If this takes more than a few seconds, your link may have expired.{' '}
                <button className="text-kiaa-600 underline" onClick={() => navigate('/login')}>
                  Request a new one
                </button>
              </p>
            </div>
          ) : (
            <>
              <h2 className="font-display text-lg font-semibold text-surface-800 mb-5">
                {isInvite ? 'Create your password' : 'Choose a new password'}
              </h2>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg mb-4">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="label">New password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      className="input pr-10"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      autoFocus
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                    >
                      {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
                    </button>
                  </div>

                  {/* Strength bar */}
                  {password && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="h-1 flex-1 rounded-full transition-colors"
                            style={{ background: i <= strength(password) ? strengthColors[strength(password)] : '#e2e8f0' }}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-surface-400">
                        {strengthLabels[strength(password)]}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="label">Confirm new password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    className={`input ${confirm && password !== confirm ? 'border-red-300' : ''}`}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                  />
                  {confirm && password !== confirm && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-full justify-center py-2.5"
                  disabled={loading || !password || !confirm}
                >
                  <KeyRound size={15}/>
                  {loading ? 'Updating…' : 'Set new password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
