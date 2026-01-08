/**
 * Componentă pentru acțiunile rapide în pipeline-urile departament
 */

import { Button } from "@/components/ui/button"
import { CheckCircle, Clock, Wrench } from "lucide-react"

interface LeadDepartmentActionsProps {
  isDepartmentPipeline: boolean
  isReparatiiPipeline: boolean
  isSaloaneHorecaFrizeriiPipeline: boolean
  onInLucru: () => void
  onFinalizare: () => void
  onAsteptPiese: () => void
  onInAsteptare: () => void
}

export function LeadDepartmentActions({
  isDepartmentPipeline,
  isReparatiiPipeline,
  isSaloaneHorecaFrizeriiPipeline,
  onInLucru,
  onFinalizare,
  onAsteptPiese,
  onInAsteptare,
}: LeadDepartmentActionsProps) {
  if (!isDepartmentPipeline) return null

  return (
    <div className="mb-4 flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <span className="text-sm font-medium text-muted-foreground">Acțiuni rapide:</span>
      <Button
        variant="default"
        size="sm"
        onClick={onInLucru}
        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
      >
        <Wrench className="h-4 w-4" />
        În lucru
      </Button>
      <Button
        variant="default"
        size="sm"
        onClick={onFinalizare}
        className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
      >
        <CheckCircle className="h-4 w-4" />
        Finalizare
      </Button>
      {isReparatiiPipeline && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAsteptPiese}
          className="flex items-center gap-2 border-amber-500 text-amber-600 hover:bg-amber-50"
        >
          <Clock className="h-4 w-4" />
          Aștept piese
        </Button>
      )}
      {isSaloaneHorecaFrizeriiPipeline && (
        <Button
          variant="outline"
          size="sm"
          onClick={onInAsteptare}
          className="flex items-center gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
        >
          <Clock className="h-4 w-4" />
          În așteptare
        </Button>
      )}
    </div>
  )
}


