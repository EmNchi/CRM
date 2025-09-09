import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

type Role = 'owner' | 'admin' | 'member'

export async function POST(req: Request) {
  try {
    const { email, password, role }: { email?: string; password?: string; role?: Role } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'email and password are required' }, { status: 400 })
    }

    // 1) Caller must be logged in
    const supaUser = createRouteHandlerClient({ cookies })
    const { data: { user: me } } = await supaUser.auth.getUser()
    if (!me) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

    // 2) MVP allowlist: only these emails can add users
    const admins = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
    if (admins.length && !admins.includes((me.email || '').toLowerCase())) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    // 3) Admin client (service role) to manage users & bypass RLS for admin ops
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // NEVER expose to client
    )

    // 4) Create (or find) the auth user
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: role ?? 'admin' },
    })

    let newUserId: string | null = null
    if (created.error) {
      // If the user already exists, find their id
      if (String(created.error.message).toLowerCase().includes('already registered')) {
        const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const existing = list.data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
        if (!existing) {
          return NextResponse.json({ ok: false, error: 'user exists but cannot be fetched' }, { status: 409 })
        }
        newUserId = existing.id
      } else {
        return NextResponse.json({ ok: false, error: created.error.message }, { status: 400 })
      }
    } else {
      newUserId = created.data.user?.id ?? null
    }

    if (!newUserId) {
      return NextResponse.json({ ok: false, error: 'no user id' }, { status: 500 })
    }

    // 5) ✅ Insert membership so RLS allows data access
    const { error: memErr } = await admin
      .from('app_members')
      .upsert({ user_id: newUserId, role: role ?? 'admin' }) // default admin for MVP
    if (memErr) {
      return NextResponse.json({ ok: false, error: `membership: ${memErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, created: !created.error })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unexpected' }, { status: 500 })
  }
}
