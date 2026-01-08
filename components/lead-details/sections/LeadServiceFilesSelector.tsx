/**
 * Componentă pentru selectorul de fișe de serviciu și tăvițe
 */

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Info } from "lucide-react"
import { format } from "date-fns"
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { TrayTabs } from "@/components/preturi/sections/TrayTabs"
import type { LeadQuote } from "@/lib/types/preturi"

interface ServiceSheet {
  id: string
  number: string
  status: string
  date: string
  lead_id: string
  created_at?: string
  fisa_index?: number
}

interface Tray {
  id: string
  number: string
  size: string
  service_file_id: string
}

interface LeadServiceFilesSelectorProps {
  isDepartmentPipeline: boolean
  isTechnician: boolean
  isVanzariPipeline: boolean
  isReceptiePipeline: boolean
  isVanzator: boolean
  
  // Service files
  serviceSheets: ServiceSheet[]
  selectedFisaId: string | null
  loadingSheets: boolean
  onFisaIdChange: (fisaId: string) => void
  onCreateServiceSheet: () => void
  
  // Trays (pentru department pipeline)
  allTrays: Tray[]
  selectedTrayId: string | null
  loadingTrays: boolean
  onTrayIdChange: (trayId: string, fisaId: string) => void
  
  // Modal detalii
  detailsModalOpen: boolean
  setDetailsModalOpen: (open: boolean) => void
  onLoadTraysDetails: (fisaId: string) => void
  loadingDetails: boolean
  traysDetails: any[]
  
  // TrayTabs props (opțional)
  quotes?: LeadQuote[]
  selectedQuoteId?: string | null
  isVanzatorMode?: boolean
  sendingTrays?: boolean
  traysAlreadyInDepartments?: boolean
  onTraySelect?: (trayId: string) => void
  onAddTray?: () => void
  onDeleteTray?: (trayId: string) => void
  onSendTrays?: () => void
}

