/**
 * Componentă pentru secțiunea de mesagerie
 */

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { MessageSquare, ChevronDown, ChevronRight } from "lucide-react"
import LeadMessenger from "@/components/leads/lead-messenger"
import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Quote {
  id: string
  number?: string | null
  [key: string]: any
}

interface LeadMessengerSectionProps {
  isMessengerOpen: boolean
  setIsMessengerOpen: (open: boolean) => void
  leadId: string | null
  leadTechnician?: string | null
  quotes?: Quote[]
  selectedQuoteId?: string | null
  isDepartmentPipeline?: boolean
}

export function LeadMessengerSection({
  isMessengerOpen,
  setIsMessengerOpen,
  leadId,
  leadTechnician,
  quotes = [],
  selectedQuoteId,
  isDepartmentPipeline = false,
}: LeadMessengerSectionProps) {
  const [selectedTrayId, setSelectedTrayId] = useState<string | null>(selectedQuoteId || null)

  if (!leadId) return null

  // Pentru Departament Tehnic - arată direct messengeru pentru tăviță deschisă
  if (isDepartmentPipeline) {
    return (
      <Collapsible open={isMessengerOpen} onOpenChange={setIsMessengerOpen}>
        <div className="rounded-lg border bg-muted/30">
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors rounded-t-lg">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Mesagerie</span>
            </div>
            {isMessengerOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </CollapsibleTrigger>
          
          <CollapsibleContent className="px-3 pb-3">
            {selectedQuoteId ? (
              <LeadMessenger leadId={leadId} leadTechnician={leadTechnician} selectedQuoteId={selectedQuoteId} />
            ) : (
              <p className="text-xs text-muted-foreground">Selectează o tăviță din lista de mai sus</p>
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>
    )
  }

  // Dacă nu sunt quotes, arată direct messengeru (pentru alte contexte)
  if (!quotes || quotes.length === 0) {
    return (
      <Collapsible open={isMessengerOpen} onOpenChange={setIsMessengerOpen}>
        <div className="rounded-lg border bg-muted/30">
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors rounded-t-lg">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Mesagerie</span>
            </div>
            {isMessengerOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </CollapsibleTrigger>
          
          <CollapsibleContent className="px-3 pb-3">
            <LeadMessenger leadId={leadId} leadTechnician={leadTechnician} selectedQuoteId={selectedQuoteId} />
          </CollapsibleContent>
        </div>
      </Collapsible>
    )
  }

  // Pentru Receptie - arată meniu cu tăvițe pentru selectare
  return (
    <Collapsible open={isMessengerOpen} onOpenChange={setIsMessengerOpen}>
      <div className="rounded-lg border bg-muted/30">
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors rounded-t-lg">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Mesagerie</span>
          </div>
          {isMessengerOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </CollapsibleTrigger>
        
        <CollapsibleContent className="px-3 pb-3 space-y-3">
          {/* Meniu cu tăvițe - doar pentru Receptie */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Selectează Tăviță</label>
            <Select value={selectedTrayId || ''} onValueChange={setSelectedTrayId}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Alege o tăviță..." />
              </SelectTrigger>
              <SelectContent>
                {quotes.map((quote) => (
                  <SelectItem key={quote.id} value={quote.id}>
                    Tăviță {quote.number || quote.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Messenger pentru tăviță selectată */}
          {selectedTrayId && (
            <div className="mt-3 pt-3 border-t">
              <LeadMessenger 
                leadId={leadId} 
                leadTechnician={leadTechnician} 
                selectedQuoteId={selectedTrayId}
              />
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

