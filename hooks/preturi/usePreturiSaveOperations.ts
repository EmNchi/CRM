/**
 * Hook pentru salvare și logare - Versiune completă refactorizată
 * Include toată logica pentru brand/serial cu garanție
 */

import { useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { 
  updateServiceFile, 
  listTraysForServiceFile, 
  listTrayItemsForTray,
  deleteServiceFile,
} from '@/lib/supabase/serviceFileOperations'
import { 
  addServiceFileToPipeline, 
} from '@/lib/supabase/pipelineOperations'
import { getPipelinesWithStages } from '@/lib/supabase/leadOperations'
import { createQuoteForLead, updateQuote, listQuoteItems, addInstrumentItem } from '@/lib/utils/preturi-helpers'
import { persistAndLogServiceSheet } from '@/lib/history/serviceSheet'
import type { LeadQuote, LeadQuoteItem } from '@/lib/types/preturi'
import type { Service } from '@/lib/supabase/serviceOperations'
import type { Lead } from '@/lib/types/database'

const supabase = supabaseBrowser()

interface UsePreturiSaveOperationsProps {
  // State
  fisaId?: string | null
  trayDetails?: string
  paymentCash: boolean
  paymentCard: boolean
  officeDirect: boolean
  curierTrimis: boolean
  selectedQuote: LeadQuote | null
  isVanzariPipeline: boolean
  isVanzator: boolean
  leadId: string
  instrumentForm: any
  svc: any
  items: LeadQuoteItem[]
  instrumentSettings: any
  urgentAllServices: boolean
  subscriptionType: 'services' | 'parts' | 'both' | ''
  isCash: boolean
  isCard: boolean
  quotes: LeadQuote[]
  isCurierPipeline: boolean
  vanzariPipelineId: string | null
  vanzariStages: Array<{ id: string; name: string }>
  lead: Lead | null
  
  // Data
  services: Service[]
  instruments: Array<{ id: string; name: string; weight: number; department_id: string | null }>
  departments: Array<{ id: string; name: string }>
  pipelinesWithIds: Array<{ id: string; name: string }>
  
  // Totals
  subtotal: number
  totalDiscount: number
  urgentAmount: number
  total: number
  
  // Setters
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
  setQuotes: React.Dispatch<React.SetStateAction<LeadQuote[]>>
  setSelectedQuoteId: React.Dispatch<React.SetStateAction<string | null>>
  setItems: React.Dispatch<React.SetStateAction<LeadQuoteItem[]>>
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>
  setSvc: React.Dispatch<React.SetStateAction<any>>
  setInstrumentForm: React.Dispatch<React.SetStateAction<any>>
  
  // Callbacks
  recalcAllSheetsTotal: (quotes: LeadQuote[]) => Promise<void>
  populateInstrumentFormFromItems: (items: LeadQuoteItem[], instrumentId: string | null, forceReload: boolean) => void
}

export function usePreturiSaveOperations(props: UsePreturiSaveOperationsProps) {
  const {
    fisaId,
    trayDetails,
    paymentCash,
    paymentCard,
    officeDirect,
    curierTrimis,
    selectedQuote,
    isVanzariPipeline,
    isVanzator,
    leadId,
    instrumentForm,
    svc,
    items,
    instrumentSettings,
    urgentAllServices,
    subscriptionType,
    isCash,
    isCard,
    quotes,
    isCurierPipeline,
    pipelinesWithIds,
    services,
    instruments,
    departments,
    subtotal,
    totalDiscount,
    urgentAmount,
    total,
    setSaving,
    setQuotes,
    setSelectedQuoteId,
    setItems,
    setIsDirty,
    setSvc,
    setInstrumentForm,
    recalcAllSheetsTotal,
    populateInstrumentFormFromItems,
  } = props
  
  // Ref pentru snapshot-ul ultimului salvare
  const lastSavedRef = useRef<any[]>([])

  // ==================== HELPER FUNCTIONS ====================

  /**
   * Verifică dacă fișa de serviciu are conținut
   */
  const checkServiceFileHasContent = useCallback(async (serviceFileId: string): Promise<boolean> => {
    try {
      const { data: trays } = await listTraysForServiceFile(serviceFileId)
      if (!trays || trays.length === 0) return false
      
      for (const tray of trays) {
        const { data: trayItems } = await listTrayItemsForTray(tray.id)
        const trayItemsArray = Array.isArray(trayItems) ? trayItems : []
        if (trayItemsArray.length > 0) {
          // FOLOSIM FOR LOOP ÎN LOC DE .some() - MAI SIGUR
          for (let i = 0; i < trayItemsArray.length; i++) {
            const item = trayItemsArray[i]
            if (item && (item.instrument_id || item.service_id || item.part_id)) {
              return true
            }
          }
        }
      }
      return false
    } catch (error) {
      console.error('Error checking service file content:', error)
      return false
    }
  }, [])

  /**
   * Salvează detaliile fișei de serviciu
   */
  const saveServiceFileDetails = useCallback(async (): Promise<void> => {
    if (!fisaId || trayDetails === undefined) return

    try {
      const detailsToSave = JSON.stringify({
        text: trayDetails,
        paymentCash,
        paymentCard
      })
      
      const { error } = await updateServiceFile(fisaId, { details: detailsToSave })
      if (error) {
        console.error('Eroare la salvarea detaliilor fișei:', error)
      }
    } catch (error) {
      console.error('Eroare la salvarea detaliilor fișei:', error)
    }
  }, [fisaId, trayDetails, paymentCash, paymentCard])

  /**
   * Salvează checkbox-urile pentru livrare și actualizează pipeline-urile
   */
  const saveDeliveryCheckboxes = useCallback(async (): Promise<void> => {
    if (!fisaId) return

    try {
      const { error } = await updateServiceFile(fisaId, {
        office_direct: officeDirect,
        curier_trimis: curierTrimis,
      })
      
      if (error) {
        console.error('❌ Eroare la actualizarea service_file:', error)
        toast.error('Eroare la salvarea checkbox-urilor livrare')
        return
      }

      // Actualizează pipeline-urile dacă este necesar
      if (officeDirect || curierTrimis) {
        const { data: pipelinesData } = await getPipelinesWithStages()
        
        // Adaugă în pipeline-ul "Receptie"
        const receptiePipeline = pipelinesWithIds.find(p => p.name.toLowerCase().includes('receptie'))
        if (receptiePipeline && pipelinesData) {
          const receptiePipelineData = pipelinesData.find((p: any) => p.id === receptiePipeline.id)
          if (receptiePipelineData?.stages?.length) {
            const stageName = officeDirect ? 'Office direct' : 'Curier Trimis'
            const stage = receptiePipelineData.stages.find((s: any) => 
              s.is_active && s.name?.toLowerCase() === stageName.toLowerCase()
            )
            
            if (stage) {
              await addServiceFileToPipeline(fisaId, receptiePipeline.id, stage.id)
            }
          }
        }
        
        // Nu mai adăugăm în pipeline-ul Curier - folosim doar Receptie
        // Dacă este "Curier Trimis", rămâne în Receptie cu stage-ul "Curier Trimis"
      }
    } catch (error) {
      console.error('Eroare la salvarea checkbox-urilor livrare:', error)
    }
  }, [fisaId, officeDirect, curierTrimis, pipelinesWithIds])

  /**
   * Salvează urgent și subscription_type în service_file
   */
  const saveUrgentAndSubscription = useCallback(async (): Promise<void> => {
    if (!fisaId) return

    try {
      const updates: any = { urgent: urgentAllServices }
      
      // subscription_type nu există în tabelul service_files - eliminat
      // Abonamentul se gestionează la nivel de tăviță/item, nu la nivel de fișă
      
      const { error } = await updateServiceFile(fisaId, updates)
      if (error) {
        console.error('Eroare la actualizarea urgent/subscription:', error)
        return
      }

      // OPTIMIZARE: Batch UPDATE pentru urgent în loc de loop individual
      // Actualizează urgent pentru toate items-urile din tăvițe
      const trayIds = quotes.map(q => q.id)
      if (trayIds.length > 0) {
        const { data: allTrayItems } = await supabase
          .from('tray_items')
          .select('id, notes')
          .in('tray_id', trayIds) as { data: Array<{ id: string; notes: string | null }> | null }
        
        if (allTrayItems && allTrayItems.length > 0) {
          // Colectează toate items-urile care trebuie actualizate
          const itemsToUpdate: Array<{ id: string; notes: string }> = []
          
          for (const item of allTrayItems) {
            let notesData: any = {}
            if (item.notes) {
              try {
                notesData = JSON.parse(item.notes)
              } catch (e) {
                // Ignoră
              }
            }
            
            if (notesData.item_type === 'service' || notesData.item_type === 'part') {
              notesData.urgent = urgentAllServices
              itemsToUpdate.push({
                id: item.id,
                notes: JSON.stringify(notesData)
              })
            }
          }
          
          // OPTIMIZARE: Batch UPDATE pentru toate items-urile (un singur call în loc de N)
          if (itemsToUpdate.length > 0) {
            // Supabase nu suportă batch UPDATE direct, dar putem folosi Promise.all pentru paralelizare
            // Sau putem face un singur UPDATE cu un WHERE condition complex
            // Pentru moment, folosim Promise.all pentru paralelizare (mai rapid decât secvențial)
            await Promise.all(
              itemsToUpdate.map(item => 
                (supabase.from('tray_items') as any)
                  .update({ notes: item.notes })
                  .eq('id', item.id)
              )
            )
          }
        }
      }
    } catch (error) {
      console.error('Eroare la salvarea urgent/subscription:', error)
    }
  }, [fisaId, urgentAllServices, subscriptionType, quotes])

  /**
   * Creează o tăviță temporară dacă nu există
   */
  const ensureTrayExists = useCallback(async (): Promise<LeadQuote | null> => {
    if (selectedQuote) return selectedQuote
    
    if (isVanzariPipeline && isVanzator && fisaId) {
      try {
        const created = await createQuoteForLead(leadId, '', fisaId, 'm')
        setQuotes([created])
        setSelectedQuoteId(created.id)
        setItems([])
        lastSavedRef.current = []
        return created
      } catch (error: any) {
        console.error('Error creating temporary tray:', error)
        toast.error('Eroare la crearea tăviței temporare')
        throw error
      }
    }
    
    return null
  }, [selectedQuote, isVanzariPipeline, isVanzator, fisaId, leadId, setQuotes, setSelectedQuoteId, setItems])

  /**
   * Actualizează snapshot-ul cu items-urile date
   */
  const updateSnapshot = useCallback((items: LeadQuoteItem[]) => {
    lastSavedRef.current = items.map((i: any) => ({
      id: String(i.id),
      name: i.name_snapshot,
      qty: Number(i.qty ?? 1),
      price: Number(i.price ?? 0),
      type: i.item_type ?? null,
      urgent: !!i.urgent,
      department: i.department ?? null,
      technician_id: i.technician_id ?? null,
      pipeline_id: i.pipeline_id ?? null,
      brand: i.brand ?? null,
      serial_number: i.serial_number ?? null,
      garantie: !!i.garantie,
    }))
  }, [])

  /**
   * Salvează brand-uri și serial numbers pentru un instrument
   */
  const saveBrandSerialData = useCallback(async (
    quoteId: string,
    instrumentId: string,
    brandSerialGroups: Array<{ brand: string; serialNumbers: Array<{ serial: string; garantie: boolean }> | string[]; qty?: string }>,
    garantie: boolean
  ): Promise<void> => {
    const instrument = instruments.find(i => i.id === instrumentId)
    if (!instrument || !instrument.department_id) {
      throw new Error('Instrumentul nu a fost găsit sau nu are departament setat')
    }

    // Verifică dacă instrumentul este din departamentul "Ascutit"
    const instrumentDept = departments.find(d => d.id === instrument.department_id)
    const deptNameLower = instrumentDept?.name?.toLowerCase() || ''
    if (deptNameLower.includes('ascutit') || deptNameLower.includes('ascuțit')) {
      throw new Error('Instrumentele din departamentul "Ascutit" nu pot avea brand sau serial number')
    }

    // Reîncarcă items-urile existente din DB
    const allExistingItems = await listQuoteItems(quoteId, services, instruments, pipelinesWithIds)
    const existingItem = allExistingItems.find((i: any) => i.instrument_id === instrumentId && i.item_type === null)

    // Transformă structura pentru salvare: grupăm serial numbers-urile după garanție
    const brandSerialGroupsToSend: Array<{ brand: string | null; serialNumbers: string[]; garantie: boolean }> = []
    
    for (const group of brandSerialGroups) {
      const brandName = group.brand?.trim()
      if (!brandName) continue
      
      // Grupează serial numbers-urile după garanție
      const serialsByGarantie = new Map<boolean, string[]>()
      
      group.serialNumbers.forEach((snData: any) => {
        const serial = typeof snData === 'string' ? snData : snData.serial || ''
        const snGarantie = typeof snData === 'object' ? (snData.garantie || false) : garantie
        
        if (serial && serial.trim()) {
          if (!serialsByGarantie.has(snGarantie)) {
            serialsByGarantie.set(snGarantie, [])
          }
          serialsByGarantie.get(snGarantie)!.push(serial.trim())
        }
      })
      
      // Creează un grup pentru fiecare nivel de garanție
      serialsByGarantie.forEach((serials, snGarantie) => {
        if (serials.length > 0) {
          brandSerialGroupsToSend.push({
            brand: brandName,
            serialNumbers: serials,
            garantie: snGarantie
          })
        }
      })
    }

    const filteredGroups = brandSerialGroupsToSend.filter(g => g.brand || g.serialNumbers.length > 0)
    
    if (filteredGroups.length === 0) return

    const supabaseClient = supabaseBrowser()
    const qty = Number(instrumentForm.qty || instrumentSettings[instrumentId]?.qty || 1)

    if (existingItem && existingItem.id) {
      // Actualizează item-ul existent
      // Actualizează cantitatea
      await (supabaseClient.from('tray_items') as any)
        .update({ qty })
        .eq('id', existingItem.id)

      // OPTIMIZARE: Batch operations pentru reducerea call-urilor
      // Șterge brand-urile existente (un singur call)
      await supabaseClient
        .from('tray_item_brands' as any)
        .delete()
        .eq('tray_item_id', existingItem.id)

      // Grupează toate brand-urile pentru batch INSERT
      // IMPORTANT: Elimină duplicatele (același brand + garanție) pentru a evita erori la INSERT
      const brandsToInsertMap = new Map<string, { tray_item_id: string; brand: string; garantie: boolean }>()
      filteredGroups.forEach(group => {
        const brandName = group.brand?.trim()
        if (!brandName) return
        const garantie = group.garantie || false
        const key = `${brandName}::${garantie}`
        // Dacă nu există deja, adaugă-l
        if (!brandsToInsertMap.has(key)) {
          brandsToInsertMap.set(key, {
            tray_item_id: existingItem.id,
            brand: brandName,
            garantie: garantie,
          })
        }
      })
      const brandsToInsert = Array.from(brandsToInsertMap.values())

      if (brandsToInsert.length > 0) {
        // Batch INSERT pentru toate brand-urile (un singur call în loc de N)
        const { data: brandResults, error: brandsError } = await (supabaseClient.from('tray_item_brands') as any)
          .insert(brandsToInsert)
          .select()

        if (brandsError) {
          console.error('Error creating brands:', brandsError)
          throw brandsError
        }

        // Grupează toate serial numbers-urile pentru batch INSERT
        const serialsToInsert: Array<{ brand_id: string; serial_number: string }> = []
        
        if (brandResults && brandResults.length > 0) {
          // Creează mapare între brand name + garantie și brand_id
          // Folosim datele din rezultat (br) pentru siguranță, nu indexarea array-ului
          const brandMap = new Map<string, string>()
          brandResults.forEach((br: any) => {
            const brandName = br.brand?.trim()
            const garantie = br.garantie || false
            const key = `${brandName}::${garantie}`
            brandMap.set(key, br.id)
          })

          // Colectează toate serial numbers-urile
          filteredGroups.forEach(group => {
            const brandName = group.brand?.trim()
            if (!brandName) return
            
            const garantie = group.garantie || false
            const key = `${brandName}::${garantie}`
            const brandId = brandMap.get(key)
            
            if (brandId && group.serialNumbers.length > 0) {
              group.serialNumbers.forEach(sn => {
                const serial = typeof sn === 'string' ? sn : sn.trim()
                if (serial && serial.trim()) {
                  serialsToInsert.push({
                    brand_id: brandId,
                    serial_number: serial.trim(),
                  })
                }
              })
            }
          })

          // Batch INSERT pentru toate serial numbers-urile (un singur call în loc de N)
          if (serialsToInsert.length > 0) {
            const { error: serialsError } = await supabaseClient
              .from('tray_item_brand_serials' as any)
              .insert(serialsToInsert as any)

            if (serialsError) {
              console.error('Error creating serials:', serialsError)
              throw serialsError
            }
          }
        }
      }

      // Propagă brand/serial la toate serviciile asociate cu acest instrument
      const servicesForInstrument = allExistingItems.filter((item: any) => {
        if (item.item_type !== 'service' || !item.service_id || !item.id) return false
        const serviceDef = services.find(s => s.id === item.service_id)
        return serviceDef?.instrument_id === instrumentId
      })

      // OPTIMIZARE: Batch operations pentru propagarea la servicii
      // Grupează toate operațiile pentru toate serviciile
      const serviceItemsToProcess = servicesForInstrument.filter((item: any) => item.id)
      
      if (serviceItemsToProcess.length > 0) {
        // Șterge brand-urile existente pentru toate serviciile (batch DELETE)
        const serviceItemIds = serviceItemsToProcess.map((item: any) => item.id)
        for (const serviceItemId of serviceItemIds) {
          await supabaseClient
            .from('tray_item_brands' as any)
            .delete()
            .eq('tray_item_id', serviceItemId)
        }

        // Grupează toate brand-urile pentru toate serviciile pentru batch INSERT
        // IMPORTANT: Elimină duplicatele (același serviciu + brand + garanție) pentru a evita erori la INSERT
        const serviceBrandsToInsertMap = new Map<string, { tray_item_id: string; brand: string; garantie: boolean; serviceIndex: number }>()
        
        serviceItemsToProcess.forEach((serviceItem: any, serviceIdx: number) => {
          filteredGroups.forEach(group => {
            const brandName = group.brand?.trim()
            if (!brandName) return
            const garantie = group.garantie || false
            const key = `${serviceItem.id}::${brandName}::${garantie}`
            // Dacă nu există deja pentru acest serviciu, adaugă-l
            if (!serviceBrandsToInsertMap.has(key)) {
              serviceBrandsToInsertMap.set(key, {
                tray_item_id: serviceItem.id,
                brand: brandName,
                garantie: garantie,
                serviceIndex: serviceIdx, // Pentru mapare ulterioară
              })
            }
          })
        })
        
        const serviceBrandsToInsert = Array.from(serviceBrandsToInsertMap.values())

        if (serviceBrandsToInsert.length > 0) {
          // Batch INSERT pentru toate brand-urile pentru toate serviciile (un singur call)
          const brandsForInsert = serviceBrandsToInsert.map(b => ({
            tray_item_id: b.tray_item_id,
            brand: b.brand,
            garantie: b.garantie,
          }))

          const { data: serviceBrandResults, error: serviceBrandsError } = await (supabaseClient.from('tray_item_brands') as any)
            .insert(brandsForInsert)
            .select()

          if (serviceBrandsError) {
            console.error('Error creating service brands:', serviceBrandsError)
            throw serviceBrandsError
          }

          // Grupează toate serial numbers-urile pentru toate serviciile pentru batch INSERT
          const serviceSerialsToInsert: Array<{ brand_id: string; serial_number: string }> = []
          
          if (serviceBrandResults && serviceBrandResults.length > 0) {
            // Creează mapare între serviceIndex + brand name + garantie și brand_id
            // Folosim datele din rezultat (br) și serviceBrandsToInsert pentru mapare corectă
            const serviceBrandMap = new Map<string, string>()
            serviceBrandResults.forEach((br: any, idx: number) => {
              const serviceBrand = serviceBrandsToInsert[idx]
              if (serviceBrand) {
                const key = `${serviceBrand.serviceIndex}::${serviceBrand.brand}::${serviceBrand.garantie}`
                serviceBrandMap.set(key, br.id)
              }
            })

            // Colectează toate serial numbers-urile pentru toate serviciile
            serviceItemsToProcess.forEach((serviceItem: any, serviceIdx: number) => {
              filteredGroups.forEach(group => {
                const brandName = group.brand?.trim()
                if (!brandName) return
                
                const garantie = group.garantie || false
                const key = `${serviceIdx}::${brandName}::${garantie}`
                const brandId = serviceBrandMap.get(key)
                
                if (brandId && group.serialNumbers.length > 0) {
                  group.serialNumbers.forEach(sn => {
                    const serial = typeof sn === 'string' ? sn : sn.trim()
                    if (serial && serial.trim()) {
                      serviceSerialsToInsert.push({
                        brand_id: brandId,
                        serial_number: serial.trim(),
                      })
                    }
                  })
                }
              })
            })

            // Batch INSERT pentru toate serial numbers-urile pentru toate serviciile (un singur call)
            if (serviceSerialsToInsert.length > 0) {
              const { error: serviceSerialsError } = await supabaseClient
                .from('tray_item_brand_serials' as any)
                .insert(serviceSerialsToInsert as any)

              if (serviceSerialsError) {
                console.error('Error creating service serials:', serviceSerialsError)
                throw serviceSerialsError
              }
            }
          }
        }
      }
    } else {
      // Creează un nou item pentru instrument
      const autoPipelineId = instrumentDept?.name?.toLowerCase() === 'reparatii'
        ? pipelinesWithIds.find(p => p.name.toLowerCase() === 'reparatii')?.id || null
        : null

      await addInstrumentItem(quoteId, instrument.name, {
        instrument_id: instrument.id,
        department_id: instrument.department_id,
        qty,
        discount_pct: 0,
        urgent: false,
        technician_id: null,
        pipeline_id: autoPipelineId,
        brandSerialGroups: filteredGroups
      })
    }
  }, [instruments, departments, services, pipelinesWithIds, instrumentForm, instrumentSettings])

  /**
   * Funcția principală de salvare - Versiune completă refactorizată
   */
  const saveAllAndLog = useCallback(async () => {
    let isCancelled = false
    
    setSaving(true)
    
    try {
      // OPTIMIZARE: Combină saveServiceFileDetails și saveDeliveryCheckboxes într-un singur UPDATE
      // pentru a evita race conditions și a reduce numărul de call-uri
      if (fisaId) {
        const detailsToSave = trayDetails !== undefined 
          ? JSON.stringify({
              text: trayDetails,
              paymentCash,
              paymentCard
            })
          : undefined
        
        // Combină ambele operații într-un singur UPDATE
        const combinedUpdates: any = {}
        if (detailsToSave !== undefined) {
          combinedUpdates.details = detailsToSave
        }
        if (officeDirect !== undefined) {
          combinedUpdates.office_direct = officeDirect
        }
        if (curierTrimis !== undefined) {
          combinedUpdates.curier_trimis = curierTrimis
        }
        
        if (Object.keys(combinedUpdates).length > 0) {
          const { error: updateError } = await updateServiceFile(fisaId, combinedUpdates)
          if (updateError) {
            console.error('Eroare la salvarea detaliilor și checkbox-urilor:', updateError)
          }
        }
        
        // Actualizează pipeline-urile dacă este necesar (după UPDATE)
        if (officeDirect || curierTrimis) {
          const { data: pipelinesData } = await getPipelinesWithStages()
          const receptiePipeline = pipelinesWithIds.find(p => p.name.toLowerCase().includes('receptie'))
          if (receptiePipeline && pipelinesData) {
            const receptiePipelineData = pipelinesData.find((p: any) => p.id === receptiePipeline.id)
            if (receptiePipelineData?.stages?.length) {
              const stageName = officeDirect ? 'Office direct' : 'Curier Trimis'
              const stage = receptiePipelineData.stages.find((s: any) => 
                s.is_active && s.name?.toLowerCase() === stageName.toLowerCase()
              )
              if (stage) {
                await addServiceFileToPipeline(fisaId, receptiePipeline.id, stage.id)
              }
            }
          }
        }
      }
      
      // 2. Asigură-te că există o tăviță (trebuie să fie după operațiile de mai sus)
      const quoteToUse = await ensureTrayExists()
      if (!quoteToUse) {
        toast.error('Nu s-a putut crea sau găsi o tăviță pentru salvare')
        setSaving(false)
        return
      }
      
      // 4. Salvează brand/serial data dacă există și reîncarcă items-urile
      let itemsToSave = items // Folosim items-urile din state ca default
      const instrumentIdToUse = instrumentForm?.instrument || svc?.instrumentId
      const groupsToSave = Array.isArray(instrumentForm.brandSerialGroups) ? instrumentForm.brandSerialGroups : []
      
      // FOLOSIM FOR LOOP ÎN LOC DE .some() - MAI SIGUR
      let hasValidBrandSerialData = false
      if (Array.isArray(groupsToSave)) {
        for (let i = 0; i < groupsToSave.length; i++) {
          const g = groupsToSave[i]
          if (!g) continue
          const hasBrand = g.brand && g.brand.trim()
          const serialNumbers = Array.isArray(g.serialNumbers) ? g.serialNumbers : []
          
          // Verifică serial numbers cu for loop în loc de .some()
          let hasSerialNumbers = false
          for (let j = 0; j < serialNumbers.length; j++) {
            const sn = serialNumbers[j]
            const serial = typeof sn === 'string' ? sn : (sn && typeof sn === 'object' ? sn?.serial || '' : '')
            if (serial && serial.trim()) {
              hasSerialNumbers = true
              break
            }
          }
          
          if (hasBrand || hasSerialNumbers) {
            hasValidBrandSerialData = true
            break
          }
        }
      }

      // 3. Salvează brand/serial data și urgent/subscription în paralel (nu depind unul de altul)
      // OPTIMIZARE: Grupează operațiile independente pentru reducerea timpului de execuție
      const saveOperations: Promise<any>[] = []
      
      if (instrumentIdToUse && hasValidBrandSerialData) {
        const garantie = instrumentForm.garantie || instrumentSettings[instrumentIdToUse]?.garantie || false
        saveOperations.push(saveBrandSerialData(quoteToUse.id, instrumentIdToUse, groupsToSave, garantie))
      }
      
      // Salvează urgent și subscription_type (nu depinde de brand/serial)
      saveOperations.push(saveUrgentAndSubscription())
      
      // Așteaptă toate operațiile de salvare să se termine
      await Promise.all(saveOperations)
      
      // OPTIMIZARE: Nu mai reîncărcăm items-urile aici - vor fi reîncărcate după persistAndLogServiceSheet
      // Aceasta reduce numărul de call-uri de la 2 la 1
      // itemsToSave rămâne cu items-urile din state, care vor fi actualizate după persistAndLogServiceSheet
      
      // 6. Cash/card sunt deja salvate în saveServiceFileDetails() prin details JSON
      // Nu mai încercăm să le salvăm în trays pentru că aceste câmpuri nu există acolo
      
      // 7. Verifică limită de instrumente (doar pentru tăvițe definite, nu pentru undefined în Vanzari)
      const isUndefinedTray = quoteToUse && (!quoteToUse.number || quoteToUse.number === '')
      const allowAllInstruments = isVanzariPipeline && isUndefinedTray
      
      if (!isVanzariPipeline && !isCurierPipeline && !allowAllInstruments) {
        const instrumentIds = Array.from(
          new Set(
            itemsToSave
              .filter(it => it.instrument_id)
              .map(it => String(it.instrument_id))
          )
        )
        if (instrumentIds.length > 2) {
          toast.error('Maxim 2 instrumente pot fi asociate aceleiași tăvițe.')
          setSaving(false)
          return
        }
      }
      
      // 8. Salvează items-urile principale prin persistAndLogServiceSheet
      // ELIMINAT: Verificările pentru temp IDs - items-urile se salvează direct în DB, nu mai există temp IDs
      const { items: fresh, snapshot } = await persistAndLogServiceSheet({
        leadId,
        quoteId: quoteToUse.id,
        items: itemsToSave, // Items-urile se salvează direct în DB, nu mai există temp IDs
        services,
        instruments,
        totals: { subtotal, totalDiscount, urgentAmount, total },
        prevSnapshot: lastSavedRef.current,
        pipelinesWithIds,
      })
      
      // 10. Reîncarcă items-urile din DB pentru a avea datele corecte
      try {
        const reloadedItems = await listQuoteItems(quoteToUse.id, services, instruments, pipelinesWithIds)
        
        if (reloadedItems && reloadedItems.length > 0) {
          setItems(reloadedItems)
          updateSnapshot(reloadedItems)
        } else {
          setItems(fresh)
          lastSavedRef.current = snapshot
        }
      } catch (reloadError) {
        console.error('[usePreturiSaveOperations] Error reloading items:', reloadError?.message || 'Unknown error')
        setItems(fresh)
        lastSavedRef.current = snapshot
      }
      
      setIsDirty(false)
      
      // 11. Recalculează totalurile
      await recalcAllSheetsTotal(quotes)
      
      // 12. Verifică dacă fișa este goală și o șterge
      if (fisaId) {
        const hasContent = await checkServiceFileHasContent(fisaId)
        if (!hasContent) {
          const { success } = await deleteServiceFile(fisaId)
          if (success) {
            toast.info('Fișa goală a fost ștearsă automat')
            isCancelled = true
            setTimeout(() => {
              window.location.reload()
            }, 200)
            return
          }
        }
      }
      
      // 13. Afișează mesaj de succes
      if (!isCancelled) {
        toast.success('Fișa de serviciu a fost salvată cu succes!')
      }
      
    } catch (error: any) {
      console.error('❌ Eroare la salvare:', error)
      
      let errorMsg = 'Eroare necunoscută la salvare'
      if (error instanceof Error) {
        errorMsg = error.message
      } else if (error?.message) {
        errorMsg = error.message
      } else if (error?.hint) {
        errorMsg = error.hint
      }
      
      toast.error(`Eroare la salvare: ${errorMsg}`)
    } finally {
      setSaving(false)
    }
  }, [
    setSaving,
    saveServiceFileDetails,
    saveDeliveryCheckboxes,
    ensureTrayExists,
    saveBrandSerialData,
    instrumentForm,
    svc,
    instrumentSettings,
    saveUrgentAndSubscription,
    isCash,
    isCard,
    isVanzariPipeline,
    isCurierPipeline,
    items,
    leadId,
    services,
    instruments,
    subtotal,
    totalDiscount,
    urgentAmount,
    total,
    pipelinesWithIds,
    setItems,
    updateSnapshot,
    setIsDirty,
    recalcAllSheetsTotal,
    quotes,
    fisaId,
    checkServiceFileHasContent,
  ])

  // Funcție pentru inițializarea snapshot-ului
  const initializeSnapshot = useCallback((items: LeadQuoteItem[]) => {
    updateSnapshot(items)
  }, [updateSnapshot])

  return {
    saveAllAndLog,
    checkServiceFileHasContent,
    initializeSnapshot,
  }
}

