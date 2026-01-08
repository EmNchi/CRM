/**
 * Componentă pentru secțiunea de pipelines
 */

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowRight, Loader2 } from "lucide-react"

interface LeadPipelinesSectionProps {
  allPipeNames: string[]
  selectedPipes: string[]
  movingPipes: boolean
  onTogglePipe: (name: string) => void
  onPickAll: () => void
  onClearAll: () => void
  onBulkMove: () => void
  onMoveToPipeline: (targetName: string) => void
}

export function LeadPipelinesSection({
  allPipeNames,
  selectedPipes,
  movingPipes,
  onTogglePipe,
  onPickAll,
  onClearAll,
  onBulkMove,
  onMoveToPipeline,
}: LeadPipelinesSectionProps) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase mb-2 block">
        Mută în Pipeline
      </label>

      {/* Butoane individuale pentru mutare rapidă */}
      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
        {allPipeNames.slice(0, 5).map((pipeName) => (
          <Button
            key={pipeName}
            variant="outline"
            size="sm"
            onClick={() => onMoveToPipeline(pipeName)}
            className="h-7 text-xs"
          >
            <ArrowRight className="h-3 w-3 mr-1" />
            {pipeName}
          </Button>
        ))}
      </div>
    </div>
  )
}


