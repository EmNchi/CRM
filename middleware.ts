/**
 * Middleware simplificat pentru autentificare
 * 
 * Strategia nouă:
 * - Verifică DOAR dacă există session validă
 * - NU mai verifică roluri sau permisiuni (se fac în AuthContext)
 * - NU mai face query-uri la app_members (evită probleme cu RLS)
 * - Permisiunile se verifică în client-side prin AuthContext
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"

export async function middleware(req: NextRequest) {
  // Ignore prefetch/noise și request-uri statice
  if (req.method === "HEAD" || req.method === "OPTIONS") {
    return NextResponse.next()
  }

  // Ignore API routes și rute statice
  const { pathname } = req.nextUrl
  if (pathname.startsWith('/api/') || 
      pathname.startsWith('/_next/') || 
      pathname.startsWith('/auth/') ||
      pathname.includes('.')) {
    return NextResponse.next()
  }

  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Verifică dacă există session (folosește cookies, nu face request la API)
  const { data: { session }, error } = await supabase.auth.getSession()

  // Dacă nu există session, redirectează la sign-in
  if (error || !session) {
    const url = req.nextUrl.clone()
    url.pathname = "/auth/sign-in"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  // Session validă → permite acces
  // Verificările de permisiuni se fac în AuthContext și componente
  return res
}

// Protect only real app pages (exclude API routes, auth routes, static files)
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth (auth routes)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|auth).*)',
  ],
}
