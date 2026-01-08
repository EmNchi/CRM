/**
 * Componentă pentru tabs-urile din LeadDetailsPanel
 */

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { FileText, History } from "lucide-react"
import { ReactNode } from "react"

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
  return (
    <Tabs value={section} onValueChange={(v) => onSectionChange(v as "fisa" | "de-confirmat" | "istoric")} className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-4">
        <TabsTrigger value="fisa" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Fișa de serviciu</span>
          <span className="sm:hidden">Fișă</span>
        </TabsTrigger>
        <TabsTrigger value="de-confirmat" className="flex items-center gap-2">
          <History className="h-4 w-4" />
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

      <TabsContent value="de-confirmat" className="mt-0">
        {deConfirmatContent}
      </TabsContent>

      <TabsContent value="istoric" className="mt-0">
        {istoricContent}
      </TabsContent>
    </Tabs>
  )
}


