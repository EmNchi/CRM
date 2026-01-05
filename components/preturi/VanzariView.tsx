'use client'

import { AddInstrumentForm } from './AddInstrumentForm'
import { AddServiceForm } from './AddServiceForm'
import { ItemsTable } from './ItemsTable'
import { TotalsSection } from './TotalsSection'
import { TrayDetailsSection } from './TrayDetailsSection'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Trash2 } from 'lucide-react'
import { URGENT_MARKUP_PCT } from '@/lib/types/preturi'
import type { LeadQuoteItem } from '@/lib/types/preturi'
import type { Service } from '@/lib/supabase/serviceOperations'
import type { Lead } from '@/app/(crm)/dashboard/page'

interface VanzariViewProps {
  // State
  instrumentForm: { instrument: string; qty: string }
  svc: { id: string; qty: string; discount: string; instrumentId: string }
  serviceSearchQuery: string
  serviceSearchFocused: boolean
  items: LeadQuoteItem[]
  subscriptionType: 'services' | 'parts' | 'both' | ''
  trayDetails: string
  loadingTrayDetails: boolean
  urgentAllServices: boolean
  officeDirect: boolean
  curierTrimis: boolean
  noDeal: boolean
  nuRaspunde: boolean
  callBack: boolean
  loading: boolean
  saving: boolean
  isDirty: boolean
  
  // Data
  availableInstruments: Array<{ id: string; name: string }>
  availableServices: Service[]
  services: Service[]
  instruments: Array<{ id: string; name: string; weight: number }>
  lead: Lead | null
  
  // Callbacks
  onInstrumentChange: (instrumentId: string) => void
  onQtyChange: (qty: string) => void
  onServiceSearchChange: (query: string) => void
  onServiceSearchFocus: () => void
  onServiceSearchBlur: () => void
  onServiceSelect: (serviceId: string, serviceName: string) => void
  onServiceDoubleClick: (serviceId: string, serviceName: string) => void
  onSvcQtyChange: (qty: string) => void
  onSvcDiscountChange: (discount: string) => void
  onAddService: () => void
  onUpdateItem: (id: string, patch: Partial<LeadQuoteItem>) => void
  onDelete: (id: string) => void
  onDetailsChange: (details: string) => void
  onOfficeDirectChange: (isOfficeDirect: boolean) => Promise<void>
  onNoDealChange: () => void
  onNuRaspundeChange: () => void
  onCallBackChange: () => void
  onSave: () => void
  
  // Computed
  currentInstrumentId: string | null
  hasServicesOrInstrumentInSheet: boolean
  isTechnician: boolean
  isDepartmentPipeline: boolean
  subtotal: number
  totalDiscount: number
  total: number
  instrumentSettings: Record<string, any>
}

