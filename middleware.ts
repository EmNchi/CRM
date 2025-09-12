import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(req: NextRequest) {
  // 1) Skip prefetch/CORS noise (this was the "Expression expected" line—extra ')' before)
  if (req.method === 'HEAD' || req.method === 'OPTIONS') {
    return NextResponse.next()
  }

  const { pathname } = req.nextUrl

  // 2) Public routes fast-exit (no auth checks, no Supabase call)
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next()
  }

  // 3) If no auth cookies, redirect WITHOUT touching Supabase (prevents storms)
  const hasAuth =
    req.cookies.has('sb-access-token') || req.cookies.has('sb-refresh-token')

  if (!hasAuth) {
    const url = req.nextUrl.clone()
    url.pathname = '/auth/sign-in'
    url.searchParams.set('redirectTo', req.nextUrl.pathname + req.nextUrl.search)
    return NextResponse.redirect(url)
  }

  // 4) Only now ask Supabase once (this may refresh token and set cookies)
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    const url = req.nextUrl.clone()
    url.pathname = '/auth/sign-in'
    url.searchParams.set('redirectTo', req.nextUrl.pathname + req.nextUrl.search)
    return NextResponse.redirect(url)
  }

  return res
}

// Narrow the scope to only the real protected areas in your app
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/pipelines/:path*',
    '/leads/:path*',
    '/settings/:path*',
  ],
}
