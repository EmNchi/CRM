'use client'

import { useState, useEffect } from 'react'
import { KanbanLead } from '@/lib/types/database'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Mail, Phone, Clock, Tag, FileText, Package, User, Loader2, Wrench, ExternalLink, CheckCircle, Plus, Trash2, Pencil, Save, X as XIcon, MessageSquare, ImagePlus, Image as ImageIcon, Download } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ro } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { listServiceFilesForLead, listTraysForServiceFile, listTrayItemsForTray, updateTrayItem, updateServiceFile, type TrayItem } from '@/lib/supabase/serviceFileOperations'
import { uploadTrayImage, deleteTrayImage, listTrayImages, saveTrayImageReference, deleteTrayImageReference, type TrayImage } from '@/lib/supabase/imageOperations'
import { moveItemToStage } from '@/lib/supabase/pipelineOperations'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'
import { toast } from 'sonner'
import { useMemo, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import LeadMessenger from '@/components/leads/lead-messenger'

const supabase = supabaseBrowser()

interface ServiceFile {
  id: string
  number: string
  status: string
  date: string
}

interface Tray {
  id: string
  number: string
  size: string
  status: string
  service_file_id: string
}

interface LeadDetailsSheetProps {
  lead: KanbanLead | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onMove?: () => void
  onEdit?: () => void
  pipelineSlug?: string
  stages?: string[]
  onStageChange?: (leadId: string, newStage: string) => void
}

export function LeadDetailsSheet({
  lead,
  open,
  onOpenChange,
  onMove,
  onEdit,
  pipelineSlug,
  stages = [],
  onStageChange,
}: LeadDetailsSheetProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [serviceFiles, setServiceFiles] = useState<ServiceFile[]>([])
  const [trays, setTrays] = useState<Tray[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [isTechnician, setIsTechnician] = useState(false)
  
  // Verifică dacă suntem în pipeline-ul Vanzari
  const isVanzariPipeline = useMemo(() => {
    if (!pipelineSlug) return false
    return pipelineSlug.toLowerCase().includes('vanzari') || pipelineSlug.toLowerCase().includes('sales')
  }, [pipelineSlug])
  
  // State pentru tab-ul "Fișă" (pentru tehnicieni)
  const [trayItems, setTrayItems] = useState<TrayItem[]>([])
  const [loadingTrayItems, setLoadingTrayItems] = useState(false)
  const [services, setServices] = useState<Array<{ id: string; name: string; price: number; instrument_id: string | null }>>([])
  const [instruments, setInstruments] = useState<Array<{ id: string; name: string }>>([])
  const [parts, setParts] = useState<Array<{ id: string; name: string; price: number }>>([])
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ qty?: number; discount_pct?: number; urgent?: boolean }>({})
  
  // State pentru dialog-uri de adăugare
  const [addServiceOpen, setAddServiceOpen] = useState(false)
  const [addPartOpen, setAddPartOpen] = useState(false)
  const [newService, setNewService] = useState({ service_id: '', qty: 1 })
  const [newPart, setNewPart] = useState({ part_id: '', qty: 1 })
  
  // State pentru imagini tăviță
  const [trayImages, setTrayImages] = useState<TrayImage[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [loadingImages, setLoadingImages] = useState(false)
  
  // State pentru detalii fișă client (nu mai per tăviță)
  const [trayDetails, setTrayDetails] = useState<string>('')
  const [loadingTrayDetails, setLoadingTrayDetails] = useState(false)
  const [savingTrayDetails, setSavingTrayDetails] = useState(false)
  
  // State pentru informații tăviță
  const [trayInfo, setTrayInfo] = useState<{ number?: string; size?: string; status?: string } | null>(null)
  
  // Verificări pentru pipeline-uri departament
  const isDepartmentPipeline = useMemo(() => {
    if (!pipelineSlug) return false
    const slug = pipelineSlug.toLowerCase()
    return slug === 'saloane' || slug === 'frizerii' || slug === 'horeca' || slug === 'reparatii'
  }, [pipelineSlug])

  const isReparatiiPipeline = useMemo(() => {
    if (!pipelineSlug) return false
    return pipelineSlug.toLowerCase() === 'reparatii'
  }, [pipelineSlug])

  const isSaloaneHorecaFrizeriiPipeline = useMemo(() => {
    if (!pipelineSlug) return false
    const slug = pipelineSlug.toLowerCase()
    return slug === 'saloane' || slug === 'frizerii' || slug === 'horeca'
  }, [pipelineSlug])
  
  // Verifică dacă utilizatorul este tehnician
  useEffect(() => {
    async function checkTechnician() {
      if (!user?.id) {
        setIsTechnician(false)
        return
      }
      const { data } = await supabase
        .from('app_members')
        .select('user_id, role')
        .eq('user_id', user.id)
        .single()
      
      setIsTechnician(!!data && (data as any).role !== 'owner' && (data as any).role !== 'admin')
    }
    checkTechnician()
  }, [user])
  
  const handleOpenTray = (trayId: string) => {
    router.push(`/tehnician/tray/${trayId}`)
    onOpenChange(false) // Închide sheet-ul
  }

  // Obține leadId - poate fi lead.id sau lead.leadId
  const getLeadId = () => {
    if (!lead) return null
    return lead.leadId || lead.id
  }

  // Handler pentru butonul "Finalizare"
  const handleFinalizare = useCallback(async () => {
    if (!lead) return
    const leadAny = lead as any
    
    const finalizareStage = stages.find(s => s.toUpperCase() === 'FINALIZATA')
    
    if (!finalizareStage) {
      toast.error('Stage-ul FINALIZATA nu există în acest pipeline')
      return
    }

    if (isDepartmentPipeline && leadAny?.type === 'tray' && leadAny?.pipelineId) {
      try {
        const { data: stageData, error: stageError } = await supabase
          .from('stages')
          .select('id')
          .eq('pipeline_id', leadAny.pipelineId)
          .eq('name', finalizareStage)
          .single()
        
        if (stageError || !stageData) {
          console.error('Error finding stage:', stageError, 'Looking for:', finalizareStage)
          toast.error('Nu s-a putut găsi stage-ul în baza de date')
          return
        }

        const { error } = await moveItemToStage(
          'tray',
          leadAny.id,
          leadAny.pipelineId,
          (stageData as any).id,
          leadAny.stageId
        )
        
        if (error) {
          toast.error('Eroare la mutarea cardului')
          console.error('Error moving to Finalizare:', error)
          return
        }
        
        toast.success('Card mutat în FINALIZATA')
        onOpenChange(false)
      } catch (error) {
        console.error('Error moving to Finalizare:', error)
        toast.error('Eroare la mutarea cardului')
      }
    } else if (onStageChange) {
      onStageChange(getLeadId()!, finalizareStage)
      toast.success('Card mutat în FINALIZATA')
    }
  }, [lead, stages, isDepartmentPipeline, onStageChange, onOpenChange])

  // Handler pentru butonul "Aștept piese" (pentru Reparații)
  const handleAsteptPiese = useCallback(async () => {
    if (!lead) return
    const leadAny = lead as any
    
    const asteptPieseStage = stages.find(s => s.toUpperCase() === 'ASTEPT PIESE')
    
    if (!asteptPieseStage) {
      toast.error('Stage-ul ASTEPT PIESE nu există în acest pipeline')
      return
    }

    if (isDepartmentPipeline && leadAny?.type === 'tray' && leadAny?.pipelineId) {
      try {
        const { data: stageData, error: stageError } = await supabase
          .from('stages')
          .select('id')
          .eq('pipeline_id', leadAny.pipelineId)
          .eq('name', asteptPieseStage)
          .single()
        
        if (stageError || !stageData) {
          console.error('Error finding stage:', stageError, 'Looking for:', asteptPieseStage)
          toast.error('Nu s-a putut găsi stage-ul în baza de date')
          return
        }

        const { error } = await moveItemToStage(
          'tray',
          leadAny.id,
          leadAny.pipelineId,
          (stageData as any).id,
          leadAny.stageId
        )
        
        if (error) {
          toast.error('Eroare la mutarea cardului')
          console.error('Error moving to Astept piese:', error)
          return
        }
        
        toast.success('Card mutat în ASTEPT PIESE')
        onOpenChange(false)
      } catch (error) {
        console.error('Error moving to Astept piese:', error)
        toast.error('Eroare la mutarea cardului')
      }
    } else if (onStageChange) {
      onStageChange(getLeadId()!, asteptPieseStage)
      toast.success('Card mutat în ASTEPT PIESE')
    }
  }, [lead, stages, isDepartmentPipeline, onStageChange, onOpenChange])

  // Handler pentru butonul "În așteptare" (pentru Saloane/Horeca/Frizerii)
  const handleInAsteptare = useCallback(async () => {
    if (!lead) return
    const leadAny = lead as any
    
    const inAsteptareStage = stages.find(s => s.toUpperCase() === 'IN ASTEPTARE')
    
    if (!inAsteptareStage) {
      toast.error('Stage-ul IN ASTEPTARE nu există în acest pipeline')
      return
    }

    if (isDepartmentPipeline && leadAny?.type === 'tray' && leadAny?.pipelineId) {
      try {
        const { data: stageData, error: stageError } = await supabase
          .from('stages')
          .select('id')
          .eq('pipeline_id', leadAny.pipelineId)
          .eq('name', inAsteptareStage)
          .single()
        
        if (stageError || !stageData) {
          console.error('Error finding stage:', stageError, 'Looking for:', inAsteptareStage)
          toast.error('Nu s-a putut găsi stage-ul în baza de date')
          return
        }

        const { error } = await moveItemToStage(
          'tray',
          leadAny.id,
          leadAny.pipelineId,
          (stageData as any).id,
          leadAny.stageId
        )
        
        if (error) {
          toast.error('Eroare la mutarea cardului')
          console.error('Error moving to In asteptare:', error)
          return
        }
        
        toast.success('Card mutat în IN ASTEPTARE')
        onOpenChange(false)
      } catch (error) {
        console.error('Error moving to In asteptare:', error)
        toast.error('Eroare la mutarea cardului')
      }
    } else if (onStageChange) {
      onStageChange(getLeadId()!, inAsteptareStage)
      toast.success('Card mutat în IN ASTEPTARE')
    }
  }, [lead, stages, isDepartmentPipeline, onStageChange, onOpenChange])

  // Handler pentru butonul "În lucru" (atribuie tăvița utilizatorului curent)
  const handleInLucru = useCallback(async () => {
    if (!lead || !user?.id) return
    const leadAny = lead as any
    
    const inLucruStage = stages.find(s => s.toUpperCase() === 'IN LUCRU')
    
    if (!inLucruStage) {
      toast.error('Stage-ul IN LUCRU nu există în acest pipeline')
      return
    }

    if (isDepartmentPipeline && leadAny?.type === 'tray' && leadAny?.pipelineId) {
      try {
        const { data: stageData, error: stageError } = await supabase
          .from('stages')
          .select('id')
          .eq('pipeline_id', leadAny.pipelineId)
          .eq('name', inLucruStage)
          .single()
        
        if (stageError || !stageData) {
          console.error('Error finding stage:', stageError, 'Looking for:', inLucruStage)
          toast.error('Nu s-a putut găsi stage-ul în baza de date')
          return
        }

        const { error: moveError } = await moveItemToStage(
          'tray',
          leadAny.id,
          leadAny.pipelineId,
          (stageData as any).id,
          leadAny.stageId
        )
        
        if (moveError) {
          toast.error('Eroare la mutarea cardului')
          console.error('Error moving to In lucru:', moveError)
          return
        }

        // Atribuie toate tray_items din tăviță utilizatorului curent
        const { error: updateError } = await supabase
          .from('tray_items')
          .update({ technician_id: user.id } as never)
          .eq('tray_id', leadAny.id)
        
        if (updateError) {
          console.error('Error assigning tray to user:', updateError)
          toast.error('Eroare la atribuirea tăviței')
          return
        }
        
        toast.success('Tăvița a fost atribuită și mutată în IN LUCRU')
        onOpenChange(false)
      } catch (error) {
        console.error('Error moving to In lucru:', error)
        toast.error('Eroare la mutarea cardului')
      }
    } else if (onStageChange) {
      onStageChange(getLeadId()!, inLucruStage)
      toast.success('Card mutat în IN LUCRU')
    }
  }, [lead, stages, isDepartmentPipeline, onStageChange, onOpenChange, user])

  // Încarcă fișele și tăvițele pentru lead
  useEffect(() => {
    const leadId = getLeadId()
    if (!leadId || !open) {
      setServiceFiles([])
      setTrays([])
      return
    }

    const loadFilesAndTrays = async () => {
      setLoadingFiles(true)
      try {
        // Încarcă fișele de serviciu pentru lead
        const { data: files, error: filesError } = await listServiceFilesForLead(leadId)
        if (filesError) {
          console.error('Eroare la încărcare fișe:', filesError)
          setServiceFiles([])
        } else {
          setServiceFiles(files || [])
          
          // Încarcă tăvițele pentru toate fișele
          if (files && files.length > 0) {
            const allTrays: Tray[] = []
            for (const file of files) {
              const { data: fileTrays, error: traysError } = await listTraysForServiceFile(file.id)
              if (!traysError && fileTrays) {
                allTrays.push(...fileTrays.map((t: any) => ({
                  id: t.id,
                  number: t.number,
                  size: t.size,
                  status: t.status,
                  service_file_id: file.id,
                })))
              }
            }
            setTrays(allTrays)
          } else {
            setTrays([])
          }
        }
      } catch (error) {
        console.error('Eroare la încărcare date:', error)
        setServiceFiles([])
        setTrays([])
      } finally {
        setLoadingFiles(false)
      }
    }

    loadFilesAndTrays()
  }, [lead, open])

  // Obține tray_id pentru lead de tip "tray" în pipeline departament
  const getTrayId = useCallback(() => {
    if (!lead || !isDepartmentPipeline) return null
    const leadAny = lead as any
    if (leadAny.type === 'tray' && leadAny.id) {
      return leadAny.id
    }
    return null
  }, [lead, isDepartmentPipeline])

  // Încarcă items-urile tăviței pentru tab-ul "Fișă"
  useEffect(() => {
    const trayId = getTrayId()
    if (!trayId || !open || !isTechnician) {
      setTrayItems([])
      return
    }

    const loadTrayData = async () => {
      setLoadingTrayItems(true)
      try {
        // Încarcă items-urile tăviței
        const { data: items, error: itemsError } = await listTrayItemsForTray(trayId)
        if (itemsError) {
          console.error('Eroare la încărcare items:', itemsError)
          setTrayItems([])
        } else {
          setTrayItems(items || [])
        }

        // Încarcă serviciile
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('id, name, price, instrument_id')
          .order('name')
        
        if (!servicesError && servicesData) {
          setServices(servicesData)
        }

        // Încarcă instrumentele
        const { data: instrumentsData, error: instrumentsError } = await supabase
          .from('instruments')
          .select('id, name')
          .order('name')
        
        if (!instrumentsError && instrumentsData) {
          setInstruments(instrumentsData)
        }

        // Încarcă piesele (doar pentru Reparatii)
        if (isReparatiiPipeline) {
          const { data: partsData, error: partsError } = await supabase
            .from('parts')
            .select('id, name, price')
            .order('name')
          
          if (!partsError && partsData) {
            setParts(partsData)
          }
        }

        // Încarcă imaginile tăviței
        try {
          const images = await listTrayImages(trayId)
          setTrayImages(images)
        } catch (error) {
          console.error('Eroare la încărcare imagini:', error)
          setTrayImages([])
        }

        // Încarcă detaliile fișei de serviciu (nu mai per tăviță)
        try {
          // Obține service_file_id din tray
          const { data: trayData, error: trayError } = await supabase
            .from('trays')
            .select('service_file_id')
            .eq('id', trayId)
            .single()
          
          if (!trayError && trayData?.service_file_id) {
            // Încarcă detaliile din service_files.details
            const { data: serviceFileData, error: detailsError } = await supabase
              .from('service_files')
              .select('details')
              .eq('id', trayData.service_file_id)
              .single()
            
            if (!detailsError && serviceFileData) {
              const details = (serviceFileData as any).details || ''
              setTrayDetails(details)
            }
          }
        } catch (error) {
          console.error('Eroare la încărcare detalii fișă:', error)
        }

        // Încarcă informațiile despre tăviță
        try {
          const { data: trayData, error: trayError } = await supabase
            .from('trays')
            .select('number, size, status')
            .eq('id', trayId)
            .single()
          
          if (!trayError && trayData) {
            setTrayInfo({
              number: (trayData as any).number,
              size: (trayData as any).size,
              status: (trayData as any).status,
            })
          }
        } catch (error) {
          console.error('Eroare la încărcare informații tăviță:', error)
        }
      } catch (error) {
        console.error('Eroare la încărcare date tăviță:', error)
        setTrayItems([])
      } finally {
        setLoadingTrayItems(false)
      }
    }

    loadTrayData()
  }, [lead, open, isTechnician, isDepartmentPipeline, isReparatiiPipeline, getTrayId])

  // Helper pentru a extrage discount și urgent din notes
  const getItemNotesData = useCallback((item: TrayItem) => {
    let notesData: any = {}
    if (item.notes) {
      try {
        notesData = JSON.parse(item.notes)
      } catch (e) {
        // Notes nu este JSON
      }
    }
    return {
      discount_pct: notesData.discount_pct || 0,
      urgent: notesData.urgent || false,
      ...notesData
    }
  }, [])

  // Funcție pentru actualizare item (qty, discount_pct, urgent)
  const handleUpdateItem = useCallback(async (
    itemId: string, 
    field: 'qty' | 'discount_pct' | 'urgent', 
    value: number | boolean
  ) => {
    try {
      const item = trayItems.find(i => i.id === itemId)
      if (!item) return

      if (field === 'qty') {
        // Actualizare simplă pentru qty
        const { error } = await updateTrayItem(itemId, { qty: value as number })
        if (error) {
          toast.error('Eroare la actualizare')
          console.error('Error updating item:', error)
          return
        }
        
        setTrayItems(prev => prev.map(i => 
          i.id === itemId ? { ...i, qty: value as number } : i
        ))
      } else {
        // Pentru discount_pct și urgent, actualizăm notes JSON
        const notesData = getItemNotesData(item)
        const updatedNotes = {
          ...notesData,
          [field]: value
        }
        
        const { error } = await updateTrayItem(itemId, { 
          notes: JSON.stringify(updatedNotes)
        })
        
        if (error) {
          toast.error('Eroare la actualizare')
          console.error('Error updating item:', error)
          return
        }
        
        setTrayItems(prev => prev.map(i => 
          i.id === itemId ? { ...i, notes: JSON.stringify(updatedNotes) } : i
        ))
      }
      
      toast.success('Actualizat cu succes')
    } catch (error) {
      console.error('Error updating item:', error)
      toast.error('Eroare la actualizare')
    }
  }, [trayItems, getItemNotesData])

  // Funcție pentru ștergere item
  const handleDeleteItem = useCallback(async (itemId: string) => {
    if (!confirm('Ești sigur că vrei să ștergi acest item?')) return
    
    try {
      const { error } = await supabase
        .from('tray_items')
        .delete()
        .eq('id', itemId)
      
      if (error) {
        toast.error('Eroare la ștergere')
        console.error('Error deleting item:', error)
        return
      }
      
      setTrayItems(prev => prev.filter(item => item.id !== itemId))
      toast.success('Item șters cu succes')
    } catch (error) {
      console.error('Error deleting item:', error)
      toast.error('Eroare la ștergere')
    }
  }, [])

  // Funcție pentru adăugare serviciu
  const handleAddService = useCallback(async () => {
    const trayId = getTrayId()
    if (!trayId || !newService.service_id) {
      toast.error('Selectează un serviciu')
      return
    }

    try {
      // Găsește instrumentul pentru serviciu
      const service = services.find(s => s.id === newService.service_id)
      if (!service || !service.instrument_id) {
        toast.error('Serviciul nu are instrument asociat')
        return
      }

      const { error } = await supabase
        .from('tray_items')
        .insert({
          tray_id: trayId,
          service_id: newService.service_id,
          instrument_id: service.instrument_id,
          qty: newService.qty,
          technician_id: user?.id || null,
        } as never)

      if (error) {
        toast.error('Eroare la adăugare serviciu')
        console.error('Error adding service:', error)
        return
      }

      // Reîncarcă items-urile
      const { data: items } = await listTrayItemsForTray(trayId)
      if (items) setTrayItems(items)

      setNewService({ service_id: '', qty: 1 })
      setAddServiceOpen(false)
      toast.success('Serviciu adăugat cu succes')
    } catch (error) {
      console.error('Error adding service:', error)
      toast.error('Eroare la adăugare serviciu')
    }
  }, [newService, services, getTrayId, user])

  // Funcție pentru adăugare piesă (doar Reparatii)
  const handleAddPart = useCallback(async () => {
    const trayId = getTrayId()
    if (!trayId || !newPart.part_id) {
      toast.error('Selectează o piesă')
      return
    }

    if (!isReparatiiPipeline) {
      toast.error('Piesele pot fi adăugate doar în pipeline-ul Reparatii')
      return
    }

    try {
      const part = parts.find(p => p.id === newPart.part_id)
      if (!part) {
        toast.error('Piesa nu a fost găsită')
        return
      }

      // Găsește primul instrument din tăviță pentru a seta instrument_id
      const trayItemsArray = Array.isArray(trayItems) ? trayItems : []
      const firstInstrument = instruments.find(inst => {
        // FOLOSIM FOR LOOP ÎN LOC DE .some() - MAI SIGUR
        if (!inst || !inst.id) return false
        for (let i = 0; i < trayItemsArray.length; i++) {
          const item = trayItemsArray[i]
          if (item && item.instrument_id === inst.id) {
            return true
          }
        }
        return false
      })

      const { error } = await supabase
        .from('tray_items')
        .insert({
          tray_id: trayId,
          part_id: newPart.part_id,
          instrument_id: firstInstrument?.id || null,
          qty: newPart.qty,
          technician_id: user?.id || null,
        } as never)

      if (error) {
        toast.error('Eroare la adăugare piesă')
        console.error('Error adding part:', error)
        return
      }

      // Reîncarcă items-urile
      const { data: items } = await listTrayItemsForTray(trayId)
      if (items) setTrayItems(items)

      setNewPart({ part_id: '', qty: 1 })
      setAddPartOpen(false)
      toast.success('Piesă adăugată cu succes')
    } catch (error) {
      console.error('Error adding part:', error)
      toast.error('Eroare la adăugare piesă')
    }
  }, [newPart, parts, instruments, trayItems, getTrayId, isReparatiiPipeline, user])

  // Helper pentru a obține numele unui item
  const getItemName = useCallback((item: TrayItem) => {
    if (item.service_id) {
      if ((item as any).service) {
        return (item as any).service.name
      }
      // Dacă nu există service în item, caută în lista de servicii
      const service = services.find(s => s.id === item.service_id)
      return service?.name || 'Serviciu necunoscut'
    }
    if (item.part_id) {
      // Pentru piese, caută în lista de piese
      const part = parts.find(p => p.id === item.part_id)
      return part?.name || 'Piesă necunoscută'
    }
    return 'Item necunoscut'
  }, [parts, services])

  // Funcție pentru upload imagine
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    
    const trayId = getTrayId()
    if (!trayId) {
      toast.error('Tăvița nu a fost găsită')
      return
    }

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
        const savedImage = await saveTrayImageReference(trayId, url, path, file.name)
        setTrayImages(prev => [savedImage, ...prev])
        toast.success('Imagine încărcată cu succes', { id: toastId })
      } catch (error: any) {
        console.error('Error uploading image:', error)
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
  }, [getTrayId])

  // Funcție pentru ștergere imagine
  const handleImageDelete = useCallback(async (imageId: string, filePath: string) => {
    if (!confirm('Ești sigur că vrei să ștergi această imagine?')) return
    
    try {
      await deleteTrayImage(filePath)
      await deleteTrayImageReference(imageId)
      setTrayImages(prev => prev.filter(img => img.id !== imageId))
      toast.success('Imagine ștearsă')
    } catch (error: any) {
      console.error('Error deleting image:', error)
      toast.error('Eroare la ștergere', {
        description: error?.message || 'Te rog încearcă din nou'
      })
    }
  }, [])

  if (!lead) return null

  const getTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return formatDistanceToNow(date, { addSuffix: true, locale: ro })
    } catch {
      return 'Data necunoscută'
    }
  }

  const getTagColor = (color?: string) => {
    switch (color) {
      case 'green': return 'bg-green-100 text-green-800 border-green-200'
      case 'yellow': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'red': return 'bg-red-100 text-red-800 border-red-200'
      case 'blue': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'orange': return 'bg-orange-100 text-orange-800 border-orange-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      'noua': 'Nouă',
      'in_lucru': 'În lucru',
      'finalizata': 'Finalizată',
      'in_receptie': 'În recepție',
      'gata': 'Gata',
    }
    return statusMap[status] || status
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-xl">{lead.name || 'Fără nume'}</SheetTitle>
          <SheetDescription>
            {lead.stage} • {getTimeAgo(lead.createdAt)}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className={cn(
            "flex w-full overflow-x-auto scrollbar-hide gap-1",
            "min-w-full"
          )}>
            <TabsTrigger value="info" className="text-xs px-2 flex-shrink-0 whitespace-nowrap">
              Info
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs px-2 flex-shrink-0 whitespace-nowrap">
              Activitate
            </TabsTrigger>
            <TabsTrigger value="files" className="text-xs px-2 flex-shrink-0 whitespace-nowrap">
              Detalii
            </TabsTrigger>
            <TabsTrigger value="messaging" className="text-xs px-2 flex-shrink-0">
              <MessageSquare className="h-3.5 w-3.5" />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4 px-[4px]">
            {/* Informații de contact */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase">
                Contact
              </h3>
              {lead.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">{lead.email}</p>
                  </div>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Telefon</p>
                    <p className="text-sm text-muted-foreground">{lead.phone}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Tag-uri */}
            {lead.tags && lead.tags.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase">
                  Tag-uri
                </h3>
                <div className="flex flex-wrap gap-2">
                  {lead.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className={cn(
                        "text-sm px-3 py-1 border",
                        getTagColor(tag.color)
                      )}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tehnician */}
            {lead.technician && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase">
                  Tehnician
                </h3>
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm">{lead.technician}</p>
                </div>
              </div>
            )}

            {/* Informații suplimentare */}
            {(lead.campaignName || lead.adName || lead.formName) && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase">
                  Sursa
                </h3>
                {lead.campaignName && (
                  <p className="text-sm">
                    <span className="font-medium">Campanie:</span> {lead.campaignName}
                  </p>
                )}
                {lead.adName && (
                  <p className="text-sm">
                    <span className="font-medium">Anunț:</span> {lead.adName}
                  </p>
                )}
                {lead.formName && (
                  <p className="text-sm">
                    <span className="font-medium">Formular:</span> {lead.formName}
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="space-y-4 mt-4 px-[4px]">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase">
                Istoric
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Mutat în {lead.stage}</p>
                    <p className="text-muted-foreground text-xs">
                      {lead.stageMovedAt ? getTimeAgo(lead.stageMovedAt) : 'Data necunoscută'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Lead creat</p>
                    <p className="text-muted-foreground text-xs">
                      {getTimeAgo(lead.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="files" className="space-y-4 mt-4 px-[4px]">
            <div className="space-y-4">
              {/* Dacă este un card de tăviță directă din pipeline departament, afișează doar detaliile tăviței */}
              {isDepartmentPipeline && (lead as any)?.type === 'tray' && getTrayId() ? (
                <>
                  {/* Butoane de acțiune pentru pipeline departament */}
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleInLucru}
                      className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-xs"
                    >
                      <Wrench className="h-3 w-3" />
                      În lucru
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleFinalizare}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-xs"
                    >
                      <CheckCircle className="h-3 w-3" />
                      Finalizare
                    </Button>
                    {isReparatiiPipeline && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAsteptPiese}
                        className="flex items-center gap-2 border-amber-500 text-amber-600 hover:bg-amber-50 text-xs"
                      >
                        <Clock className="h-3 w-3" />
                        Aștept piese
                      </Button>
                    )}
                    {isSaloaneHorecaFrizeriiPipeline && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleInAsteptare}
                        className="flex items-center gap-2 border-blue-500 text-blue-600 hover:bg-blue-50 text-xs"
                      >
                        <Clock className="h-3 w-3" />
                        În așteptare
                      </Button>
                    )}
                  </div>

                  {/* Detalii tăviță - doar pentru carduri de tăviță directă */}
                  {isTechnician && (
                    <div className="space-y-4">
                      {/* Informații despre tăviță */}
                      {trayInfo && (
                        <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-primary" />
                            <h3 className="font-semibold text-sm text-foreground">
                              Tăviță #{trayInfo.number}
                            </h3>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div>
                              <span className="font-medium">Dimensiune:</span> {trayInfo.size || 'N/A'}
                            </div>
                            <div>
                              <span className="font-medium">Status:</span> {getStatusLabel(trayInfo.status || '')}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Informații Tavita - Detalii comandă */}
                      <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="h-4 w-4 text-primary" />
                          <h3 className="font-semibold text-sm text-muted-foreground uppercase">
                            Informații Tavita
                          </h3>
                        </div>
                        <label className="text-xs font-medium text-muted-foreground uppercase block mb-2">
                          Detalii comandă comunicate de client
                          {!isVanzariPipeline && (
                            <span className="text-xs text-muted-foreground ml-2">(doar vizualizare)</span>
                          )}
                        </label>
                        {loadingTrayDetails ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <Textarea
                            value={trayDetails}
                            onChange={(e) => {
                              // Detaliile pot fi modificate doar din pipeline-ul Vanzari
                              if (!isVanzariPipeline) {
                                toast.error('Detaliile pot fi modificate doar din pipeline-ul Vanzari')
                                return
                              }
                              // Pentru tehnician, este read-only
                              if (!isTechnician) {
                                setTrayDetails(e.target.value)
                              }
                            }}
                            placeholder={isVanzariPipeline 
                              ? "Detaliile comenzii pentru această fișă (vizibile pentru toate tăvițele din fișă)..."
                              : "Detaliile pot fi modificate doar din pipeline-ul Vanzari"}
                            className="min-h-[100px] text-xs sm:text-sm resize-none"
                            readOnly={isTechnician || !isVanzariPipeline}
                          />
                        )}
                        {/* Buton salvare doar pentru vânzători și doar în pipeline-ul Vanzari */}
                        {!isTechnician && isVanzariPipeline && (
                          <div className="flex justify-end mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                // IMPORTANT: Detaliile pot fi modificate doar din pipeline-ul Vanzari
                                if (!isVanzariPipeline) {
                                  toast.error('Detaliile pot fi modificate doar din pipeline-ul Vanzari')
                                  return
                                }
                                
                                setSavingTrayDetails(true)
                                try {
                                  const trayId = getTrayId()
                                  if (!trayId) {
                                    toast.error('Tăvița nu a fost găsită')
                                    return
                                  }

                                  // Obține service_file_id din tray
                                  const { data: trayData, error: trayError } = await supabase
                                    .from('trays')
                                    .select('service_file_id')
                                    .eq('id', trayId)
                                    .single()

                                  if (trayError || !trayData?.service_file_id) {
                                    toast.error('Fișa de serviciu nu a fost găsită')
                                    return
                                  }

                                  // Salvează detaliile în service_files.details folosind funcția updateServiceFile
                                  const { error } = await updateServiceFile(trayData.service_file_id, {
                                    details: trayDetails
                                  })

                                  if (error) {
                                    console.error('Error saving service file details:', error)
                                    toast.error('Eroare la salvarea detaliilor: ' + (error?.message || 'Eroare necunoscută'))
                                  } else {
                                    toast.success('Detaliile fișei au fost salvate')
                                  }
                                } catch (err: any) {
                                  console.error('Error:', err)
                                  toast.error('Eroare: ' + (err.message || 'Eroare necunoscută'))
                                } finally {
                                  setSavingTrayDetails(false)
                                }
                              }}
                              disabled={savingTrayDetails}
                            >
                              {savingTrayDetails ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                  Salvare...
                                </>
                              ) : (
                                'Salvează'
                              )}
                            </Button>
                          </div>
                        )}
                      </div>

                      <h3 className="font-semibold text-sm text-muted-foreground uppercase">
                        Detalii Tăviță
                      </h3>
                      
                      {loadingTrayItems ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Butoane adăugare */}
                          <div className="flex gap-2">
                            <Button
                              onClick={() => setAddServiceOpen(true)}
                              className="flex-1"
                              size="sm"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Serviciu
                            </Button>
                            {isReparatiiPipeline && (
                              <Button
                                onClick={() => setAddPartOpen(true)}
                                variant="outline"
                                className="flex-1"
                                size="sm"
                              >
                                <Package className="h-4 w-4 mr-1" />
                                Piesă
                              </Button>
                            )}
                          </div>

                          {/* Lista items */}
                          {trayItems.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                              Nu există items în această tăviță
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {trayItems
                                .filter(item => item.service_id || item.part_id)
                                .map((item) => (
                                  <Card key={item.id} className="p-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                          <h4 className="font-medium text-sm">
                                            {getItemName(item)}
                                          </h4>
                                          <Badge variant={item.part_id ? 'secondary' : 'outline'} className="text-[10px]">
                                            {item.part_id ? 'Piesă' : 'Serviciu'}
                                          </Badge>
                                        </div>
                                        {item.instrument_id && (
                                          <p className="text-xs text-muted-foreground">
                                            Instrument: {instruments.find(i => i.id === item.instrument_id)?.name || 'Necunoscut'}
                                          </p>
                                        )}
                                        <div className="space-y-2">
                                          {/* Cantitate */}
                                          <div className="flex items-center gap-2">
                                            <Label className="text-xs text-muted-foreground">Cantitate:</Label>
                                            {editingItem === item.id ? (
                                              <Input
                                                type="number"
                                                value={editValues.qty ?? item.qty}
                                                onChange={(e) => setEditValues({ ...editValues, qty: Number(e.target.value) })}
                                                className="w-16 h-7 text-xs"
                                                min="1"
                                              />
                                            ) : (
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium">{item.qty}</span>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() => {
                                                    const notesData = getItemNotesData(item)
                                                    setEditingItem(item.id)
                                                    setEditValues({ qty: item.qty, discount_pct: notesData.discount_pct, urgent: notesData.urgent })
                                                  }}
                                                  className="h-6 w-6 p-0"
                                                >
                                                  <Pencil className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            )}
                                          </div>

                                          {/* Discount */}
                                          {editingItem === item.id ? (
                                            <div className="flex items-center gap-2">
                                              <Label className="text-xs text-muted-foreground">Discount %:</Label>
                                              <Input
                                                type="number"
                                                value={editValues.discount_pct ?? getItemNotesData(item).discount_pct}
                                                onChange={(e) => setEditValues({ ...editValues, discount_pct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                                                className="w-16 h-7 text-xs"
                                                min="0"
                                                max="100"
                                              />
                                            </div>
                                          ) : (
                                            getItemNotesData(item).discount_pct > 0 && (
                                              <div className="flex items-center gap-2">
                                                <Label className="text-xs text-muted-foreground">Discount:</Label>
                                                <span className="text-xs font-medium text-amber-600">
                                                  {getItemNotesData(item).discount_pct}%
                                                </span>
                                              </div>
                                            )
                                          )}

                                          {/* Urgent */}
                                          {editingItem === item.id ? (
                                            <div className="flex items-center gap-2">
                                              <Label className="text-xs text-muted-foreground">Urgent:</Label>
                                              <Switch
                                                checked={editValues.urgent ?? getItemNotesData(item).urgent}
                                                onCheckedChange={(checked) => setEditValues({ ...editValues, urgent: checked })}
                                              />
                                            </div>
                                          ) : (
                                            getItemNotesData(item).urgent && (
                                              <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-[10px] bg-red-100 text-red-800 border-red-200">
                                                  Urgent (+30%)
                                                </Badge>
                                              </div>
                                            )
                                          )}

                                          {/* Butoane salvare/anulare pentru editare */}
                                          {editingItem === item.id && (
                                            <div className="flex items-center gap-2 pt-2 border-t">
                                              <Button
                                                size="sm"
                                                variant="default"
                                                onClick={async () => {
                                                  if (editValues.qty !== undefined) {
                                                    await handleUpdateItem(item.id, 'qty', editValues.qty)
                                                  }
                                                  if (editValues.discount_pct !== undefined) {
                                                    await handleUpdateItem(item.id, 'discount_pct', editValues.discount_pct)
                                                  }
                                                  if (editValues.urgent !== undefined) {
                                                    await handleUpdateItem(item.id, 'urgent', editValues.urgent)
                                                  }
                                                  setEditingItem(null)
                                                  setEditValues({})
                                                }}
                                                className="flex-1 h-8 text-xs"
                                              >
                                                <Save className="h-3 w-3 mr-1" />
                                                Salvează
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                  setEditingItem(null)
                                                  setEditValues({})
                                                }}
                                                className="flex-1 h-8 text-xs"
                                              >
                                                <XIcon className="h-3 w-3 mr-1" />
                                                Anulează
                                              </Button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteItem(item.id)}
                                        className="h-8 w-8 p-0 text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </Card>
                                ))}
                            </div>
                          )}

                          {/* Secțiune Imagini */}
                          <div className="space-y-3 pt-4 border-t">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-sm text-muted-foreground uppercase">
                                Imagini Tăviță
                              </h3>
                              {trayImages.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {trayImages.length} {trayImages.length === 1 ? 'imagine' : 'imagini'}
                                </span>
                              )}
                            </div>

                            {/* Buton upload */}
                            <label
                              htmlFor="tray-image-upload-mobile"
                              className={`relative flex flex-col items-center justify-center w-full py-4 px-4 rounded-lg border-2 border-dashed transition-all cursor-pointer ${
                                uploadingImage
                                  ? 'border-primary/40 bg-primary/5'
                                  : 'border-border hover:border-primary/50 hover:bg-primary/5 bg-muted/20'
                              }`}
                            >
                              <input
                                type="file"
                                id="tray-image-upload-mobile"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                                disabled={uploadingImage}
                                multiple
                              />

                              {uploadingImage ? (
                                <div className="flex flex-col items-center gap-2">
                                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                                  <span className="text-sm font-medium text-primary">Se încarcă...</span>
                                </div>
                              ) : (
                                <>
                                  <ImagePlus className="h-5 w-5 text-muted-foreground mb-2" />
                                  <p className="text-sm font-medium text-muted-foreground">
                                    Adaugă imagini
                                  </p>
                                  <p className="text-xs text-muted-foreground/70 mt-1">
                                    Max 5MB per imagine
                                  </p>
                                </>
                              )}
                            </label>

                            {/* Grid imagini */}
                            {trayImages.length > 0 && (
                              <div className="grid grid-cols-2 gap-3">
                                {trayImages.map((image) => (
                                  <div
                                    key={image.id}
                                    className="group relative aspect-square rounded-lg overflow-hidden bg-muted/30 ring-1 ring-border"
                                  >
                                    <img
                                      src={image.url}
                                      alt={image.filename}
                                      className="w-full h-full object-cover"
                                    />
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => handleImageDelete(image.id, image.file_path)}
                                    >
                                      <XIcon className="h-4 w-4" />
                                    </Button>
                                    <a
                                      href={image.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="absolute inset-0"
                                      title="Deschide în tab nou"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}

                            {trayImages.length === 0 && !uploadingImage && (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                Nu există imagini încărcate
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Pentru lead-uri normale sau când nu este tăviță directă, afișează lista de fișe și tăvițe */}
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase">
                    Fișe de serviciu și tăvițe
                  </h3>
                  
                  {loadingFiles ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      {/* Fișe de serviciu */}
                      {serviceFiles.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                            Fișe de serviciu
                          </h4>
                          {serviceFiles.map((file) => {
                            const fileTrays = trays.filter(t => t.service_file_id === file.id)
                            return (
                              <div key={file.id} className="border rounded-lg p-3 space-y-2">
                                <div className="flex items-center gap-3">
                                  <FileText className="h-5 w-5 text-muted-foreground" />
                                  <div className="flex-1">
                                    <p className="font-medium">Fișă #{file.number}</p>
                                    <p className="text-sm text-muted-foreground">
                                      Status: {getStatusLabel(file.status)}
                                    </p>
                                    {file.date && (
                                      <p className="text-xs text-muted-foreground">
                                        {new Date(file.date).toLocaleDateString('ro-RO')}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Tăvițe pentru această fișă */}
                                {fileTrays.length > 0 && (
                                  <div className="ml-8 space-y-2 pt-2 border-t">
                                    {fileTrays.map((tray) => (
                                      <div 
                                        key={tray.id} 
                                        className="flex items-center justify-between gap-3 p-2 border rounded-lg cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors"
                                        onClick={() => handleOpenTray(tray.id)}
                                      >
                                        <div className="flex items-center gap-3 flex-1">
                                          <Package className="h-4 w-4 text-muted-foreground" />
                                          <div className="flex-1">
                                            <p className="text-sm font-medium">Tăviță #{tray.number}</p>
                                            <p className="text-xs text-muted-foreground">
                                              {tray.size} • {getStatusLabel(tray.status)}
                                            </p>
                                          </div>
                                        </div>
                                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Tăvițe fără fișă (dacă există) */}
                      {(() => {
                        const serviceFilesArray = Array.isArray(serviceFiles) ? serviceFiles : []
                        const traysWithoutFile = trays.filter(t => {
                          // FOLOSIM FOR LOOP ÎN LOC DE .some() - MAI SIGUR
                          if (!t || !t.service_file_id) return true
                          for (let i = 0; i < serviceFilesArray.length; i++) {
                            const f = serviceFilesArray[i]
                            if (f && f.id === t.service_file_id) {
                              return false
                            }
                          }
                          return true
                        })
                        return traysWithoutFile.length > 0
                      })() && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                            Tăvițe
                          </h4>
                          {(() => {
                            const serviceFilesArray = Array.isArray(serviceFiles) ? serviceFiles : []
                            return trays
                              .filter(t => {
                                // FOLOSIM FOR LOOP ÎN LOC DE .some() - MAI SIGUR
                                if (!t || !t.service_file_id) return true
                                for (let i = 0; i < serviceFilesArray.length; i++) {
                                  const f = serviceFilesArray[i]
                                  if (f && f.id === t.service_file_id) {
                                    return false
                                  }
                                }
                                return true
                              })
                              .map((tray) => (
                              <div 
                                key={tray.id} 
                                className="flex items-center justify-between gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors"
                                onClick={() => handleOpenTray(tray.id)}
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <Package className="h-5 w-5 text-muted-foreground" />
                                  <div className="flex-1">
                                    <p className="font-medium">Tăviță #{tray.number}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {tray.size} • {getStatusLabel(tray.status)}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-2"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleOpenTray(tray.id)
                                  }}
                                >
                                  <Wrench className="h-4 w-4" />
                                  Deschide
                                </Button>
                              </div>
                            ))
                          })()}
                        </div>
                      )}

                      {/* Mesaj dacă nu există fișe sau tăvițe */}
                      {serviceFiles.length === 0 && trays.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Nu există fișe sau tăvițe asociate
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          {/* Dialog adăugare serviciu */}
          <Dialog open={addServiceOpen} onOpenChange={setAddServiceOpen}>
                <DialogContent className="max-w-[90vw] sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Adaugă Serviciu</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Serviciu</Label>
                      <Select
                        value={newService.service_id}
                        onValueChange={(value) => setNewService(prev => ({ ...prev, service_id: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selectează serviciu" />
                        </SelectTrigger>
                        <SelectContent>
                          {services
                            .filter(s => {
                              // Filtrează serviciile care au instrumente care există deja în tăviță
                              const trayInstruments = new Set(trayItems.map(item => item.instrument_id).filter(Boolean))
                              return s.instrument_id && trayInstruments.has(s.instrument_id)
                            })
                            .map((service) => (
                              <SelectItem key={service.id} value={service.id}>
                                {service.name} - {service.price.toFixed(2)} RON
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Cantitate</Label>
                      <Input
                        type="number"
                        value={newService.qty}
                        onChange={(e) => setNewService(prev => ({ ...prev, qty: Number(e.target.value) || 1 }))}
                        min="1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleAddService} className="flex-1">
                        Adaugă
                      </Button>
                      <Button variant="outline" onClick={() => setAddServiceOpen(false)}>
                        Anulează
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Dialog adăugare piesă */}
              {isReparatiiPipeline && (
                <Dialog open={addPartOpen} onOpenChange={setAddPartOpen}>
                  <DialogContent className="max-w-[90vw] sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Adaugă Piesă</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Piesă</Label>
                        <Select
                          value={newPart.part_id}
                          onValueChange={(value) => setNewPart(prev => ({ ...prev, part_id: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selectează piesă" />
                          </SelectTrigger>
                          <SelectContent>
                            {parts.map((part) => (
                              <SelectItem key={part.id} value={part.id}>
                                {part.name} - {part.price.toFixed(2)} RON
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Cantitate</Label>
                        <Input
                          type="number"
                          value={newPart.qty}
                          onChange={(e) => setNewPart(prev => ({ ...prev, qty: Number(e.target.value) || 1 }))}
                          min="1"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleAddPart} className="flex-1">
                          Adaugă
                        </Button>
                        <Button variant="outline" onClick={() => setAddPartOpen(false)}>
                          Anulează
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

          {/* Tab Mesagerie - disponibil pentru toți */}
          <TabsContent value="messaging" className="space-y-4 mt-4 px-[4px]">
            {getLeadId() ? (
              <LeadMessenger 
                leadId={getLeadId()!} 
                leadTechnician={lead.technician || null} 
              />
            ) : (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                Nu s-a putut identifica lead-ul
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Action buttons */}
        <div className="flex gap-2 mt-6 pt-4 border-t">
          {onMove && (
            <Button variant="outline" className="flex-1" onClick={onMove}>
              Mută lead
            </Button>
          )}
          {onEdit && (
            <Button variant="default" className="flex-1" onClick={onEdit}>
              Editează
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

