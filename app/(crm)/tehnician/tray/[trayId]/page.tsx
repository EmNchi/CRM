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
import { ArrowLeft, Plus, Trash2, Save, Loader2, Wrench, ImageIcon, ImagePlus, X, Download, ChevronUp, ChevronDown, Camera, Package, CircleDot, CheckCircle2, Clock } from 'lucide-react'
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

const supabase = supabaseBrowser()

interface TrayData {
  id: string
  number: string
  size: string
  status: 'in_receptie' | 'in_lucru' | 'gata'
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
  technician_id: string | null
  qty: number
  discount_pct?: number
  urgent?: boolean
  brand?: string | null
  serial_number?: string | null
  garantie?: boolean
  notes?: string | null
  name_snapshot?: string | null
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
    qty: 1,
    discount_pct: 0,
    urgent: false,
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
    name: '',
    price: 0,
    qty: 1,
  })

  // State pentru editare inline
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{
    qty?: number
    discount_pct?: number
    urgent?: boolean
  }>({})

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

      console.log('[TrayPage] Loaded tray:', tray)
      setTrayData(tray as any)

      // Găsește toate tray_items pentru această tăviță
      const { data: allItems, error: itemError } = await supabase
        .from('tray_items')
        .select('instrument_id')
        .eq('tray_id', trayId)

      if (itemError && itemError.code !== 'PGRST116') {
        throw itemError
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
        console.log('[TrayPage] Loaded instruments:', allInst.length)
        setAllInstruments(allInst as Instrument[])
      }
      
      // Încarcă toate serviciile active
      const { data: allSvcs, error: allSvcsError } = await supabase
        .from('services')
        .select('*')
        .eq('active', true)
        .order('name')

      if (!allSvcsError && allSvcs) {
        console.log('[TrayPage] Loaded services:', allSvcs.length)
        setServices(allSvcs)
      }

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
        .select('user_id, name, email')

      if (!membersError && membersData) {
        const techMap: Record<string, string> = {}
        membersData.forEach((m: any) => {
          const name = m.name || m.email?.split('@')[0] || `User ${m.user_id.slice(0, 8)}`
          techMap[m.user_id] = name
        })
        setTechnicians(techMap)
      }

      // Încarcă toate tray_items pentru această tăviță
      await loadTrayItems(firstInstrumentId || null)

    } catch (error: any) {
      console.error('Eroare la încărcare:', error)
      toast.error(`Eroare: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const loadTrayItems = async (instrumentId: string | null) => {
    if (!trayId) return

    try {
      // Încarcă TOATE serviciile pentru această tăviță (nu filtrăm după instrument)
      const { data, error } = await supabase
        .from('tray_items')
        .select(`
          *,
          service:services(*),
          department:departments(id, name),
          instrument:instruments(id, name)
        `)
        .eq('tray_id', trayId)
        .order('created_at')

      if (error) throw error
      
      console.log('[TrayPage] Loaded tray_items from DB:', data?.length, 'items')
      console.log('[TrayPage] Raw data:', JSON.stringify(data, null, 2))

      // Parsează notes JSON pentru discount_pct, urgent, brand, serial_number, garantie
      const items = (data || []).map((item: any) => {
        let discount_pct = 0
        let urgent = false
        let brand = null
        let serial_number = null
        let garantie = false

        if (item.notes) {
          try {
            const notesData = JSON.parse(item.notes)
            discount_pct = notesData.discount_pct || 0
            urgent = notesData.urgent || false
            brand = notesData.brand || null
            serial_number = notesData.serial_number || null
            garantie = notesData.garantie || false
          } catch (e) {
            // Notes nu este JSON valid, ignoră
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

      console.log('[TrayPage] Processed items:', items.length, items)
      setTrayItems(items as TrayItem[])
    } catch (error: any) {
      console.error('[TrayPage] Eroare la încărcare tray_items:', error)
      toast.error(`Eroare: ${error.message}`)
    }
  }

  // Încarcă imaginile pentru tăviță
  const loadTrayImages = async () => {
    if (!trayId) return
    try {
      const images = await listTrayImages(trayId)
      console.log('[TrayPage] Loaded images:', images.length)
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

  // Schimbă statusul tăviței
  const handleStatusChange = async (newStatus: 'in_receptie' | 'in_lucru' | 'gata') => {
    if (!trayId || !trayData) return
    
    setUpdatingStatus(true)
    try {
      const { error } = await supabase
        .from('trays')
        .update({ status: newStatus })
        .eq('id', trayId)
      
      if (error) throw error
      
      setTrayData({ ...trayData, status: newStatus })
      toast.success(`Status actualizat: ${getStatusLabel(newStatus)}`)
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
    if (!newPart.name.trim()) {
      toast.error('Introdu numele piesei')
      return
    }
    
    if (!currentUserId) {
      toast.error('Nu ești autentificat')
      return
    }

    setSaving(true)
    try {
      const notesData = {
        item_type: 'part',
        price: newPart.price,
        name: newPart.name.trim(),
      }

      const { error } = await supabase
        .from('tray_items')
        .insert({
          tray_id: trayId,
          instrument_id: null,
          service_id: null,
          department_id: null,
          technician_id: currentUserId,
          qty: newPart.qty,
          name_snapshot: newPart.name.trim(),
          notes: JSON.stringify(notesData),
        })

      if (error) throw error

      toast.success('Piesă adăugată cu succes')
      setAddPartOpen(false)
      setNewPart({ name: '', price: 0, qty: 1 })
      await loadTrayItems(null)
    } catch (error: any) {
      console.error('[TrayPage] Error adding part:', error)
      toast.error(`Eroare: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Calculează prețul cu discount și urgent
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
    
    // Dacă nu este piesă, folosește prețul serviciului
    if (basePrice === 0 && item.service) {
      basePrice = item.service.price
    }
    
    let price = basePrice * item.qty
    if (item.urgent) {
      price = price * 1.3 // +30%
    }
    if (item.discount_pct) {
      price = price * (1 - item.discount_pct / 100)
    }
    return price
  }
  
  // Obține numele itemului (serviciu sau piesă)
  const getItemName = (item: TrayItem) => {
    // Verifică dacă este piesă
    if (item.notes) {
      try {
        const notesData = JSON.parse(item.notes)
        if (notesData.item_type === 'part') {
          return item.name_snapshot || notesData.name || 'Piesă'
        }
      } catch (e) {}
    }
    return item.service?.name || item.name_snapshot || 'Serviciu necunoscut'
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

  // Calculează totalul pentru tăviță
  const trayTotal = useMemo(() => {
    return trayItems.reduce((sum, item) => sum + calculatePrice(item), 0)
  }, [trayItems])

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

      // Parsează notes JSON
      const notesData = {
        discount_pct: newService.discount_pct || 0,
        urgent: newService.urgent || false,
      }

      console.log('[TrayPage] Adding service:', {
        tray_id: trayId,
        instrument_id: instrumentId,
        service_id: newService.service_id,
        department_id: selectedService.department_id,
        technician_id: currentUserId,
        qty: newService.qty,
      })

      const { data, error } = await supabase
        .from('tray_items')
        .insert({
          tray_id: trayId,
          instrument_id: instrumentId,
          service_id: newService.service_id,
          department_id: selectedService.department_id,
          technician_id: currentUserId,
          qty: newService.qty,
          notes: JSON.stringify(notesData),
        })
        .select()

      if (error) {
        console.error('[TrayPage] Insert error:', error)
        throw error
      }

      console.log('[TrayPage] Service added:', data)
      toast.success('Serviciu adăugat cu succes')
      setAddServiceOpen(false)
      setNewService({ service_id: '', instrument_id: '', qty: 1, discount_pct: 0, urgent: false })
      
      // Reîncarcă lista de servicii
      await loadTrayItems(null)
    } catch (error: any) {
      console.error('Eroare la adăugare serviciu:', error)
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

      // Reconstruiește notes JSON
      const notesData = {
        discount_pct: field === 'discount_pct' ? value : (item.discount_pct || 0),
        urgent: field === 'urgent' ? value : (item.urgent || false),
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
      const { error } = await supabase
        .from('tray_items')
        .delete()
        .eq('id', itemId)

      if (error) throw error

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
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b p-4">
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
            {lead.full_name || 'Fără nume'} · Fișa {trayData.service_file.number} · Tăviță {trayData.number}
          </h1>
        </div>
        
        {/* Status Buttons */}
        <div className="flex gap-2">
          <Button
            variant={trayData.status === 'in_receptie' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleStatusChange('in_receptie')}
            disabled={updatingStatus}
            className="flex-1 gap-1.5"
          >
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs">Recepție</span>
          </Button>
          <Button
            variant={trayData.status === 'in_lucru' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleStatusChange('in_lucru')}
            disabled={updatingStatus}
            className="flex-1 gap-1.5"
          >
            <CircleDot className="h-3.5 w-3.5" />
            <span className="text-xs">În lucru</span>
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
      </header>

      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
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

        {/* Bloc Servicii și Piese */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Servicii & Piese</CardTitle>
            </div>
            {/* Butoane de adăugare */}
            <div className="flex gap-2 mt-2">
              <Button 
                onClick={() => setAddServiceOpen(true)} 
                className="flex-1"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Serviciu
              </Button>
              <Button 
                onClick={() => setAddPartOpen(true)} 
                variant="outline"
                className="flex-1"
                size="sm"
              >
                <Package className="h-4 w-4 mr-1" />
                Piesă
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {trayItems.length === 0 ? (
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
                      <TableHead className="w-20">Urgent</TableHead>
                      <TableHead className="w-32">Tehnician</TableHead>
                      <TableHead className="w-20">Acțiuni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trayItems.map((item) => (
                      <TableRow key={item.id}>
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
                          <Switch
                            checked={item.urgent || false}
                            onCheckedChange={(checked) => handleUpdateItem(item.id, 'urgent', checked)}
                          />
                        </TableCell>
                        <TableCell>
                          {item.department?.name || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.technician_id ? (technicians[item.technician_id] || 'Necunoscut') : '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Mobile: Card-uri */}
              <div className="md:hidden space-y-3">
                {trayItems.map((item) => (
                  <Card key={item.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-base">
                              {getItemName(item)}
                            </h4>
                            <Badge variant={isPart(item) ? 'secondary' : 'outline'} className="text-[10px] px-1.5">
                              {isPart(item) ? 'Piesă' : 'Serviciu'}
                            </Badge>
                          </div>
                          <p className="text-sm font-semibold text-primary">
                            {calculatePrice(item).toFixed(2)} RON
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteItem(item.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Cantitate</Label>
                          <Input
                            type="number"
                            value={item.qty}
                            onChange={(e) => handleUpdateItem(item.id, 'qty', Number(e.target.value))}
                            className="h-9"
                            min="1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Discount %</Label>
                          <Input
                            type="number"
                            value={item.discount_pct || 0}
                            onChange={(e) => handleUpdateItem(item.id, 'discount_pct', Number(e.target.value))}
                            className="h-9"
                            min="0"
                            max="100"
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.urgent || false}
                            onCheckedChange={(checked) => handleUpdateItem(item.id, 'urgent', checked)}
                          />
                          <Label className="text-sm">Urgent (+30%)</Label>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.department?.name || '-'}
                        </div>
                      </div>
                      
                      {item.technician_id && (
                        <div className="text-xs text-muted-foreground pt-2 border-t">
                          Tehnician: {technicians[item.technician_id] || 'Necunoscut'}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
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
        <SheetContent side="bottom" className="h-auto max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Adaugă serviciu</SheetTitle>
            <SheetDescription>
              {instrument ? `Selectează un serviciu pentru ${instrument.name}` : 'Selectează un instrument și serviciu'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-4">
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
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cantitate</Label>
                <Input
                  type="number"
                  value={newService.qty}
                  onChange={(e) => setNewService({ ...newService, qty: Number(e.target.value) })}
                  min="1"
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
            </div>
            
            <div className="flex items-center gap-3">
              <Switch
                checked={newService.urgent}
                onCheckedChange={(checked) => setNewService({ ...newService, urgent: checked })}
              />
              <Label>Urgent (+30%)</Label>
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
                disabled={!newService.service_id || (!instrument && !newService.instrument_id) || saving}
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
        <SheetContent side="bottom" className="h-auto max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Adaugă piesă</SheetTitle>
            <SheetDescription>
              Adaugă o piesă sau material pentru această tăviță
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-4">
            <div>
              <Label>Nume piesă *</Label>
              <Input
                value={newPart.name}
                onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
                placeholder="Ex: Șurub M4, Cablu alimentare..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Preț unitar (RON)</Label>
                <Input
                  type="number"
                  value={newPart.price}
                  onChange={(e) => setNewPart({ ...newPart, price: Number(e.target.value) })}
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <Label>Cantitate</Label>
                <Input
                  type="number"
                  value={newPart.qty}
                  onChange={(e) => setNewPart({ ...newPart, qty: Number(e.target.value) })}
                  min="1"
                />
              </div>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setAddPartOpen(false)}
              >
                Anulează
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddPart}
                disabled={!newPart.name.trim() || saving}
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvează
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}


