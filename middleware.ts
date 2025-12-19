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
  // Ignore prefetch/noise
  if (req.method === "HEAD" || req.method === "OPTIONS") {
    return NextResponse.next()
  }

  const { pathname } = req.nextUrl
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Verifică dacă există session
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

// Protect only real app pages
export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/dashboard",
    "/configurari/:path*",
    "/configurari",
    "/leads/:path*",
    "/leads",
    "/pipelines/:path*",
    "/pipelines",
    "/settings/:path*",
    "/settings",
    "/profile/:path*",
    "/profile",
    "/tehnician/:path*",
  ],
}
