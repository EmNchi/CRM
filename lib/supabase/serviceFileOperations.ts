'use client'

import { supabaseBrowser } from './supabaseClient'

const supabase = supabaseBrowser()

// Tipuri pentru noile tabele
export type ServiceFile = {
  id: string
  lead_id: string
  number: string
  date: string
  status: 'noua' | 'in_lucru' | 'finalizata'
  notes: string | null
  office_direct: boolean // Checkbox pentru "Office direct"
  curier_trimis: boolean // Checkbox pentru "Curier Trimis"
  no_deal: boolean       // Checkbox pentru "No Deal" în Vânzări
  created_at: string
  updated_at: string
}

export type Tray = {
  id: string
  number: string
  size: string
  service_file_id: string
  status: 'in_receptie' | 'in_lucru' | 'gata'
  urgent: boolean
  created_at: string
}

export type TrayItem = {
  id: string
  tray_id: string
  department_id: string | null
  instrument_id: string | null
  service_id: string | null
  part_id: string | null
  technician_id: string | null
  qty: number
  notes: string | null
  pipeline: string | null
  details?: string | null
  // Joined data
  service?: {
    id: string
    name: string
    price: number
  } | null
  // Noua structură pentru brand-uri și serial numbers
  tray_item_brands?: Array<{
    id: string
    brand: string
    garantie: boolean
    tray_item_brand_serials?: Array<{
      id: string
      serial_number: string
    }>
  }>
}

// ==================== SERVICE FILES ====================

