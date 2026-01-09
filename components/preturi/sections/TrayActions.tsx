'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Loader2, Save } from 'lucide-react'

interface TrayActionsProps {
  urgentAllServices: boolean
  subscriptionType: 'services' | 'parts' | 'both' | ''
  officeDirect: boolean
  curierTrimis: boolean
  paymentCash: boolean
  paymentCard: boolean
  loading: boolean
  saving: boolean
  isDirty: boolean
  isVanzariPipeline: boolean
  isReceptiePipeline: boolean
  currentServiceFileStage: string | null
  canEditUrgentAndSubscription: boolean
  fisaId?: string | null
  selectedQuoteId: string | null
  items: any[]
  onUrgentChange: (checked: boolean) => Promise<void>
  onSubscriptionChange: (value: 'services' | 'parts' | 'both' | '') => void
  onOfficeDirectChange: (checked: boolean) => Promise<void>
  onCurierTrimisChange: (checked: boolean) => Promise<void>
  onPaymentCashChange: (checked: boolean) => void
  onPaymentCardChange: (checked: boolean) => void
  onSave: () => void
  onPrint?: () => void
  // Save to history for department pipelines
  onSaveToHistory?: () => void
}

/**
 * Componentă independentă pentru acțiunile tăviței
 * Include toggle-uri pentru urgent, subscription, delivery, payment și butonul de salvare
 */
