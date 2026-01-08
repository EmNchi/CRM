/**
 * Componentă pentru secțiunea de mesagerie
 */

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { MessageSquare, ChevronDown, ChevronRight } from "lucide-react"
import LeadMessenger from "@/components/leads/lead-messenger"

interface LeadMessengerSectionProps {
  isMessengerOpen: boolean
  setIsMessengerOpen: (open: boolean) => void
  leadId: string | null
  leadTechnician?: string | null
}

export function LeadMessengerSection({
  isMessengerOpen,
  setIsMessengerOpen,
  leadId,
  leadTechnician,
}: LeadMessengerSectionProps) {
  if (!leadId) return null

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
          <LeadMessenger leadId={leadId} leadTechnician={leadTechnician} />
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

