'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface StageTabsProps {
  stages: string[]
  currentStage: string
  onStageChange: (stage: string) => void
  leadCounts?: Record<string, number>
}

export function StageTabs({ stages, currentStage, onStageChange, leadCounts = {} }: StageTabsProps) {
  return (
    <div className="border-b bg-background sticky top-0 z-10 md:hidden">
      {/* Container cu scroll orizontal nativ pentru mobil */}
      <div className="overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth-horizontal">
        <div className="flex gap-2 px-3 py-3 min-w-max">
          {stages.map((stage) => {
            const count = leadCounts[stage] || 0
            const isActive = stage === currentStage
            
            return (
              <button
                key={stage}
                onClick={() => onStageChange(stage)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all",
                  "min-h-[44px] touch-manipulation select-none", // Minimum touch target pentru mobil
                  "active:scale-95", // Feedback vizual la tap
                  isActive
                    ? "bg-black text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                <span className="uppercase tracking-wide">{stage}</span>
                {count > 0 && (
                  <Badge
                    className={cn(
                      "text-xs min-w-[22px] h-5 px-1.5 flex items-center justify-center rounded-full font-medium",
                      isActive
                        ? "bg-white/20 text-white border-0"
                        : "bg-white text-gray-700 border-0"
                    )}
                  >
                    {count}
                  </Badge>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

