'use client'

import { Sidebar } from '@/components/sidebar'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { Toaster } from '@/components/ui/sonner'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'

export default function CrmShell({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => supabaseBrowser(), [])
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    let unsub: { unsubscribe: () => void } | undefined
    supabase.auth.getSession().then(({ data }) => setIsAuthed(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAuthed(!!session)
    })
    unsub = sub.subscription
    return () => unsub?.unsubscribe()
  }, [supabase])

  // Închide meniul mobil când se schimbă ruta
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // avoid mounting data hooks until we know auth state
  if (isAuthed === null) return null

  // unauthenticated -> go to login (make sure /login is outside the (crm) group)
  if (!isAuthed) {
    router.replace('/auth/sign-in')
    return null
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar pentru desktop */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      
      {/* Meniu mobil - buton hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b shadow-sm">
        <div className="flex items-center justify-between p-3 h-12">
          <h2 className="font-semibold text-sm">ascutzit.ro – CRM</h2>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Deschide meniu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 bg-sidebar">
              <div className="h-full overflow-y-auto">
                <Sidebar />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      
      {/* Main content - adaugă padding-top pe mobil pentru header */}
      <main className="flex-1 overflow-auto pt-12 md:pt-0">{children}</main>
      <Toaster />
    </div>
  )
}
