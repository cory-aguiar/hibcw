import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { LogIn, AlertCircle, CheckCircle } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent]   = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) { setError(error.message); return }
    navigate('/')
  }

  async function handleForgot(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setResetSent(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-kiaa-700 to-kiaa-600 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logowhite.png" alt="KIAA" className="mx-auto mb-4 block" style={{width:'200px',height:'200px',objectFit:'contain',filter:'brightness(0) invert(1)'}}/>
          <h1 className="font-display text-2xl font-semibold text-white">KIAA Connect</h1>
          <p className="text-kiaa-200 text-sm mt-1">KIAA Health Plan Platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-modal p-6">

          {forgotMode ? (
            resetSent ? (
              <div className="text-center py-4">
                <CheckCircle size={36} className="text-kiaa-500 mx-auto mb-3" />
                <div className="font-display font-semibold text-surface-800 text-lg mb-1">Check your email</div>
                <p className="text-surface-400 text-sm mb-5">
                  We sent a password reset link to <strong>{email}</strong>.
                </p>
                <button className="text-kiaa-600 text-sm underline" onClick={() => { setForgotMode(false); setResetSent(false) }}>
                  Back to sign in
                </button>
              </div>
            ) : (
              <>
                <h2 className="font-display text-lg font-semibold text-surface-800 mb-1">Reset password</h2>
                <p className="text-surface-400 text-sm mb-5">Enter your email and we'll send you a reset link.</p>

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg mb-4">
                    <AlertCircle size={15} className="flex-shrink-0"/> {error}
                  </div>
                )}

                <form onSubmit={handleForgot} className="space-y-4">
                  <div>
                    <label className="label">Email address</label>
                    <input
                      type="email" className="input" value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com" required autoFocus
                    />
                  </div>
                  <button type="submit" className="btn btn-primary w-full justify-center py-2.5" disabled={loading}>
                    {loading ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>

                <button className="text-kiaa-600 text-sm underline w-full text-center mt-4"
                  onClick={() => { setForgotMode(false); setError('') }}>
                  Back to sign in
                </button>
              </>
            )
          ) : (
            <>
              <h2 className="font-display text-lg font-semibold text-surface-800 mb-5">Sign in</h2>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg mb-4">
                  <AlertCircle size={15} className="flex-shrink-0"/> {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Email address</label>
                  <input
                    type="email" className="input" value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com" required autoFocus
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Password</label>
                    <button type="button" className="text-xs text-kiaa-600 hover:text-kiaa-800 underline"
                      onClick={() => { setForgotMode(true); setError('') }}>
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password" className="input" value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required
                  />
                </div>
                <button type="submit" className="btn btn-primary w-full justify-center py-2.5" disabled={loading}>
                  <LogIn size={15}/>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <p className="text-xs text-surface-400 text-center mt-5">
                Contact your KIAA administrator to set up your account.
              </p>
            </>
          )}
        </div>

        <p className="text-center text-kiaa-300 text-xs mt-6">
          Kanoelehua Industrial Area Association © {new Date().getFullYear()}
          <br/>
          <a href="/terms-of-service" className="underline hover:text-white transition-colors">Terms of Service</a>
          {' · '}
          <a href="/privacy-policy" className="underline hover:text-white transition-colors">Privacy Policy</a>
        </p>
      </div>
    </div>
  )
}
