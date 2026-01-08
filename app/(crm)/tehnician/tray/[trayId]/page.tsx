'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Plus, Trash2, Save, Loader2, Wrench, ImageIcon, ImagePlus, X, Download, ChevronUp, ChevronDown, Camera, Package, CircleDot, CheckCircle2, Clock, Pencil, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { 
  uploadTrayImage, 
  deleteTrayImage, 
  listTrayImages, 
  saveTrayImageReference, 
  deleteTrayImageReference,
  type TrayImage 
} from '@/lib/supabase/imageOperations'
import { listParts, type Part } from '@/lib/supabase/partOperations'
import { moveItemToStage } from '@/lib/supabase/pipelineOperations'
import { getPipelinesWithStages, logItemEvent } from '@/lib/supabase/leadOperations'

const supabase = supabaseBrowser()

interface TrayData {
  id: string
  number: string
  size: string
  status: 'in_receptie' | 'in_lucru' | 'gata'
  urgent: boolean
  service_file: {
    id: string
    number: string
    lead: {
      id: string
      full_name: string | null
      email: string | null
      phone_number: string | null
    }
  }
}

interface Instrument {
  id: string
  name: string
  department_id: string | null
  pipeline: string | null
}

interface Service {
  id: string
  name: string
  price: number
  instrument_id: string | null
  department_id: string | null
}

interface TrayItem {
  id: string
  tray_id: string
  instrument_id: string | null
  service_id: string | null
  part_id: string | null
  technician_id: string | null
  qty: number
  discount_pct?: number
  urgent?: boolean
  brand?: string | null
  serial_number?: string | null
  garantie?: boolean
  notes?: string | null
  // Joined data
  service?: Service
  department?: { id: string; name: string }
}

