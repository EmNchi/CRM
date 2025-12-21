'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const params = useSearchParams()
  const redirectTo = params.get('redirectTo') || '/' 

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = supabaseBrowser()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    router.replace(redirectTo)
  }

  return (
    <div className="max-w-sm mx-auto mt-16 p-[5px]">
      <h1 className="text-xl font-semibold mb-4 p-[5px]">Sign in</h1>
      <form onSubmit={onSubmit} className="space-y-3 p-[5px]">
        <div className="p-[5px]">
          <label className="block text-sm font-medium p-[5px]">Email</label>
          <input
            className="border rounded px-3 py-2 w-full p-[5px]"
            type="email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            required
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
