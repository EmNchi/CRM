/**
 * Componentă pentru tabs-urile din LeadDetailsPanel
 */

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { FileText, History, MessageSquare } from "lucide-react"
import { ReactNode, useEffect } from "react"

interface LeadDetailsTabsProps {
  section: "fisa" | "de-confirmat" | "istoric"
  onSectionChange: (section: "fisa" | "de-confirmat" | "istoric") => void
  fisaContent: ReactNode
  deConfirmatContent: ReactNode
  istoricContent: ReactNode
}

export function LeadDetailsTabs({
  section,
  onSectionChange,
  fisaContent,
  deConfirmatContent,
  istoricContent,
}: LeadDetailsTabsProps) {
  // Dezactivează scrollul pe body când suntem în secțiunea "De Confirmat"
  useEffect(() => {
    if (section === 'de-confirmat') {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    
    // Cleanup la unmount
    return () => {
      document.body.style.overflow = 'hidden'
    }
  }, [section])

  useEffect(() => {
    if (section === 'fisa') {
      document.body.style.overflow = 'hidden'
    } 
    // Cleanup la unmount
    return () => {
      document.body.style.overflow = 'hidden'
    }
  }, [section])

  return (
    <Tabs value={section} onValueChange={(v) => onSectionChange(v as "fisa" | "de-confirmat" | "istoric")} className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-4">
        <TabsTrigger value="fisa" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Fișa de serviciu</span>
          <span className="sm:hidden">Fișă</span>
        </TabsTrigger>
        <TabsTrigger value="de-confirmat" className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <span>De Confirmat</span>
        </TabsTrigger>
        <TabsTrigger value="istoric" className="flex items-center gap-2">
          <History className="h-4 w-4" />
          <span>Istoric</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="fisa" className="mt-0">
        {fisaContent}
      </TabsContent>

      <TabsContent value="de-confirmat" className="mt-0 overflow-hidden">
        {deConfirmatContent}
      </TabsContent>

      <TabsContent value="istoric" className="mt-0">
        {istoricContent}
      </TabsContent>
    </Tabs>
  )
}


