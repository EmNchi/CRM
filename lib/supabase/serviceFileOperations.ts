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
  details: string | null // Detalii comandă comunicate de client, specifice pentru această fișă
  office_direct: boolean // Checkbox pentru "Office direct"
  curier_trimis: boolean // Checkbox pentru "Curier Trimis"
  no_deal: boolean       // Checkbox pentru "No Deal" în Vânzări
  urgent: boolean        // Flag urgent pentru toate tăvițele din fișă
  created_at: string
  updated_at: string
}

export type Tray = {
  id: string
  number: string
  size: string
  service_file_id: string
  status: 'in_receptie' | 'in_lucru' | 'gata'
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

/**
 * Creează o nouă fișă de serviciu (service file) asociată cu un lead.
 * O fișă de serviciu reprezintă un document de lucru care conține detalii despre serviciile
 * care trebuie efectuate pentru un client. Poate include status, note și flag-uri pentru
 * "Office direct", "Curier Trimis" și "No Deal".
 * 
 * @param data - Datele fișei de serviciu:
 *   - lead_id: ID-ul lead-ului pentru care se creează fișa
 *   - number: Numărul fișei (ex: "Fisa 1")
 *   - date: Data fișei (format ISO)
 *   - status: Statusul fișei ('noua', 'in_lucru', 'finalizata') - implicit 'noua'
 *   - notes: Note opționale despre fișă
 *   - office_direct: Flag pentru "Office direct" - implicit false
 *   - curier_trimis: Flag pentru "Curier Trimis" - implicit false
 *   - no_deal: Flag pentru "No Deal" în pipeline-ul Vânzări - implicit false
 * @returns Obiect cu data fișei create sau null și eroarea dacă există
 */
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

/**
 * Obține o fișă de serviciu după ID-ul său.
 * Funcția returnează toate detaliile unei fișe de serviciu, inclusiv status, note și flag-uri.
 * 
 * @param serviceFileId - ID-ul unic al fișei de serviciu
 * @returns Obiect cu data fișei sau null dacă nu există, și eroarea dacă există
 */
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

/**
 * Obține următorul număr global pentru o fișă de serviciu.
 * Numărul este global pentru toate fișele din sistem, nu doar pentru un lead specific.
 * 
 * @returns Următorul număr global disponibil
 */
export async function getNextGlobalServiceFileNumber(): Promise<{ data: number | null; error: any }> {
  try {
    // Numără toate fișele existente pentru a obține următorul număr global
    const { count, error } = await supabase
      .from('service_files')
      .select('*', { count: 'exact', head: true })

    if (error) throw error
    const nextNumber = (count ?? 0) + 1
    return { data: nextNumber, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Listează toate fișele de serviciu asociate cu un lead specificat.
 * Fișele sunt returnate în ordine descrescătoare după data creării (cele mai noi primele).
 * Această funcție este folosită pentru a afișa toate fișele unui client în panoul de detalii.
 * 
 * @param leadId - ID-ul lead-ului pentru care se caută fișele
 * @returns Array cu toate fișele de serviciu ale lead-ului sau array gol dacă nu există
 */
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

/**
 * Actualizează o fișă de serviciu existentă.
 * Permite modificarea oricărui câmp al fișei: număr, dată, status, note sau flag-uri.
 * Funcția actualizează automat câmpul updated_at cu data curentă.
 * 
 * @param serviceFileId - ID-ul fișei de serviciu de actualizat
 * @param updates - Obiect parțial cu câmpurile de actualizat:
 *   - number: Numărul fișei
 *   - date: Data fișei
 *   - status: Statusul fișei ('noua', 'in_lucru', 'finalizata')
 *   - notes: Note despre fișă
 *   - office_direct: Flag pentru "Office direct"
 *   - curier_trimis: Flag pentru "Curier Trimis"
 *   - no_deal: Flag pentru "No Deal"
 * @returns Obiect cu data fișei actualizate sau null și eroarea dacă există
 */
export async function updateServiceFile(
  serviceFileId: string,
  updates: Partial<Pick<ServiceFile, 'number' | 'date' | 'status' | 'notes' | 'details' | 'office_direct' | 'curier_trimis' | 'no_deal' | 'urgent'>>
): Promise<{ data: ServiceFile | null; error: any }> {
  try {
    // IMPORTANT: Nu mai citim details dacă nu este în updates pentru a evita erorile 400
    // Supabase va păstra automat valoarea existentă pentru câmpurile care nu sunt incluse în update
    // Doar includem câmpurile care sunt explicit specificate în updates
    // IMPORTANT: Eliminăm câmpurile cu valoare null/undefined pentru a evita erorile Supabase
    const finalUpdates: any = {
      updated_at: new Date().toISOString(),
    }
    
    // Adaugă doar câmpurile care au valori definite (nu null/undefined)
    for (const [key, value] of Object.entries(updates)) {
      if (value !== null && value !== undefined) {
        finalUpdates[key] = value
      }
    }
    
    const { data, error } = await supabase
      .from('service_files')
      .update(finalUpdates)
      .eq('id', serviceFileId)
      .select()
      .single()

    if (error) {
      console.error('[updateServiceFile] Supabase error:', error?.message || 'Unknown error')
      throw error
    }
    
    return { data: data as ServiceFile, error: null }
  } catch (error: any) {
    console.error('[updateServiceFile] Error:', error?.message || 'Unknown error')
    return { data: null, error }
  }
}

/**
 * Șterge o fișă de serviciu din baza de date.
 * ATENȚIE: Ștergerea unei fișe va șterge și toate tăvițele (trays) asociate cu aceasta.
 * Folosiți cu precauție, deoarece operația este ireversibilă.
 * 
 * @param serviceFileId - ID-ul fișei de serviciu de șters
 * @returns Obiect cu success: true dacă ștergerea a reușit, false altfel, și eroarea dacă există
 */
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

/**
 * Creează o nouă tăviță (tray) asociată cu o fișă de serviciu.
 * O tăviță reprezintă un container fizic sau logic care conține item-uri de lucru.
 * Funcția verifică dacă există deja o tăviță cu același număr, mărime și fișă de serviciu,
 * și dacă da, returnează tăvița existentă în loc să creeze una duplicată.
 * 
 * @param data - Datele tăviței:
 *   - number: Numărul tăviței (ex: "Tăbliță 1")
 *   - size: Mărimea tăviței (ex: "M", "L", "XL")
 *   - service_file_id: ID-ul fișei de serviciu căreia îi aparține tăvița
 *   - status: Statusul tăviței ('in_receptie', 'in_lucru', 'gata') - implicit 'in_receptie'
 * @returns Obiect cu data tăviței create sau existente, sau null și eroarea dacă există
 */
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

/**
 * Verifică disponibilitatea unei tăvițe la nivel global.
 * Compară numărul și mărimea introduse de utilizator cu toate tăvițele înregistrate în baza de date.
 * Dacă o tăviță cu același număr și mărime există deja, funcția returnează o eroare.
 * Aceasta asigură că fiecare combinație (număr + mărime) este unică în sistem.
 * 
 * @param trayNumber - Numărul tăviței (ex: "Tăbliță 1")
 * @param traySize - Mărimea tăviței (ex: "M", "L", "XL")
 * @returns Obiect cu available: true dacă tăvița poate fi creată, false dacă există deja,
 *          și existingTray cu datele tăviței existente (dacă aceasta există)
 */
export async function checkTrayAvailability(
  trayNumber: string,
  traySize: string
): Promise<{ available: boolean; existingTray?: Tray; error: any }> {
  try {
    // Caută orice tăviță cu aceeași combinație de număr și mărime (global, nu per service_file)
    const { data, error } = await supabase
      .from('trays')
      .select('*')
      .eq('number', trayNumber.trim())
      .eq('size', traySize.trim())
      .maybeSingle()
    
    if (error) {
      console.error('[checkTrayAvailability] Error checking tray availability:', error)
      throw error
    }
    
    // Dacă nu găsim vreo tăviță cu acest număr și mărime, e disponibilă
    if (!data) {
      return { available: true, error: null }
    }
    
    // Dacă găsim o tăviță existentă, nu e disponibilă
    return { 
      available: false, 
      existingTray: data as Tray,
      error: null 
    }
  } catch (error) {
    return { available: false, error }
  }
}

/**
 * Obține o tăviță după ID-ul său.
 * Returnează toate detaliile unei tăvițe, inclusiv număr, mărime, status și flag-ul urgent.
 * 
 * @param trayId - ID-ul unic al tăviței
 * @returns Obiect cu data tăviței sau null dacă nu există, și eroarea dacă există
 */
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

/**
 * Listează toate tăvițele asociate cu o fișă de serviciu specificată.
 * Tăvițele sunt returnate în ordine crescătoare după data creării (cele mai vechi primele).
 * Această funcție este folosită pentru a afișa toate tăvițele unei fișe în panoul de detalii.
 * 
 * @param serviceFileId - ID-ul fișei de serviciu pentru care se caută tăvițele
 * @returns Array cu toate tăvițele fișei sau array gol dacă nu există
 */
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

/**
 * Actualizează o tăviță existentă.
 * Permite modificarea oricărui câmp al tăviței: număr, mărime, status, flag urgent sau detalii.
 * Dacă nu sunt furnizate actualizări, funcția returnează tăvița existentă fără modificări.
 * 
 * @param trayId - ID-ul tăviței de actualizat
 * @param updates - Obiect parțial cu câmpurile de actualizat:
 *   - number: Numărul tăviței
 *   - size: Mărimea tăviței
 *   - status: Statusul tăviței ('in_receptie', 'in_lucru', 'gata')
 * @returns Obiect cu data tăviței actualizate sau existente, sau null și eroarea dacă există
 */
export async function updateTray(
  trayId: string,
  updates: Partial<Pick<Tray, 'number' | 'size' | 'status'>>
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

/**
 * Șterge o tăviță din baza de date.
 * ATENȚIE: Ștergerea unei tăvițe va șterge și toate item-urile (tray_items) asociate cu aceasta.
 * Folosiți cu precauție, deoarece operația este ireversibilă.
 * 
 * @param trayId - ID-ul tăviței de șters
 * @returns Obiect cu success: true dacă ștergerea a reușit, false altfel, și eroarea dacă există
 */
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

/**
 * Creează un nou item într-o tăviță (tray item).
 * Un tray item reprezintă un serviciu, piese sau instrument care trebuie procesat în cadrul unei tăvițe.
 * Funcția suportă noua structură cu brand-uri și serial numbers, salvând datele în tabelele
 * tray_item_brands și tray_item_brand_serials. Dacă aceste tabele nu există, funcția va funcționa
 * doar cu câmpurile de bază.
 * 
 * @param data - Datele item-ului:
 *   - tray_id: ID-ul tăviței căreia îi aparține item-ul
 *   - department_id: ID-ul departamentului (opțional)
 *   - instrument_id: ID-ul instrumentului (opțional)
 *   - service_id: ID-ul serviciului (opțional)
 *   - part_id: ID-ul piesei (opțional)
 *   - technician_id: ID-ul tehnicianului atribuit (opțional)
 *   - qty: Cantitatea item-ului
 *   - notes: Note JSON cu detalii (preț, discount, urgent, item_type, brand, serial_number)
 *   - pipeline: Pipeline-ul asociat (opțional)
 *   - brandSerialGroups: Array cu grupuri de brand-uri și serial numbers (noua structură)
 * @returns Obiect cu data item-ului creat sau null și eroarea dacă există
 */
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
        
      }])
      .select()
      .single()

    if (error) {
      console.error('[createTrayItem] Error creating tray_item:', error?.message || 'Unknown error')
      throw error
    }
    
    if (!result) {
      console.error('[createTrayItem] No result returned from tray_items insert')
      return { data: null, error: new Error('Failed to create tray item') }
    }

    // Salvează brand-urile și serial numbers în noile tabele
    if (data.brandSerialGroups && data.brandSerialGroups.length > 0) {
      // console.log('[createTrayItem] Saving brandSerialGroups:', JSON.stringify(data.brandSerialGroups, null, 2))
      for (const group of data.brandSerialGroups) {
        const brandName = group.brand?.trim()
        if (!brandName) {
          console.warn('[createTrayItem] Skipping group without brand name')
          continue
        }
        
        const garantie = group.garantie || false
        const safeSerialNumbers = Array.isArray(group.serialNumbers) ? group.serialNumbers : []
        // IMPORTANT: Include toate serial numbers-urile, inclusiv cele goale (pentru a păstra pozițiile ocupate)
        const serialNumbers = safeSerialNumbers.map(sn => sn && sn.trim() ? sn.trim() : '')
        
        // console.log(`[createTrayItem] Creating brand "${brandName}" with ${serialNumbers.length} serial numbers:`, serialNumbers)
        
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
          console.error('[createTrayItem] Error creating brand:', brandError?.message || 'Unknown error')
          continue
        }
        
        // Creează serial numbers pentru acest brand (inclusiv cele goale)
        if (serialNumbers.length > 0) {
          const serialsToInsert = serialNumbers.map(sn => ({
            brand_id: brandResult.id,
            serial_number: sn || '', // Salvează string gol pentru serial numbers goale (nu null)
          }))
          
          // console.log(`[createTrayItem] Inserting ${serialsToInsert.length} serial numbers for brand "${brandName}"`)
          
          const { error: serialsError } = await supabase
            .from('tray_item_brand_serials')
            .insert(serialsToInsert)
          
          if (serialsError) {
            console.error('[createTrayItem] Error creating serials:', serialsError?.message || 'Unknown error')
          } else {
            // console.log(`[createTrayItem] Successfully created ${serialsToInsert.length} serial numbers for brand "${brandName}"`)
          }
        }
      }
    }

    return { data: result as TrayItem, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Obține un item de tăviță după ID-ul său.
 * Returnează toate detaliile unui item, inclusiv relațiile cu servicii, brand-uri și serial numbers.
 * 
 * @param trayItemId - ID-ul unic al item-ului de tăviță
 * @returns Obiect cu data item-ului sau null dacă nu există, și eroarea dacă există
 */
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

/**
 * Listează toate item-urile dintr-o tăviță specificată.
 * Funcția încearcă să folosească noua structură cu tray_item_brands și tray_item_brand_serials.
 * Dacă aceste tabele nu există sau apar erori, funcția face fallback la structura veche.
 * Item-urile sunt returnate în ordine crescătoare după ID (ordinea creării).
 * Funcția gestionează și cazurile în care RLS (Row Level Security) blochează join-urile cu services,
 * încărcând serviciile separat dacă este necesar.
 * 
 * @param trayId - ID-ul tăviței pentru care se caută item-urile
 * @returns Array cu toate item-urile tăviței sau array gol dacă nu există
 */
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
        console.error('[listTrayItemsForTray] Error:', result.error?.message || 'Unknown error')
        throw result.error
      }
      
      data = result.data
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
  } catch (error: any) {
    console.error('[listTrayItemsForTray] Exception:', error?.message || 'Unknown error')
    return { data: [], error }
  }
}

