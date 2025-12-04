'use client'

import { supabaseBrowser } from './supabaseClient'

const supabase = supabaseBrowser()
const BUCKET_NAME = 'lead-images'

export interface LeadImage {
  id: string
  url: string
  filename: string
  file_path: string
  created_at: string
}

/**
 * Upload o imagine pentru un lead
 */
export async function uploadLeadImage(leadId: string, file: File): Promise<{ url: string; path: string }> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${leadId}/${Date.now()}.${fileExt}`
  const filePath = `${fileName}`

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) throw error

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath)

  return { url: publicUrl, path: filePath }
}

/**
 * Șterge o imagine pentru un lead
 */
export async function deleteLeadImage(filePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath])

  if (error) throw error
}

/**
 * Obține toate imaginile pentru un lead
 * Presupunem că în baza de date există o tabelă lead_images cu coloanele:
 * - id
 * - lead_id
 * - file_path (sau url)
 * - filename
 * - created_at
 */
export async function listLeadImages(leadId: string): Promise<LeadImage[]> {
  const { data, error } = await supabase
    .from('lead_images')
    .select('id, url, filename, file_path, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as LeadImage[]
}

/**
 * Salvează referința unei imagini în baza de date
 */
export async function saveLeadImageReference(leadId: string, url: string, filePath: string, filename: string): Promise<LeadImage> {
  const { data, error } = await supabase
    .from('lead_images')
    .insert([{
      lead_id: leadId,
      url: url,
      file_path: filePath,
      filename: filename
    }] as any)
    .select('id, url, filename, file_path, created_at')
    .single()

  if (error) throw error
  return data as LeadImage
}

/**
 * Șterge referința unei imagini din baza de date
 */
export async function deleteLeadImageReference(imageId: string): Promise<void> {
  const { error } = await supabase
    .from('lead_images')
    .delete()
    .eq('id', imageId)

  if (error) throw error
}

