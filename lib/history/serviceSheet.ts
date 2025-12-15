// lib/history/serviceSheet.ts
import { logLeadEvent, logItemEvent } from "@/lib/supabase/leadOperations"
import {
  createTrayItem,
  updateTrayItem,
  deleteTrayItem,
  listTrayItemsForTray,
  getTrayItem,
  type TrayItem
} from "@/lib/supabase/serviceFileOperations"
import type { Service } from "@/lib/supabase/serviceOperations"
import { supabaseBrowser } from "@/lib/supabase/supabaseClient"

/**
 * Obține user_id pentru utilizatorul curent (folosit ca technician_id)
 * Folosește user_id din app_members
 */
async function getCurrentUserTechnicianId(): Promise<string | null> {
  try {
    const supabase = supabaseBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user?.id) return null
    
    // Returnează user_id direct (va fi folosit ca technician_id)
    return user.id
  } catch (error) {
    console.error('Eroare la obținerea user_id pentru utilizatorul curent:', error)
    return null
  }
}

// Tip pentru transformarea datelor
type LeadQuoteItem = any

type SnapshotItem = {
  id: string
  name: string
  qty: number
  price: number
  type: string | null
  urgent: boolean
  department?: string | null
  technician_id?: string | null // Changed from technician (text) to technician_id (UUID)
  pipeline_id?: string | null // FK către pipelines
  brand?: string | null
  serial_number?: string | null
  garantie?: boolean
}

type Totals = {
  subtotal: number
  totalDiscount: number
  urgentAmount: number
  total: number
}

const isLocalId = (id: string | number) => String(id).startsWith("local_")

const toSnap = (i: any): SnapshotItem => ({
  id: String(i.id ?? `${i.name_snapshot}:${i.item_type}`),
  name: i.name_snapshot,
  qty: Number(i.qty ?? 1),
  price: Number(i.price ?? 0),
  type: i.item_type ?? null, // Păstrăm null pentru items cu doar instrument
  urgent: !!i.urgent,
  department: i.department ?? null,
  technician_id: i.technician_id ?? null,
  pipeline_id: i.pipeline_id ?? null,
  brand: i.brand ?? null,
  serial_number: i.serial_number ?? null,
  garantie: !!i.garantie,
})

function toMap(arr: SnapshotItem[]) {
  return Object.fromEntries(arr.map(x => [String(x.id), x]))
}

function diffSnapshots(prev: SnapshotItem[], next: SnapshotItem[]) {
  const pm = toMap(prev)
  const nm = toMap(next)
  const added = next.filter(x => !pm[x.id])
  const removed = prev.filter(x => !nm[x.id])
  const updated = next.filter(x => {
    const p = pm[x.id]
    return p && (p.qty !== x.qty || p.price !== x.price || p.urgent !== x.urgent || p.department !== x.department || p.technician_id !== x.technician_id || p.pipeline_id !== x.pipeline_id || p.name !== x.name || p.type !== x.type || p.brand !== x.brand || p.serial_number !== x.serial_number || p.garantie !== x.garantie)
  })
  return { added, removed, updated, prevMap: pm }
}

function composeMessage(next: SnapshotItem[], d: ReturnType<typeof diffSnapshots>, totals: Totals) {
  const servicesCount = next.filter(i => i.type === "service").length
  const partsCount = next.length - servicesCount
  const urgentCount = next.filter(i => i.urgent).length

  const chunks: string[] = []
  if (d.added.length)   chunks.push(`adăugate: ${d.added.slice(0,3).map(x=>x.name).join(", ")}${d.added.length>3?"…":""}`)
  if (d.removed.length) chunks.push(`șterse: ${d.removed.slice(0,3).map(x=>x.name).join(", ")}${d.removed.length>3?"…":""}`)
  if (d.updated.length) chunks.push(`actualizate: ${d.updated.slice(0,3).map(x=>x.name).join(", ")}${d.updated.length>3?"…":""}`)

  const headline = chunks.length ? `Fișa de serviciu salvată (${chunks.join(" · ")})` : "Fișa de serviciu salvată"
  const message =
    `${headline}. ` +
    `servicii=${servicesCount}, piese=${partsCount}, linii_urgente=${urgentCount}, total=${totals.total.toFixed(2)} RON.`

  const payload = (diff: ReturnType<typeof diffSnapshots>) => ({
    totals: {
      subtotal: totals.subtotal,
      total_discount: totals.totalDiscount,
      urgent_amount: totals.urgentAmount,
      total: totals.total,
    },
    counts: { services: servicesCount, parts: partsCount, urgent_lines: urgentCount },
    diff: {
      added: diff.added.map(x => ({
        id: x.id, name: x.name, type: x.type,
        department: x.department ?? null, technician_id: x.technician_id ?? null,
      })),
      removed: diff.removed.map(x => ({
        id: x.id, name: x.name, type: x.type,
        department: x.department ?? null, technician_id: x.technician_id ?? null,
      })),
      updated: diff.updated.map(x => ({
        id: x.id, name: x.name, type: x.type,
        department: x.department ?? null, technician_id: x.technician_id ?? null,
      })),
    },
  })

  return { message, payload: payload }
}

