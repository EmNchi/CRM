'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'

type Role = 'owner' | 'admin' | 'member'
type State = { role: Role | null; isOwner: boolean; loading: boolean; error: string | null }

export function useRole(): State {
  const supabase = supabaseBrowser()
  const [state, setState] = useState<State>({ role: null, isOwner: false, loading: true, error: null })

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return alive && setState({ role: null, isOwner: false, loading: false, error: null })

        const { data, error } = await supabase
          .from('app_members')
          .select('role')
          .eq('user_id', user.id)
          .single()

        if (!alive) return
        if (error) return setState({ role: null, isOwner: false, loading: false, error: error.message })
        const role = (data?.role ?? null) as Role | null
        setState({ role, isOwner: role === 'owner', loading: false, error: null })
      } catch (e: any) {
        if (!alive) return
        setState({ role: null, isOwner: false, loading: false, error: e?.message ?? 'role error' })
      }
    })()
    return () => { alive = false }
  }, [])

  return state
}
