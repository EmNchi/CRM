'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { debounce } from '@/lib/utils'

export default function SignInPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const params = useSearchParams()
  const redirectTo = params.get('redirectTo') || '/' 

  const handleSignIn = useCallback(async () => {
    if (!username || !password) {
      setError('Username și parola sunt obligatorii')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      // Găsește email-ul asociat cu username-ul
      const emailRes = await fetch('/api/auth/username-to-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      
      const emailData = await emailRes.json()
      
      if (!emailRes.ok || !emailData.ok) {
        setError(emailData.error || 'Username-ul nu a fost găsit')
        setLoading(false)
        return
      }

      // Autentifică cu email-ul găsit
      const supabase = supabaseBrowser()
      const { error } = await supabase.auth.signInWithPassword({ 
        email: emailData.email, 
        password 
      })
      
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      
      router.replace(redirectTo)
    } catch (err: any) {
      setError(err.message || 'Eroare la autentificare')
      setLoading(false)
    }
  }, [username, password, redirectTo, router])

  // Funcție debounced pentru sign in (500ms delay)
  const debouncedSignIn = useMemo(
    () => debounce(handleSignIn, 500),
    [handleSignIn]
  )

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    debouncedSignIn()
  }

  return (
    <div className="max-w-sm mx-auto mt-16 p-[5px]">
      <h1 className="text-xl font-semibold mb-4 p-[5px]">Sign in</h1>
      <form onSubmit={onSubmit} className="space-y-3 p-[5px]">
        <div className="p-[5px]">
          <label className="block text-sm font-medium p-[5px]">Username</label>
          <input
            className="border rounded px-3 py-2 w-full p-[5px]"
            type="text"
            value={username}
            onChange={(e)=>setUsername(e.target.value)}
            required
            autoComplete="username"
          />
        </div>
        <div className="p-[5px]">
          <label className="block text-sm font-medium p-[5px]">Password</label>
          <input
            className="border rounded px-3 py-2 w-full p-[5px]"
            type="password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            required
          />
        </div>
        <button
          className="px-4 py-2 rounded bg-black text-white w-full disabled:opacity-50 p-[5px]"
          disabled={loading}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        {error && <p className="text-sm text-red-600 p-[5px]">{error}</p>}
      </form>
    </div>
  )
}
