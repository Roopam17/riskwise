import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

// Turns Supabase's technical messages into plain English.
export function friendlyAuthError(error) {
  const text = (error?.message || '').toLowerCase()
  if (text.includes('invalid login')) return 'That email and password do not match. Try again, or use "Forgot password?".'
  if (text.includes('not confirmed')) return 'Please verify your email first. We sent you a link when you signed up.'
  if (text.includes('already registered')) return 'There is already an account with that email. Try logging in instead.'
  if (text.includes('password') && text.includes('least')) return 'Your password is too short. Use at least 8 characters.'
  if (text.includes('rate limit') || text.includes('too many')) return 'Too many tries. Please wait a minute and try again.'
  if (text.includes('fetch') || text.includes('network')) return 'We could not reach the login service. Check your connection and try again.'
  return error?.message || 'Something went wrong. Please try again.'
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    if (!supabase) return undefined
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const run = useCallback(async (promise) => {
    const { data, error } = await promise
    if (error) throw new Error(friendlyAuthError(error))
    return data
  }, [])

  const value = useMemo(() => ({
    configured: Boolean(supabase),
    user: session?.user ?? null,
    loading,
    recovery,
    clearRecovery: () => setRecovery(false),
    async signUp(email, password) {
      const data = await run(supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth?mode=login&verified=1` } }))
      return { needsVerification: !data.session }
    },
    signIn: (email, password) => run(supabase.auth.signInWithPassword({ email, password })),
    signInGoogle: () => run(supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })),
    signOut: () => run(supabase.auth.signOut()),
    resend: (email) => run(supabase.auth.resend({ type: 'signup', email })),
    resetPassword: (email) => run(supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth?mode=reset` })),
    updatePassword: (password) => run(supabase.auth.updateUser({ password })),
    async deleteAccount() {            // see supabase/schema.sql: the delete_my_account() function
      await run(supabase.rpc('delete_my_account'))
      await supabase.auth.signOut()
    },
  }), [session, loading, recovery, run])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
