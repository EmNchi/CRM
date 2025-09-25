'use client'

import { supabaseBrowser } from './supabaseClient'
const supabase = supabaseBrowser()

export type TagColor = 'green' | 'yellow' | 'red'
export type Tag = { id: string; name: string; color: TagColor }

/** Admin list (Configurări) */
export async function listTags(): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('id,name,color')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Tag[]
}

/** Toggle assign/unassign a tag on a lead */
export async function toggleLeadTag(leadId: string, tagId: string) {
  // does it exist?
  const { data: existing } = await supabase
    .from('lead_tags')
    .select('lead_id')
    .eq('lead_id', leadId)
    .eq('tag_id', tagId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('lead_tags')
      .delete()
      .eq('lead_id', leadId)
      .eq('tag_id', tagId)
    if (error) throw error
    return { removed: true }
  } else {
    const { error } = await supabase
      .from('lead_tags')
      .insert([{ lead_id: leadId, tag_id: tagId }])
    if (error) throw error
    return { added: true }
  }
}

export async function createTag(name: string, color: TagColor) {
  const { data, error } = await supabase
    .from('tags')
    .insert([{ name, color }])
    .select('id,name,color')
    .single()
  if (error) throw error
  return data as Tag
}

export async function deleteTag(tagId: string) {
  const { error } = await supabase.from('tags').delete().eq('id', tagId)
  if (error) throw error
}

export async function updateTag(tagId: string, patch: Partial<Pick<Tag,'name'|'color'>>) {
  const { data, error } = await supabase
    .from('tags')
    .update(patch)
    .eq('id', tagId)
    .select('id,name,color')
    .single()
  if (error) throw error
  return data as Tag
}

