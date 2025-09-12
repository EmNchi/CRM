// middleware.ts
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

  // 1) Session check
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    const url = req.nextUrl.clone()
    url.pathname = "/auth/sign-in"
    url.searchParams.set("next", pathname) // so we can bounce back after login
    return NextResponse.redirect(url)
  }

  const { data: member, error: memberErr } = await supabase
    .from("app_members")
    .select("role")
    .eq("user_id", session.user.id)  
    .single()

  // If not in app, send to a simple "no access" page (or dashboard)
  if (memberErr || !member) {
    const url = req.nextUrl.clone()
    url.pathname = "/auth/no-access"   // make a tiny page or change to "/"
    return NextResponse.redirect(url)
  }

  // (Optional) only owners can access destructive areas; you can branch by path here
  // if (pathname.startsWith("/settings") && member.role !== "owner") { ... }

  return res // IMPORTANT: return the SAME res you passed to createMiddlewareClient
}

// Protect only real app pages
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/leads/:path*",
    "/pipelines/:path*",
    "/settings/:path*",
  ],
}