export async function createServiceFile(data: {
  lead_id: string
  number: string
  date: string
  status?: 'noua' | 'in_lucru' | 'finalizata'
  notes?: string | null
  office_direct?: boolean
  curier_trimis?: boolean
  no_deal?: boolean
}): Promise<{ data: ServiceFile | null; error: any }> {
  try {
    const { data: result, error } = await supabase
      .from('service_files')
      .insert([{
        lead_id: data.lead_id,
        number: data.number,
        date: data.date,
        status: data.status || 'noua',
        notes: data.notes || null,
        office_direct: data.office_direct || false,
        curier_trimis: data.curier_trimis || false,
        no_deal: data.no_deal ?? false,
      }])
      .select()
      .single()

    if (error) throw error
    return { data: result as ServiceFile, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getServiceFile(serviceFileId: string): Promise<{ data: ServiceFile | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('service_files')
      .select('*')
      .eq('id', serviceFileId)
      .single()

    if (error) throw error
    return { data: data as ServiceFile, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function listServiceFilesForLead(leadId: string): Promise<{ data: ServiceFile[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('service_files')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { data: (data ?? []) as ServiceFile[], error: null }
  } catch (error) {
    return { data: [], error }
  }
}

export async function updateServiceFile(
  serviceFileId: string,
  updates: Partial<Pick<ServiceFile, 'number' | 'date' | 'status' | 'notes' | 'office_direct' | 'curier_trimis' | 'no_deal'>>
): Promise<{ data: ServiceFile | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('service_files')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', serviceFileId)
      .select()
      .single()

    if (error) throw error
    return { data: data as ServiceFile, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function deleteServiceFile(serviceFileId: string): Promise<{ success: boolean; error: any }> {
  try {
    const { error } = await supabase
      .from('service_files')
      .delete()
      .eq('id', serviceFileId)

    if (error) throw error
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error }
  }
}

// ==================== TRAYS ====================

export async function createTray(data: {
  number: string
  size: string
  service_file_id: string
  status?: 'in_receptie' | 'in_lucru' | 'gata'
}): Promise<{ data: Tray | null; error: any }> {
  try {
    // Dacă există deja o tavă cu același număr, mărime și service_file_id, nu mai crea una nouă
    const { data: existing } = await supabase
      .from('trays')
      .select('*')
      .eq('service_file_id', data.service_file_id)
      .eq('number', data.number)
      .eq('size', data.size)
      .maybeSingle()

    if (existing) {
      return { data: existing as Tray, error: null }
    }

    const { data: result, error } = await supabase
      .from('trays')
      .insert([{
        number: data.number,
        size: data.size,
        service_file_id: data.service_file_id,
        status: data.status || 'in_receptie',
      }])
      .select()
      .single()

    if (error) throw error
    return { data: result as Tray, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getTray(trayId: string): Promise<{ data: Tray | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('trays')
      .select('*')
      .eq('id', trayId)
      .single()

    if (error) throw error
    return { data: data as Tray, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function listTraysForServiceFile(serviceFileId: string): Promise<{ data: Tray[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('trays')
      .select('*')
      .eq('service_file_id', serviceFileId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return { data: (data ?? []) as Tray[], error: null }
  } catch (error) {
    return { data: [], error }
  }
}

export async function updateTray(
  trayId: string,
  updates: Partial<Pick<Tray, 'number' | 'size' | 'status' | 'urgent' | 'details'>>
): Promise<{ data: Tray | null; error: any }> {
  try {
    // Verifică dacă există actualizări
    if (!updates || Object.keys(updates).length === 0) {
      // Dacă nu există actualizări, doar returnează tray-ul existent
      return await getTray(trayId)
    }
    
    const { data, error } = await supabase
      .from('trays')
      .update(updates)
      .eq('id', trayId)
      .select()
      .single()

    if (error) throw error
    return { data: data as Tray, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function deleteTray(trayId: string): Promise<{ success: boolean; error: any }> {
  try {
    const { error } = await supabase
      .from('trays')
      .delete()
      .eq('id', trayId)

    if (error) throw error
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error }
  }
}

// ==================== TRAY ITEMS ====================

export async function createTrayItem(data: {
  tray_id: string
  department_id?: string | null
  instrument_id?: string | null
  service_id?: string | null
  part_id?: string | null
  technician_id?: string | null
  qty: number
  notes?: string | null
  pipeline?: string | null
  brandSerialGroups?: Array<{ brand: string | null; serialNumbers: string[]; garantie?: boolean }>
}): Promise<{ data: TrayItem | null; error: any }> {
  try {
    console.log('🚀 [createTrayItem] Starting with data:', {
      tray_id: data.tray_id,
      instrument_id: data.instrument_id,
      brandSerialGroups: data.brandSerialGroups
    })
    
    // Creează tray_item-ul (brand/serial_number se salvează în tray_item_brands și tray_item_brand_serials)
    const { data: result, error } = await supabase
      .from('tray_items')
      .insert([{
        tray_id: data.tray_id,
        department_id: data.department_id || null,
        instrument_id: data.instrument_id || null,
        service_id: data.service_id || null,
        part_id: data.part_id || null,
        technician_id: data.technician_id || null,
        qty: data.qty,
        notes: data.notes || null,
        pipeline: data.pipeline || null,
        details: (data as any).details ?? null,
      }])
      .select()
      .single()

    if (error) {
      console.error('❌ [createTrayItem] Error creating tray_item:', error)
      throw error
    }
    
    if (!result) {
      console.error('❌ [createTrayItem] No result returned from tray_items insert')
      return { data: null, error: new Error('Failed to create tray item') }
    }
    
    console.log('✅ [createTrayItem] Tray item created with ID:', result.id)

    // Încearcă să salveze în noile tabele, dacă nu există folosește câmpurile vechi
    console.log('🔍 [createTrayItem] Received brandSerialGroups:', data.brandSerialGroups)
    
    // Salvează brand-urile și serial numbers în noile tabele
    if (data.brandSerialGroups && data.brandSerialGroups.length > 0) {
      console.log('📦 [createTrayItem] Processing', data.brandSerialGroups.length, 'brand groups')
      
      for (const group of data.brandSerialGroups) {
        const brandName = group.brand?.trim()
        if (!brandName) {
          console.warn('⚠️ [createTrayItem] Skipping group without brand name')
          continue
        }
        
        const garantie = group.garantie || false
        const serialNumbers = group.serialNumbers.filter(sn => sn && sn.trim())
        
        console.log('🔍 [createTrayItem] Processing brand:', { brandName, serialNumbers, garantie })
        
        // Creează brand-ul în tray_item_brands
        const { data: brandResult, error: brandError } = await supabase
          .from('tray_item_brands')
          .insert([{
            tray_item_id: result.id,
            brand: brandName,
            garantie: garantie,
          }])
          .select()
          .single()
        
        if (brandError) {
          console.error('❌ [createTrayItem] Error creating brand:', brandError)
          continue
        }
        
        console.log('✅ [createTrayItem] Brand created with ID:', brandResult.id)
        
        // Creează serial numbers pentru acest brand
        if (serialNumbers.length > 0) {
          const serialsToInsert = serialNumbers.map(sn => ({
            brand_id: brandResult.id,
            serial_number: sn.trim(),
          }))
          
          const { error: serialsError } = await supabase
            .from('tray_item_brand_serials')
            .insert(serialsToInsert)
          
          if (serialsError) {
            console.error('❌ [createTrayItem] Error creating serials:', serialsError)
          } else {
            console.log('✅ [createTrayItem] Serial numbers created:', serialNumbers.length)
          }
        }
      }
    } else {
      console.log('ℹ️ [createTrayItem] No brandSerialGroups provided')
    }

    return { data: result as TrayItem, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getTrayItem(trayItemId: string): Promise<{ data: TrayItem | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('tray_items')
      .select('*')
      .eq('id', trayItemId)
      .single()

    if (error) throw error
    return { data: data as TrayItem, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function listTrayItemsForTray(trayId: string): Promise<{ data: TrayItem[]; error: any }> {
  try {
    // Încearcă mai întâi noua structură cu tray_item_brands
    let data: any[] | null = null
    let useNewStructure = true
    
    try {
      const result = await supabase
        .from('tray_items')
        .select(`
          id, 
          tray_id, 
          instrument_id, 
          service_id,
          part_id, 
          department_id, 
          technician_id, 
          qty, 
          notes, 
          pipeline, 
          created_at,
          service:services(id, name, price),
          tray_item_brands(
            id, 
            brand, 
            garantie, 
            created_at,
            tray_item_brand_serials(id, serial_number, created_at)
          )
        `)
        .eq('tray_id', trayId)
        .order('id', { ascending: true })
      
      if (result.error) {
        // Dacă eroarea e legată de tabel inexistent, folosește structura veche
        console.warn('[listTrayItemsForTray] New structure failed, trying old structure:', result.error.message)
        useNewStructure = false
      } else {
        data = result.data
      }
    } catch (e) {
      console.warn('[listTrayItemsForTray] New structure exception, trying old structure')
      useNewStructure = false
    }
    
    // Fallback la structura veche (fără brand tables)
    if (!useNewStructure || !data) {
      const result = await supabase
        .from('tray_items')
        .select(`
          id, 
          tray_id, 
          instrument_id, 
          service_id,
          part_id, 
          department_id, 
          technician_id, 
          qty, 
          notes, 
          pipeline, 
          created_at,
          service:services(id, name, price)
        `)
        .eq('tray_id', trayId)
        .order('id', { ascending: true })
      
      if (result.error) {
        console.error('[listTrayItemsForTray] Error:', result.error)
        throw result.error
      }
      
      data = result.data
      console.log('[listTrayItemsForTray] Using old structure, loaded items:', data?.length)
    } else {
      console.log('📦 [listTrayItemsForTray] Using NEW structure, loaded items:', data?.length)
      
      // Log brands și serials pentru debugging - ÎNTOTDEAUNA
      data?.forEach((item: any, idx: number) => {
        const brands = item.tray_item_brands || []
        console.log(`📦 [listTrayItemsForTray] Item ${idx} (${item.id}):`, {
          instrument_id: item.instrument_id,
          has_tray_item_brands: !!item.tray_item_brands,
          brands_count: brands.length,
          brands: brands.map((b: any) => ({
            id: b.id,
            brand: b.brand,
            garantie: b.garantie,
            serials_count: b.tray_item_brand_serials?.length || 0,
            serials: b.tray_item_brand_serials?.map((s: any) => s.serial_number) || []
          }))
        })
      })
    }
    
    // Verifică dacă RLS blochează join-ul cu services
    const itemsWithServiceIdButNoJoin = data?.filter((i: any) => i.service_id && !i.service) || []
    if (itemsWithServiceIdButNoJoin.length > 0) {
      console.warn('[listTrayItemsForTray] RLS might be blocking service joins. Loading services separately...')
      const serviceIds = itemsWithServiceIdButNoJoin.map((i: any) => i.service_id).filter(Boolean)
      if (serviceIds.length > 0) {
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('id, name, price')
          .in('id', serviceIds)
        
        if (!servicesError && servicesData) {
          const servicesMap = new Map(servicesData.map((s: any) => [s.id, s]))
          data?.forEach((item: any) => {
            if (item.service_id && !item.service && servicesMap.has(item.service_id)) {
              item.service = servicesMap.get(item.service_id)
            }
          })
        }
      }
    }
    
    return { data: (data ?? []) as TrayItem[], error: null }
  } catch (error) {
    console.error('[listTrayItemsForTray] Exception:', error)
    return { data: [], error }
  }
}

export async function updateTrayItem(
  trayItemId: string,
  updates: Partial<Pick<TrayItem, 'department_id' | 'instrument_id' | 'service_id' | 'part_id' | 'technician_id' | 'qty' | 'notes' | 'pipeline'>>
): Promise<{ data: TrayItem | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('tray_items')
      .update(updates)
      .eq('id', trayItemId)
      .select()
      .single()

    if (error) throw error
    return { data: data as TrayItem, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function deleteTrayItem(trayItemId: string): Promise<{ success: boolean; error: any }> {
  try {
    const { error } = await supabase
      .from('tray_items')
      .delete()
      .eq('id', trayItemId)

    if (error) throw error
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error }
  }
}

