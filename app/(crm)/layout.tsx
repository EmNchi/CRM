'use client'

import { Sidebar } from '@/components/sidebar'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { Toaster } from '@/components/ui/sonner'

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

  return (
    <div className="min-h-screen flex">
      {/* Sidebar ascuns pe mobil - va fi în drawer */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-auto">{children}</main>
      <Toaster />
    </div>
  )
}
