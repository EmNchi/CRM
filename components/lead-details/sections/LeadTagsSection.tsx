/**
 * Componentă pentru secțiunea de tags
 */

import { Badge } from "@/components/ui/badge"
import { Tag } from "lucide-react"
import type { Tag as TagType, TagColor } from '@/lib/supabase/tagOperations'

interface LeadTagsSectionProps {
  allTags: TagType[]
  selectedTagIds: string[]
  onToggleTag: (tagId: string) => void
  tagClass: (color: TagColor) => string
  isDepartmentTag: (tagName: string) => boolean
  getDepartmentBadgeStyle: (tagName: string) => string
}

export function LeadTagsSection({
  allTags,
  selectedTagIds,
  onToggleTag,
  tagClass,
  isDepartmentTag,
  getDepartmentBadgeStyle,
}: LeadTagsSectionProps) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase mb-2 block flex items-center gap-2">
        <Tag className="h-3.5 w-3.5" />
        Tags
      </label>
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {allTags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id)
          const isDeptTag = isDepartmentTag(tag.name)
          
          return (
            <Badge
              key={tag.id}
              variant={isSelected ? "default" : "outline"}
              className={`
                cursor-pointer transition-all hover:scale-105
                ${isSelected 
                  ? isDeptTag 
                    ? getDepartmentBadgeStyle(tag.name) + " text-white border-white/30"
                    : tagClass(tag.color)
                  : "bg-background hover:bg-muted"
                }
                ${isDeptTag ? "font-semibold" : ""}
              `}
              onClick={() => onToggleTag(tag.id)}
            >
              {tag.name}
            </Badge>
          )
        })}
      </div>
    </div>
  )
}