export function LeadServiceFilesSelector({
  isDepartmentPipeline,
  isTechnician,
  isVanzariPipeline,
  isReceptiePipeline,
  isVanzator,
  serviceSheets,
  selectedFisaId,
  loadingSheets,
  onFisaIdChange,
  onCreateServiceSheet,
  allTrays,
  selectedTrayId,
  loadingTrays,
  onTrayIdChange,
  detailsModalOpen,
  setDetailsModalOpen,
  onLoadTraysDetails,
  loadingDetails,
  traysDetails,
  quotes,
  selectedQuoteId,
  isVanzatorMode,
  sendingTrays,
  traysAlreadyInDepartments,
  onTraySelect,
  onAddTray,
  onDeleteTray,
  onSendTrays,
}: LeadServiceFilesSelectorProps) {
  // Verifică dacă TrayTabs trebuie afișat
  const showTrayTabs = !isDepartmentPipeline && !isVanzatorMode && quotes && quotes.length > 0 && onTraySelect && onAddTray && onDeleteTray && onSendTrays
  
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          {isDepartmentPipeline ? (
          <>
            {/* Pentru vânzători / admin / owner: selector de tăviță */}
            {!isTechnician ? (
              <>
                <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                  Selectează tăvița:
                </label>
                <div className="flex items-center gap-2 flex-1">
                  <Select
                    value={selectedTrayId || ''}
                    onValueChange={(value) => {
                      const tray = allTrays.find(t => t.id === value)
                      if (tray) {
                        onTrayIdChange(tray.id, tray.service_file_id)
                      }
                    }}
                    disabled={loadingTrays}
                  >
                    <SelectTrigger className="w-full max-w-md">
                      <SelectValue placeholder={loadingTrays ? "Se încarcă..." : "Selectează o tăviță"} />
                    </SelectTrigger>
                    <SelectContent>
                      {allTrays.map((tray) => {
                        const displayText = `Tăviță #${tray.number} - ${tray.size}`
                        return (
                          <SelectItem key={tray.id} value={tray.id}>
                            {displayText}
                          </SelectItem>
                        );
                      })}
                      {allTrays.length === 0 && !loadingTrays && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          Nu există tăvițe
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCreateServiceSheet}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Adaugă Fișă Serviciu
                  </Button>
                </div>
              </>
            ) : (
              /* Pentru tehnicieni: afișează doar tăvița curentă, fără dropdown */
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">
                  Tăviță curentă
                </label>
                <p className="text-sm font-medium">
                  {allTrays.find(t => t.id === selectedTrayId)?.number
                    ? `Tăviță #${allTrays.find(t => t.id === selectedTrayId)!.number} - ${allTrays.find(t => t.id === selectedTrayId)!.size}`
                    : 'N/A'}
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Selectează fișa de serviciu:
            </label>
            <div className="flex items-center gap-2 flex-1">
              <Select
                value={selectedFisaId || ''}
                onValueChange={(value) => onFisaIdChange(value)}
                disabled={loadingSheets}
              >
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder={loadingSheets ? "Se încarcă..." : "Selectează o fișă"} />
                </SelectTrigger>
                <SelectContent>
                  {serviceSheets.map((sheet) => {
                    const createdDate = sheet.created_at 
                      ? format(new Date(sheet.created_at), 'dd MMM yyyy')
                      : '';
                    const displayText = createdDate 
                      ? `${sheet.number} - ${createdDate}`
                      : sheet.number;
                    return (
                      <SelectItem key={sheet.id} value={sheet.id}>
                        {displayText}
                      </SelectItem>
                    );
                  })}
                  {serviceSheets.length === 0 && !loadingSheets && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Nu există fișe de serviciu
                    </div>
                  )}
                </SelectContent>
              </Select>
              {/* Buton "Fișă nouă" - pentru pipeline-ul Vânzări (toți utilizatorii) 
                  și pentru Receptie (doar vânzători / admin / owner) */}
              {(
                isVanzariPipeline ||               // în Vânzări: întotdeauna vizibil
                (isReceptiePipeline && isVanzator) // în Receptie: doar pentru vânzători/admin/owner
              ) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCreateServiceSheet}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Adaugă Fișă Serviciu
                </Button>
              )}
            </div>
          </>
        )}
        </div>
        
        {/* TrayTabs pe același rând cu dropdown-ul */}
        {showTrayTabs && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <TrayTabs
              quotes={quotes!}
              selectedQuoteId={selectedQuoteId || null}
              isVanzariPipeline={isVanzariPipeline}
              isReceptiePipeline={isReceptiePipeline}
              isDepartmentPipeline={isDepartmentPipeline}
              isVanzatorMode={isVanzatorMode || false}
              sendingTrays={sendingTrays || false}
              traysAlreadyInDepartments={traysAlreadyInDepartments || false}
              onTraySelect={onTraySelect!}
              onAddTray={onAddTray!}
              onDeleteTray={onDeleteTray!}
              onSendTrays={onSendTrays!}
              inline={true}
            />
          </div>
        )}
        
        {/* Butonul "Detalii Fisa" pe același rând */}
        {selectedFisaId && !isDepartmentPipeline && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDetailsModalOpen(true)
                    onLoadTraysDetails(selectedFisaId)
                  }}
                  className="flex items-center gap-2"
                >
                  <Info className="h-5 w-5" />
                  Detalii Fisa
                </Button>
              </DialogTrigger>
            <DialogContent 
                className="overflow-y-auto"
                style={{ 
                  width: '95vw', 
                  maxWidth: '3200px',
                  height: '95vh',
                  maxHeight: '95vh'
                }}
              >
              <DialogTitle className="sr-only">Detalii Fișă</DialogTitle>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Detalii Fișă</h2>
                </div>
                
                {loadingDetails ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Se încarcă...</span>
                  </div>
                ) : traysDetails.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nu există tăvițe în această fișă
                  </div>
                ) : (
                  <div className="space-y-6">
                    {traysDetails.map((detail, index) => {
                      // Filtrează items-urile vizibile (exclude item_type: null)
                      const visibleItems = detail.items.filter((item: any) => item.item_type !== null)
                      
                      return (
                        <div key={detail.tray.id} className="border rounded-lg p-4">
                          <h3 className="font-medium mb-3 flex items-center gap-2">
                            Tăviță {index + 1}: {detail.tray.name}
                            {detail.urgent > 0 && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">
                                URGENT (+30%)
                              </span>
                            )}
                          </h3>
                          
                          {visibleItems.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nu există poziții în această tăviță</p>
                          ) : (
                            <>
                              <div className="space-y-2 mb-4">
                                {visibleItems.map((item: any) => (
                                  <div key={item.id} className="flex items-center justify-between text-sm border-b pb-2">
                                    <div className="flex-1">
                                      <span className="font-medium">{item.name_snapshot || 'N/A'}</span>
                                      {item.brand && (
                                        <span className="text-muted-foreground ml-2">({item.brand})</span>
                                      )}
                                      {item.serial_number && (
                                        <span className="text-muted-foreground ml-2">SN: {item.serial_number}</span>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <div className="font-medium">{item.qty} x {item.price.toFixed(2)} RON</div>
                                      {item.discount_pct > 0 && (
                                        <div className="text-xs text-muted-foreground">
                                          Reducere: {item.discount_pct}%
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              
                              <div className="border-t pt-3 space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span>Subtotal:</span>
                                  <span>{detail.subtotal.toFixed(2)} RON</span>
                                </div>
                                {detail.discount > 0 && (
                                  <div className="flex justify-between text-muted-foreground">
                                    <span>Reducere:</span>
                                    <span>-{detail.discount.toFixed(2)} RON</span>
                                  </div>
                                )}
                                {detail.urgent > 0 && (
                                  <div className="flex justify-between text-amber-600">
                                    <span>Urgent (+30%):</span>
                                    <span>+{detail.urgent.toFixed(2)} RON</span>
                                  </div>
                                )}
                                {detail.subscriptionDiscount > 0 && (
                                  <>
                                    {detail.subscriptionDiscountServices > 0 && (
                                      <div className="flex justify-between text-muted-foreground">
                                        <span>Reducere abonament servicii (10%):</span>
                                        <span>-{detail.subscriptionDiscountServices.toFixed(2)} RON</span>
                                      </div>
                                    )}
                                    {detail.subscriptionDiscountParts > 0 && (
                                      <div className="flex justify-between text-muted-foreground">
                                        <span>Reducere abonament piese (5%):</span>
                                        <span>-{detail.subscriptionDiscountParts.toFixed(2)} RON</span>
                                      </div>
                                    )}
                                  </>
                                )}
                                <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                                  <span>Total:</span>
                                  <span>{detail.total.toFixed(2)} RON</span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
      </div>
    </div>
  )
}