export function VanzariView({
  instrumentForm,
  svc,
  serviceSearchQuery,
  serviceSearchFocused,
  items,
  subscriptionType,
  trayDetails,
  loadingTrayDetails,
  urgentAllServices,
  officeDirect,
  curierTrimis,
  noDeal,
  nuRaspunde,
  callBack,
  loading,
  saving,
  isDirty,
  availableInstruments,
  availableServices,
  services,
  instruments,
  lead,
  onInstrumentChange,
  onQtyChange,
  onServiceSearchChange,
  onServiceSearchFocus,
  onServiceSearchBlur,
  onServiceSelect,
  onServiceDoubleClick,
  onSvcQtyChange,
  onSvcDiscountChange,
  onAddService,
  onUpdateItem,
  onDelete,
  onDetailsChange,
  onOfficeDirectChange,
  onNoDealChange,
  onNuRaspundeChange,
  onCallBackChange,
  onSave,
  currentInstrumentId,
  hasServicesOrInstrumentInSheet,
  isTechnician,
  isDepartmentPipeline,
  subtotal,
  totalDiscount,
  total,
  instrumentSettings,
}: VanzariViewProps) {
  return (
    <div className="space-y-4 border rounded-xl bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-800/30 border-b">
        <div className="px-4 pt-4 pb-3">
          <h3 className="font-semibold text-base text-foreground">Comandă Nouă</h3>
          <p className="text-sm text-muted-foreground mt-1">Adaugă instrumente și servicii pentru această comandă</p>
        </div>
      </div>
      
      {/* Informații Contact */}
      {lead && (
        <div className="px-4 py-3 bg-muted/30 border-b">
          <h4 className="font-medium text-sm mb-2">Informații Contact</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Nume: </span>
              <span className="font-medium">{lead.name || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Email: </span>
              <span className="font-medium">{lead.email || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Telefon: </span>
              <span className="font-medium">{lead.phone || '—'}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Instrument */}
      {!(isDepartmentPipeline && isTechnician) && (
        <AddInstrumentForm
          instrumentForm={instrumentForm}
          availableInstruments={availableInstruments}
          instrumentSettings={instrumentSettings}
          hasServicesOrInstrumentInSheet={hasServicesOrInstrumentInSheet}
          isVanzariPipeline={true}
          isDepartmentPipeline={isDepartmentPipeline}
          isTechnician={isTechnician}
          onInstrumentChange={onInstrumentChange}
          onQtyChange={onQtyChange}
        />
      )}
      
      {/* Add Service */}
      <AddServiceForm
        svc={svc}
        serviceSearchQuery={serviceSearchQuery}
        serviceSearchFocused={serviceSearchFocused}
        currentInstrumentId={currentInstrumentId}
        availableServices={availableServices}
        onServiceSearchChange={onServiceSearchChange}
        onServiceSearchFocus={onServiceSearchFocus}
        onServiceSearchBlur={onServiceSearchBlur}
        onServiceSelect={onServiceSelect}
        onServiceDoubleClick={onServiceDoubleClick}
        onQtyChange={onSvcQtyChange}
        onDiscountChange={onSvcDiscountChange}
        onAddService={onAddService}
      />
      
      {/* Items Table - simplificat */}
      <div className="p-0 mx-4 overflow-x-auto border rounded-lg bg-card">
        <Table className="text-sm min-w-[600px]">
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs font-semibold">Serviciu</TableHead>
              <TableHead className="text-xs font-semibold text-center">Cant.</TableHead>
              <TableHead className="text-xs font-semibold text-center">Preț</TableHead>
              <TableHead className="text-xs font-semibold text-center">Disc%</TableHead>
              <TableHead className="text-xs font-semibold text-right">Total</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.filter(it => it.item_type !== null).map(it => {
              const disc = Math.min(100, Math.max(0, it.discount_pct || 0));
              const base = (it.qty || 0) * (it.price || 0);
              const afterDisc = base * (1 - disc / 100);
              const lineTotal = it.urgent ? afterDisc * (1 + URGENT_MARKUP_PCT / 100) : afterDisc;
              
              return (
                <TableRow key={it.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-sm py-2">
                    {it.name_snapshot}
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      className="h-7 text-sm text-center w-14"
                      inputMode="numeric"
                      value={String(it.qty)}
                      onChange={e => {
                        const v = Math.max(1, Number(e.target.value || 1));
                        onUpdateItem(it.id, { qty: v });
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-center text-sm py-2">
                    {it.price.toFixed(2)}
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      className="h-7 text-sm text-center w-12"
                      inputMode="decimal"
                      value={String(it.discount_pct)}
                      onChange={e => {
                        const v = Math.min(100, Math.max(0, Number(e.target.value || 0)));
                        onUpdateItem(it.id, { discount_pct: v });
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium text-sm py-2">{lineTotal?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell className="py-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" 
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(it.id)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground text-center py-6 text-sm">
                  Nu există poziții încă.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Totals */}
      <div className="flex justify-end px-4">
        <div className="w-full md:w-[280px] space-y-1 text-sm bg-muted/20 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{subtotal.toFixed(2)} RON</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span className="text-red-500">-{totalDiscount.toFixed(2)} RON</span>
          </div>
          <div className="h-px bg-border my-2" />
          <div className="flex items-center justify-between font-semibold text-base">
            <span>Total</span>
            <span>{total.toFixed(2)} RON</span>
          </div>
        </div>
      </div>
      
      {/* Checkbox-uri Office Direct / Curier Trimis */}
      <div className="mx-4 p-3 rounded-lg bg-muted/30 border">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer group">
            <Checkbox
              id="office-direct-vanzator"
              checked={officeDirect}
              disabled={curierTrimis}
              onCheckedChange={async (c: any) => {
                const isChecked = !!c
                if (isChecked) {
                  await onOfficeDirectChange(true)
                }
              }}
              className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
            />
            <span className={`text-sm font-medium transition-colors ${officeDirect ? 'text-blue-600' : 'text-muted-foreground group-hover:text-foreground'}`}>
              Office direct
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <Checkbox
              id="curier-trimis-vanzator"
              checked={curierTrimis}
              disabled={officeDirect}
              onCheckedChange={async (c: any) => {
                const isChecked = !!c
                if (isChecked) {
                  await onOfficeDirectChange(false)
                }
              }}
              className="data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
            />
            <span className={`text-sm font-medium transition-colors ${curierTrimis ? 'text-purple-600' : 'text-muted-foreground group-hover:text-foreground'}`}>
              Curier Trimis
            </span>
          </label>
        </div>
      </div>
      
      {/* Detalii comandă */}
      <TrayDetailsSection
        trayDetails={trayDetails}
        loadingTrayDetails={loadingTrayDetails}
        isCommercialPipeline={true}
        onDetailsChange={onDetailsChange}
      />
      
      {/* Checkbox-uri NoDeal, NuRaspunde, CallBack */}
      <div className="px-4 py-3 bg-muted/30 border-b">
        <h4 className="font-medium text-sm mb-3">Acțiuni Lead</h4>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer group">
            <Checkbox
              id="no-deal-vanzator"
              checked={noDeal}
              disabled={nuRaspunde || callBack}
              onCheckedChange={onNoDealChange}
              className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
            />
            <span className={`text-sm font-medium transition-colors ${noDeal ? 'text-red-600' : 'text-muted-foreground group-hover:text-foreground'}`}>
              No Deal
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <Checkbox
              id="nu-raspunde-vanzator"
              checked={nuRaspunde}
              disabled={noDeal || callBack}
              onCheckedChange={onNuRaspundeChange}
              className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
            />
            <span className={`text-sm font-medium transition-colors ${nuRaspunde ? 'text-orange-600' : 'text-muted-foreground group-hover:text-foreground'}`}>
              Nu Raspunde
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <Checkbox
              id="callback-vanzator"
              checked={callBack}
              disabled={noDeal || nuRaspunde}
              onCheckedChange={onCallBackChange}
              className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
            />
            <span className={`text-sm font-medium transition-colors ${callBack ? 'text-blue-600' : 'text-muted-foreground group-hover:text-foreground'}`}>
              Call Back
            </span>
          </label>
        </div>
      </div>
      
      {/* Buton Salvare */}
      <div className="px-4 py-3 flex justify-end">
        <Button 
          size="sm" 
          onClick={onSave} 
          disabled={loading || saving || !isDirty}
          className="shadow-sm"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Se salvează…
            </>
          ) : (
            "Salvează Comandă"
          )}
        </Button>
      </div>
    </div>
  )
}

