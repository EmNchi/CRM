import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(req: NextRequest) {
  // Let static and auth paths through quickly
  const { pathname, search } = req.nextUrl
  const publicPaths = [
    '/auth', '/auth/sign-in', '/auth/callback',
    '/favicon.ico', '/robots.txt', '/sitemap.xml'
  ]
  const isPublic =
    publicPaths.some(p => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/api') // API routes do their own checks

  if (isPublic) return NextResponse.next()

  // Check session
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  // Redirect unauthenticated users to sign-in, preserving the original URL
  if (!session) {
    const url = req.nextUrl.clone()
    url.pathname = '/auth/sign-in'
    url.searchParams.set('redirectTo', pathname + search)
    return NextResponse.redirect(url)
  }

  return res
}

// Run on everything except static assets/auth/api (performance)
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|auth|api).*)',
  ],
}
