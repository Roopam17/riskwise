import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Info, MailCheck } from 'lucide-react'
import { Page } from '../components/Layout'
import { useAuth } from '../hooks/auth'
import { useTitle } from '../hooks/data'
import { useToast } from '../hooks/toast'
import { googleEnabled } from '../lib/supabase'

// 0 = too short, 1 = weak, 2 = okay, 3 = strong
export function passwordStrength(password) {
  if (password.length < 8) return 0
  let score = 0
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score >= 3 ? 3 : score >= 2 ? 2 : 1
}
const STRENGTH = [['Too short (8 or more characters)', 'var(--r)'], ['Weak', 'var(--r)'], ['Okay', 'var(--a)'], ['Strong', 'var(--g)']]

function PasswordField({ id, label, value, onChange, meter = false, autoComplete }) {
  const [show, setShow] = useState(false)
  const level = passwordStrength(value)
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <div className="relative">
        <input id={id} className="input !pr-10" type={show ? 'text' : 'password'} value={value} autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)} required minLength={8} />
        <button type="button" className="star absolute right-1.5 top-1/2 -translate-y-1/2" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {meter && value && (
        <div className="mt-2" aria-live="polite">
          <div className="flex gap-1">{[1, 2, 3].map((n) => <span key={n} className="h-1.5 flex-1 rounded" style={{ background: level >= n ? STRENGTH[level][1] : 'var(--pn2)' }} />)}</div>
          <div className="faint mt-1 text-xs">Password strength: {STRENGTH[level][0]}</div>
        </div>
      )}
    </div>
  )
}

function Field({ id, label, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <input id={id} className="input" {...props} />
    </div>
  )
}

