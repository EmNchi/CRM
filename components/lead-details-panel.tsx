"use client"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { format } from "date-fns"
import type { Lead } from "@/app/page" 
import Preturi from '@/components/preturi';
import LeadHistory from "@/components/lead-history"
import { PrintView } from '@/components/print-view'
import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import DeConfirmat from "@/components/de-confirmat"
import LeadMessenger from "@/components/lead-messenger"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"
import { ChevronsUpDown, Printer, Mail, Phone, Copy, Check, Loader2, FileText, History, MessageSquare, X as XIcon, Maximize2 } from "lucide-react"
import { listTags, toggleLeadTag, type Tag, type TagColor } from "@/lib/supabase/tagOperations"
import { supabaseBrowser } from "@/lib/supabase/supabaseClient"
import { uploadLeadImage, deleteLeadImage, listLeadImages, saveLeadImageReference, deleteLeadImageReference, type LeadImage } from "@/lib/supabase/imageOperations"
import { ImagePlus, X, Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type Maybe<T> = T | null

interface LeadDetailsPanelProps {
  lead: Maybe<Lead>
  onClose: () => void
  onStageChange: (leadId: string, newStage: string) => void
  stages: string[]
  pipelines: string[]
  pipelineSlug?: string
  onMoveToPipeline?: (leadId: string, targetName: string) => Promise<void>
  pipelineOptions?: { name: string; activeStages: number }[]
  onTagsChange?: (leadId: string, tags: Tag[]) => void
  onBulkMoveToPipelines?: (leadId: string, pipelineNames: string[]) => Promise<void>
}

export function LeadDetailsPanel({
  lead,
  onClose,
  onStageChange,
  onTagsChange,
  onMoveToPipeline,
  onBulkMoveToPipelines,
  pipelines,
  stages,
  pipelineSlug,
}: LeadDetailsPanelProps) {
  if (!lead) return null

  // verifica daca suntem in unul dintre pipeline-urile care arata checkbox-urile
  const showActionCheckboxes = useMemo(() => {
    if (!pipelineSlug) return false
    const slug = pipelineSlug.toLowerCase()
    return slug.includes('receptie') || slug.includes('vanzari') || slug.includes('curier')
  }, [pipelineSlug])

  // verifica daca suntem in pipeline-ul Curier
  const isCurierPipeline = useMemo(() => {
    if (!pipelineSlug) return false
    return pipelineSlug.toLowerCase().includes('curier')
  }, [pipelineSlug])

  const supabase = supabaseBrowser()
  const [section, setSection] = useState<"fisa" | "deconfirmat" | "istoric">("fisa")
  const [stage, setStage] = useState(lead.stage)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement>(null)

  // memoizeaza functiile ca sa nu le recreez la fiecare render
  const tagClass = useCallback((c: TagColor) =>
    c === "green" ? "bg-emerald-100 text-emerald-800"
    : c === "yellow" ? "bg-amber-100  text-amber-800"
    : c === "orange" ? "bg-orange-100 text-orange-800"
    : c === "blue" ? "bg-blue-100 text-blue-800"
    :                  "bg-rose-100   text-rose-800"
  , [])

  const isDepartmentTag = useCallback((tagName: string) => {
    const departmentTags = ['Horeca', 'Saloane', 'Frizerii', 'Reparatii']
    return departmentTags.includes(tagName)
  }, [])

  const getDepartmentBadgeStyle = useCallback((tagName: string) => {
    const styles: Record<string, string> = {
      'Horeca': 'bg-gradient-to-r from-orange-500 to-orange-600 border-orange-300',
      'Saloane': 'bg-gradient-to-r from-emerald-500 to-emerald-600 border-emerald-300',
      'Frizerii': 'bg-gradient-to-r from-amber-500 to-amber-600 border-amber-300',
      'Reparatii': 'bg-gradient-to-r from-blue-500 to-blue-600 border-blue-300',
    }
    return styles[tagName] || 'bg-gradient-to-r from-gray-500 to-gray-600 border-gray-300'
  }, [])

  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

  const [selectedPipes, setSelectedPipes] = useState<string[]>([])
  const [movingPipes, setMovingPipes] = useState(false)

  // State pentru checkbox-uri generale
  const [callBack, setCallBack] = useState(false)
  const [nuRaspunde, setNuRaspunde] = useState(false)
  const [noDeal, setNoDeal] = useState(false)

  // State pentru imagini
  const [images, setImages] = useState<LeadImage[]>([])
  const [uploading, setUploading] = useState(false)

  const allPipeNames = pipelines ?? []

  const togglePipe = (name: string) =>
    setSelectedPipes(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name])

  const pickAll = () => setSelectedPipes(allPipeNames)
  const clearAll = () => setSelectedPipes([])

  useEffect(() => {
    const ch = supabase
      .channel('rt-tags-lead-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' },
        () => listTags().then(setAllTags).catch(console.error)
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { listTags().then(setAllTags).catch(console.error) }, [])

  useEffect(() => {
    if (!lead) return
    setSelectedTagIds((lead.tags ?? []).map(t => t.id))
  }, [lead?.id])

  useEffect(() => {
    setStage(lead.stage)
  }, [lead.id, lead.stage])

  // incarca imaginile pentru lead
  useEffect(() => {
    if (!lead?.id) return
    
    const loadImages = async () => {
      try {
        const loadedImages = await listLeadImages(lead.id)
        setImages(loadedImages)
      } catch (error) {
        console.error('Error loading images:', error)
      }
    }
    
    loadImages()
  }, [lead?.id])

  async function handleToggleTag(tagId: string) {
    if (!lead) return

    // Previne eliminarea tag-urilor de departament
    const tag = allTags.find(t => t.id === tagId)
    if (tag && isDepartmentTag(tag.name)) {
      // Tag-urile de departament nu pot fi eliminate manual
      return
    }
  
    // 1) server change
    await toggleLeadTag(lead.id, tagId)
  
    // 2) compute next selection based on current state
    const nextIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter(id => id !== tagId)
      : [...selectedTagIds, tagId]
  
    // 3) local update
    setSelectedTagIds(nextIds)
  
    // 4) notify parent AFTER local setState (outside render)
    const nextTags = allTags.filter(t => nextIds.includes(t.id))
    onTagsChange?.(lead.id, nextTags)
  }
  
  const handleStageChange = (newStage: string) => {
    setStage(newStage)                
  
    onStageChange(lead.id, newStage)
  }

  // functii pentru gestionarea imaginilor
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !lead?.id) return

    // validare tip fisier
    if (!file.type.startsWith('image/')) {
      toast.error('Tip de fișier invalid', {
        description: 'Te rog selectează o imagine validă (JPG, PNG, etc.)'
      })
      return
    }

    // Validare dimensiune (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Fișier prea mare', {
        description: 'Dimensiunea maximă este 5MB'
      })
      return
    }

    setUploading(true)
    const toastId = toast.loading('Se încarcă imaginea...')
    
    try {
      const { url, path } = await uploadLeadImage(lead.id, file)
      const savedImage = await saveLeadImageReference(lead.id, url, path, file.name)
      setImages(prev => [savedImage, ...prev])
      toast.success('Imagine încărcată cu succes', { id: toastId })
    } catch (error: any) {
      console.error('Error uploading image:', error)
      toast.error('Eroare la încărcarea imaginii', {
        id: toastId,
        description: error?.message || 'Te rog încearcă din nou'
      })
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }, [lead?.id])

  const handleImageDelete = useCallback(async (imageId: string, filePath: string) => {
    try {
      await deleteLeadImage(filePath)
      await deleteLeadImageReference(imageId)
      setImages(prev => prev.filter(img => img.id !== imageId))
      toast.success('Imagine ștearsă cu succes')
    } catch (error: any) {
      console.error('Error deleting image:', error)
      toast.error('Eroare la ștergerea imaginii', {
        description: error?.message || 'Te rog încearcă din nou'
      })
    }
  }, [])

  // functii pentru contacte
  const handleCopy = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast.success('Copiat în clipboard', {
        description: `${field} a fost copiat`
      })
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      toast.error('Eroare la copiere')
    }
  }, [])

  const handlePhoneClick = useCallback((phone: string) => {
    window.location.href = `tel:${phone}`
  }, [])

  const handleEmailClick = useCallback((email: string) => {
    const subject = encodeURIComponent(`Comanda Ascutzit.ro`)
    const body = encodeURIComponent(`Va contactez in legatura cu comanda dvs facuta la Ascutzit.ro`)
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`, '_blank')
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])
  
  return (
    <section ref={panelRef} className="mt-6 rounded-lg border bg-card shadow-sm">
      <header className="border-b p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{lead.name}</h2>

            <div className="mt-2 flex items-center gap-2">
              {/* Add tags button + multi-select */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 px-2">
                    Add tags
                    <ChevronsUpDown className="ml-1 h-4 w-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[260px]">
                  {allTags
                    .filter(tag => !isDepartmentTag(tag.name)) // Ascunde tag-urile de departament din dropdown
                    .map(tag => (
                      <DropdownMenuCheckboxItem
                        key={tag.id}
                        checked={selectedTagIds.includes(tag.id)}
                        onCheckedChange={() => handleToggleTag(tag.id)}
                        onSelect={(e) => e.preventDefault()} // ← keep menu open
                      >
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[11px] leading-5 ${tagClass(tag.color)}`}>
                          {tag.name}
                        </span>
                      </DropdownMenuCheckboxItem>
                    ))}
                  {allTags.filter(tag => !isDepartmentTag(tag.name)).length === 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                      No tags defined yet.
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Selected chips — inline, small radius, wrap at max width */}
              <div className="flex flex-wrap gap-1 max-w-[60%] md:max-w-[520px]">
                {allTags
                  .filter(t => selectedTagIds.includes(t.id))
                  .map(tag => {
                    const isUrgentOrRetur = tag.name.toLowerCase() === 'urgent' || tag.name === 'RETUR'
                    if (isDepartmentTag(tag.name)) {
                      return (
                        <span
                          key={tag.id}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${getDepartmentBadgeStyle(tag.name)} text-white shadow-sm border ${isUrgentOrRetur ? 'animate-border-strobe' : ''}`}
                        >
                          {tag.name}
                        </span>
                      )
                    }
                    // tag-uri speciale pentru urgent si RETUR cu background rosu si text alb
                    if (isUrgentOrRetur) {
                      return (
                        <span
                          key={tag.id}
                          className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[11px] leading-5 bg-red-600 text-white font-medium animate-border-strobe`}
                        >
                          {tag.name}
                        </span>
                      )
                    }
                    return (
                      <span
                        key={tag.id}
                        className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[11px] leading-5 ${tagClass(tag.color)}`}
                      >
                        {tag.name}
                      </span>
                    )
                  })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 items-end">
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  window.print()
                }}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  if (lead.email) {
                    handleEmailClick(lead.email)
                  } else {
                    toast.error('Email indisponibil', {
                      description: 'Lead-ul nu are adresă de email'
                    })
                  }
                }}
                disabled={!lead.email}
                title={lead.email ? `Trimite email la ${lead.email}` : 'Email indisponibil'}
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            </div>

            {/* checkbox-uri cu butoane - vizibile doar in Receptie, Vanzari, Curier */}
            {showActionCheckboxes && (
              <div className="flex flex-wrap gap-2">
                {/* Checkbox-uri pentru Curier */}
                {isCurierPipeline ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="curier-trimis"
                        checked={curierTrimis}
                        onCheckedChange={(c: any) => setCurierTrimis(!!c)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurierTrimis(!curierTrimis)}
                      >
                        Curier trimis
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="colet-ajuns"
                        checked={coletAjuns}
                        onCheckedChange={(c: any) => setColetAjuns(!!c)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setColetAjuns(!coletAjuns)}
                      >
                        Colet ajuns
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="curier-retur"
                        checked={curierRetur}
                        onCheckedChange={(c: any) => setCurierRetur(!!c)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurierRetur(!curierRetur)}
                      >
                        Curier retur
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="colet-trimis"
                        checked={coletTrimis}
                        onCheckedChange={(c: any) => setColetTrimis(!!c)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setColetTrimis(!coletTrimis)}
                      >
                        Colet trimis
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="astept-ridicarea"
                        checked={asteptRidicarea}
                        onCheckedChange={(c: any) => setAsteptRidicarea(!!c)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAsteptRidicarea(!asteptRidicarea)}
                      >
                        Astept ridicarea
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="ridic-personal"
                        checked={ridicPersonal}
                        onCheckedChange={(c: any) => setRidicPersonal(!!c)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRidicPersonal(!ridicPersonal)}
                      >
                        Ridic personal
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Checkbox-uri pentru Receptie si Vanzari (fara Call back in Curier) */}
                    {!isCurierPipeline && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="call-back"
                          checked={callBack}
                          onCheckedChange={(c: any) => setCallBack(!!c)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCallBack(!callBack)}
                        >
                          Call back
                        </Button>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="nu-raspunde"
                        checked={nuRaspunde}
                        onCheckedChange={(c: any) => setNuRaspunde(!!c)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setNuRaspunde(!nuRaspunde)}
                      >
                        Nu raspunde
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="no-deal"
                        checked={noDeal}
                        onCheckedChange={(c: any) => setNoDeal(!!c)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setNoDeal(!noDeal)}
                      >
                        No deal
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4 items-start p-4">
        {/* LEFT column — identity & meta */}
        <div className="space-y-4">
          <div>
            <label className="font-medium text-foreground">Name</label>
            <p className="text-muted-foreground">{lead.name}</p>
          </div>

          {lead.company && (
            <div>
              <label className="font-medium text-foreground">Company</label>
              <p className="text-muted-foreground">{lead.company}</p>
            </div>
          )}

          {lead.phone && (
            <div>
              <label className="font-medium text-foreground mb-1.5 block">Phone</label>
              <div className="flex items-center gap-2 group">
                <a
                  href={`tel:${lead.phone}`}
                  onClick={(e) => {
                    e.preventDefault()
                    handlePhoneClick(lead.phone!)
                  }}
                  className="flex-1 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  <span className="truncate">{lead.phone}</span>
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleCopy(lead.phone!, 'Telefon')}
                  title="Copiază telefon"
                >
                  {copiedField === 'Telefon' ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {lead.email && (
            <div>
              <label className="font-medium text-foreground mb-1.5 block">Email</label>
              <div className="flex items-center gap-2 group">
                <a
                  href={`mailto:${lead.email}`}
                  onClick={(e) => {
                    e.preventDefault()
                    handleEmailClick(lead.email!)
                  }}
                  className="flex-1 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors truncate"
                >
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  onClick={() => handleCopy(lead.email!, 'Email')}
                  title="Copiază email"
                >
                  {copiedField === 'Email' ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {lead.technician && (
            <div>
              <label className="font-medium text-foreground">Tehnician</label>
              <p className="text-muted-foreground">{lead.technician}</p>
            </div>
          )}

          {lead.notes && (
            <div>
              <label className="font-medium text-foreground">Notes</label>
              <p className="text-muted-foreground text-sm mt-1">{lead.notes}</p>
            </div>
          )}

          {/* sectiune pentru imagini */}
          <div>
            <label className="font-medium text-foreground mb-2 block">Imagini</label>
            <div className="space-y-3">
              {/* buton pentru adaugare imagine */}
              <div>
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <label
                  htmlFor="image-upload"
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background hover:bg-accent cursor-pointer transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <ImagePlus className="h-4 w-4" />
                  <span className="text-sm">{uploading ? 'Se încarcă...' : 'Adaugă imagine'}</span>
                </label>
              </div>

              {/* Grid cu imaginile existente */}
              {images.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {images.map((image) => (
                    <div key={image.id} className="relative group">
                      <div 
                        className="aspect-square rounded-lg overflow-hidden border border-border bg-muted cursor-pointer hover:ring-2 ring-primary transition-all"
                        onClick={() => setLightboxImage(image.url)}
                      >
                        <img
                          src={image.url}
                          alt={image.filename}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <Maximize2 className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleImageDelete(image.id, image.file_path)
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90 shadow-lg"
                        title="Șterge imagine"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Lightbox pentru imagini */}
              {lightboxImage && (
                <Dialog open={!!lightboxImage} onOpenChange={(open) => !open && setLightboxImage(null)}>
                  <DialogContent className="max-w-4xl p-0">
                    <img
                      src={lightboxImage}
                      alt="Preview"
                      className="w-full h-auto max-h-[80vh] object-contain"
                    />
                  </DialogContent>
                </Dialog>
              )}

              {images.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border border-dashed rounded-lg">
                  <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Nu există imagini adăugate</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            {lead?.createdAt && (
              <div>
                <label className="font-medium text-foreground">Created At</label>
                <p className="text-muted-foreground">{format(lead.createdAt, "MMM dd, yyyy")}</p>
              </div>
            )}
            {lead?.lastActivity && (
              <div>
                <label className="font-medium text-foreground">Last Activity</label>
                <p className="text-muted-foreground">{format(lead.lastActivity, "MMM dd, yyyy")}</p>
              </div>
            )}
          </div>

          <div>
            <label className="font-medium text-foreground mb-2 block">Move to Stage</label>
            <Select value={stage} onValueChange={handleStageChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Move to pipeline(s) */}
          <div className="mt-4">
            <label className="font-medium text-foreground mb-2 block">
              Move to pipeline(s)
            </label>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    {selectedPipes.length > 0 ? `Selected: ${selectedPipes.length}` : "Choose pipelines"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="w-[260px] max-h-[280px] overflow-y-auto">
                  {/* Pick all / Clear all */}
                  <DropdownMenuCheckboxItem
                    checked={selectedPipes.length === allPipeNames.length && allPipeNames.length > 0}
                    onCheckedChange={(v) => (v ? pickAll() : clearAll())}
                    onSelect={(e) => e.preventDefault()} // keep menu open
                  >
                    Pick all
                  </DropdownMenuCheckboxItem>

                  <div className="my-1 h-px bg-border" />

                  {/* Pipelines list */}
                  {allPipeNames.map(name => (
                    <DropdownMenuCheckboxItem
                      key={name}
                      checked={selectedPipes.includes(name)}
                      onCheckedChange={() => togglePipe(name)}
                      onSelect={(e) => e.preventDefault()} // keep menu open
                    >
                      <span className="truncate">{name}</span>
                    </DropdownMenuCheckboxItem>
                  ))}

                  {allPipeNames.length === 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                      No pipelines available.
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Action button – will do real work in Step 2 */}
              <Button
                size="sm"
                disabled={movingPipes || selectedPipes.length === 0}
                onClick={async () => {
                  if (!lead?.id) return
                  setMovingPipes(true)
                  try {
                    if (onBulkMoveToPipelines) {
                      await onBulkMoveToPipelines(lead.id, selectedPipes)
                    } else if (onMoveToPipeline) {
                      for (const name of selectedPipes) {
                        await onMoveToPipeline(lead.id, name)
                      }
                    }
                    setSelectedPipes([])
                  } finally {
                    setMovingPipes(false)
                  }
                }}
              >
                {movingPipes ? "Moving…" : "Move"}
              </Button>
            </div>
          </div>

          {/* mesagerie intre receptie si tehnician */}
          <LeadMessenger leadId={lead.id} leadTechnician={lead.technician} />
        </div>


          {/* RIGHT — switchable content cu tabs */}
          <div className="min-w-0">
            <Tabs value={section} onValueChange={(v) => setSection(v as "fisa" | "deconfirmat" | "istoric")} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="fisa" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Fișa de serviciu</span>
                  <span className="sm:hidden">Fișă</span>
                </TabsTrigger>
                <TabsTrigger value="deconfirmat" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">De confirmat</span>
                  <span className="sm:hidden">Confirmat</span>
                </TabsTrigger>
                <TabsTrigger value="istoric" className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  <span>Istoric</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="fisa" className="mt-0">
                <Preturi leadId={lead.id} lead={lead} />
              </TabsContent>
              <TabsContent value="deconfirmat" className="mt-0">
                <DeConfirmat
                  leadId={lead.id}
                  onMoveStage={(s) => onStageChange(lead.id, s)}
                />
              </TabsContent>
              <TabsContent value="istoric" className="mt-0">
                <LeadHistory leadId={lead.id} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
    </section>
  )
}
