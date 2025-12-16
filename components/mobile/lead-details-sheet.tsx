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
import { Mail, Phone, Clock, Tag, FileText, Package, User, Loader2, Wrench, ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ro } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { listServiceFilesForLead, listTraysForServiceFile } from '@/lib/supabase/serviceFileOperations'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

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
}

export function LeadDetailsSheet({
  lead,
  open,
  onOpenChange,
  onMove,
  onEdit,
}: LeadDetailsSheetProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [serviceFiles, setServiceFiles] = useState<ServiceFile[]>([])
  const [trays, setTrays] = useState<Tray[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [isTechnician, setIsTechnician] = useState(false)
  
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
      
      setIsTechnician(!!data && data.role !== 'owner' && data.role !== 'admin')
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="activity">Activitate</TabsTrigger>
            <TabsTrigger value="files">Fișe & Tăvițe</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
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

          <TabsContent value="activity" className="space-y-4 mt-4">
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

          <TabsContent value="files" className="space-y-4 mt-4">
            <div className="space-y-4">
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
                  {trays.filter(t => !serviceFiles.some(f => f.id === t.service_file_id)).length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                        Tăvițe
                      </h4>
                      {trays
                        .filter(t => !serviceFiles.some(f => f.id === t.service_file_id))
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
                        ))}
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
            </div>
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

