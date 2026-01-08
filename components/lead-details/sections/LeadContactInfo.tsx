/**
 * Componentă pentru informațiile de contact ale lead-ului
 * Cu suport pentru editare inline și design uniform
 */

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { 
  Check, Copy, Mail, MapPin, Phone, User, ChevronDown, ChevronRight, 
  Pencil, Save, X, Loader2, Building2, Hash, Calendar
} from "lucide-react"
import { format } from "date-fns"
import { supabaseBrowser } from "@/lib/supabase/supabaseClient"
import { useRole } from "@/lib/contexts/AuthContext"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const supabase = supabaseBrowser()

interface LeadContactInfoProps {
  lead: {
    id?: string
    name: string
    phone?: string | null
    email?: string | null
    company_name?: string | null
    company_address?: string | null
    address?: string | null
    address2?: string | null
    city?: string | null
    zip?: string | null
    judet?: string | null
    strada?: string | null
    technician?: string | null
    notes?: string | null
    createdAt?: Date | string | null
    lastActivity?: Date | string | null
    [key: string]: any
  }
  isContactOpen: boolean
  setIsContactOpen: (open: boolean) => void
  copiedField: string | null
  onCopy: (text: string, field: string) => void
  onPhoneClick: (phone: string) => void
  onEmailClick: (email: string) => void
  onLeadUpdate?: (updatedLead: any) => void
}

interface FieldConfig {
  key: string
  label: string
  icon: React.ReactNode
  type: 'text' | 'phone' | 'email'
  placeholder: string
  gridSpan?: string
}

const fieldConfigs: FieldConfig[] = [
  // Rând 1: Nume (full)
  { key: 'name', label: 'Nume', icon: <User className="h-4 w-4" />, type: 'text', placeholder: 'Nume complet', gridSpan: 'col-span-2' },
  // Rând 2: Telefon + Cod Poștal (1/2 + 1/2)
  { key: 'phone', label: 'Telefon', icon: <Phone className="h-4 w-4" />, type: 'phone', placeholder: '+40 xxx xxx xxx' },
  { key: 'zip', label: 'Cod Poștal', icon: <Hash className="h-4 w-4" />, type: 'text', placeholder: 'Cod poștal' },
  // Rând 3: Email (full)
  { key: 'email', label: 'Email', icon: <Mail className="h-4 w-4" />, type: 'email', placeholder: 'email@exemplu.ro', gridSpan: 'col-span-2' },
  // Rând 4: Companie (full)
  { key: 'company_name', label: 'Companie', icon: <Building2 className="h-4 w-4" />, type: 'text', placeholder: 'Nume companie', gridSpan: 'col-span-2' },
  // Rând 5: Adresă Companie (full)
  { key: 'company_address', label: 'Adresă Companie', icon: <Building2 className="h-4 w-4" />, type: 'text', placeholder: 'Adresa companiei', gridSpan: 'col-span-2' },
  // Rând 6: Stradă (full)
  { key: 'strada', label: 'Stradă', icon: <MapPin className="h-4 w-4" />, type: 'text', placeholder: 'Strada și număr', gridSpan: 'col-span-2' },
  // Rând 7: Oraș + Județ (1/2 + 1/2)
  { key: 'city', label: 'Oraș', icon: <MapPin className="h-4 w-4" />, type: 'text', placeholder: 'Oraș' },
  { key: 'judet', label: 'Județ', icon: <MapPin className="h-4 w-4" />, type: 'text', placeholder: 'Județ' },
]