export default function Auth() {
  useTitle('Log in or sign up')
  const auth = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const mode = auth.recovery ? 'reset' : params.get('mode') || 'login'
  const next = params.get('next') && params.get('next').startsWith('/') ? params.get('next') : '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [info, setInfo] = useState(params.get('verified') ? 'Your email is verified. You can log in now.' : '')

  useEffect(() => { setError('') }, [mode])
  if (auth.user && mode !== 'reset') return <Navigate to={next} replace />

  const go = (m) => { const p = new URLSearchParams(params); p.set('mode', m); setParams(p, { replace: true }) }

  async function submit(event) {
    event.preventDefault()
    setBusy(true); setError(''); setInfo('')
    try {
      if (mode === 'login') { await auth.signIn(email, password); navigate(next, { replace: true }) }
      else if (mode === 'signup') {
        const { needsVerification } = await auth.signUp(email, password)
        if (needsVerification) setSentTo(email); else navigate(next, { replace: true })
      } else if (mode === 'forgot') { await auth.resetPassword(email); setInfo('If an account exists for that email, a reset link is on its way. Check your inbox.') }
      else if (mode === 'reset') { await auth.updatePassword(password); auth.clearRecovery(); toast('Your password was changed'); navigate('/', { replace: true }) }
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  if (sentTo) {
    return (
      <Page narrow>
        <div className="card mt-8 text-center">
          <MailCheck size={30} className="mx-auto text-ac" aria-hidden="true" />
          <h1 className="h2 mt-2">Check your email</h1>
          <p className="muted mt-2">We sent a link to <b className="text-tx">{sentTo}</b>. Click it to verify your email, then come back and log in. It can take a minute, and it may land in your spam folder.</p>
          {error && <p className="dn mt-2 text-sm" role="alert">{error}</p>}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" className="btn" onClick={async () => { try { await auth.resend(sentTo); toast('Email sent again') } catch (e) { setError(e.message) } }}>Resend email</button>
            <button type="button" className="btn btn-primary" onClick={() => { setSentTo(''); go('login') }}>I verified, log me in</button>
          </div>
        </div>
      </Page>
    )
  }

  const titles = { login: 'Welcome back', signup: 'Create your free account', forgot: 'Reset your password', reset: 'Choose a new password' }
  return (
    <Page narrow>
      <div className="card mt-6">
        {!auth.configured && (
          <div className="note mb-4 flex gap-2 text-sm"><Info size={16} className="mt-0.5 flex-none" aria-hidden="true" />
            <span>Logins are not connected yet (local mode). You can still use everything else, and your watchlist is saved in this browser. See DEPLOY.md to switch logins on.</span></div>
        )}
        {mode !== 'forgot' && mode !== 'reset' && (
          <div className="tabs mb-4" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={`tab ${mode === 'login' ? 'on' : ''}`} onClick={() => go('login')}>Log in</button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} className={`tab ${mode === 'signup' ? 'on' : ''}`} onClick={() => go('signup')}>Sign up</button>
          </div>
        )}
        <h1 className="h2 mb-1">{titles[mode]}</h1>
        {params.get('why') === 'watchlist' && mode === 'login' && <p className="muted mb-2 text-sm">Log in to save stocks to your watchlist.</p>}
        {mode === 'forgot' && <p className="muted mb-2 text-sm">Enter your email and we will send you a link to set a new password.</p>}
        {info && <p className="banner my-3 text-sm" role="status">{info}</p>}

        <form onSubmit={submit} className="mt-3 grid gap-3.5">
          {mode !== 'reset' && <Field id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="name@example.com" />}
          {mode !== 'forgot' && <PasswordField id="password" label={mode === 'reset' ? 'New password' : 'Password'} value={password} onChange={setPassword} meter={mode === 'signup' || mode === 'reset'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />}
          {error && <p className="dn text-sm" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary !justify-center !py-2.5" disabled={busy || !auth.configured}>
            {busy ? 'Please wait…' : { login: 'Log in', signup: 'Create account', forgot: 'Send reset link', reset: 'Save new password' }[mode]}
          </button>
        </form>

        {mode === 'login' && <button type="button" className="btn btn-ghost mt-2 !px-0" onClick={() => go('forgot')}>Forgot password?</button>}
        {mode === 'forgot' && <button type="button" className="btn btn-ghost mt-2 !px-0" onClick={() => go('login')}>Back to log in</button>}

        {googleEnabled && (mode === 'login' || mode === 'signup') && (
          <>
            <div className="faint my-4 text-center text-xs">or</div>
            <button type="button" className="btn w-full !justify-center !py-2.5" onClick={() => auth.signInGoogle().catch((e) => setError(e.message))}>Log in with Google</button>
          </>
        )}
        {mode === 'signup' && <p className="faint mt-4 text-xs">We keep only your email and your watchlist. By signing up you agree this is an educational tool and not investment advice. <Link to="/about" className="underline">Read more</Link></p>}
      </div>
    </Page>
  )
}

export function Account() {
  useTitle('Your account')
  const auth = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (auth.loading) return <Page narrow><div className="card muted">Loading…</div></Page>
  if (!auth.user) return <Navigate to="/auth?mode=login&next=/account" replace />

  async function changePassword(e) {
    e.preventDefault(); setError(''); setMessage('')
    try { await auth.updatePassword(password); setPassword(''); setMessage('Your password was changed.') } catch (err) { setError(err.message) }
  }
  async function remove() {
    try { await auth.deleteAccount(); toast('Your account was deleted'); navigate('/', { replace: true }) } catch (err) { setError(err.message) }
  }

  return (
    <Page narrow>
      <h1 className="h2 mb-3 mt-2">Your account</h1>
      <div className="card"><div className="muted text-sm">Signed in as</div><div className="font-medium">{auth.user.email}</div>
        <button type="button" className="btn mt-3" onClick={async () => { await auth.signOut(); navigate('/') }}>Log out</button></div>
      <form className="card mt-3.5 grid gap-3" onSubmit={changePassword}>
        <h2 className="h3">Change your password</h2>
        <PasswordField id="newpw" label="New password" value={password} onChange={setPassword} meter autoComplete="new-password" />
        <button type="submit" className="btn justify-self-start" disabled={passwordStrength(password) === 0}>Change password</button>
        {message && <p className="up text-sm" role="status">{message}</p>}
      </form>
      <div className="card mt-3.5">
        <h2 className="h3">Delete your account</h2>
        <p className="muted mt-1 text-sm">This permanently deletes your login and your saved watchlist. It cannot be undone. Type DELETE to confirm.</p>
        <div className="mt-2.5 flex flex-wrap gap-2"><input className="input !w-40" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Type DELETE to confirm" placeholder="DELETE" />
          <button type="button" className="btn !border-risk-high !text-risk-high" disabled={confirm !== 'DELETE'} onClick={remove}>Delete my account</button></div>
      </div>
      {error && <p className="dn mt-3 text-sm" role="alert">{error}</p>}
    </Page>
  )
}