export async function persistAndLogServiceSheet(params: {
  leadId: string
  quoteId: string
  items: LeadQuoteItem[]
  services: Service[]           // for mapping service name → service def when adding new rows
  instruments?: Array<{ id: string; name: string; department_id: string | null }> // Instrumente pentru a obține department_id
  totals: Totals
  prevSnapshot: SnapshotItem[]  // what DB had on last save/load (use toSnap on DB items)
  pipelinesWithIds?: Array<{ id: string; name: string }> // Pipeline-uri cu ID-uri pentru a seta automat "Reparatii" pentru piese
}) {
  const { leadId, quoteId, items, services, instruments = [], totals, prevSnapshot, pipelinesWithIds = [] } = params
  
  console.log('🔧 persistAndLogServiceSheet - START:', {
    leadId,
    quoteId,
    itemsCount: items.length,
    servicesCount: services.length,
    instrumentsCount: instruments.length,
    prevSnapshotCount: prevSnapshot.length,
    items: items.map(it => ({ id: it.id, type: it.item_type, name: it.name_snapshot }))
  })
  
  // Obține ID-ul pipeline-ului "Reparatii" pentru piese
  const reparatiiPipeline = pipelinesWithIds.find(p => p.name === 'Reparatii')
  const reparatiiPipelineId = reparatiiPipeline?.id || null

  // === 1) APPLY CHANGES TO DB (delete, update, add) ===

  // Obține technician_id pentru utilizatorul curent (pentru atribuire automată)
  const currentUserTechnicianId = await getCurrentUserTechnicianId()
  console.log('🔧 Current user technician_id:', currentUserTechnicianId)

  // Deletes: anything that existed before (real DB id) but not anymore in current items
  const currentDbIds = new Set(items.filter(it => !isLocalId(it.id)).map(it => String(it.id)))
  for (const prev of prevSnapshot) {
    const wasDbId = !isLocalId(prev.id)
    if (wasDbId && !currentDbIds.has(String(prev.id))) {
      const { success, error } = await deleteTrayItem(String(prev.id))
      if (!success || error) {
        console.error('Error deleting tray item:', error)
        throw error || new Error('Failed to delete tray item')
      }
    }
  }

  // Updates: rows that still exist and changed
  const beforeMap = new Map(prevSnapshot.map(b => [String(b.id), b]))
  for (const it of items) {
    if (isLocalId(it.id)) continue
    const prev = beforeMap.get(String(it.id))
    if (!prev) continue

    const patch: any = {}
    
    // Verifică dacă item_type s-a schimbat (de exemplu, de la null la 'service')
    const currentItemType = it.item_type ?? null
    const prevItemType = prev.type ?? null
    if (currentItemType !== prevItemType) {
      patch.item_type = currentItemType
      // Dacă item_type s-a schimbat la 'service', actualizează și service_id, name_snapshot, pipeline_id și technician_id
      if (currentItemType === 'service' && it.service_id) {
        patch.service_id = it.service_id
        patch.name_snapshot = it.name_snapshot
        // Include pipeline_id și technician_id când se transformă de la null la 'service'
        // Include chiar dacă sunt null pentru a le seta corect
        patch.pipeline_id = it.pipeline_id && String(it.pipeline_id).trim() ? String(it.pipeline_id).trim() : null
        patch.technician_id = it.technician_id && String(it.technician_id).trim() ? String(it.technician_id).trim() : null
      }
    }
    
    if (Number(it.qty) !== Number(prev.qty)) patch.qty = Number(it.qty)
    if (Number(it.price) !== Number(prev.price)) patch.price = Number(it.price)
    if (Number(it.discount_pct) !== Number((it as any).discount_pct ?? 0)) patch.discount_pct = Number(it.discount_pct ?? 0)
    if (Boolean(it.urgent) !== Boolean(prev.urgent)) patch.urgent = !!it.urgent
    // Department nu mai există - folosim pipeline_id pentru departament
    const currentTechnicianId = it.technician_id && String(it.technician_id).trim() ? String(it.technician_id).trim() : null
    const prevTechnicianId = prev.technician_id && String(prev.technician_id).trim() ? String(prev.technician_id).trim() : null
    if (currentTechnicianId !== prevTechnicianId) patch.technician_id = currentTechnicianId
    
    const currentPipelineId = it.pipeline_id && String(it.pipeline_id).trim() ? String(it.pipeline_id).trim() : null
    const prevPipelineId = (prev as any).pipeline_id && String((prev as any).pipeline_id).trim() ? String((prev as any).pipeline_id).trim() : null
    if (currentPipelineId !== prevPipelineId) patch.pipeline_id = currentPipelineId
    
    // Actualizează name_snapshot dacă s-a schimbat (pentru cazul când item_type se schimbă de la null la 'service')
    const currentName = String(it.name_snapshot ?? "").trim()
    const prevName = String(prev.name ?? "").trim()
    if (currentName !== prevName && currentName !== "") {
      patch.name_snapshot = currentName
    }
    
    // Brand, Serial Number and Garantie
    const currentBrand = it.brand && String(it.brand).trim() ? String(it.brand).trim() : null
    const prevBrand = prev.brand && String(prev.brand).trim() ? String(prev.brand).trim() : null
    if (currentBrand !== prevBrand) patch.brand = currentBrand
    
    const currentSerialNumber = it.serial_number && String(it.serial_number).trim() ? String(it.serial_number).trim() : null
    const prevSerialNumber = prev.serial_number && String(prev.serial_number).trim() ? String(prev.serial_number).trim() : null
    if (currentSerialNumber !== prevSerialNumber) patch.serial_number = currentSerialNumber
    
    const currentGarantie = !!it.garantie
    const prevGarantie = !!prev.garantie
    if (currentGarantie !== prevGarantie) patch.garantie = currentGarantie
    
    // For parts, name can be edited:
    if (it.item_type === "part") {
      const currentName = String(it.name_snapshot ?? "").trim()
      const prevName = String(prev.name ?? "").trim()
      if (currentName !== prevName && currentName !== "") {
        patch.name_snapshot = currentName
      }
    }

    if (Object.keys(patch).length) {
      // Obține item-ul actual din DB pentru a păstra notes existente
      const { data: existingItem } = await getTrayItem(String(it.id))
      
      // Parsează notes existente sau inițializează un obiect gol
      let notesData: any = {}
      if (existingItem?.notes) {
        try {
          notesData = JSON.parse(existingItem.notes)
        } catch (e) {
          // Notes nu este JSON, ignoră
        }
      }
      
      // Dacă nu există notes și item-ul actual are informații, păstrează-le
      if (!existingItem?.notes && it.item_type) {
        notesData.item_type = it.item_type
        if (it.name_snapshot) notesData.name_snapshot = it.name_snapshot
        if (it.price !== undefined) notesData.price = it.price
        if (it.discount_pct !== undefined) notesData.discount_pct = it.discount_pct
        if (it.urgent !== undefined) notesData.urgent = it.urgent
        if (it.brand) notesData.brand = it.brand
        if (it.serial_number) notesData.serial_number = it.serial_number
        if (it.garantie !== undefined) notesData.garantie = it.garantie
        if (it.pipeline_id) notesData.pipeline_id = it.pipeline_id
      }
      
      // Transformă patch-ul în format TrayItem
      const trayItemPatch: any = {}
      if (patch.qty !== undefined) trayItemPatch.qty = patch.qty
      if (patch.service_id !== undefined) {
        trayItemPatch.service_id = patch.service_id
        // Când se schimbă service_id, actualizează și instrument_id și department_id
        if (patch.service_id) {
          const svcDef = services.find(s => s.id === patch.service_id)
          if (svcDef?.instrument_id) {
            trayItemPatch.instrument_id = svcDef.instrument_id
            const instrument = instruments.find(inst => inst.id === svcDef.instrument_id)
            if (instrument?.department_id) {
              trayItemPatch.department_id = instrument.department_id
            }
          }
        }
      }
      if (patch.technician_id !== undefined) {
        // Dacă technician_id este setat, folosește-l; altfel folosește cel din utilizatorul curent
        trayItemPatch.technician_id = patch.technician_id || currentUserTechnicianId
        
        // Loghează atribuirea tehnicianului
        try {
          const supabase = (await import("@/lib/supabase/supabaseClient")).supabaseBrowser()
          // technician_id este acum user_id din app_members
          const { data: member } = await supabase
            .from('app_members')
            .select('*')
            .eq('user_id', patch.technician_id)
            .single()
          
          // Obține numele din app_members sau din auth.users
          let technicianName = 'tehnician necunoscut'
          if (member) {
            // Verifică dacă există câmpul 'name' în app_members sau folosește user_id pentru a obține din auth
            technicianName = (member as any)?.name || (member as any)?.Name || 'tehnician necunoscut'
          }
          const itemName = it.name_snapshot || it.service_id || 'item'
          
          // Obține tray_id pentru a loga la nivel de tăviță
          const { data: trayItem } = await getTrayItem(String(it.id))
          if (trayItem?.tray_id) {
            await logItemEvent(
              'tray',
              trayItem.tray_id,
              `Tehnician "${technicianName}" atribuit pentru "${itemName}"`,
              'technician_assigned',
              {
                item_id: it.id,
                item_name: itemName,
                technician_id: patch.technician_id,
                technician_name: technicianName,
                item_type: it.item_type || null
              }
            )
          }
        } catch (logError) {
          console.error('Eroare la logarea atribuirii tehnicianului:', logError)
          // Nu aruncă eroarea, doar loghează - să nu blocheze salvarea
        }
      }
      
      // Setează pipeline (numele pipeline-ului) direct în tray_items, nu în notes
      if (patch.pipeline_id !== undefined) {
        // Transformă pipeline_id (UUID) în numele pipeline-ului
        const pipeline = pipelinesWithIds.find(p => p.id === patch.pipeline_id)
        if (pipeline) {
          trayItemPatch.pipeline = pipeline.name
        }
      }
      
      // Salvează informații suplimentare în notes ca JSON (fără pipeline_id)
      if (patch.price !== undefined) notesData.price = patch.price
      if (patch.discount_pct !== undefined) notesData.discount_pct = patch.discount_pct
      if (patch.urgent !== undefined) notesData.urgent = patch.urgent
      if (patch.name_snapshot !== undefined) notesData.name_snapshot = patch.name_snapshot
      if (patch.brand !== undefined) notesData.brand = patch.brand
      if (patch.serial_number !== undefined) notesData.serial_number = patch.serial_number
      if (patch.garantie !== undefined) notesData.garantie = patch.garantie
      if (patch.item_type !== undefined) notesData.item_type = patch.item_type
      // Nu mai salvăm pipeline_id în notes
      
      // Actualizează notes cu toate informațiile
      trayItemPatch.notes = JSON.stringify(notesData)
      
      const { error } = await updateTrayItem(String(it.id), trayItemPatch)
      if (error) {
        console.error('Error updating tray item:', error)
        throw error
      }
    }
  }

  // Adds: local rows (id starts with local_)
  for (const it of items) {
    if (!isLocalId(it.id)) continue

    if (it.item_type === "service") {
      // match by service_id first, then fallback to name
      const svcDef = it.service_id && String(it.service_id).trim()
        ? services.find(s => s.id === String(it.service_id).trim())
        : services.find(s => s.name === it.name_snapshot)
      if (!svcDef || !svcDef.id || !svcDef.id.trim()) {
        console.warn('Serviciu negăsit sau fără ID valid:', it)
        continue
      }
      if (!svcDef.name || !svcDef.name.trim()) {
        console.warn('Serviciu fără nume valid:', svcDef)
        continue
      }
      // Setează technician_id: dacă este setat manual, folosește-l; altfel folosește cel din utilizatorul curent
      const technicianId = it.technician_id && String(it.technician_id).trim() 
        ? String(it.technician_id).trim() 
        : currentUserTechnicianId
      
      const serviceItemOpts = {
        qty: Number(it.qty ?? 1),
        discount_pct: Number(it.discount_pct ?? 0),
        urgent: !!it.urgent,
        technician_id: technicianId,
        pipeline_id: it.pipeline_id && String(it.pipeline_id).trim() ? String(it.pipeline_id).trim() : null,
        brand: it.brand && String(it.brand).trim() ? String(it.brand).trim() : null,
        serial_number: it.serial_number && String(it.serial_number).trim() ? String(it.serial_number).trim() : null,
        garantie: !!it.garantie,
      }
      console.log('Adding service item with opts:', serviceItemOpts, 'from item:', it);
      // Creează TrayItem pentru serviciu
      // Obține instrument_id și department_id - prioritate: din item -> serviciu -> instrument
      let departmentId: string | null = null
      let instrumentId: string | null = null
      
      // 1. Verifică dacă item-ul are deja instrument_id și department_id (din UI)
      if ((it as any).instrument_id) {
        instrumentId = (it as any).instrument_id
      }
      if ((it as any).department_id) {
        departmentId = (it as any).department_id
      }
      
      // 2. Dacă nu avem din item, verifică serviciul
      if (!departmentId && svcDef.department_id) {
        departmentId = svcDef.department_id
      }
      
      // 3. Dacă serviciul are instrument_id și nu avem încă instrumentId
      if (!instrumentId && svcDef.instrument_id) {
        instrumentId = svcDef.instrument_id
      }
      
      // 4. Dacă avem instrumentId dar nu departmentId, obține din instrument
      if (instrumentId && !departmentId) {
        const instrument = instruments.find(inst => inst.id === instrumentId)
        if (instrument?.department_id) {
          departmentId = instrument.department_id
        }
      }
      
      console.log('Service department lookup:', {
        serviceName: svcDef.name,
        itemInstrumentId: (it as any).instrument_id,
        itemDeptId: (it as any).department_id,
        serviceDeptId: svcDef.department_id,
        finalInstrumentId: instrumentId,
        finalDeptId: departmentId,
        instrumentsCount: instruments.length
      })
      
      // Salvează informații suplimentare în notes ca JSON (fără pipeline_id)
      const notesData = {
        name_snapshot: svcDef.name,
        price: svcDef.price || 0,
        discount_pct: serviceItemOpts.discount_pct,
        urgent: serviceItemOpts.urgent,
        brand: serviceItemOpts.brand,
        serial_number: serviceItemOpts.serial_number,
        garantie: serviceItemOpts.garantie,
        item_type: 'service',
      }
      
      // Transformă pipeline_id în numele pipeline-ului
      let pipelineName: string | null = null
      if (serviceItemOpts.pipeline_id) {
        const pipeline = pipelinesWithIds.find(p => p.id === serviceItemOpts.pipeline_id)
        if (pipeline) {
          pipelineName = pipeline.name
        }
      }
      
      if (!departmentId) {
        console.error('Department_id missing for service:', svcDef)
        throw new Error(`Department_id lipsă pentru serviciul "${svcDef.name}". Verifică dacă serviciul sau instrumentul are department_id setat în baza de date.`)
      }
      
      const { data: createdServiceItem, error } = await createTrayItem({
        tray_id: quoteId,
        service_id: svcDef.id,
        instrument_id: instrumentId,
        department_id: departmentId,
        technician_id: serviceItemOpts.technician_id,
        qty: serviceItemOpts.qty,
        notes: JSON.stringify(notesData),
        pipeline: pipelineName,
      })
      if (error) {
        console.error('Error creating service tray item:', error)
        throw error
      }
      
      // Loghează atribuirea tehnicianului pentru itemul nou creat
      if (serviceItemOpts.technician_id) {
        try {
          const supabase = (await import("@/lib/supabase/supabaseClient")).supabaseBrowser()
          // technician_id este acum user_id din app_members
          const { data: member } = await supabase
            .from('app_members')
            .select('*')
            .eq('user_id', serviceItemOpts.technician_id)
            .single()
          
          // Obține numele din app_members sau din auth.users
          let technicianName = 'tehnician necunoscut'
          if (member) {
            technicianName = (member as any)?.name || (member as any)?.Name || 'tehnician necunoscut'
          }
          await logItemEvent(
            'tray',
            quoteId,
            `Tehnician "${technicianName}" atribuit pentru "${svcDef.name}"`,
            'technician_assigned',
            {
              item_id: createdServiceItem?.id || null,
              item_name: svcDef.name,
              technician_id: serviceItemOpts.technician_id,
              technician_name: technicianName,
              item_type: 'service'
            }
          )
        } catch (logError) {
          console.error('Eroare la logarea atribuirii tehnicianului:', logError)
          // Nu aruncă eroarea, doar loghează
        }
      }
    } else if (it.item_type === null && (it as any).instrument_id) {
      // Item doar cu instrument (item_type: null) - datele instrumentului sunt deja salvate
      // Acest caz este gestionat de addInstrumentItem care creează direct în DB
      // Verificăm dacă are instrument_id și department_id din item
      const instrumentId = (it as any).instrument_id
      const departmentId = (it as any).department_id
      
      if (!instrumentId || !departmentId) {
        // Încearcă să obțină din lista de instrumente
        const instrument = instruments.find(inst => inst.id === instrumentId)
        const finalDeptId = departmentId || instrument?.department_id
        
        if (!finalDeptId) {
          console.error('Department_id missing for instrument item:', it)
          throw new Error(`Department_id lipsă pentru instrument. Verifică dacă instrumentul are department_id setat.`)
        }
        
        const notesData = {
          name_snapshot: it.name_snapshot,
          item_type: null,
          brand: it.brand || null,
          serial_number: it.serial_number || null,
          garantie: it.garantie || false,
        }
        
        // Transformă pipeline_id în numele pipeline-ului
        let pipelineNameForInstrument: string | null = null
        if ((it as any).pipeline_id) {
          const pipeline = pipelinesWithIds.find(p => p.id === (it as any).pipeline_id)
          if (pipeline) {
            pipelineNameForInstrument = pipeline.name
          }
        }
        
        const technicianIdForInstrument = it.technician_id || currentUserTechnicianId
        const { data: createdInstrumentItem, error } = await createTrayItem({
          tray_id: quoteId,
          instrument_id: instrumentId,
          department_id: finalDeptId,
          service_id: null,
          technician_id: technicianIdForInstrument,
          qty: Number(it.qty ?? 1),
          notes: JSON.stringify(notesData),
          pipeline: pipelineNameForInstrument,
        })
        if (error) {
          console.error('Error creating instrument tray item:', error)
          throw error
        }
        
        // Loghează atribuirea tehnicianului pentru itemul cu instrument nou creat
        if (technicianIdForInstrument) {
          try {
            const supabase = (await import("@/lib/supabase/supabaseClient")).supabaseBrowser()
            // technician_id este acum user_id din app_members
            const { data: member } = await supabase
              .from('app_members')
              .select('*')
              .eq('user_id', technicianIdForInstrument)
              .single()
            
            // Obține numele din app_members sau din auth.users
            let technicianName = 'tehnician necunoscut'
            if (member) {
              technicianName = (member as any)?.name || (member as any)?.Name || 'tehnician necunoscut'
            }
            const instrumentName = it.name_snapshot || 'instrument'
            await logItemEvent(
              'tray',
              quoteId,
              `Tehnician "${technicianName}" atribuit pentru "${instrumentName}"`,
              'technician_assigned',
              {
                item_id: createdInstrumentItem?.id || null,
                item_name: instrumentName,
                technician_id: technicianIdForInstrument,
                technician_name: technicianName,
                item_type: null
              }
            )
          } catch (logError) {
            console.error('Eroare la logarea atribuirii tehnicianului:', logError)
            // Nu aruncă eroarea, doar loghează
          }
        }
    } else {
        // Item-ul are deja toate informațiile necesare
        const notesData = {
          name_snapshot: it.name_snapshot,
          item_type: null,
          brand: it.brand || null,
          serial_number: it.serial_number || null,
          garantie: it.garantie || false,
        }
        
        // Transformă pipeline_id în numele pipeline-ului
        let pipelineNameForInstrumentAlt: string | null = null
        if ((it as any).pipeline_id) {
          const pipeline = pipelinesWithIds.find(p => p.id === (it as any).pipeline_id)
          if (pipeline) {
            pipelineNameForInstrumentAlt = pipeline.name
          }
        }
        
        const { error } = await createTrayItem({
          tray_id: quoteId,
          instrument_id: instrumentId,
          department_id: departmentId,
          service_id: null,
          technician_id: it.technician_id || currentUserTechnicianId,
          qty: Number(it.qty ?? 1),
          notes: JSON.stringify(notesData),
          pipeline: pipelineNameForInstrumentAlt,
        })
        if (error) {
          console.error('Error creating instrument tray item:', error)
          throw error
        }
      }
    } else if (it.item_type === 'part') {
      // part
      const partName = String(it.name_snapshot ?? '').trim()
      if (!partName) {
        console.warn('Piesă fără nume valid:', it)
        continue
      }
      
      // Pentru piese, obține instrument_id și department_id din item (setat din UI)
      let departmentId: string | null = (it as any).department_id || null
      let instrumentId: string | null = (it as any).instrument_id || null
      
      // Dacă nu avem din item, încearcă din alte surse (fallback)
      if (!departmentId || !instrumentId) {
        // Caută în alte items din tavă (locale)
        const otherServiceItem = items.find(other => other.item_type === 'service' && (other as any).instrument_id)
        if (otherServiceItem) {
          if (!instrumentId && (otherServiceItem as any).instrument_id) {
            instrumentId = (otherServiceItem as any).instrument_id
          }
          if (!departmentId && (otherServiceItem as any).department_id) {
            departmentId = (otherServiceItem as any).department_id
          }
        }
      }
      
      // Dacă încă nu avem, verifică items-urile existente din DB
      if (!departmentId || !instrumentId) {
        const { data: existingItems } = await listTrayItemsForTray(quoteId)
        const existingItem = existingItems?.find((ti: TrayItem) => ti.department_id && ti.instrument_id)
        if (existingItem) {
          if (!departmentId) departmentId = existingItem.department_id
          if (!instrumentId) instrumentId = existingItem.instrument_id
        }
      }
      
      console.log('Part department lookup:', {
        partName,
        itemDeptId: (it as any).department_id,
        itemInstrumentId: (it as any).instrument_id,
        finalDeptId: departmentId,
        finalInstrumentId: instrumentId
      })
      
      if (!departmentId || !instrumentId) {
        throw new Error(`Department_id sau instrument_id lipsă pentru piesa "${partName}". Te rog selectează un instrument înainte de a adăuga piese.`)
      }
      
      const pipelineId = it.pipeline_id && String(it.pipeline_id).trim() ? String(it.pipeline_id).trim() : reparatiiPipelineId
      
      // Transformă pipeline_id în numele pipeline-ului
      let pipelineNameForPart: string | null = null
      if (pipelineId) {
        const pipeline = pipelinesWithIds.find(p => p.id === pipelineId)
        if (pipeline) {
          pipelineNameForPart = pipeline.name
        }
      }
      
      const technicianIdForPart = it.technician_id && String(it.technician_id).trim() 
        ? String(it.technician_id).trim() 
        : currentUserTechnicianId
      const { data: createdPartItem, error } = await createTrayItem({
        tray_id: quoteId,
        service_id: null, // Piese nu au service_id
        instrument_id: instrumentId,
        department_id: departmentId,
        technician_id: technicianIdForPart,
        qty: Number(it.qty ?? 1),
        notes: JSON.stringify({
          name: partName,
          price: Number(it.price ?? 0),
        discount_pct: Number(it.discount_pct ?? 0),
        urgent: !!it.urgent,
          brand: it.brand || null,
          serial_number: it.serial_number || null,
        garantie: !!it.garantie,
        }), // Salvează informații suplimentare în notes ca JSON (fără pipeline_id)
        pipeline: pipelineNameForPart,
      })
      if (error) {
        console.error('Error creating part tray item:', error)
        throw error
      }
      
      // Loghează atribuirea tehnicianului pentru piesa nou creată
      if (technicianIdForPart) {
        try {
          const supabase = (await import("@/lib/supabase/supabaseClient")).supabaseBrowser()
          // technician_id este acum user_id din app_members
          const { data: member } = await supabase
            .from('app_members')
            .select('*')
            .eq('user_id', technicianIdForPart)
            .single()
          
          // Obține numele din app_members
          let technicianName = 'tehnician necunoscut'
          if (member) {
            technicianName = (member as any)?.name || (member as any)?.Name || 'tehnician necunoscut'
          }
          await logItemEvent(
            'tray',
            quoteId,
            `Tehnician "${technicianName}" atribuit pentru piesa "${partName}"`,
            'technician_assigned',
            {
              item_id: createdPartItem?.id || null,
              item_name: partName,
              technician_id: technicianIdForPart,
              technician_name: technicianName,
              item_type: 'part'
            }
          )
        } catch (logError) {
          console.error('Eroare la logarea atribuirii tehnicianului:', logError)
          // Nu aruncă eroarea, doar loghează
        }
      }
    }
  }

  // === 2) Reload canonical DB rows ===
  const { data: trayItems, error: loadError } = await listTrayItemsForTray(quoteId)
  if (loadError) {
    console.error('Error loading tray items:', loadError)
    throw loadError
  }
  
  // Transformă TrayItem în LeadQuoteItem pentru UI
  const fresh: LeadQuoteItem[] = (trayItems || []).map((item: TrayItem) => {
    // Încearcă să parseze notes pentru a obține informații suplimentare (pentru piese)
    let additionalData: any = {}
    if (item.notes) {
      try {
        additionalData = JSON.parse(item.notes)
      } catch (e) {
        // Notes nu este JSON, ignoră
      }
    }
    
    // Determină item_type
    let item_type: 'service' | 'part' | null = additionalData.item_type || null
    if (!item_type) {
      if (item.service_id) {
        item_type = 'service'
      } else if (additionalData.name || additionalData.name_snapshot) {
        item_type = 'part'
      }
    }
    
    // Obține prețul
    let price = additionalData.price || 0
    if (!price && item_type === 'service' && item.service_id && services) {
      const service = services.find((s: Service) => s.id === item.service_id)
      price = service?.price || 0
    }
    
    // Obține name_snapshot
    let name_snapshot = additionalData.name_snapshot || additionalData.name || ''
    if (!name_snapshot && item_type === 'service' && item.service_id && services) {
      const service = services.find((s: Service) => s.id === item.service_id)
      name_snapshot = service?.name || ''
    }
    
    // Transformă pipeline (nume) în pipeline_id (UUID) pentru UI
    let pipeline_id: string | null = null
    if (item.pipeline) {
      const pipeline = pipelinesWithIds.find(p => p.name === item.pipeline)
      if (pipeline) {
        pipeline_id = pipeline.id
      }
    }
    // Fallback la pipeline_id din notes dacă nu există în câmpul pipeline
    if (!pipeline_id && additionalData.pipeline_id) {
      pipeline_id = additionalData.pipeline_id
    }
    
    return {
      id: item.id,
      tray_id: item.tray_id,
      item_type,
      service_id: item.service_id,
      name_snapshot,
      price,
      qty: item.qty,
      discount_pct: additionalData.discount_pct || 0,
      urgent: additionalData.urgent || false,
      technician_id: item.technician_id,
      pipeline_id,
      brand: additionalData.brand || null,
      serial_number: additionalData.serial_number || null,
      garantie: additionalData.garantie || false,
    } as LeadQuoteItem
  })
  
  const freshSnap = (fresh ?? []).map(toSnap)

  // === 3) Compose message + payload and log ===
  const d = diffSnapshots(prevSnapshot, freshSnap)
  const { message, payload } = composeMessage(freshSnap, d, totals)
  await logLeadEvent(leadId, message, "service_sheet_save", payload(d))

  // === 4) Return new items + snapshot for the caller to update UI flags ===
  return { items: fresh ?? [], snapshot: freshSnap }
}
