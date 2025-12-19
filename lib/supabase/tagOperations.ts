'use client'

import { supabaseBrowser } from './supabaseClient'
const supabase = supabaseBrowser()

export type TagColor = 'green' | 'yellow' | 'red' | 'orange' | 'blue'
export type Tag = { id: string; name: string; color: TagColor }

/** admin list (configurari) */
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
      .insert([{ lead_id: leadId, tag_id: tagId }] as any)
      .select('lead_id, tag_id')
      .single()

    // Dacă primim eroare de tip duplicate key (23505), înseamnă că în paralel
    // a fost deja inserată aceeași pereche (lead_id, tag_id). O putem ignora
    // și considerăm că tag-ul este deja adăugat.
    if (error && (error as any).code !== '23505') {
      throw error
    }

    return { added: true }
  }
}

export async function createTag(name: string, color: TagColor) {
  const { data, error } = await supabase
    .from('tags')
    .insert([{ name, color }] as any)
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
  const updateData: any = {}
  if (patch.name !== undefined) updateData.name = patch.name
  if (patch.color !== undefined) updateData.color = patch.color
  
  const { data, error } = await supabase
    .from('tags')
    .update(updateData as any)
    .eq('id', tagId)
    .select('id,name,color')
    .single()
  if (error) throw error
  return data as Tag
}

/** Gaseste sau creeaza tag-ul PINNED */
export async function getOrCreatePinnedTag(): Promise<Tag> {
  // cauta tag-ul PINNED
  const { data: existingTag } = await supabase
    .from('tags')
    .select('id,name,color')
    .eq('name', 'PINNED')
    .maybeSingle()
  
  if (existingTag) {
    return existingTag as Tag
  }
  
  // creeaza tag-ul PINNED daca nu exista
  const { data: newTag, error } = await supabase
    .from('tags')
    .insert([{ name: 'PINNED', color: 'blue' }] as any)
    .select('id,name,color')
    .single()
  
  if (error) throw error
  return newTag as Tag
}

