'use client'

import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuthContext } from '@/lib/contexts/AuthContext'

export default function AuthStatus() {
  const { user, profile, loading } = useAuthContext()

  // Generează inițialele din nume
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  // Obține numele pentru afișare
  const displayName = profile?.name || user?.email?.split('@')[0] || 'User'

  if (loading) return null
  if (!user) return <Link className="text-sm underline" href="/auth/sign-in">Sign in</Link>
  
  return (
    <div className="flex items-center gap-3 text-sm">
      <Link 
        href="/profile" 
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        title="Profil"
      >
        <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
          <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
      </Link>
      <SignOutButton />
    </div>
  )
}
