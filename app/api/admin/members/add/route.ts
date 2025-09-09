import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient, createClient as _noop } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

type Role = "owner" | "admin" | "member"

export async function POST(req: Request) {
  try {
    const { email, password, role }: { email?: string; password?: string; role?: Role } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "email and password are required" }, { status: 400 })
    }

    // 1) Ensure the caller is authenticated (basic MVP gate)
    const cookieStore = cookies()
    const supaUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (n) => cookieStore.get(n)?.value, set() {}, remove() {} } }
    )
    const { data: { user: me } } = await supaUser.auth.getUser()
    if (!me) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })

    // 2) Optional: allow only specific admins (no membership needed yet)
    const admins = (process.env.ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
    if (admins.length && !admins.includes((me.email || "").toLowerCase())) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })
    }

    // 3) Create the auth user with the SERVICE ROLE (server-only)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!  // NEVER expose to client
    )

    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: role ?? "admin" }
    })

    if (created.error) {
      // if user already exists, that's okay for MVP
      if (String(created.error.message).toLowerCase().includes("already registered")) {
        return NextResponse.json({ ok: true, note: "user already existed" })
      }
      return NextResponse.json({ ok: false, error: created.error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unexpected" }, { status: 500 })
  }
}
