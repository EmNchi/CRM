'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import SignOutButton from '@/components/SignOutButton'

export default function AuthStatus() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Link className="text-sm underline" href="/auth/sign-in">Sign in</Link>
  return (
    <div className="flex items-center gap-3 text-sm">
      <span>{user.email}</span>
      <SignOutButton />
    </div>
  )
}
