import { supabaseBrowser } from './supabaseClient'

export interface TraySearchResult {
  trayId: string
  trayNumber: string
  traySize: string
  leadName: string
  leadPhone?: string
  leadEmail?: string
  serviceFileNumber: string
  serviceFileId: string
  matchType: 'tray_number' | 'serial_number' | 'brand'
  matchDetails?: string
  serialNumbers?: string[]
  brands?: string[]
}

/**
 * Caută tăvițe global după:
 * - Numărul tăviței
 * - Serial numbers
 * - Brand-uri
 * 
 * @param query - Textul de căutat
 * @returns Array cu rezultatele căutării
 */
export async function searchTraysGlobally(query: string): Promise<{ data: TraySearchResult[]; error: any }> {
  try {
    if (!query || query.trim().length < 2) {
      return { data: [], error: null }
    }

    const supabase = supabaseBrowser()
    const searchTerm = query.toLowerCase().trim()

    // 1. Caută după numărul tăviței
    const { data: traysByNumber } = await supabase
      .from('trays')
      .select(`
        id,
        number,
        size,
        service_file_id,
        service_file:service_files!inner(
          id,
          number,
          lead_id,
          lead:leads!inner(id, full_name, email, phone_number)
        )
      `)
      .ilike('number', `%${searchTerm}%`)

    // 2. Caută după serial numbers și brand-uri
    const { data: trayItemBrands } = await supabase
      .from('tray_item_brands')
      .select(`
        id,
        brand,
        tray_item:tray_items!inner(
          id,
          tray_id,
          tray:trays!inner(
            id,
            number,
            size,
            service_file_id,
            service_file:service_files!inner(
              id,
              number,
              lead_id,
              lead:leads!inner(id, full_name, email, phone_number)
            )
          )
        ),
        tray_item_brand_serials(serial_number)
      `)
      .ilike('brand', `%${searchTerm}%`)

    // 3. Caută după serial numbers
    const { data: serialNumbers } = await supabase
      .from('tray_item_brand_serials')
      .select(`
        serial_number,
        brand:tray_item_brands!inner(
          brand,
          tray_item:tray_items!inner(
            id,
            tray_id,
            tray:trays!inner(
              id,
              number,
              size,
              service_file_id,
              service_file:service_files!inner(
                id,
                number,
                lead_id,
                lead:leads!inner(id, full_name, email, phone_number)
              )
            )
          )
        )
      `)
      .ilike('serial_number', `%${searchTerm}%`)

    // Consolidează rezultatele
    const resultsMap = new Map<string, TraySearchResult>()

    // Adaugă rezultate din căutarea după numărul tăviței
    (traysByNumber as any[])?.forEach((tray: any) => {
      if (tray?.service_file?.lead) {
        const key = tray.id
        resultsMap.set(key, {
          trayId: tray.id,
          trayNumber: tray.number,
          traySize: tray.size,
          leadName: tray.service_file.lead.full_name || 'Unknown',
          leadPhone: tray.service_file.lead.phone_number,
          leadEmail: tray.service_file.lead.email,
          serviceFileNumber: tray.service_file.number,
          serviceFileId: tray.service_file.id,
          matchType: 'tray_number',
          matchDetails: `Tăviță: ${tray.number}`,
        })
      }
    })

    // Adaugă rezultate din căutarea după brand
    (trayItemBrands as any[])?.forEach((brand: any) => {
      const tray = brand?.tray_item?.[0]?.tray?.[0]
      if (tray?.service_file?.lead) {
        const key = tray.id
        if (!resultsMap.has(key)) {
          resultsMap.set(key, {
            trayId: tray.id,
            trayNumber: tray.number,
            traySize: tray.size,
            leadName: tray.service_file.lead.full_name || 'Unknown',
            leadPhone: tray.service_file.lead.phone_number,
            leadEmail: tray.service_file.lead.email,
            serviceFileNumber: tray.service_file.number,
            serviceFileId: tray.service_file.id,
            matchType: 'brand',
            matchDetails: `Brand: ${brand.brand}`,
            brands: [brand.brand],
          })
        } else {
          const existing = resultsMap.get(key)!
          if (!existing.brands) existing.brands = []
          if (!existing.brands.includes(brand.brand)) {
            existing.brands.push(brand.brand)
          }
        }
      }
    })

    // Adaugă rezultate din căutarea după serial number
    (serialNumbers as any[])?.forEach((sn: any) => {
      const tray = sn?.brand?.[0]?.tray_item?.[0]?.tray?.[0]
      if (tray?.service_file?.lead) {
        const key = tray.id
        if (!resultsMap.has(key)) {
          resultsMap.set(key, {
            trayId: tray.id,
            trayNumber: tray.number,
            traySize: tray.size,
            leadName: tray.service_file.lead.full_name || 'Unknown',
            leadPhone: tray.service_file.lead.phone_number,
            leadEmail: tray.service_file.lead.email,
            serviceFileNumber: tray.service_file.number,
            serviceFileId: tray.service_file.id,
            matchType: 'serial_number',
            matchDetails: `Serial: ${sn.serial_number}`,
            serialNumbers: [sn.serial_number],
          })
        } else {
          const existing = resultsMap.get(key)!
          if (!existing.serialNumbers) existing.serialNumbers = []
          if (!existing.serialNumbers.includes(sn.serial_number)) {
            existing.serialNumbers.push(sn.serial_number)
          }
        }
      }
    })

    return { data: Array.from(resultsMap.values()), error: null }
  } catch (error: any) {
    console.error('[searchTraysGlobally] Error:', error)
    return { data: [], error }
  }
}

