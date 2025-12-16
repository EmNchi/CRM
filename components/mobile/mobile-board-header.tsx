'use client'

import { Search, Filter, Menu, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

interface MobileBoardHeaderProps {
  pipelineName: string
  pipelines: string[]
  onPipelineChange: (pipeline: string) => void
  onSearchClick: () => void
  onFilterClick: () => void
  sidebarContent?: React.ReactNode
}

export function MobileBoardHeader({
  pipelineName,
  pipelines,
  onPipelineChange,
  onSearchClick,
  onFilterClick,
  sidebarContent,
}: MobileBoardHeaderProps) {
  return (
    <header className="sticky top-0 z-20 bg-background border-b md:hidden">
      <div className="flex items-center justify-between px-4 py-3 gap-2">
        {/* Pipeline selector */}
        <div className="flex-1 min-w-0">
          <Select value={pipelineName} onValueChange={onPipelineChange}>
            <SelectTrigger className="w-full h-9">
              <SelectValue>
                <span className="font-semibold truncate">{pipelineName}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((pipeline) => (
                <SelectItem key={pipeline} value={pipeline}>
                  {pipeline}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={onSearchClick}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={onFilterClick}
          >
            <Filter className="h-4 w-4" />
          </Button>
          {sidebarContent && (
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle className="sr-only">Meniu navigare</SheetTitle>
                </SheetHeader>
                {sidebarContent}
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  )
}