export function LeadContactInfo({
  lead,
  isContactOpen,
  setIsContactOpen,
  copiedField,
  onCopy,
  onPhoneClick,
  onEmailClick,
  onLeadUpdate,
}: LeadContactInfoProps) {
  const { isAdmin } = useRole()
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editData, setEditData] = useState<Record<string, string>>({})

  // Actualizează editData când lead-ul se schimbă
  useEffect(() => {
    const data: Record<string, string> = {}
    fieldConfigs.forEach(field => {
      data[field.key] = (lead as any)[field.key] || ''
    })
    setEditData(data)
  }, [lead])

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    // Reset to original values
    const data: Record<string, string> = {}
    fieldConfigs.forEach(field => {
      data[field.key] = (lead as any)[field.key] || ''
    })
    setEditData(data)
  }

  const handleSave = async () => {
    if (!lead.id) {
      toast.error('ID-ul lead-ului lipsește')
      return
    }

    setSaving(true)
    try {
      // Mapare câmpuri UI -> DB
      const dbUpdate: Record<string, any> = {
        full_name: editData.name || null,
        phone_number: editData.phone || null,
        email: editData.email || null,
        company_name: editData.company_name || null,
        company_address: editData.company_address || null,
        city: editData.city || null,
        zip: editData.zip || null,
        judet: editData.judet || null,
        strada: editData.strada || null,
        updated_at: new Date().toISOString()
      }

      // console.log('[LeadContactInfo] Saving to DB:', { leadId: lead.id, dbUpdate })

      const { error } = await supabase
        .from('leads')
        .update(dbUpdate)
        .eq('id', lead.id)

      if (error) {
        console.error('[LeadContactInfo] DB Error:', error)
        throw error
      }

      toast.success('Informațiile au fost salvate cu succes!')
      setIsEditing(false)
      
      // Notifică părintele despre actualizare cu câmpurile mapate corect pentru UI
      onLeadUpdate?.({
        ...lead,
        name: editData.name,
        phone: editData.phone,
        email: editData.email,
        company_name: editData.company_name,
        company_address: editData.company_address,
        city: editData.city,
        zip: editData.zip,
        judet: editData.judet,
        strada: editData.strada,
      })
    } catch (error: any) {
      console.error('Error saving contact info:', error)
      toast.error('Eroare la salvarea informațiilor: ' + (error?.message || 'Eroare necunoscută'))
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (key: string, value: string) => {
    setEditData(prev => ({ ...prev, [key]: value }))
  }

  const getFieldValue = (key: string): string => {
    return (lead as any)[key] || ''
  }

  const renderField = (config: FieldConfig) => {
    const value = isEditing ? (editData[config.key] || '') : getFieldValue(config.key)
    const displayValue = value || config.placeholder
    const isEmpty = !value

    return (
      <div 
        key={config.key}
        className={cn(
          "group",
          config.gridSpan || ''
        )}
      >
        {/* Label cu iconță */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-muted-foreground">{config.icon}</span>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {config.label}
          </span>
        </div>
        
        {/* Input/Display - același stil */}
        <div className="relative">
          <Input
            value={value}
            onChange={(e) => handleFieldChange(config.key, e.target.value)}
            placeholder={config.placeholder}
            className={cn(
              "h-10 text-sm transition-all",
              isEditing 
                ? "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 focus:border-primary focus:ring-2 focus:ring-primary/20" 
                : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 cursor-default",
              isEmpty && !isEditing && "text-muted-foreground"
            )}
            disabled={!isEditing || saving}
            readOnly={!isEditing}
          />
          
          {/* Butoane de acțiune pentru telefon/email - doar în modul vizualizare */}
          {!isEditing && !isEmpty && (config.type === 'phone' || config.type === 'email') && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {config.type === 'phone' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:hover:bg-emerald-800/50"
                  onClick={() => onPhoneClick(value)}
                  title="Sună"
                >
                  <Phone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </Button>
              )}
              {config.type === 'email' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-800/50"
                  onClick={() => onEmailClick(value)}
                  title="Trimite email"
                >
                  <Mail className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                onClick={() => onCopy(value, config.label)}
                title="Copiază"
              >
                {copiedField === config.label ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Collapsible open={isContactOpen} onOpenChange={setIsContactOpen}>
      <div className="rounded-xl border bg-gradient-to-br from-slate-50/80 to-white dark:from-slate-900/80 dark:to-slate-800/50 shadow-sm overflow-hidden">
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left">
              <span className="font-semibold text-sm block">Informații Contact</span>
              <span className="text-[10px] text-muted-foreground">
                {lead.name} • {lead.phone || 'Fără telefon'}
              </span>
            </div>
          </div>
          {isContactOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-3 pb-4 space-y-4">
            {/* Separator decorativ */}
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            
            {/* Butoane acțiune */}
            <div className="flex justify-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={saving}
                    className="h-8 text-xs gap-1.5"
                  >
                    <X className="h-3.5 w-3.5" />
                    Anulează
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                    className="h-8 text-xs gap-1.5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-sm"
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Salvează
                  </Button>
                </>
              ) : (
                isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEdit}
                    className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editează
                  </Button>
                )
              )}
            </div>

            {/* Grid cu câmpuri - design uniform */}
            <div className="grid grid-cols-2 gap-3">
              {fieldConfigs.map(config => renderField(config))}
            </div>

            {/* Informații suplimentare (read-only) */}
            {(lead.technician || lead.notes) && (
              <>
                <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-2" />
                
                {lead.technician && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <User className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      Tehnician: {lead.technician}
                    </span>
                  </div>
                )}

                {lead.notes && (
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Notițe
                    </span>
                    <p className="text-sm text-muted-foreground">{lead.notes}</p>
                  </div>
                )}
              </>
            )}

            {/* Footer cu date sistem */}
            <div className="flex items-center justify-center gap-4 pt-2 border-t border-dashed">
              {lead?.createdAt && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Creat: {format(new Date(lead.createdAt), "dd MMM yyyy")}</span>
                </div>
              )}
              {lead?.lastActivity && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Activitate: {format(new Date(lead.lastActivity), "dd MMM yyyy")}</span>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
