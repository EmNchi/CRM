/**
 * Hook pentru încărcarea datelor în componenta LeadDetailsPanel
 */

import { useEffect, useCallback, useMemo } from 'react'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { 
  listServiceFilesForLead, 
  createServiceFile,
  createTray,
  listTraysForServiceFile,
  getNextGlobalServiceFileNumber,
  getServiceFile,
} from '@/lib/supabase/serviceFileOperations'
import { listTags } from '@/lib/supabase/tagOperations'
import { listServices } from '@/lib/supabase/serviceOperations'
import { toast } from 'sonner'

const supabaseClient = supabaseBrowser()

// Tipuri pentru UI
type ServiceSheet = {
  id: string
  number: string
  status: string
  date: string
  lead_id: string
  fisa_index?: number
}

type Technician = {
  id: string
  name: string
}

type Lead = {
  id: string
  stage?: string
  tags?: Array<{ id: string }>
  [key: string]: any
}

// Funcții helper pentru transformarea datelor
const listServiceSheetsForLead = async (leadId: string): Promise<ServiceSheet[]> => {
  const { data, error } = await listServiceFilesForLead(leadId)
  if (error) {
    console.error('Error loading service files:', error)
    return []
  }
  // Transformă ServiceFile în ServiceSheet (adaugă fisa_index)
  return (data || []).map((sf, index) => ({
    ...sf,
    fisa_index: index + 1,
    id: sf.id,
  })) as ServiceSheet[]
}

const listTraysForServiceSheet = async (fisaId: string) => {
  const { data, error } = await listTraysForServiceFile(fisaId)
  if (error) {
    console.error('Error loading trays:', error)
    return []
  }
  return (data || []) as any[]
}

const listQuotesForLead = async (leadId: string) => {
  // Trebuie să obținem toate fișele și apoi toate tăvițele
  const serviceSheets = await listServiceSheetsForLead(leadId)
  const allTrays: any[] = []
  
  for (const sheet of serviceSheets) {
    const trays = await listTraysForServiceSheet(sheet.id)
    allTrays.push(...trays)
  }
  
  return allTrays
}

interface UseLeadDetailsDataLoaderProps {
  lead: Lead | null
  isDepartmentPipeline: boolean
  
  // Helpers pentru a obține ID-uri
  getLeadId: () => string | null
  getServiceFileId: () => Promise<string | null>
  getTrayId: () => string | null
  
  // Setters pentru state
  setServiceSheets: React.Dispatch<React.SetStateAction<ServiceSheet[]>>
  setSelectedFisaId: React.Dispatch<React.SetStateAction<string | null>>
  setLoadingSheets: React.Dispatch<React.SetStateAction<boolean>>
  setAllTrays: React.Dispatch<React.SetStateAction<Array<{ id: string; number: string; size: string; service_file_id: string }>>>
  setSelectedTrayId: React.Dispatch<React.SetStateAction<string | null>>
  setLoadingTrays: React.Dispatch<React.SetStateAction<boolean>>
  setAllTags: React.Dispatch<React.SetStateAction<any[]>>
  setSelectedTagIds: React.Dispatch<React.SetStateAction<string[]>>
  setTechnicians: React.Dispatch<React.SetStateAction<Technician[]>>
  setTrayDetails: React.Dispatch<React.SetStateAction<string>>
  setLoadingTrayDetails: React.Dispatch<React.SetStateAction<boolean>>
  setLoadingDetails: React.Dispatch<React.SetStateAction<boolean>>
  setTraysDetails: React.Dispatch<React.SetStateAction<any[]>>
  setTotalFisaSum: React.Dispatch<React.SetStateAction<number | null>>
  setLoadingTotalSum: React.Dispatch<React.SetStateAction<boolean>>
  
  // State pentru verificare selecție
  selectedFisaId: string | null
  selectedTrayId: string | null
}

