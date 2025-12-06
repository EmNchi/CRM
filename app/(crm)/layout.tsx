'use client'

import { Sidebar } from '@/components/sidebar'
import { useKanbanData } from '@/hooks/useKanbanData'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'

function AppShell({ children }: { children: React.ReactNode }) {
  // <-- runs ONLY after session exists
  const { leads, pipelines } = useKanbanData()
  return (
    <div className="min-h-screen flex">
      <Sidebar leads={leads} onLeadSelect={() => {}} pipelines={pipelines} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

export default function CrmShell({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => supabaseBrowser(), [])
  const router = useRouter()
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    let unsub: { unsubscribe: () => void } | undefined
    supabase.auth.getSession().then(({ data }) => setIsAuthed(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAuthed(!!session)
    })
    unsub = sub.subscription
    return () => unsub?.unsubscribe()
  }, [supabase])

  // avoid mounting data hooks until we know auth state
  if (isAuthed === null) return null

  // unauthenticated -> go to login (make sure /login is outside the (crm) group)
  if (!isAuthed) {
    router.replace('/auth/sign-in')
    return null
  }

  // authenticated -> now mount the heavy shell (this is where useKanbanData runs)
  return <AppShell>{children}</AppShell>
}
