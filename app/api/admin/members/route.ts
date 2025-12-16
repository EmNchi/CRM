import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

// GET - Lista toți membrii cu email-uri
export async function GET() {
  try {
    // Verifică variabilele de mediu necesare
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return NextResponse.json({ 
        ok: false, 
        error: 'Server configuration error: Missing Supabase credentials.' 
      }, { status: 500 })
    }

    // 1) Caller must be logged in
    const supaUser = createRouteHandlerClient({ cookies })
    const { data: { user: me } } = await supaUser.auth.getUser()
    if (!me) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

    // 2) Check if caller is owner
    const { data: membership } = await supaUser
      .from('app_members')
      .select('role')
      .eq('user_id', me.id)
      .single()
    
    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ ok: false, error: 'forbidden - only owners can list members' }, { status: 403 })
    }

    // 3) Admin client to get user emails from auth
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // 4) Get all members
    const { data: members, error: membersError } = await admin
      .from('app_members')
      .select('*')
      .order('created_at', { ascending: true })

    if (membersError) throw membersError

    // 5) Get emails from auth.users
    const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const userEmails = new Map<string, string>()
    
    authData?.users?.forEach(u => {
      if (u.email) {
        userEmails.set(u.id, u.email)
      }
    })

    // 6) Merge emails into members
    const membersWithEmail = (members || []).map(m => ({
      ...m,
      email: m.email || userEmails.get(m.user_id) || `User ${m.user_id.slice(0, 8)}...`
    }))

    return NextResponse.json({ ok: true, members: membersWithEmail })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unexpected' }, { status: 500 })
  }
}

// DELETE - Șterge un membru
export async function DELETE(req: Request) {
  try {
    // Verifică variabilele de mediu necesare
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 })
    }

    const { memberId } = await req.json()
    if (!memberId) {
      return NextResponse.json({ ok: false, error: 'memberId is required' }, { status: 400 })
    }

    // 1) Caller must be logged in
    const supaUser = createRouteHandlerClient({ cookies })
    const { data: { user: me } } = await supaUser.auth.getUser()
    if (!me) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

    // 2) Check if caller is owner
    const { data: membership } = await supaUser
      .from('app_members')
      .select('role')
      .eq('user_id', me.id)
      .single()
    
    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ ok: false, error: 'forbidden - only owners can delete members' }, { status: 403 })
    }

    // 3) Admin client
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // 4) Check if member to delete is owner (folosim user_id ca PK)
    const { data: targetMember } = await admin
      .from('app_members')
      .select('role, user_id')
      .eq('user_id', memberId)
      .single()

    if (targetMember?.role === 'owner') {
      return NextResponse.json({ ok: false, error: 'Cannot delete an owner' }, { status: 403 })
    }

    // 5) Delete from app_members
    const { error: deleteError } = await admin
      .from('app_members')
      .delete()
      .eq('user_id', memberId)

    if (deleteError) throw deleteError

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unexpected' }, { status: 500 })
  }
}

// PATCH - Actualizează rolul unui membru
export async function PATCH(req: Request) {
  try {
    // Verifică variabilele de mediu necesare
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 })
    }

    const { memberId, role } = await req.json()
    if (!memberId || !role) {
      return NextResponse.json({ ok: false, error: 'memberId and role are required' }, { status: 400 })
    }

    if (!['owner', 'admin', 'member'].includes(role)) {
      return NextResponse.json({ ok: false, error: 'invalid role' }, { status: 400 })
    }

    // 1) Caller must be logged in
    const supaUser = createRouteHandlerClient({ cookies })
    const { data: { user: me } } = await supaUser.auth.getUser()
    if (!me) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

    // 2) Check if caller is owner
    const { data: membership } = await supaUser
      .from('app_members')
      .select('role')
      .eq('user_id', me.id)
      .single()
    
    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ ok: false, error: 'forbidden - only owners can update roles' }, { status: 403 })
    }

    // 3) Admin client
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // 4) Update role (folosim user_id ca PK)
    const { data: updateData, error: updateError } = await admin
      .from('app_members')
      .update({ role })
      .eq('user_id', memberId)
      .select()

    if (updateError) {
      console.error('Update error:', updateError)
      throw updateError
    }

    // Check if any row was actually updated
    if (!updateData || updateData.length === 0) {
      console.error('No rows updated for memberId (user_id):', memberId)
      return NextResponse.json({ ok: false, error: 'Member not found' }, { status: 404 })
    }

    console.log('Role updated successfully:', updateData[0])
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unexpected' }, { status: 500 })
  }
}

