import { NextResponse } from 'next/server'
import { requireAuth, createAdminClient } from '@/lib/supabase/api-helpers'

export async function PATCH(req: Request) {
  try {
    const { displayName } = await req.json()
    
    if (!displayName || !displayName.trim()) {
      return NextResponse.json({ ok: false, error: 'Display name is required' }, { status: 400 })
    }

    const { user } = await requireAuth()
    const admin = createAdminClient()

    // Obține user_metadata existent pentru a-l păstra
    const { data: existingUser } = await admin.auth.admin.getUserById(user.id)
    const existingMetadata = existingUser?.user?.user_metadata || {}

    // Actualizează display_name în user_metadata folosind admin client
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { 
        ...existingMetadata,
        display_name: displayName.trim(),
        name: displayName.trim(),
        full_name: displayName.trim()
      }
    })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, displayName: displayName.trim() })
  } catch (error: any) {
    if (error instanceof Response) return error
    return NextResponse.json({ ok: false, error: error?.message || 'Error' }, { status: 500 })
  }
}