export function TrayActions({
  urgentAllServices,
  subscriptionType,
  officeDirect,
  curierTrimis,
  paymentCash,
  paymentCard,
  loading,
  saving,
  isDirty,
  isVanzariPipeline,
  isReceptiePipeline,
  currentServiceFileStage,
  canEditUrgentAndSubscription,
  fisaId,
  selectedQuoteId,
  items,
  onUrgentChange,
  onSubscriptionChange,
  onOfficeDirectChange,
  onCurierTrimisChange,
  onPaymentCashChange,
  onPaymentCardChange,
  onSave,
  onPrint,
  onSaveToHistory,
}: TrayActionsProps) {
  const isFacturatStage = currentServiceFileStage?.toLowerCase().trim() === 'facturat' || 
    currentServiceFileStage?.toLowerCase().trim() === 'facturată' ||
    currentServiceFileStage?.toLowerCase().includes('facturat')

  // Validări pentru checkbox-urile Office Direct și Curier Trimis
  // Permitem selecția chiar și fără items, dar salvăm doar când există items
  const canSelectDelivery = !!(fisaId && selectedQuoteId)
  const canSaveDelivery = !!(fisaId && selectedQuoteId && items.length > 0)

  // Check if this is a department pipeline (not Vanzari, not Receptie)
  const isDepartmentPipeline = !isVanzariPipeline && !isReceptiePipeline

  return (
    <div className="mx-1 sm:mx-2 lg:mx-3 mb-2 sm:mb-3 flex flex-wrap items-center justify-between gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-muted/30 border border-border/40">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4">
        {/* Urgent Toggle - AFIȘAT PENTRU TOȚI utilizatorii */}
        {true && (
          <>
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${urgentAllServices ? 'bg-red-500' : 'bg-muted-foreground/20'}`}>
                <Checkbox
                  id="urgent-all"
                  checked={urgentAllServices}
                  onCheckedChange={onUrgentChange}
                  className="sr-only"
                />
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${urgentAllServices ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className={`text-xs sm:text-sm font-medium transition-colors ${urgentAllServices ? 'text-red-600' : 'text-muted-foreground group-hover:text-foreground'}`}>
                Urgent
              </span>
              {urgentAllServices && (
                <span className="text-[10px] font-medium text-red-500 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded">
                  +30%
                </span>
              )}
            </label>
            
            {/* Divider */}
            <div className="h-5 w-px bg-border/60" />
            
            {/* Abonament */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Label htmlFor="subscription" className="text-xs sm:text-sm font-medium text-muted-foreground">Abonament</Label>
              <select
                id="subscription"
                className="h-7 sm:h-8 text-xs sm:text-sm rounded-md sm:rounded-lg border border-border/60 px-2 sm:px-3 bg-white dark:bg-background hover:border-primary/40 transition-colors cursor-pointer"
                value={subscriptionType}
                onChange={e => onSubscriptionChange(e.target.value as 'services' | 'parts' | 'both' | '')}
              >
                <option value="">— Fără —</option>
                <option value="services">🏷️ Servicii (-10%)</option>
                <option value="parts">🔧 Piese (-5%)</option>
                <option value="both">✨ Ambele</option>
              </select>
            </div>
          </>
        )}
      
        {/* Checkbox-uri pentru livrare - AFIȘATE PENTRU TOȚI utilizatorii */}
        {true && (
          <div className="flex items-center gap-3">
            <div className="h-5 w-px bg-border/60" />
            
            {/* Office Direct Checkbox */}
            <label 
              className={`flex items-center gap-2 group select-none ${
                !canSelectDelivery || curierTrimis || loading || saving 
                  ? 'cursor-not-allowed' 
                  : 'cursor-pointer'
              }`}
              onMouseDown={(e) => {
                if (!canSelectDelivery || curierTrimis || loading || saving) {
                  e.preventDefault()
                  return
                }
                e.preventDefault()
                const newValue = !officeDirect
                if (onOfficeDirectChange) {
                  onOfficeDirectChange(newValue)
                }
              }}
            >
              <Checkbox
                id="office-direct"
                checked={officeDirect}
                disabled={!canSelectDelivery || curierTrimis || loading || saving}
                onCheckedChange={async (checked) => {
                  if (!canSelectDelivery) {
                    console.warn('[TrayActions] Cannot select Office Direct - conditions not met')
                    return
                  }
                  
                  const isChecked = !!checked
                  
                  // Dacă se bifează Office Direct, debifează Curier Trimis
                  if (isChecked && curierTrimis && onCurierTrimisChange) {
                    await onCurierTrimisChange(false)
                  }
                  
                  // Apelează callback-ul pentru Office Direct
                  if (onOfficeDirectChange) {
                    await onOfficeDirectChange(isChecked)
                  }
                }}
                className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 data-[disabled]:opacity-50"
              />
              <span className={`text-xs sm:text-sm font-medium transition-colors ${
                officeDirect 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : canSelectDelivery && !curierTrimis && !loading && !saving
                    ? 'text-muted-foreground group-hover:text-foreground'
                    : 'text-muted-foreground opacity-50'
              }`}>
                Office direct
              </span>
            </label>
            
            {/* Curier Trimis Checkbox */}
            <label 
              className={`flex items-center gap-1.5 sm:gap-2 group select-none ${
                !canSelectDelivery || officeDirect || loading || saving 
                  ? 'cursor-not-allowed' 
                  : 'cursor-pointer'
              }`}
              onMouseDown={(e) => {
                if (!canSelectDelivery || officeDirect || loading || saving) {
                  e.preventDefault()
                  return
                }
                e.preventDefault()
                const newValue = !curierTrimis
                if (onCurierTrimisChange) {
                  onCurierTrimisChange(newValue)
                }
              }}
            >
              <Checkbox
                id="curier-trimis"
                checked={curierTrimis}
                disabled={!canSelectDelivery || officeDirect || loading || saving}
                onCheckedChange={async (checked) => {
                  if (!canSelectDelivery) {
                    console.warn('[TrayActions] Cannot select Curier Trimis - conditions not met')
                    return
                  }
                  
                  const isChecked = !!checked
                  
                  // Dacă se bifează Curier Trimis, debifează Office Direct
                  if (isChecked && officeDirect && onOfficeDirectChange) {
                    await onOfficeDirectChange(false)
                  }
                  
                  // Apelează callback-ul pentru Curier Trimis
                  if (onCurierTrimisChange) {
                    await onCurierTrimisChange(isChecked)
                  }
                }}
                className="data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500 data-[disabled]:opacity-50"
              />
              <span className={`text-xs sm:text-sm font-medium transition-colors ${
                curierTrimis 
                  ? 'text-purple-600 dark:text-purple-400' 
                  : canSelectDelivery && !officeDirect && !loading && !saving
                    ? 'text-muted-foreground group-hover:text-foreground'
                    : 'text-muted-foreground opacity-50'
              }`}>
                Curier Trimis
              </span>
            </label>
          </div>
        )}
        
        {/* Checkbox-uri Cash și Card - doar în pipeline-ul Recepție și doar când fișa este în stage-ul "Facturat" */}
        {isReceptiePipeline && isFacturatStage && (
          <div className="flex items-center gap-3">
            <div className="h-5 w-px bg-border/60" />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="payment-cash"
                  checked={paymentCash}
                  onCheckedChange={(checked) => {
                    const isChecked = !!checked
                    onPaymentCashChange(isChecked)
                    if (isChecked) {
                      onPaymentCardChange(false)
                    }
                  }}
                />
                <label
                  htmlFor="payment-cash"
                  className="text-xs font-medium cursor-pointer"
                >
                  Cash
                </label>
              </div>
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="payment-card"
                  checked={paymentCard}
                  onCheckedChange={(checked) => {
                    const isChecked = !!checked
                    onPaymentCardChange(isChecked)
                    if (isChecked) {
                      onPaymentCashChange(false)
                    }
                  }}
                />
                <label
                  htmlFor="payment-card"
                  className="text-xs font-medium cursor-pointer"
                >
                  Card
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Butoane acțiune fișă */}
      <div className="ml-auto flex items-center gap-2">
        {/* Buton Facturare - doar în pipeline-ul Recepție și doar când fișa este în stage-ul "Facturat" */}
        {isReceptiePipeline && isFacturatStage && onPrint && (
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={onPrint}
            className="shadow-sm"
          >
            Facturează fișa
          </Button>
        )}

        {/* Buton Salvare în Istoric pentru department pipelines */}
        {isDepartmentPipeline && onSaveToHistory ? (
          <Button 
            size="sm" 
            variant="outline"
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onSaveToHistory()
            }} 
            disabled={loading || saving}
            className="shadow-sm"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Se salvează…
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Salvează în istoric
              </>
            )}
          </Button>
        ) : (
          /* Buton Salvare standard */
          <Button 
            size="sm" 
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onSave()
            }} 
            disabled={loading || saving || !isDirty}
            className="shadow-sm"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Se salvează…
              </>
            ) : (
              "Salvează în Istoric"
            )}
          </Button>
        )}
      </div>
    </div>
  )
}