export default function TehnicianTrayPage() {
  const params = useParams<{ trayId: string }>()
  const router = useRouter()
  const trayId = params.trayId

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [trayData, setTrayData] = useState<TrayData | null>(null)
  const [instrument, setInstrument] = useState<Instrument | null>(null)
  const [trayItems, setTrayItems] = useState<TrayItem[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [departments, setDepartments] = useState<Record<string, { id: string; name: string }>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [technicians, setTechnicians] = useState<Record<string, string>>({})

  // State pentru adăugare serviciu
  const [addServiceOpen, setAddServiceOpen] = useState(false)
  const [newService, setNewService] = useState({
    service_id: '',
    instrument_id: '',
    discount_pct: 0,
    qty: 1,
  })
  
  // Lista tuturor instrumentelor pentru dropdown
  const [allInstruments, setAllInstruments] = useState<Instrument[]>([])
  
  // State pentru imagini
  const [trayImages, setTrayImages] = useState<TrayImage[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isImagesExpanded, setIsImagesExpanded] = useState(true)
  
  // State pentru status tăviță
  const [updatingStatus, setUpdatingStatus] = useState(false)
  
  // State pentru adăugare piesă
  const [addPartOpen, setAddPartOpen] = useState(false)
  const [newPart, setNewPart] = useState({
    part_id: '',
    qty: 1,
  })
  const [parts, setParts] = useState<Part[]>([])
  const [loadingParts, setLoadingParts] = useState(false)

  // State pentru editare inline
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{
    qty?: number
    discount_pct?: number
    urgent?: boolean
  }>({})

  // State pentru editare serviciu (dialog)
  const [editServiceOpen, setEditServiceOpen] = useState(false)
  const [editingServiceItem, setEditingServiceItem] = useState<TrayItem | null>(null)
  const [editService, setEditService] = useState({
    qty: 1,
    discount_pct: 0,
    price: 0,
    brand: '',
    serialNumber: '',
    garantie: false,
  })

  // State pentru pasare tăviță către alt tehnician
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>('')
  const [passingTray, setPassingTray] = useState(false)

  // Încărcare date
  useEffect(() => {
    if (!trayId) return
    loadData()
  }, [trayId])

  const loadData = async () => {
    setLoading(true)
    try {
      // Obține user-ul curent
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)

      // Încarcă tăvița cu service_file și lead
      const { data: tray, error: trayError } = await supabase
        .from('trays')
        .select(`
          id,
          number,
          size,
          status,
          service_file_id,
          service_file:service_files!inner(
            id,
            number,
            urgent,
            lead:leads!inner(
              id,
              full_name,
              email,
              phone_number
            )
          )
        `)
        .eq('id', trayId)
        .single()

      if (trayError) throw trayError
      if (!tray) throw new Error('Tăvița nu a fost găsită')

      setTrayData(tray as any)

      // Găsește toate tray_items pentru această tăviță
      const { data: allItems, error: itemError } = await supabase
        .from('tray_items')
        .select('instrument_id')
        .eq('tray_id', trayId)

      if (itemError) {
        // Dacă eroarea nu este PGRST116 (tabel inexistent), aruncă eroarea
        if (itemError.code !== 'PGRST116') {
          throw itemError
        }
        // Altfel, continuă fără items (tabelul poate să nu existe încă)
        console.warn('[TrayPage] loadData - PGRST116 error ignored, continuing without items')
      }

      // Găsește primul instrument valid
      const firstInstrumentId = allItems?.find(item => item.instrument_id)?.instrument_id

      if (firstInstrumentId) {
        // Încarcă instrumentul
        const { data: inst, error: instError } = await supabase
          .from('instruments')
          .select('*')
          .eq('id', firstInstrumentId)
          .single()

        if (instError) throw instError
        setInstrument(inst as Instrument)

        // Încarcă serviciile pentru acest instrument
        const { data: svcs, error: svcsError } = await supabase
          .from('services')
          .select('*')
          .eq('instrument_id', firstInstrumentId)
          .eq('active', true)
          .order('name')

        if (svcsError) throw svcsError
        setServices(svcs || [])
      }
      
      // Încarcă toate instrumentele pentru dropdown
      const { data: allInst, error: allInstError } = await supabase
        .from('instruments')
        .select('*')
        .eq('active', true)
        .order('name')
      
      if (!allInstError && allInst) {
        setAllInstruments(allInst as Instrument[])
      }
      
      // Încarcă toate serviciile active
      const { data: allSvcs, error: allSvcsError } = await supabase
        .from('services')
        .select('*')
        .eq('active', true)
        .order('name')

      if (!allSvcsError && allSvcs) {
        setServices(allSvcs)
      }

      // Încarcă piese
      await loadParts()

      // Încarcă departamentele
      const { data: depts, error: deptsError } = await supabase
        .from('departments')
        .select('*')

      if (deptsError) throw deptsError
      const deptMap: Record<string, { id: string; name: string }> = {}
      depts?.forEach((d: any) => {
        deptMap[d.id] = { id: d.id, name: d.name }
      })
      setDepartments(deptMap)

      // Încarcă tehnicienii din app_members
      const { data: membersData, error: membersError } = await supabase
        .from('app_members')
        .select('user_id, name')

      if (!membersError && membersData) {
        const techMap: Record<string, string> = {}
        membersData.forEach((m: any) => {
          const name = m.name || `User ${m.user_id.slice(0, 8)}`
          techMap[m.user_id] = name
        })
        setTechnicians(techMap)
      }

      // Încarcă toate tray_items pentru această tăviță
      try {
        await loadTrayItems(firstInstrumentId || null)
      } catch (trayItemsError: any) {
        console.error('[TrayPage] loadData - Error in loadTrayItems:', {
          message: trayItemsError?.message,
          code: trayItemsError?.code,
          details: trayItemsError?.details,
          hint: trayItemsError?.hint,
          fullError: trayItemsError
        })
        // Nu aruncăm eroarea aici, doar o logăm, pentru a permite încărcarea altor date
        toast.error(`Eroare la încărcare items: ${trayItemsError?.message || 'Eroare necunoscută'}`)
      }

    } catch (error: any) {
      console.error('[TrayPage] loadData - Eroare la încărcare:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        name: error?.name,
        stack: error?.stack,
        fullError: error
      })
      
      const errorMessage = error?.message || error?.code || 'Eroare necunoscută la încărcare date'
      toast.error(`Eroare: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const loadTrayItems = async (instrumentId: string | null) => {
    if (!trayId) {
      console.warn('[TrayPage] loadTrayItems called without trayId')
      return
    }

    try {
      // Încearcă mai întâi cu join-ul complet (inclusiv tray_item_brands)
      let data: any[] | null = null
      let error: any = null
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
            created_at,
            service:services(*),
            department:departments(id, name),
            instrument:instruments(id, name),
            tray_item_brands(id, brand, garantie, tray_item_brand_serials(id, serial_number))
          `)
          .eq('tray_id', trayId)
          .order('created_at')

        if (result.error) {
          console.error('[TrayPage] Query error:', {
            message: result.error.message,
            code: result.error.code,
            details: result.error.details,
            hint: result.error.hint,
            fullError: result.error
          })
          
          // Dacă eroarea este legată de tray_item_brands, încercă fără el
          if (result.error.message?.includes('tray_item_brands') || 
              result.error.code === 'PGRST116' ||
              result.error.message?.includes('relation') && result.error.message?.includes('tray_item_brands')) {
            console.warn('[TrayPage] tray_item_brands join failed, trying without it:', result.error.message)
            useNewStructure = false
          } else {
            throw result.error
          }
        } else {
          data = result.data
          error = null
        }
      } catch (e: any) {
        console.error('[TrayPage] Exception in first query attempt:', {
          message: e?.message,
          code: e?.code,
          name: e?.name,
          stack: e?.stack,
          fullError: e
        })
        
        // Dacă este o eroare de structură, încercă fără tray_item_brands
        if (e?.message?.includes('tray_item_brands') || 
            e?.code === 'PGRST116' ||
            (e?.message?.includes('relation') && e?.message?.includes('tray_item_brands'))) {
          console.warn('[TrayPage] tray_item_brands join failed (exception), trying without it:', e?.message)
          useNewStructure = false
        } else {
          throw e
        }
      }

      // Fallback: încarcă fără tray_item_brands dacă prima încercare a eșuat
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
            created_at,
            service:services(*),
            department:departments(id, name),
            instrument:instruments(id, name)
          `)
          .eq('tray_id', trayId)
          .order('created_at')

        if (result.error) {
          console.error('[TrayPage] Fallback query error:', {
            message: result.error.message,
            code: result.error.code,
            details: result.error.details,
            hint: result.error.hint,
            fullError: result.error
          })
          throw result.error
        }
        data = result.data
      }

      if (error) {
        console.error('[TrayPage] Error still present after queries:', error)
        throw error
      }
      
      const servicesJoined = data?.map((i: any) => ({ 
        service_id: i.service_id, 
        service_name: i.service?.name,
        has_service: !!i.service 
      })).filter((i: any) => i.service_id)
      
      // Verifică dacă join-ul cu services a funcționat (dacă RLS permite)
      // Dacă există service_id dar service este null, înseamnă că RLS blochează join-ul
      const itemsWithServiceIdButNoJoin = data?.filter((i: any) => i.service_id && !i.service) || []
      if (itemsWithServiceIdButNoJoin.length > 0) {
        console.warn('[TrayPage] RLS might be blocking service joins. Loading services separately...')
        // Încarcă serviciile separat ca fallback
        const serviceIds = itemsWithServiceIdButNoJoin.map((i: any) => i.service_id).filter(Boolean)
        if (serviceIds.length > 0) {
          const { data: servicesData, error: servicesError } = await supabase
            .from('services')
            .select('id, name, price')
            .in('id', serviceIds)
          
          if (!servicesError && servicesData) {
            // Creează un map pentru servicii
            const servicesMap = new Map(servicesData.map((s: any) => [s.id, s]))
            // Adaugă serviciile la items
            data?.forEach((item: any) => {
              if (item.service_id && !item.service && servicesMap.has(item.service_id)) {
                item.service = servicesMap.get(item.service_id)
              }
            })
          }
        }
      }

      // Parsează notes JSON pentru discount_pct, urgent
      // Brand și serial_number vin acum din tray_item_brands
      // Și asigură-te că serviciile au datele complete chiar dacă join-ul nu a funcționat
      const items = (data || []).map((item: any) => {
        let discount_pct = 0
        let urgent = false
        let brand = null
        let serial_number = null
        let garantie = false

        // Extrage brand și serial_number din tray_item_brands (noua structură)
        if (item.tray_item_brands && Array.isArray(item.tray_item_brands) && item.tray_item_brands.length > 0) {
          // Folosește primul brand (sau poți agrega toate)
          const firstBrand = item.tray_item_brands[0]
          if (firstBrand) {
            brand = firstBrand.brand || null
            garantie = firstBrand.garantie || false
            
            // Extrage serial numbers din primul brand
            if (firstBrand.tray_item_brand_serials && Array.isArray(firstBrand.tray_item_brand_serials) && firstBrand.tray_item_brand_serials.length > 0) {
              const serials = firstBrand.tray_item_brand_serials
                .map((s: any) => s?.serial_number)
                .filter((sn: any) => sn && sn.trim())
              serial_number = serials.length > 0 ? serials.join(', ') : null
            }
          }
        }
        
        // Fallback: dacă nu există tray_item_brands, încearcă să extragă din notes (pentru backwards compatibility)
        if (!brand && !serial_number && item.notes) {
          try {
            const notesData = JSON.parse(item.notes)
            if (notesData.brand) brand = notesData.brand
            if (notesData.serial_number) serial_number = notesData.serial_number
            if (notesData.garantie !== undefined) garantie = notesData.garantie
          } catch (e) {
            // Ignoră eroarea de parsing
          }
        }

        // Parsează notes JSON pentru discount_pct și urgent (brand/serial_number nu mai sunt în notes)
        if (item.notes) {
          try {
            const notesData = JSON.parse(item.notes)
            discount_pct = notesData.discount_pct || 0
            urgent = notesData.urgent || false
            // Nu mai căutăm brand și serial_number în notes, le luăm din tray_item_brands
          } catch (e) {
            // Notes nu este JSON valid, ignoră
          }
        }

        // Dacă itemul are service_id dar nu are service din join, încercă să-l găsească din state
        if (item.service_id && !item.service) {
          const serviceFromState = services.find(s => s.id === item.service_id)
          if (serviceFromState) {
            item.service = serviceFromState
          }
        }

        return {
          ...item,
          discount_pct,
          urgent,
          brand,
          serial_number,
          garantie,
        }
      })

      setTrayItems(items as TrayItem[])
      
      // Verifică dacă există item-uri atribuite utilizatorului curent
      // FOLOSIM FOR LOOP ÎN LOC DE .some() - MAI SIGUR
      const itemsArray = Array.isArray(items) ? items : []
      let hasAssignedItems = false
      for (let i = 0; i < itemsArray.length; i++) {
        const item = itemsArray[i]
        if (item && item.technician_id === currentUserId) {
          hasAssignedItems = true
          break
        }
      }
    } catch (error: any) {
      // Log detaliat al erorii
      const errorDetails = {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        name: error?.name,
        stack: error?.stack,
        toString: error?.toString?.(),
        stringified: JSON.stringify(error, Object.getOwnPropertyNames(error || {})),
        type: typeof error,
        isNull: error === null,
        isUndefined: error === undefined,
        keys: error && typeof error === 'object' ? Object.keys(error) : [],
        fullError: error
      }
      
      console.error('[TrayPage] Eroare la încărcare tray_items - Full details:', errorDetails)
      
      // Îmbunătățește mesajul de eroare
      let errorMessage = 'Eroare la încărcare items'
      if (error?.message) {
        errorMessage = error.message
      } else if (error?.code) {
        errorMessage = `Eroare ${error.code}: ${error.message || 'Eroare necunoscută'}`
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error && typeof error === 'object') {
        // Încearcă să extragă informații din obiectul de eroare
        try {
          errorMessage = JSON.stringify(error, Object.getOwnPropertyNames(error))
        } catch (e) {
          errorMessage = `Eroare: ${String(error)}`
        }
      } else if (error !== null && error !== undefined) {
        errorMessage = String(error)
      }
      
      toast.error(`Eroare: ${errorMessage}`)
      
      // Setează items-urile ca array gol pentru a evita erori ulterioare
      setTrayItems([])
    }
  }

  // Încarcă imaginile pentru tăviță
  const loadTrayImages = async () => {
    if (!trayId) return
    try {
      const images = await listTrayImages(trayId)
      setTrayImages(images)
    } catch (error) {
      console.error('[TrayPage] Error loading images:', error)
    }
  }

  // Încarcă imaginile la mount
  useEffect(() => {
    if (trayId) {
      loadTrayImages()
    }
  }, [trayId])

  // Încarcă piese
  const loadParts = async () => {
    setLoadingParts(true)
    try {
      const partsList = await listParts()
      setParts(partsList.filter(p => p.active))
    } catch (error: any) {
      console.error('[TrayPage] Error loading parts:', error)
      toast.error('Eroare la încărcarea pieselor')
    } finally {
      setLoadingParts(false)
    }
  }

  // Upload imagine
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0 || !trayId) return

    // Procesează fiecare fișier
    for (const file of Array.from(files)) {
      // Validare tip fișier
      if (!file.type.startsWith('image/')) {
        toast.error('Tip de fișier invalid', {
          description: 'Te rog selectează o imagine validă (JPG, PNG, etc.)'
        })
        continue
      }

      // Validare dimensiune (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Fișier prea mare', {
          description: 'Dimensiunea maximă este 5MB'
        })
        continue
      }

      setUploadingImage(true)
      const toastId = toast.loading('Se încarcă imaginea...')
      
      try {
        const { url, path } = await uploadTrayImage(trayId, file)
        await saveTrayImageReference(trayId, url, path, file.name)
        await loadTrayImages()
        toast.success('Imagine încărcată cu succes', { id: toastId })
      } catch (error: any) {
        console.error('[TrayPage] Error uploading image:', error)
        toast.error('Eroare la încărcare', { 
          id: toastId,
          description: error?.message || 'Te rog încearcă din nou' 
        })
      } finally {
        setUploadingImage(false)
      }
    }
    
    // Reset input
    event.target.value = ''
  }

  // Șterge imagine
  const handleImageDelete = async (imageId: string, filePath: string) => {
    try {
      await deleteTrayImage(filePath)
      await deleteTrayImageReference(imageId)
      setTrayImages(prev => prev.filter(img => img.id !== imageId))
      toast.success('Imagine ștearsă')
    } catch (error: any) {
      console.error('[TrayPage] Error deleting image:', error)
      toast.error('Eroare la ștergere', {
        description: error?.message || 'Te rog încearcă din nou'
      })
    }
  }

  // Descarcă toate imaginile
  const handleDownloadAllImages = async () => {
    if (trayImages.length === 0) {
      toast.error('Nu există imagini de descărcat')
      return
    }

    try {
      for (const image of trayImages) {
        const link = document.createElement('a')
        link.href = image.url
        link.download = image.filename
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      toast.success(`S-au descărcat ${trayImages.length} imagini`)
    } catch (error: any) {
      console.error('[TrayPage] Error downloading images:', error)
      toast.error('Eroare la descărcare')
    }
  }

  // Schimbă urgent-ul tăviței
  const handleUrgentChange = async (urgent: boolean) => {
    if (!trayId || !trayData || !trayData.service_file_id) return
    
    try {
      // IMPORTANT: urgent este gestionat la nivel de service_file, nu de tăviță
      const { getServiceFile, updateServiceFile } = await import('@/lib/supabase/serviceFileOperations')
      const { error } = await updateServiceFile(trayData.service_file_id, { urgent })
      
      if (error) throw error
      
      // Reîncarcă datele pentru a reflecta modificarea
      await loadData()
      toast.success(urgent ? 'Fișă marcată ca urgentă' : 'Fișă nemarcată ca urgentă')
    } catch (error: any) {
      console.error('Eroare la actualizare urgent:', error)
      toast.error('Eroare la actualizare')
    }
  }

  // Schimbă statusul tăviței și mută lead-ul în stage-ul corespunzător
  const handleStatusChange = async (newStatus: 'in_receptie' | 'in_lucru' | 'gata') => {
    if (!trayId || !trayData) return
    
    setUpdatingStatus(true)
    try {
      // Actualizează statusul tăviței
      const { error: trayError } = await supabase
        .from('trays')
        .update({ status: newStatus })
        .eq('id', trayId)
      
      if (trayError) throw trayError
      
      setTrayData({ ...trayData, status: newStatus })
      
      // Mută lead-ul în stage-ul corespunzător
      const leadId = trayData.service_file.lead.id
      if (leadId) {
        try {
          // Obține toate pipeline-urile și stage-urile
          const pipelinesData = await getPipelinesWithStages()
          
          // Găsește pipeline-ul care conține lead-ul
          const { data: pipelineItem } = await supabase
            .from('pipeline_items')
            .select('pipeline_id, stage_id')
            .eq('type', 'lead')
            .eq('item_id', leadId)
            .maybeSingle()
          
          if (pipelineItem && pipelinesData) {
            const pipeline = pipelinesData.find((p: any) => p.id === pipelineItem.pipeline_id)
            
            if (pipeline) {
              let targetStageName = ''
              
              // Determină stage-ul țintă în funcție de status (cu variante de nume)
              let targetStage: any = null
              
              if (newStatus === 'gata') {
                // Mută în "Finalizat" - caută variante
                targetStage = pipeline.stages.find((s: any) => {
                  const name = s.name.toLowerCase()
                  return name.includes('finalizat') || name.includes('finalizare') || name === 'finalizat'
                })
              } else if (newStatus === 'in_lucru') {
                // Mută în "Asteptare" - caută variante
                targetStage = pipeline.stages.find((s: any) => {
                  const name = s.name.toLowerCase()
                  return name.includes('asteptare') || name.includes('astept') || name === 'asteptare'
                })
              } else if (newStatus === 'in_receptie') {
                // Mută în "In Lucru" - caută variante
                targetStage = pipeline.stages.find((s: any) => {
                  const name = s.name.toLowerCase()
                  return (name.includes('in lucru') || name.includes('în lucru') || name === 'in lucru') && 
                         !name.includes('asteptare')
                })
              }
              
              if (targetStage) {
                const { error: moveError } = await moveItemToStage(
                  'lead',
                  leadId,
                  pipeline.id,
                  targetStage.id
                )
                
                if (moveError) {
                  console.error('[TrayPage] Error moving lead to stage:', moveError)
                  toast.error('Eroare la mutarea în stage')
                } else {
                  toast.success(`Tavita mutată în ${targetStage.name}`)
                }
              } else {
                const statusLabel = newStatus === 'gata' ? 'Finalizat' : 
                                   newStatus === 'in_lucru' ? 'Asteptare' : 'In Lucru'
                console.warn(`[TrayPage] Stage "${statusLabel}" nu a fost găsit în pipeline`)
                toast.success(`Status actualizat: ${getStatusLabel(newStatus)}`)
              }
            }
          }
        } catch (moveError: any) {
          console.error('[TrayPage] Error in move lead logic:', moveError)
          // Continuă oricum, statusul tăviței a fost actualizat
          toast.success(`Status actualizat: ${getStatusLabel(newStatus)}`)
        }
      } else {
        toast.success(`Status actualizat: ${getStatusLabel(newStatus)}`)
      }
    } catch (error: any) {
      console.error('[TrayPage] Error updating status:', error)
      toast.error('Eroare la actualizare status')
    } finally {
      setUpdatingStatus(false)
    }
  }
  
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in_receptie': return 'În recepție'
      case 'in_lucru': return 'În lucru'
      case 'gata': return 'Finalizată'
      default: return status
    }
  }

  // Adaugă piesă nouă
  const handleAddPart = async () => {
    if (!newPart.part_id) {
      toast.error('Selectează o piesă')
      return
    }
    
    if (!currentUserId) {
      toast.error('Nu ești autentificat')
      return
    }

    const selectedPart = parts.find(p => p.id === newPart.part_id)
    if (!selectedPart) {
      toast.error('Piesa selectată nu există')
      return
    }

    setSaving(true)
    try {
      // Folosește instrumentul curent dacă există
      const instrumentId = instrument?.id || null
      
      // Șterge înregistrarea cu doar instrumentul dacă există și avem un instrument
      if (instrumentId) {
        const instrumentOnlyItems = trayItems.filter(i => 
          i.instrument_id === instrumentId && isInstrumentOnly(i)
        )
        
        if (instrumentOnlyItems.length > 0) {
          for (const instrumentItem of instrumentOnlyItems) {
            const { error: deleteError } = await supabase
              .from('tray_items')
              .delete()
              .eq('id', instrumentItem.id)
            
            if (deleteError) {
              console.error('[TrayPage] Error deleting instrument-only item:', deleteError)
              // Continuă oricum, nu este critic
            }
          }
        }
      }

      const notesData = {
        item_type: 'part',
        price: selectedPart.price,
        name: selectedPart.name,
      }

      // Găsește departamentul "Reparații" pentru piese (case-insensitive, cu sau fără diacritice)
      let reparatiiDeptId = Object.entries(departments).find(
        ([_, dept]) => {
          const deptNameLower = dept.name.toLowerCase()
          return deptNameLower.includes('reparat') || deptNameLower === 'reparatii' || deptNameLower === 'reparații'
        }
      )?.[0] || null

      // Dacă nu s-a găsit în departments map, încercă direct din baza de date
      if (!reparatiiDeptId) {
        const { data: reparatiiDept, error: deptError } = await supabase
          .from('departments')
          .select('id, name')
          .or('name.ilike.Reparatii,name.ilike.Reparații')
          .limit(1)
          .maybeSingle() as { data: { id: string; name: string } | null; error: any }

        if (!deptError && reparatiiDept) {
          reparatiiDeptId = reparatiiDept.id
          // Actualizează și departments map pentru viitoare utilizări
          setDepartments(prev => ({
            ...prev,
            [reparatiiDept.id]: { id: reparatiiDept.id, name: reparatiiDept.name }
          }))
        }
      }

      // Dacă încă nu s-a găsit departamentul, aruncă o eroare clară
      if (!reparatiiDeptId) {
        throw new Error('Departamentul "Reparații" nu a fost găsit în baza de date. Contactează administratorul.')
      }

      const { error } = await supabase
        .from('tray_items')
        .insert({
          tray_id: trayId,
          instrument_id: instrumentId,
          service_id: null,
          part_id: selectedPart.id,
          department_id: reparatiiDeptId,
          technician_id: currentUserId,
          qty: newPart.qty,
          notes: JSON.stringify(notesData),
        })

      if (error) throw error

      toast.success('Piesă adăugată cu succes')
      setAddPartOpen(false)
      setNewPart({ part_id: '', qty: 1 })
      await loadTrayItems(null)
    } catch (error: any) {
      console.error('[TrayPage] Error adding part:', error)
      toast.error(`Eroare: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Calculează prețul cu discount și urgent (urgent se preia de pe tăviță)
  const calculatePrice = (item: TrayItem) => {
    let basePrice = 0
    
    // Verifică dacă este piesă (din notes)
    if (item.notes) {
      try {
        const notesData = JSON.parse(item.notes)
        if (notesData.item_type === 'part' && notesData.price) {
          basePrice = notesData.price
        }
      } catch (e) {}
    }
    
    // Pentru servicii, verifică dacă există preț override în notes
    if (basePrice === 0 && item.notes) {
      try {
        const notesData = JSON.parse(item.notes)
        if (notesData.item_type === 'service' && notesData.price) {
          basePrice = notesData.price
        }
      } catch (e) {}
    }
    
    // Dacă nu există preț override, folosește prețul serviciului
    if (basePrice === 0) {
      if (item.service?.price) {
        basePrice = item.service.price
      } else if (item.service_id) {
        // Fallback: caută serviciul în array-ul services din state
        const serviceFromState = services.find(s => s.id === item.service_id)
        if (serviceFromState) {
          basePrice = serviceFromState.price
        }
      }
    }
    
    let price = basePrice * item.qty
    // Urgent se preia din service_file, nu din tăviță
    const serviceFileUrgent = (trayData as any)?.service_file?.urgent || false
    if (serviceFileUrgent) {
      price = price * 1.3 // +30%
    }
    if (item.discount_pct) {
      price = price * (1 - item.discount_pct / 100)
    }
    return price
  }
  
  // Verifică dacă itemul este doar instrument (fără serviciu/piesă)
  const isInstrumentOnly = (item: TrayItem) => {
    if (item.notes) {
      try {
        const notesData = JSON.parse(item.notes)
        // Dacă item_type este explicit null, este doar instrument
        if (notesData.item_type === null) {
          return true
        }
      } catch (e) {}
    }
    // Dacă nu are service_id și nu este piesă, este doar instrument
    if (!item.service_id && !item.notes) {
      return true
    }
    // Verifică dacă notes nu are item_type setat și nu are service_id
    if (!item.service_id) {
      try {
        const notesData = item.notes ? JSON.parse(item.notes) : {}
        if (!notesData.item_type && !notesData.name && !notesData.price) {
          return true
        }
      } catch (e) {
        // Dacă notes nu este JSON valid și nu are service_id, probabil este doar instrument
        return true
      }
    }
    return false
  }
  
  // Obține numele itemului (serviciu sau piesă)
  const getItemName = (item: TrayItem) => {
    // Dacă este doar instrument, nu returna nume
    if (isInstrumentOnly(item)) {
      return ''
    }
    
    // Verifică dacă este piesă
    if (item.notes) {
      try {
        const notesData = JSON.parse(item.notes)
        if (notesData.item_type === 'part') {
          return notesData.name || 'Piesă'
        }
      } catch (e) {}
    }
    
    // Pentru servicii, caută în array-ul services din state folosind service_id
    if (item.service_id) {
      // Încearcă mai întâi din join
      if (item.service?.name) {
        return item.service.name
      }
      // Fallback: caută în array-ul services din state
      const serviceFromState = services.find(s => s.id === item.service_id)
      if (serviceFromState) {
        return serviceFromState.name
      }
    }
    
    // Fallback: dacă nu există service, verifică notes
    if (item.notes) {
      try {
        const notesData = JSON.parse(item.notes)
        return notesData.name || ''
      } catch (e) {}
    }
    
    return ''
  }
  
  // Verifică dacă itemul este piesă
  const isPart = (item: TrayItem) => {
    if (item.notes) {
      try {
        const notesData = JSON.parse(item.notes)
        return notesData.item_type === 'part'
      } catch (e) {}
    }
    return false
  }

  // Calculează totalul pentru tăviță (exclude items-urile cu doar instrument)
  const trayTotal = useMemo(() => {
    return trayItems
      .filter(item => {
        // Exclude items-urile cu doar instrument
        if (item.notes) {
          try {
            const notesData = JSON.parse(item.notes)
            if (notesData.item_type === null) {
              return false
            }
          } catch (e) {}
        }
        // Dacă nu are service_id și nu este piesă, exclude
        if (!item.service_id) {
          try {
            const notesData = item.notes ? JSON.parse(item.notes) : {}
            if (!notesData.item_type && !notesData.name && !notesData.price) {
              return false
            }
          } catch (e) {
            // Dacă notes nu este JSON valid și nu are service_id, exclude
            return false
          }
        }
        return true
      })
      .reduce((sum, item) => {
        let basePrice = 0
        if (item.notes) {
          try {
            const notesData = JSON.parse(item.notes)
            if (notesData.item_type === 'part' && notesData.price) {
              basePrice = notesData.price
            }
          } catch (e) {}
        }
        // Pentru servicii, verifică dacă există preț override în notes
        if (basePrice === 0 && item.notes) {
          try {
            const notesData = JSON.parse(item.notes)
            if (notesData.item_type === 'service' && notesData.price) {
              basePrice = notesData.price
            }
          } catch (e) {}
        }
        
        if (basePrice === 0 && item.service) {
          basePrice = item.service.price
        }
        let price = basePrice * item.qty
        // Urgent se preia din service_file, nu din tăviță
        const serviceFileUrgent = (trayData as any)?.service_file?.urgent || false
        if (serviceFileUrgent) {
          price = price * 1.3
        }
        if (item.discount_pct) {
          price = price * (1 - item.discount_pct / 100)
        }
        return sum + price
      }, 0)
  }, [trayItems, trayData])

  // Serviciile filtrate după instrumentul selectat
  const filteredServices = useMemo(() => {
    const selectedInstrumentId = newService.instrument_id || instrument?.id
    if (!selectedInstrumentId) return services
    return services.filter(s => s.instrument_id === selectedInstrumentId || !s.instrument_id)
  }, [services, newService.instrument_id, instrument?.id])

  // Adaugă serviciu nou
  const handleAddService = async () => {
    const instrumentId = newService.instrument_id || instrument?.id
    
    if (!newService.service_id) {
      toast.error('Selectează un serviciu')
      return
    }
    
    if (!instrumentId) {
      toast.error('Selectează un instrument')
      return
    }
    
    if (!newService.qty || newService.qty < 1) {
      toast.error('Introdu cantitatea (minim 1)')
      return
    }
    
    if (!currentUserId) {
      toast.error('Nu ești autentificat')
      return
    }

    setSaving(true)
    try {
      const selectedService = services.find(s => s.id === newService.service_id)
      if (!selectedService) {
        toast.error('Serviciul selectat nu există')
        return
      }

      // Șterge înregistrarea cu doar instrumentul dacă există
      const instrumentOnlyItems = trayItems.filter(i => 
        i.instrument_id === instrumentId && isInstrumentOnly(i)
      )
      
      if (instrumentOnlyItems.length > 0) {
        for (const instrumentItem of instrumentOnlyItems) {
          const { error: deleteError } = await supabase
            .from('tray_items')
            .delete()
            .eq('id', instrumentItem.id)
          
          if (deleteError) {
            console.error('[TrayPage] Error deleting instrument-only item:', deleteError)
            // Continuă oricum, nu este critic
          }
        }
      }

      // Parsează notes JSON (urgent se preia de pe tăviță, nu de pe serviciu)
      const notesData = {
        item_type: 'service',
        discount_pct: newService.discount_pct || 0,
      }

      const insertData = {
        tray_id: trayId,
        instrument_id: instrumentId,
        service_id: newService.service_id,
        department_id: selectedService.department_id,
        technician_id: currentUserId,
        qty: newService.qty, // Cantitatea introdusă manual
        notes: JSON.stringify(notesData),
      }

      const { data, error } = await supabase
        .from('tray_items')
        .insert(insertData)
        .select()

      if (error) {
        console.error('[TrayPage] Insert error:', error)
        console.error('[TrayPage] Insert data that failed:', insertData)
        throw error
      }
      
      // Reîncarcă lista de servicii IMEDIAT după inserare pentru a avea join-ul cu services
      await loadTrayItems(null)
      
      toast.success('Serviciu adăugat cu succes')
      setAddServiceOpen(false)
      setNewService({ service_id: '', instrument_id: '', discount_pct: 0, qty: 1 })
    } catch (error: any) {
      console.error('Eroare la adăugare serviciu:', error)
      toast.error(`Eroare: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Deschide dialog-ul pentru editarea unui serviciu
  const handleEditService = (item: TrayItem) => {
    // Obține prețul curent (din notes dacă există override, altfel din service)
    let currentPrice = 0
    if (item.notes) {
      try {
        const notesData = JSON.parse(item.notes)
        if (notesData.price && notesData.item_type === 'service') {
          currentPrice = notesData.price
        }
      } catch (e) {}
    }
    
    // Dacă nu există preț override, folosește prețul din service
    if (currentPrice === 0) {
      if (item.service?.price) {
        currentPrice = item.service.price
      } else if (item.service_id) {
        const serviceFromState = services.find(s => s.id === item.service_id)
        if (serviceFromState) {
          currentPrice = serviceFromState.price
        }
      }
    }
    
    setEditingServiceItem(item)
    setEditService({
      qty: item.qty || 1,
      discount_pct: item.discount_pct || 0,
      price: currentPrice,
      brand: item.brand || '',
      serialNumber: item.serial_number || '',
      garantie: item.garantie || false,
    })
    setEditServiceOpen(true)
  }

  // Salvează editarea serviciului
  const handleSaveEditService = async () => {
    if (!editingServiceItem) return

    setSaving(true)
    try {
      const item = editingServiceItem

      // Reconstruiește notes JSON (fără brand și serial_number - acestea sunt în tabele separate)
      const notesData: any = {
        item_type: item.notes ? (() => {
          try {
            const parsed = JSON.parse(item.notes)
            return parsed.item_type || 'service'
          } catch {
            return 'service'
          }
        })() : 'service',
        discount_pct: editService.discount_pct || 0,
        price: editService.price, // Salvează prețul în notes pentru override
      }

      const updateData: any = {
        qty: editService.qty,
        notes: JSON.stringify(notesData),
      }

      // Actualizează tray_item
      const { error } = await supabase
        .from('tray_items')
        .update(updateData)
        .eq('id', editingServiceItem.id)

      if (error) throw error

      // IMPORTANT: Actualizează brand și serial number în tabelele tray_item_brands și tray_item_brand_serials
      const { deleteAllTrayItemBrands, createTrayItemBrandsWithSerials } = await import('@/lib/supabase/trayItemBrandSerials')
      
      // Șterge brand-urile existente
      await deleteAllTrayItemBrands(editingServiceItem.id)
      
      // Creează brand și serial number dacă sunt completate
      if (editService.brand && editService.brand.trim()) {
        const serialNumbers = editService.serialNumber 
          ? editService.serialNumber.split(',').map(sn => sn.trim()).filter(sn => sn)
          : []
        
        await createTrayItemBrandsWithSerials(editingServiceItem.id, [{
          brand: editService.brand.trim(),
          serialNumbers: serialNumbers,
          garantie: editService.garantie || false,
        }])
      }

      toast.success('Serviciu actualizat cu succes')
      setEditServiceOpen(false)
      setEditingServiceItem(null)
      await loadTrayItems(null)
    } catch (error: any) {
      console.error('Eroare la actualizare serviciu:', error)
      toast.error(`Eroare: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Actualizează item inline
  const handleUpdateItem = async (itemId: string, field: string, value: any) => {
    try {
      const item = trayItems.find(i => i.id === itemId)
      if (!item) return

      // Reconstruiește notes JSON (urgent se setează pe tăviță, nu pe item)
      const notesData = {
        discount_pct: field === 'discount_pct' ? value : (item.discount_pct || 0),
        brand: item.brand || null,
        serial_number: item.serial_number || null,
        garantie: item.garantie || false,
      }

      const updateData: any = {}
      if (field === 'qty') {
        updateData.qty = value
      }
      updateData.notes = JSON.stringify(notesData)

      const { error } = await supabase
        .from('tray_items')
        .update(updateData)
        .eq('id', itemId)

      if (error) throw error

      toast.success('Actualizat')
      await loadTrayItems(instrument?.id || null)
    } catch (error: any) {
      console.error('Eroare la actualizare:', error)
      toast.error(`Eroare: ${error.message}`)
    }
  }

  // Șterge item
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Ești sigur că vrei să ștergi acest serviciu?')) return

    try {
      const item = trayItems.find(i => i.id === itemId)
      if (!item) return

      // Verifică dacă este ultimul serviciu/piesă pentru instrument
      const itemsForInstrument = trayItems.filter(i => 
        i.instrument_id === item.instrument_id && !isInstrumentOnly(i)
      )
      
      // Dacă este ultimul serviciu/piesă, păstrează o înregistrare goală cu instrumentul
      if (itemsForInstrument.length === 1 && item.instrument_id) {
        // Găsește sau creează o înregistrare cu doar instrumentul
        const instrumentOnlyItem = trayItems.find(i => 
          i.instrument_id === item.instrument_id && isInstrumentOnly(i)
        )
        
        if (instrumentOnlyItem) {
          // Există deja o înregistrare cu doar instrumentul, șterge doar serviciul
          const { error } = await supabase
            .from('tray_items')
            .delete()
            .eq('id', itemId)

          if (error) throw error
        } else {
          // Creează o înregistrare goală cu doar instrumentul înainte de a șterge serviciul
          // Păstrează valorile care nu pot fi null din itemul original
          const { error: createError } = await supabase
            .from('tray_items')
            .insert({
              tray_id: trayId,
              instrument_id: item.instrument_id,
              service_id: null,
              department_id: item.department_id, // Păstrează department_id
              technician_id: item.technician_id || currentUserId,
              qty: item.qty || 1, // Păstrează cantitatea instrumentului
              notes: JSON.stringify({ item_type: null }),
            })

          if (createError) throw createError

          // Acum șterge serviciul
          const { error } = await supabase
            .from('tray_items')
            .delete()
            .eq('id', itemId)

          if (error) throw error
        }
      } else {
        // Nu este ultimul serviciu, șterge normal
        const { error } = await supabase
          .from('tray_items')
          .delete()
          .eq('id', itemId)

        if (error) throw error
      }

      toast.success('Serviciu șters')
      await loadTrayItems(instrument?.id || null)
    } catch (error: any) {
      console.error('Eroare la ștergere:', error)
      toast.error(`Eroare: ${error.message}`)
    }
  }

  // Status badge
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'in_receptie': { label: 'In receptie', variant: 'secondary' },
      'in_lucru': { label: 'In lucru', variant: 'default' },
      'gata': { label: 'Finalizata', variant: 'outline' },
    }
    const statusInfo = statusMap[status] || { label: status, variant: 'secondary' }
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!trayData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-muted-foreground mb-4">Tăvița nu a fost găsită</p>
        <Button onClick={() => router.back()}>Înapoi</Button>
      </div>
    )
  }

  const lead = trayData.service_file.lead

  return (
    <div className="min-h-screen bg-background pb-20 px-[3px] md:px-0">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b p-4 md:p-4">
        <div className="flex items-center justify-between mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Înapoi
          </Button>
          <div className="text-right">
            <p className="text-lg font-bold text-primary">{trayTotal.toFixed(2)} RON</p>
          </div>
        </div>
        <div className="mb-3">
          <h1 className="text-lg md:text-xl font-semibold">
            Tăviță #{trayData.number}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {trayData.size} • {trayData.status === 'in_receptie' ? 'În recepție' : 
                              trayData.status === 'in_lucru' ? 'În lucru' : 
                              trayData.status === 'gata' ? 'Gata' : trayData.status}
          </p>
        </div>
        
        {/* Status Buttons - Desktop: full buttons, Mobile: compact */}
        <div className="flex gap-2">
          {/* Desktop: Butoane complete */}
          <div className="hidden md:flex gap-2 flex-1">
            <Button
              variant={trayData.status === 'in_receptie' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusChange('in_receptie')}
              disabled={updatingStatus}
              className="flex-1 gap-1.5"
            >
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs">Preia Tavita</span>
            </Button>
            <Button
              variant={trayData.status === 'in_lucru' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusChange('in_lucru')}
              disabled={updatingStatus}
              className="flex-1 gap-1.5"
            >
              <CircleDot className="h-3.5 w-3.5" />
              <span className="text-xs">Astept piesa</span>
            </Button>
            <Button
              variant={trayData.status === 'gata' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusChange('gata')}
              disabled={updatingStatus}
              className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="text-xs">Gata</span>
            </Button>
          </div>
          
          {/* Mobile: Butoane compacte */}
          <div className="md:hidden flex gap-1.5 flex-1">
            <Button
              variant={trayData.status === 'in_receptie' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusChange('in_receptie')}
              disabled={updatingStatus}
              className="flex-1 h-9 px-2"
              title="Preia Tavita"
            >
              <Clock className="h-4 w-4" />
            </Button>
            <Button
              variant={trayData.status === 'in_lucru' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusChange('in_lucru')}
              disabled={updatingStatus}
              className="flex-1 h-9 px-2"
              title="Astept piesa"
            >
              <CircleDot className="h-4 w-4" />
            </Button>
            <Button
              variant={trayData.status === 'gata' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusChange('gata')}
              disabled={updatingStatus}
              className="flex-1 h-9 px-2 bg-green-600 hover:bg-green-700 text-white"
              title="Gata"
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Switch Urgent - pentru toată fișa de serviciu */}
        <div className="flex items-center gap-2 mt-3">
          <Switch
            checked={(trayData as any)?.service_file?.urgent || false}
            onCheckedChange={handleUrgentChange}
          />
          <Label className={cn("text-sm font-medium", (trayData as any)?.service_file?.urgent && "text-amber-600")}>
            Urgent (+30%)
          </Label>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-[3px] md:p-6 space-y-4 md:space-y-6">
        {/* Bloc Instrument */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Instrument
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {instrument ? (
              <>
                <div>
                  <Label className="text-sm text-muted-foreground">Instrument</Label>
                  <p className="font-medium">{instrument.name}</p>
                </div>
                {(instrument.department_id && departments[instrument.department_id]?.name === 'Reparatii') && (
                  <>
                    {trayItems.length > 0 && (trayItems[0]?.brand || trayItems[0]?.serial_number || trayItems[0]?.garantie) && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm text-muted-foreground">Brand</Label>
                            <p className="font-medium">{trayItems[0]?.brand || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-sm text-muted-foreground">Serial Number</Label>
                            <p className="font-medium">{trayItems[0]?.serial_number || '-'}</p>
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Garantie</Label>
                          <p className="font-medium">{trayItems[0]?.garantie ? 'Da' : 'Nu'}</p>
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">
                Nu există instrument asociat. Adaugă un serviciu pentru a selecta instrumentul.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Bloc Pasare Tăviță către Alt Tehnician */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Pasare Tăviță
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label className="text-sm">Selectează tehnician</Label>
              <div className="flex items-center gap-2">
                <Select 
                  value={selectedTechnicianId} 
                  onValueChange={setSelectedTechnicianId}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Alege tehnician" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(technicians)
                      .filter(([id]) => id !== currentUserId) // Exclude utilizatorul curent
                      .map(([id, name]) => (
                        <SelectItem key={id} value={id}>
                          {name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={async () => {
                    if (!trayId) {
                      toast.error('Tăvița nu a fost găsită')
                      return
                    }

                    if (!selectedTechnicianId) {
                      toast.error('Selectează un tehnician')
                      return
                    }

                    setPassingTray(true)
                    try {
                      // Obține tehnicianul vechi (dacă există)
                      const { data: prevTechRow, error: prevError } = await supabase
                        .from('tray_items')
                        .select('technician_id')
                        .eq('tray_id', trayId)
                        .not('technician_id', 'is', null)
                        .limit(1)
                        .single()

                      if (prevError && prevError.code !== 'PGRST116') {
                        console.error('Error loading previous technician for tray:', prevError)
                      }

                      const previousTechnicianId = (prevTechRow as any)?.technician_id || null

                      // Actualizează technician_id pentru toate tray_items din tăviță
                      const { error: updateError } = await supabase
                        .from('tray_items')
                        .update({ technician_id: selectedTechnicianId } as any)
                        .eq('tray_id', trayId)
                      
                      if (updateError) {
                        console.error('Error passing tray to technician:', updateError)
                        toast.error('Eroare la pasarea tăviței')
                        return
                      }

                      // Găsește numele tehnicienilor pentru mesaj
                      const newTechName = technicians[selectedTechnicianId] || 'tehnician necunoscut'
                      const prevTechName = previousTechnicianId
                        ? (technicians[previousTechnicianId] || 'tehnician necunoscut')
                        : 'Fără atribuire'

                      // Loghează evenimentul în istoricul tăviței
                      try {
                        const leadId = trayData?.service_file?.lead?.id
                        if (leadId) {
                          await logItemEvent(
                            'tray',
                            trayId,
                            `Tăvița a fost pasată de la "${prevTechName}" la "${newTechName}"`,
                            'tray_passed',
                            {
                              from_technician_id: previousTechnicianId,
                              to_technician_id: selectedTechnicianId,
                              tray_id: trayId,
                              lead_id: leadId,
                            }
                          )
                        }
                      } catch (logError) {
                        console.error('Error logging tray pass event:', logError)
                      }

                      toast.success(`Tăvița a fost atribuită cu succes către ${newTechName}`)
                      setSelectedTechnicianId('')
                      
                      // Reîncarcă toate datele pentru a reflecta modificările
                      await loadData()
                    } catch (error) {
                      console.error('Error passing tray:', error)
                      toast.error('Eroare la pasarea tăviței')
                    } finally {
                      setPassingTray(false)
                    }
                  }}
                  disabled={passingTray || !selectedTechnicianId}
                  className="h-10"
                >
                  {passingTray ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Se atribuie...
                    </>
                  ) : (
                    'Pasare'
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Transferă tăvița către alt tehnician. Toate item-urile din tăviță vor fi atribuite noului tehnician.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Bloc Servicii și Piese */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base md:text-lg">Servicii & Piese</CardTitle>
            </div>
            {/* Butoane de adăugare */}
            <div className="flex gap-2 mt-2 md:mt-3">
              <Button 
                onClick={() => setAddServiceOpen(true)} 
                className="flex-1 text-sm md:text-base"
                size="sm"
              >
                <Plus className="h-4 w-4 md:h-5 md:w-5 mr-1" />
                Serviciu
              </Button>
              <Button 
                onClick={() => setAddPartOpen(true)} 
                variant="outline"
                className="flex-1 text-sm md:text-base"
                size="sm"
              >
                <Package className="h-4 w-4 md:h-5 md:w-5 mr-1" />
                Piesă
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {trayItems.filter(item => !isInstrumentOnly(item)).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nu există servicii sau piese adăugate.
              </div>
            ) : (
              <>
                {/* Desktop: Tabel */}
                <div className="hidden md:block border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nume</TableHead>
                      <TableHead className="w-16">Tip</TableHead>
                      <TableHead className="w-20">Cant.</TableHead>
                      <TableHead className="w-24">Preț</TableHead>
                      <TableHead className="w-20">Disc%</TableHead>
                      <TableHead className="w-32">Departament</TableHead>
                      <TableHead className="w-32">Tehnician</TableHead>
                      <TableHead className="w-20">Acțiuni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trayItems.filter(item => !isInstrumentOnly(item)).map((item) => (
                      <TableRow 
                        key={item.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleEditService(item)}
                      >
                        <TableCell className="font-medium">
                          {getItemName(item)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isPart(item) ? 'secondary' : 'outline'} className="text-xs">
                            {isPart(item) ? 'Piesă' : 'Serviciu'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.qty}
                            onChange={(e) => handleUpdateItem(item.id, 'qty', Number(e.target.value))}
                            className="w-16 h-8"
                            min="1"
                          />
                        </TableCell>
                        <TableCell>
                          {calculatePrice(item).toFixed(2)} RON
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.discount_pct || 0}
                            onChange={(e) => handleUpdateItem(item.id, 'discount_pct', Number(e.target.value))}
                            className="w-16 h-8"
                            min="0"
                            max="100"
                          />
                        </TableCell>
                        <TableCell>
                          {item.department?.name || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.technician_id ? (technicians[item.technician_id] || 'Necunoscut') : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditService(item)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteItem(item.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Mobile: Card-uri */}
              <div className="md:hidden space-y-3 px-[3px]">
                {trayItems.filter(item => !isInstrumentOnly(item)).map((item) => {
                  // Obține numele instrumentului pentru serviciu
                  let instrumentName = null
                  if (item.service?.instrument_id) {
                    const inst = allInstruments.find(i => i.id === item.service.instrument_id)
                    instrumentName = inst?.name || null
                  } else if (item.instrument_id) {
                    const inst = allInstruments.find(i => i.id === item.instrument_id)
                    instrumentName = inst?.name || null
                  }
                  
                  const itemName = getItemName(item)
                  // Nu afișa card-ul dacă nu are nume (este doar instrument)
                  if (!itemName) return null
                  
                  return (
                    <Card 
                      key={item.id} 
                      className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleEditService(item)}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-base">
                                {itemName}
                              </h4>
                              <Badge variant={isPart(item) ? 'secondary' : 'outline'} className="text-[10px] px-1.5">
                                {isPart(item) ? 'Piesă' : 'Serviciu'}
                              </Badge>
                            </div>
                            {instrumentName && (
                              <p className="text-sm text-muted-foreground mb-1">
                                Instrument: {instrumentName}
                              </p>
                            )}
                            <p className="text-sm font-semibold text-primary">
                              {calculatePrice(item).toFixed(2)} RON
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Cantitate: {item.qty} • Preț unitar: {(() => {
                                // Verifică dacă există preț override în notes (pentru servicii sau piese)
                                if (item.notes) {
                                  try {
                                    const notesData = JSON.parse(item.notes)
                                    if (notesData.price) {
                                      return notesData.price.toFixed(2)
                                    }
                                  } catch {
                                    // Ignoră eroarea
                                  }
                                }
                                // Pentru servicii, folosește prețul din service
                                if (item.service?.price) {
                                  return item.service.price.toFixed(2)
                                }
                                // Fallback pentru servicii din state
                                if (item.service_id) {
                                  const serviceFromState = services.find(s => s.id === item.service_id)
                                  if (serviceFromState) {
                                    return serviceFromState.price.toFixed(2)
                                  }
                                }
                                return '0.00'
                              })()} RON
                            </p>
                          </div>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditService(item)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteItem(item.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        
                        <div>
                          <Label className="text-xs text-muted-foreground">Discount %</Label>
                          <p className="text-sm font-medium">{item.discount_pct || 0}%</p>
                        </div>
                        
                        <div className="text-xs text-muted-foreground">
                          Departament: {item.department?.name || '-'}
                        </div>
                        
                        {item.technician_id && (
                          <div className="text-xs text-muted-foreground pt-2 border-t">
                            Tehnician: {technicians[item.technician_id] || 'Necunoscut'}
                          </div>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Bloc Imagini - Galerie modernă pentru mobil */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Camera className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Galerie Imagini</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {trayImages.length === 0 ? 'Nicio imagine' : 
                     trayImages.length === 1 ? '1 imagine' : `${trayImages.length} imagini`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {trayImages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadAllImages}
                    className="h-8 px-2"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsImagesExpanded(!isImagesExpanded)}
                  className="h-8 w-8 p-0"
                >
                  {isImagesExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          
          {isImagesExpanded && (
            <CardContent className="pt-2 space-y-4">
              {/* Zona de upload - optimizată pentru mobil */}
              <label
                htmlFor="tray-image-upload-mobile"
                className={cn(
                  "relative flex flex-col items-center justify-center w-full py-6 px-4 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer",
                  uploadingImage 
                    ? 'border-primary/40 bg-primary/5' 
                    : 'border-border hover:border-primary/50 hover:bg-primary/5 bg-muted/20 active:bg-primary/10'
                )}
              >
                <input
                  type="file"
                  id="tray-image-upload-mobile"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploadingImage}
                  multiple
                />
                
                {uploadingImage ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-full bg-primary/10 animate-pulse">
                      <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    </div>
                    <span className="text-sm font-medium text-primary">Se încarcă...</span>
                  </div>
                ) : (
                  <>
                    <div className="p-3 rounded-full bg-muted/50 mb-2">
                      <ImagePlus className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground text-center">
                      Apasă pentru a adăuga imagini
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      sau folosește camera
                    </p>
                  </>
                )}
              </label>
              
              {/* Grid imagini - optimizat pentru mobil */}
              {trayImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {trayImages.map((image, idx) => (
                    <div 
                      key={image.id} 
                      className="group relative aspect-square rounded-xl overflow-hidden bg-muted/30 ring-1 ring-border/30"
                    >
                      <img
                        src={image.url}
                        alt={image.filename}
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Overlay cu gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      
                      {/* Buton ștergere - vizibil mereu pe mobil */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleImageDelete(image.id, image.file_path)
                        }}
                        className="absolute top-2 right-2 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-red-500 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      
                      {/* Nume fișier */}
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-[11px] font-medium text-white truncate">
                          {image.filename}
                        </p>
                      </div>
                      
                      {/* Badge număr */}
                      <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/40 backdrop-blur-sm text-xs font-medium text-white">
                        #{idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="p-4 rounded-full bg-muted/30 mb-3">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground">Nu există imagini</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Adaugă imagini pentru a documenta tăvița
                  </p>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>

      {/* Bottom Sheet - Adaugă serviciu */}
      <Sheet open={addServiceOpen} onOpenChange={setAddServiceOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[85vh] overflow-y-auto px-4 md:px-6">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-lg md:text-xl">Adaugă serviciu</SheetTitle>
            <SheetDescription className="text-sm md:text-base">
              {instrument ? `Selectează un serviciu pentru ${instrument.name}` : 'Selectează un instrument și serviciu'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-4 md:space-y-5">
            {/* Dropdown Instrument - afișat doar dacă nu avem instrument pre-setat */}
            {!instrument && (
              <div>
                <Label>Instrument *</Label>
                <Select
                  value={newService.instrument_id}
                  onValueChange={(value) => setNewService({ ...newService, instrument_id: value, service_id: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selectează instrument" />
                  </SelectTrigger>
                  <SelectContent>
                    {allInstruments.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div>
              <Label>Serviciu *</Label>
              <Select
                value={newService.service_id}
                onValueChange={(value) => setNewService({ ...newService, service_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selectează serviciu" />
                </SelectTrigger>
                <SelectContent>
                  {filteredServices.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      {!instrument && !newService.instrument_id 
                        ? 'Selectează mai întâi un instrument' 
                        : 'Nu există servicii disponibile'}
                    </SelectItem>
                  ) : (
                    filteredServices.map((svc) => (
                      <SelectItem key={svc.id} value={svc.id}>
                        {svc.name} - {svc.price.toFixed(2)} RON
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Cantitate *</Label>
              <Input
                type="number"
                value={newService.qty}
                onChange={(e) => setNewService({ ...newService, qty: Number(e.target.value) || 1 })}
                min="1"
                required
              />
            </div>
            
            <div>
              <Label>Discount %</Label>
              <Input
                type="number"
                value={newService.discount_pct}
                onChange={(e) => setNewService({ ...newService, discount_pct: Number(e.target.value) })}
                min="0"
                max="100"
              />
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setAddServiceOpen(false)}
              >
                Anulează
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddService}
                disabled={!newService.service_id || !newService.qty || newService.qty < 1 || (!instrument && !newService.instrument_id) || saving}
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvează
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Bottom Sheet - Editează serviciu */}
      <Sheet open={editServiceOpen} onOpenChange={setEditServiceOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[85vh] overflow-y-auto px-4 md:px-6">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-lg md:text-xl">Editează serviciu</SheetTitle>
            <SheetDescription className="text-sm md:text-base">
              {editingServiceItem && getItemName(editingServiceItem)}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-4 md:space-y-5">
            <div>
              <Label>Cantitate *</Label>
              <Input
                type="number"
                value={editService.qty}
                onChange={(e) => setEditService({ ...editService, qty: Number(e.target.value) || 1 })}
                min="1"
                required
              />
            </div>
            
            <div>
              <Label>Preț unitar (RON) *</Label>
              <Input
                type="number"
                step="0.01"
                value={editService.price}
                onChange={(e) => setEditService({ ...editService, price: Number(e.target.value) || 0 })}
                min="0"
                required
              />
            </div>
            
            <div>
              <Label>Discount %</Label>
              <Input
                type="number"
                value={editService.discount_pct}
                onChange={(e) => setEditService({ ...editService, discount_pct: Number(e.target.value) || 0 })}
                min="0"
                max="100"
              />
            </div>
            
            {/* Brand și Serial Number - doar pentru pipeline Reparații */}
            <div className="border-t pt-4 space-y-4">
              <div>
                <Label>Brand</Label>
                <Input
                  type="text"
                  value={editService.brand}
                  onChange={(e) => setEditService({ ...editService, brand: e.target.value })}
                  placeholder="Introduceți brand-ul instrumentului"
                />
              </div>
              
              <div>
                <Label>Serial Number</Label>
                <Input
                  type="text"
                  value={editService.serialNumber}
                  onChange={(e) => setEditService({ ...editService, serialNumber: e.target.value })}
                  placeholder="Introduceți serial number (separate prin virgulă pentru mai multe)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Pentru mai multe serial numbers, separați-le prin virgulă
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="garantie-edit"
                  checked={editService.garantie}
                  onChange={(e) => setEditService({ ...editService, garantie: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="garantie-edit" className="cursor-pointer">
                  Garanție
                </Label>
              </div>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setEditServiceOpen(false)
                  setEditingServiceItem(null)
                }}
              >
                Anulează
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveEditService}
                disabled={!editService.qty || editService.qty < 1 || !editService.price || editService.price <= 0 || saving}
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvează
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Bottom Sheet - Adaugă piesă */}
      <Sheet open={addPartOpen} onOpenChange={setAddPartOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[85vh] overflow-y-auto px-4 md:px-6">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-lg md:text-xl">Adaugă piesă</SheetTitle>
            <SheetDescription className="text-sm md:text-base">
              Selectează o piesă din catalog. Prețul se va completa automat.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-4 md:space-y-5">
            <div>
              <Label className="text-sm md:text-base mb-2 block">Piesă *</Label>
              {loadingParts ? (
                <div className="flex items-center gap-2 py-3">
                  <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" />
                  <span className="text-sm md:text-base text-muted-foreground">Se încarcă piesele...</span>
                </div>
              ) : (
                <Select
                  value={newPart.part_id}
                  onValueChange={(value) => setNewPart({ ...newPart, part_id: value })}
                >
                  <SelectTrigger className="w-full h-10 md:h-11 text-sm md:text-base">
                    <SelectValue placeholder="Selectează o piesă" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {parts.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        Nu există piese disponibile
                      </SelectItem>
                    ) : (
                      parts.map((part) => (
                        <SelectItem key={part.id} value={part.id} className="text-sm md:text-base">
                          <div className="flex items-center justify-between w-full">
                            <span className="flex-1">{part.name}</span>
                            <span className="ml-2 text-muted-foreground font-medium">
                              {part.price.toFixed(2)} RON
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
              {newPart.part_id && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
                  <p className="text-sm md:text-base text-muted-foreground">
                    Preț unitar: <span className="font-semibold text-foreground text-lg">
                      {parts.find(p => p.id === newPart.part_id)?.price.toFixed(2) || '0.00'} RON
                    </span>
                  </p>
                </div>
              )}
            </div>
            
            <div>
              <Label className="text-sm md:text-base mb-2 block">Cantitate</Label>
              <Input
                type="number"
                value={newPart.qty}
                onChange={(e) => setNewPart({ ...newPart, qty: Number(e.target.value) || 1 })}
                min="1"
                className="w-full h-10 md:h-11 text-sm md:text-base"
              />
            </div>
            
            <div className="flex gap-3 pt-4 md:pt-6">
              <Button
                variant="outline"
                className="flex-1 h-11 md:h-12 text-sm md:text-base"
                onClick={() => {
                  setAddPartOpen(false)
                  setNewPart({ part_id: '', qty: 1 })
                }}
              >
                Anulează
              </Button>
              <Button
                className="flex-1 h-11 md:h-12 text-sm md:text-base"
                onClick={handleAddPart}
                disabled={!newPart.part_id || saving}
              >
                {saving && <Loader2 className="h-4 w-4 md:h-5 md:w-5 mr-2 animate-spin" />}
                Salvează
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}



