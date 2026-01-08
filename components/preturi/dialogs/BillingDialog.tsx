'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import type { Lead as DatabaseLead } from '@/lib/types/database'
import type { Lead } from '@/app/(crm)/dashboard/page'
import type { LeadQuote } from '@/lib/types/preturi'
import type { Service } from '@/lib/supabase/serviceOperations'
import { PrintViewData } from '../utils/PrintViewData'

const supabase = supabaseBrowser()

interface BillingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead: Lead | DatabaseLead
  quotes: LeadQuote[]
  allSheetsTotal: number
  urgentMarkupPct: number
  subscriptionType: 'services' | 'parts' | 'both' | ''
  services: Service[]
  instruments: Array<{ id: string; name: string; weight: number; department_id: string | null; pipeline?: string | null }>
  pipelinesWithIds: Array<{ id: string; name: string }>
  onSave?: () => void
}

interface BillingFormData {
  nume_prenume: string
  nume_companie: string
  cui: string
  strada: string
  oras: string
  judet: string
  cod_postal: string
}

export function BillingDialog({
  open,
  onOpenChange,
  lead,
  quotes,
  allSheetsTotal,
  urgentMarkupPct,
  subscriptionType,
  services,
  instruments,
  pipelinesWithIds,
  onSave
}: BillingDialogProps) {
  const [formData, setFormData] = useState<BillingFormData>({
    nume_prenume: '',
    nume_companie: '',
    cui: '',
    strada: '',
    oras: '',
    judet: '',
    cod_postal: ''
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Încarcă datele de facturare din DB sau populează cu datele de livrare
  useEffect(() => {
    if (!open || !lead) return

    const loadBillingData = async () => {
      setLoading(true)
      try {
        // Type guard pentru a verifica dacă lead-ul are câmpurile de facturare
        const dbLead = lead as DatabaseLead
        
        // Verifică dacă există date de facturare salvate
        const hasBillingData = dbLead.billing_nume_prenume || 
                                dbLead.billing_nume_companie || 
                                dbLead.billing_cui ||
                                dbLead.billing_strada ||
                                dbLead.billing_oras ||
                                dbLead.billing_judet ||
                                dbLead.billing_cod_postal

        if (hasBillingData) {
          // Folosește datele de facturare salvate
          setFormData({
            nume_prenume: dbLead.billing_nume_prenume || '',
            nume_companie: dbLead.billing_nume_companie || '',
            cui: dbLead.billing_cui || '',
            strada: dbLead.billing_strada || '',
            oras: dbLead.billing_oras || '',
            judet: dbLead.billing_judet || '',
            cod_postal: dbLead.billing_cod_postal || ''
          })
        } else {
          // Populează cu datele de livrare (default)
          // Verifică dacă lead-ul are full_name (DatabaseLead) sau name (KanbanLead)
          const leadName = (dbLead as any).full_name || (lead as any).name || ''
          const leadCity = dbLead.city || (lead as any).city || ''
          const leadJudet = dbLead.judet || ''
          const leadStrada = dbLead.strada || ''
          const leadZip = dbLead.zip || (lead as any).zip || ''
          const leadCompany = dbLead.company_name || (lead as any).company_name || ''
          
          setFormData({
            nume_prenume: leadName,
            nume_companie: leadCompany,
            cui: '',
            strada: leadStrada,
            oras: leadCity,
            judet: leadJudet,
            cod_postal: leadZip
          })
        }
      } catch (error) {
        console.error('Error loading billing data:', error)
        // În caz de eroare, folosește datele de livrare
        const dbLead = lead as DatabaseLead
        const leadName = dbLead.full_name || (lead as any).name || ''
        const leadCity = dbLead.city || (lead as any).city || ''
        const leadCompany = dbLead.company_name || (lead as any).company_name || ''
        
        setFormData({
          nume_prenume: leadName,
          nume_companie: leadCompany,
          cui: '',
          strada: dbLead.strada || '',
          oras: leadCity,
          judet: dbLead.judet || '',
          cod_postal: dbLead.zip || (lead as any).zip || ''
        })
      } finally {
        setLoading(false)
      }
    }

    loadBillingData()
  }, [open, lead])

  const handleSave = async () => {
    if (!lead?.id) return

    setSaving(true)
    try {
      const dbLead = lead as DatabaseLead
      const { error } = await supabase
        .from('leads')
        .update({
          billing_nume_prenume: formData.nume_prenume || null,
          billing_nume_companie: formData.nume_companie || null,
          billing_cui: formData.cui || null,
          billing_strada: formData.strada || null,
          billing_oras: formData.oras || null,
          billing_judet: formData.judet || null,
          billing_cod_postal: formData.cod_postal || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', dbLead.id || lead.id)

      if (error) throw error

      toast.success('Datele de facturare au fost salvate')
      onSave?.()
    } catch (error: any) {
      console.error('Error saving billing data:', error)
      toast.error('Eroare la salvarea datelor de facturare')
    } finally {
      setSaving(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] p-0" showCloseButton={true}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Date de facturare</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col md:flex-row h-[calc(90vh-80px)]">
          {/* Formular facturare - stânga */}
          <div className="w-full md:w-1/2 border-r p-6 overflow-y-auto">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="billing-nume-prenume">
                    Nume și Prenume <span className="text-muted-foreground">(editabil)</span>
                  </Label>
                  <Input
                    id="billing-nume-prenume"
                    value={formData.nume_prenume}
                    onChange={(e) => setFormData(prev => ({ ...prev, nume_prenume: e.target.value }))}
                    placeholder="Nume și prenume"
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="billing-nume-companie">Nume Companie</Label>
                  <Input
                    id="billing-nume-companie"
                    value={formData.nume_companie}
                    onChange={(e) => setFormData(prev => ({ ...prev, nume_companie: e.target.value }))}
                    placeholder="Nume companie"
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="billing-cui">CUI</Label>
                  <Input
                    id="billing-cui"
                    value={formData.cui}
                    onChange={(e) => setFormData(prev => ({ ...prev, cui: e.target.value }))}
                    placeholder="CUI"
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="billing-strada">
                    Stradă <span className="text-muted-foreground">(editabil)</span>
                  </Label>
                  <Input
                    id="billing-strada"
                    value={formData.strada}
                    onChange={(e) => setFormData(prev => ({ ...prev, strada: e.target.value }))}
                    placeholder="Stradă și număr"
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="billing-oras">
                    Oraș <span className="text-muted-foreground">(editabil)</span>
                  </Label>
                  <Input
                    id="billing-oras"
                    value={formData.oras}
                    onChange={(e) => setFormData(prev => ({ ...prev, oras: e.target.value }))}
                    placeholder="Oraș"
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="billing-judet">
                    Județ <span className="text-muted-foreground">(editabil)</span>
                  </Label>
                  <Input
                    id="billing-judet"
                    value={formData.judet}
                    onChange={(e) => setFormData(prev => ({ ...prev, judet: e.target.value }))}
                    placeholder="Județ"
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="billing-cod-postal">
                    Cod poștal <span className="text-muted-foreground">(editabil)</span>
                  </Label>
                  <Input
                    id="billing-cod-postal"
                    value={formData.cod_postal}
                    onChange={(e) => setFormData(prev => ({ ...prev, cod_postal: e.target.value }))}
                    placeholder="Cod poștal"
                    disabled={loading}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleSave}
                    disabled={saving || loading}
                    className="flex-1"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Se salvează...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Salvează datele
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handlePrint}
                    variant="outline"
                    disabled={loading}
                  >
                    Tipărește
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Detalii comandă - dreapta */}
          <div className="w-full md:w-1/2 p-6 overflow-y-auto bg-gray-50">
            <ScrollArea className="h-full">
              <div className="print-section">
                <PrintViewData
                  lead={lead as any}
                  quotes={quotes}
                  allSheetsTotal={allSheetsTotal}
                  urgentMarkupPct={urgentMarkupPct}
                  subscriptionType={subscriptionType}
                  services={services}
                  instruments={instruments}
                  pipelinesWithIds={pipelinesWithIds}
                />
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