export function useLeadDetailsDataLoader({
  lead,
  isDepartmentPipeline,
  getLeadId,
  getServiceFileId,
  getTrayId,
  setServiceSheets,
  setSelectedFisaId,
  setLoadingSheets,
  setAllTrays,
  setSelectedTrayId,
  setLoadingTrays,
  setAllTags,
  setSelectedTagIds,
  setTechnicians,
  setTrayDetails,
  setLoadingTrayDetails,
  setLoadingDetails,
  setTraysDetails,
  setTotalFisaSum,
  setLoadingTotalSum,
  selectedFisaId,
  selectedTrayId,
}: UseLeadDetailsDataLoaderProps) {
  const supabase = supabaseBrowser()

  // Funcție helper pentru încărcarea fișelor (folosită atât la inițializare cât și după creare)
  const loadServiceSheets = useCallback(async (leadId: string) => {
    try {
      const sheets = await listServiceSheetsForLead(leadId)
      return sheets
    } catch (error) {
      console.error('Error loading service sheets:', error)
      throw error
    }
  }, [])

  // Memoizează leadId și trayId pentru a evita re-executări inutile
  const leadIdMemo = useMemo(() => getLeadId(), [getLeadId])
  const trayIdMemo = useMemo(() => getTrayId(), [getTrayId])
  const leadTypeMemo = useMemo(() => (lead as any)?.type, [lead])
  const leadIsQuoteMemo = useMemo(() => (lead as any)?.isQuote, [lead])
  const leadQuoteIdMemo = useMemo(() => (lead as any)?.quoteId, [lead])
  
  // Încarcă fișele de serviciu pentru lead
  useEffect(() => {
    if (!leadIdMemo) return
    
    let isMounted = true
    
    const loadData = async () => {
      setLoadingSheets(true)
      try {
        const sheets = await loadServiceSheets(leadIdMemo)
        if (!isMounted) return
        
        setServiceSheets(sheets)
        
        // Dacă este un service_file (vine din pipeline Curier), selectează fișa direct
        const serviceFileId = await getServiceFileId()
        const trayId = getTrayId()
        
        if (serviceFileId) {
          // Cardului service_file - selectează fișa corespunzătoare
          const fisaFromCard = sheets.find(s => s.id === serviceFileId)
          if (fisaFromCard) {
            setSelectedFisaId(fisaFromCard.id)
          } else if (sheets.length > 0) {
            setSelectedFisaId(sheets[0].id)
          }
        } else if (trayId) {
          // Dacă este un tray (vine din pipeline departament), găsește fișa care conține tăvița
          for (const sheet of sheets) {
            const trays = await listTraysForServiceSheet(sheet.id)
            const foundTray = trays.find((t: any) => t.id === trayId)
            if (foundTray) {
              setSelectedFisaId(sheet.id)
              break
            }
          }
          // Dacă nu s-a găsit, selectează prima fișă
          if (!selectedFisaId && sheets.length > 0) {
            setSelectedFisaId(sheets[0].id)
          }
        } else if (leadIsQuoteMemo && leadQuoteIdMemo) {
          // Dacă este un tray, găsește fișa care conține tăvița
          const allQuotes = await listQuotesForLead(leadIdMemo)
          const quote = allQuotes.find(q => q.id === leadQuoteIdMemo)
          if (quote?.fisa_id) {
            const fisaWithQuote = sheets.find(s => s.id === quote.fisa_id)
            if (fisaWithQuote) {
              setSelectedFisaId(fisaWithQuote.id)
            } else if (sheets.length > 0) {
              setSelectedFisaId(sheets[0].id)
            }
          } else if (sheets.length > 0) {
            setSelectedFisaId(sheets[0].id)
          }
        } else {
          // Selectează prima fișă dacă există și nu avem deja una selectată
          const sheetsArray = Array.isArray(sheets) ? sheets : []
          
          if (sheetsArray.length > 0) {
            if (!Array.isArray(sheetsArray)) {
              console.error('❌ [useLeadDetailsDataLoader] ERROR: sheetsArray is NOT an array!', sheetsArray)
              return
            }
            
            // FOLOSIM FOR LOOP ÎN LOC DE .some() - MAI SIGUR
            let currentSelectedExists = false
            if (selectedFisaId && Array.isArray(sheetsArray)) {
              for (let i = 0; i < sheetsArray.length; i++) {
                const s = sheetsArray[i]
                if (s && s.id === selectedFisaId) {
                  currentSelectedExists = true
                  break
                }
              }
            }
            if (!currentSelectedExists) {
              setSelectedFisaId(sheetsArray[0]?.id || null)
            }
          }
        }
      } catch (error) {
        if (!isMounted) return
        console.error('Error loading service sheets:', error)
        toast.error('Eroare la încărcarea fișelor')
      } finally {
        if (isMounted) {
          setLoadingSheets(false)
        }
      }
    }
    
    loadData()
    
    return () => {
      isMounted = false
    }
  }, [leadIdMemo, leadTypeMemo, leadIsQuoteMemo, leadQuoteIdMemo, loadServiceSheets, getServiceFileId, getTrayId, selectedFisaId])

  // Încarcă toate tăvițele pentru lead în pipeline-urile departament
  useEffect(() => {
    if (!isDepartmentPipeline) return
    if (!leadIdMemo) return
    
    let isMounted = true
    
    const loadTrays = async () => {
      setLoadingTrays(true)
      try {
        const sheets = await loadServiceSheets(leadIdMemo)
        if (!isMounted) return
        
        // OPTIMIZARE: Încarcă toate tăvițele din toate service_files în paralel
        // În loc de loop secvențial, folosim Promise.all pentru paralelizare
        const allTraysList: Array<{ id: string; number: string; size: string; service_file_id: string }> = []
        
        if (sheets.length > 0) {
          const traysPromises = sheets.map(sheet => listTraysForServiceSheet(sheet.id))
          const traysResults = await Promise.all(traysPromises)
          
          traysResults.forEach((trays, index) => {
            const sheet = sheets[index]
            allTraysList.push(...trays.map((t: any) => ({
              id: t.id,
              number: t.number,
              size: t.size,
              service_file_id: sheet.id
            })))
          })
        }
        
        if (!isMounted) return
        
        setAllTrays(allTraysList)
        
        // Dacă este un tray (vine din pipeline departament), selectează-l direct
        if (trayIdMemo) {
          const foundTray = allTraysList.find(t => t.id === trayIdMemo)
          if (foundTray) {
            setSelectedTrayId(trayIdMemo)
            setSelectedFisaId(foundTray.service_file_id)
          } else if (allTraysList.length > 0) {
            setSelectedTrayId(allTraysList[0].id)
            setSelectedFisaId(allTraysList[0].service_file_id)
          }
        } else if (allTraysList.length > 0 && !selectedTrayId) {
          setSelectedTrayId(allTraysList[0].id)
          setSelectedFisaId(allTraysList[0].service_file_id)
        }
      } catch (error) {
        if (!isMounted) return
        console.error('Error loading trays:', error)
        toast.error('Eroare la încărcarea tăvițelor')
      } finally {
        if (isMounted) {
          setLoadingTrays(false)
        }
      }
    }
    
    loadTrays()
    
    return () => {
      isMounted = false
    }
  }, [isDepartmentPipeline, leadIdMemo, trayIdMemo, loadServiceSheets, selectedTrayId])

  // Real-time subscription pentru tags
  useEffect(() => {
    const ch = supabase
      .channel('rt-tags-lead-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' },
        () => listTags().then(setAllTags).catch(console.error)
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [setAllTags])

  // Încarcă tags la mount
  useEffect(() => { 
    listTags().then(setAllTags).catch(console.error) 
  }, [setAllTags])

  // Setează tag-urile selectate din lead
  useEffect(() => {
    if (!lead) return
    setSelectedTagIds((lead.tags ?? []).map(t => t.id))
  }, [lead?.id, setSelectedTagIds])

  // Încarcă detaliile pentru fișa de serviciu
  useEffect(() => {
    const loadServiceFileDetails = async () => {
      setLoadingTrayDetails(true)
      try {
        const serviceFileId = await getServiceFileId()
        if (!serviceFileId) {
          setTrayDetails('')
          return
        }
        
        const { data: serviceFile, error } = await supabase
          .from('service_files')
          .select('details')
          .eq('id', serviceFileId)
          .single()
        
        if (error) {
          console.error('Error loading service file details:', error)
          setTrayDetails('')
          return
        }
        
        const detailsValue = serviceFile?.details || ''
        
        // Încearcă să parseze ca JSON pentru a extrage doar textul
        try {
          const parsedDetails = JSON.parse(detailsValue)
          if (typeof parsedDetails === 'object' && parsedDetails !== null && parsedDetails.text !== undefined) {
            setTrayDetails(parsedDetails.text || '')
          } else {
            setTrayDetails(detailsValue)
          }
        } catch {
          setTrayDetails(detailsValue)
        }
      } catch (err) {
        console.error('Error loading service file details:', err)
        setTrayDetails('')
      } finally {
        setLoadingTrayDetails(false)
      }
    }
    
    loadServiceFileDetails()
  }, [getServiceFileId, setTrayDetails, setLoadingTrayDetails])

  // Încarcă tehnicienii
  useEffect(() => {
    const loadTechnicians = async () => {
      try {
        const { data: membersData, error } = await supabase
          .from('app_members')
          .select('user_id, name')
          .order('created_at', { ascending: true })
        
        if (error) {
          console.error('Error loading app_members:', error)
          setTechnicians([])
          return
        }
        
        if (!membersData || membersData.length === 0) {
          setTechnicians([])
          return
        }
        
        const techs: Technician[] = (membersData || []).map((m: any) => {
          let name = m.name || m.Name || null
          if (!name && m.user_id) {
            name = `User ${m.user_id.slice(0, 8)}`
          }
          if (!name) {
            name = 'Necunoscut'
          }
          
          return {
            id: m.user_id,
            name: name
          }
        })
        
        techs.sort((a, b) => a.name.localeCompare(b.name))
        setTechnicians(techs)
      } catch (error) {
        console.error('Error loading technicians:', error)
      }
    }
    loadTechnicians()
  }, [setTechnicians])

  // Funcție pentru încărcarea detaliilor tăvițelor din fișă
  const loadTraysDetails = useCallback(async (fisaId: string) => {
    if (!fisaId) return
    
    setLoadingDetails(true)
    try {
      // Încarcă serviciile, instrumentele și pipeline-urile pentru a obține prețurile și departamentele
      const [servicesResult, instrumentsResult, pipelinesResult] = await Promise.all([
        listServices().then(s => {
          return s
        }),
        supabaseClient.from('instruments').select('id,name,pipeline').then(({ data, error }) => {
          if (error) {
            console.error('Error loading instruments:', error)
            return []
          }
          return data || []
        }),
        supabaseClient.from('pipelines').select('id,name').then(({ data, error }) => {
          if (error) {
            console.error('Error loading pipelines:', error)
            return []
          }
          return data || []
        })
      ])
      
      // Creează un map pentru pipeline-uri (id -> name)
      const pipelineMap = new Map(pipelinesResult.map((p: any) => [p.id, p.name]))
      
      // Creează un map pentru instrumente (id -> pipeline_id)
      const instrumentPipelineMap = new Map(instrumentsResult.map((i: any) => [i.id, i.pipeline]))
      
      // Creează un map pentru instrumente (id -> { id, name })
      const instrumentsMap = new Map(instrumentsResult.map((i: any) => [i.id, { id: i.id, name: i.name }]))
      
      // Încarcă toate tăvițele din fișă
      const trays = await listTraysForServiceSheet(fisaId)
      
      const services = servicesResult
      
      // Pentru fiecare tăviță, încarcă items-urile și calculează totalurile
      // Folosim exact aceeași logică ca în preturi.tsx
      const details = await Promise.all(
        trays.map(async (tray) => {
          const items = await listQuoteItems(tray.id, services, instrumentPipelineMap, pipelineMap, instrumentsMap)
          
          // Exclude items-urile cu item_type: null (doar instrument, fără serviciu) din calculele de totaluri
          const visibleItems = items.filter((it: any) => it.item_type !== null)
          
          // Calculează totalurile folosind aceeași logică ca în preturi.tsx
          const subtotal = visibleItems.reduce((acc: number, it: any) => acc + it.qty * it.price, 0)
          
          const totalDiscount = visibleItems.reduce(
            (acc: number, it: any) => acc + it.qty * it.price * (Math.min(100, Math.max(0, it.discount_pct)) / 100),
            0
          )
          
          // Urgent se preia din service_file, nu din tăviță
          // Va fi setat mai jos după ce încărcăm service_file
          const isUrgent = false // Va fi actualizat mai jos
          const urgentAmount = 0 // Va fi actualizat mai jos
          
          // Calculează reducerile pentru abonament (10% servicii, 5% piese) - exact ca în preturi.tsx PrintViewData
          const subscriptionType = tray.subscription_type || null
          
          // Calculează totalul pentru servicii (afterDisc + urgent)
          const servicesTotal = visibleItems
            .filter((it: any) => it.item_type === 'service')
            .reduce((acc: number, it: any) => {
              const base = it.qty * it.price
              const disc = base * (Math.min(100, Math.max(0, it.discount_pct)) / 100)
              const afterDisc = base - disc
              const urgent = isUrgent ? afterDisc * (30 / 100) : 0
              return acc + afterDisc + urgent
            }, 0)
          
          // Calculează totalul pentru piese (afterDisc)
          const partsTotal = visibleItems
            .filter((it: any) => it.item_type === 'part')
            .reduce((acc: number, it: any) => {
              const base = it.qty * it.price
              const disc = base * (Math.min(100, Math.max(0, it.discount_pct)) / 100)
              return acc + base - disc
            }, 0)
          
          // Aplică reducerile pentru abonament
          let subscriptionDiscount = 0
          let subscriptionDiscountServices = 0
          let subscriptionDiscountParts = 0
          
          if (subscriptionType === 'services' || subscriptionType === 'both') {
            subscriptionDiscountServices = servicesTotal * 0.10
            subscriptionDiscount += subscriptionDiscountServices
          }
          if (subscriptionType === 'parts' || subscriptionType === 'both') {
            subscriptionDiscountParts = partsTotal * 0.05
            subscriptionDiscount += subscriptionDiscountParts
          }
          
          // Total folosind aceeași formulă ca în preturi.tsx: baseTotal - subscriptionDiscountAmount
          const baseTotal = subtotal - totalDiscount + urgentAmount
          const total = baseTotal - subscriptionDiscount
          
          return {
            tray,
            items,
            subtotal,
            discount: totalDiscount,
            urgent: urgentAmount,
            subscriptionDiscount,
            subscriptionDiscountServices,
            subscriptionDiscountParts,
            subscriptionType,
            total
          }
        })
      )
      
      setTraysDetails(details)
    } catch (error) {
      console.error('Error loading trays details:', error)
      toast.error('Eroare la încărcarea detaliilor')
    } finally {
      setLoadingDetails(false)
    }
  }, [setLoadingDetails, setTraysDetails])

  // Funcție pentru calcularea sumei totale a tuturor tăvițelor din fișă
  const calculateTotalFisaSum = useCallback(async (fisaId: string) => {
    if (!fisaId) {
      setTotalFisaSum(null)
      return
    }
    
    setLoadingTotalSum(true)
    try {
      // Încarcă serviciile, instrumentele și pipeline-urile
      const [services, instrumentsResult, pipelinesResult] = await Promise.all([
        listServices(),
        supabaseClient.from('instruments').select('id,name,pipeline').then(({ data, error }) => {
          if (error) {
            console.error('Error loading instruments:', error)
            return []
          }
          return data || []
        }),
        supabaseClient.from('pipelines').select('id,name').then(({ data, error }) => {
          if (error) {
            console.error('Error loading pipelines:', error)
            return []
          }
          return data || []
        })
      ])
      
      // Creează un map pentru pipeline-uri (id -> name)
      const pipelineMap = new Map(pipelinesResult.map((p: any) => [p.id, p.name]))
      
      // Creează un map pentru instrumente (id -> pipeline_id)
      const instrumentPipelineMap = new Map(instrumentsResult.map((i: any) => [i.id, i.pipeline]))
      
      // Creează un map pentru instrumente (id -> { id, name })
      const instrumentsMap = new Map(instrumentsResult.map((i: any) => [i.id, { id: i.id, name: i.name }]))
      
      const trays = await listTraysForServiceSheet(fisaId)
      
      let totalSum = 0
      
      for (const tray of trays) {
        const items = await listQuoteItems(tray.id, services, instrumentPipelineMap, pipelineMap, instrumentsMap)
        
        // Exclude items-urile cu item_type: null (doar instrument, fără serviciu) din calculele de totaluri
        const visibleItems = items.filter((it: any) => it.item_type !== null)
        
        // Calculează totalurile folosind aceeași logică ca în loadTraysDetails
        const subtotal = visibleItems.reduce((acc: number, it: any) => acc + it.qty * it.price, 0)
        
        const totalDiscount = visibleItems.reduce(
          (acc: number, it: any) => acc + it.qty * it.price * (Math.min(100, Math.max(0, it.discount_pct)) / 100),
          0
        )
        
        // IMPORTANT: Încarcă urgent din service_file, nu din tăviță
        const { data: serviceFileData } = await getServiceFile(fisaId)
        const serviceFileUrgent = serviceFileData?.urgent || false
        const isUrgent = serviceFileUrgent
        const urgentAmount = isUrgent ? visibleItems.reduce((acc: number, it: any) => {
          const afterDisc = it.qty * it.price * (1 - Math.min(100, Math.max(0, it.discount_pct)) / 100)
          return acc + afterDisc * (30 / 100)
        }, 0) : 0
        
        const subscriptionType = tray.subscription_type || null
        
        const servicesTotal = visibleItems
          .filter((it: any) => it.item_type === 'service')
          .reduce((acc: number, it: any) => {
            const base = it.qty * it.price
            const disc = base * (Math.min(100, Math.max(0, it.discount_pct)) / 100)
            const afterDisc = base - disc
            const urgent = isUrgent ? afterDisc * (30 / 100) : 0
            return acc + afterDisc + urgent
          }, 0)
        
        const partsTotal = visibleItems
          .filter((it: any) => it.item_type === 'part')
          .reduce((acc: number, it: any) => {
            const base = it.qty * it.price
            const disc = base * (Math.min(100, Math.max(0, it.discount_pct)) / 100)
            return acc + base - disc
          }, 0)
        
        let subscriptionDiscount = 0
        
        if (subscriptionType === 'services' || subscriptionType === 'both') {
          subscriptionDiscount += servicesTotal * 0.10
        }
        if (subscriptionType === 'parts' || subscriptionType === 'both') {
          subscriptionDiscount += partsTotal * 0.05
        }
        
        const baseTotal = subtotal - totalDiscount + urgentAmount
        const total = baseTotal - subscriptionDiscount
        
        totalSum += total
      }
      
      setTotalFisaSum(totalSum)
    } catch (error) {
      console.error('Error calculating total fisa sum:', error)
      setTotalFisaSum(null)
    } finally {
      setLoadingTotalSum(false)
    }
  }, [setTotalFisaSum, setLoadingTotalSum])

  return {
    loadServiceSheets,
    listServiceSheetsForLead,
    listTraysForServiceSheet,
    listQuotesForLead,
    loadTraysDetails,
    calculateTotalFisaSum,
  }
}

// Export funcții helper pentru utilizare în alte hook-uri
// Funcție simplificată - încarcă items cu servicii din array
const listQuoteItems = async (
  trayId: string, 
  services?: any[], 
  instrumentPipelineMap?: Map<string, string | null>,
  pipelineMap?: Map<string, string>,
  instrumentsMap?: Map<string, { id: string; name: string }>
): Promise<any[]> => {
  
  // Query simplu fără join-uri (pentru a evita probleme RLS)
  const { data, error } = await supabaseClient
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
      created_at,
      tray_item_brands(id, brand, garantie, tray_item_brand_serials(id, serial_number))
    `)
    .eq('tray_id', trayId)
    .order('created_at')

  if (error) {
    console.error('[listQuoteItems] Error:', error)
    return []
  }

  // Procesează fiecare item - folosește services array pentru a găsi numele
  return (data || []).map((item: any) => {
    // Parsează notes
    let notesData: any = {}
    if (item.notes) {
      try {
        notesData = JSON.parse(item.notes)
      } catch (e) {}
    }
    
    // Determină item_type
    // IMPORTANT: Un item este "part" DOAR dacă are explicit part_id setat
    // Nu marcam automat ca "part" item-urile care au doar name în notes,
    // deoarece acestea pot fi instrumente sau item-uri incomplete
    let item_type: 'service' | 'part' | null = notesData.item_type || null
    if (!item_type) {
      if (item.service_id) {
        item_type = 'service'
      } else if (item.part_id) {
        item_type = 'part'
      }
      // Dacă nu are nici service_id nici part_id, rămâne null
      // (poate fi doar instrument sau item incomplet)
    }
    
    // Găsește serviciul în array-ul services
    let serviceName = ''
    let servicePrice = 0
    if (item.service_id && services && services.length > 0) {
      const foundService = services.find((s: any) => s.id === item.service_id)
      if (foundService) {
        serviceName = foundService.name || ''
        servicePrice = foundService.price || 0
      } else {
        console.warn('[listQuoteItems] Service not found for service_id:', item.service_id)
      }
    }
    
    // Obține numele - prioritate: service din array > notes
    let displayName = ''
    let price = notesData.price || 0
    
    if (serviceName) {
      displayName = serviceName
      price = servicePrice || price
    } else if (notesData.name) {
      displayName = notesData.name
    }
    
    // Obține numele instrumentului din map
    let instrumentName: string | null = null
    if (item.instrument_id && instrumentsMap) {
      const instr = instrumentsMap.get(item.instrument_id)
      instrumentName = instr?.name || null
    }
    
    // Obține departamentul și pipeline_id
    let department: string | null = null
    let pipelineId: string | null = null
    if (item.instrument_id && instrumentPipelineMap && pipelineMap) {
      pipelineId = instrumentPipelineMap.get(item.instrument_id) || null
      if (pipelineId) {
        department = pipelineMap.get(pipelineId) || null
      }
    }

    return {
      id: item.id,
      tray_id: item.tray_id,
      instrument_id: item.instrument_id,
      service_id: item.service_id,
      part_id: item.part_id,
      department_id: item.department_id,
      technician_id: item.technician_id,
      qty: item.qty || 1,
      notes: item.notes,
      created_at: item.created_at,
      // Câmpuri calculate
      item_type,
      name_snapshot: displayName,
      price: price || 0,
      discount_pct: notesData.discount_pct || 0,
      urgent: notesData.urgent || false,
      // Folosește brand și serial_number din câmpurile directe (pentru compatibilitate)
      // sau din primul brand din tray_item_brands dacă există
      brand: item.brand || (item.tray_item_brands && item.tray_item_brands.length > 0 
        ? item.tray_item_brands[0].brand 
        : null) || notesData.brand || null,
      serial_number: (() => {
        // Extrage serial_number - poate fi string sau obiect {serial, garantie}
        let serialValue: string | null = null
        
        if (item.serial_number) {
          if (typeof item.serial_number === 'string') {
            serialValue = item.serial_number
          } else if (typeof item.serial_number === 'object' && item.serial_number !== null && 'serial' in item.serial_number) {
            serialValue = (item.serial_number as any).serial || null
          } else {
            serialValue = String(item.serial_number)
          }
        }
        
        if (!serialValue && item.tray_item_brands && item.tray_item_brands.length > 0 
          && item.tray_item_brands[0].tray_item_brand_serials?.length > 0) {
          serialValue = item.tray_item_brands[0].tray_item_brand_serials[0].serial_number || null
        }
        
        if (!serialValue && notesData.serial_number) {
          if (typeof notesData.serial_number === 'string') {
            serialValue = notesData.serial_number
          } else if (typeof notesData.serial_number === 'object' && notesData.serial_number !== null && 'serial' in notesData.serial_number) {
            serialValue = notesData.serial_number.serial || null
          } else {
            serialValue = String(notesData.serial_number)
          }
        }
        
        return serialValue
      })(),
      garantie: (item.tray_item_brands && item.tray_item_brands.length > 0 
        ? item.tray_item_brands[0].garantie 
        : false) || notesData.garantie || false,
      // Include toate brand-urile cu serial numbers pentru afișare (noua structură)
      brand_groups: (() => {
        const safeBrands = Array.isArray(item.tray_item_brands) ? item.tray_item_brands : []
        const brandGroups = safeBrands.map((b: any) => {
          if (!b || typeof b !== 'object') {
            return { id: '', brand: '', garantie: false, serialNumbers: [] }
          }
          const safeSerials = Array.isArray(b.tray_item_brand_serials) ? b.tray_item_brand_serials : []
          // IMPORTANT: Include toate serial numbers-urile, inclusiv cele goale
          const serialNumbers = safeSerials.map((s: any) => s?.serial_number || '')
          // console.log(`[useLeadDetailsDataLoader] Loading brand "${b.brand}" with ${serialNumbers.length} serial numbers:`, serialNumbers)
          return {
            id: b.id || '',
            brand: b.brand || '',
            garantie: b.garantie || false,
            serialNumbers: serialNumbers
          }
        })
        // console.log(`[useLeadDetailsDataLoader] Loaded ${brandGroups.length} brand groups for item ${item.id}:`, brandGroups)
        return brandGroups
      })(),
      pipeline_id: pipelineId, // Adăugat pipeline_id pentru afișare în tabel
      department,
      instrument_name: instrumentName,
    }
  })
}

export { listServiceSheetsForLead, listTraysForServiceSheet, listQuotesForLead, listQuoteItems }