/**
 * Actualizează un item de tăviță existent.
 * Permite modificarea oricărui câmp al item-ului: departament, instrument, serviciu, piesă,
 * tehnician, cantitate, note sau pipeline. Note-urile pot conține JSON cu detalii suplimentare
 * (preț, discount, urgent, item_type, brand, serial_number).
 * 
 * @param trayItemId - ID-ul item-ului de actualizat
 * @param updates - Obiect parțial cu câmpurile de actualizat:
 *   - department_id: ID-ul departamentului
 *   - instrument_id: ID-ul instrumentului
 *   - service_id: ID-ul serviciului
 *   - part_id: ID-ul piesei
 *   - technician_id: ID-ul tehnicianului
 *   - qty: Cantitatea item-ului
 *   - notes: Note JSON cu detalii
 *   - pipeline: Pipeline-ul asociat
 * @returns Obiect cu data item-ului actualizat sau null și eroarea dacă există
 */
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

/**
 * Șterge un item de tăviță din baza de date.
 * ATENȚIE: Ștergerea unui item este ireversibilă și va șterge și toate brand-urile și
 * serial numbers asociate (dacă există noua structură).
 * 
 * @param trayItemId - ID-ul item-ului de șters
 * @returns Obiect cu success: true dacă ștergerea a reușit, false altfel, și eroarea dacă există
 */
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

