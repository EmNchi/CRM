/**
 * Componentă pentru header-ul LeadDetailsPanel
 * Design modern cu gradiente și layout îmbunătățit
 */

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"
import { Mail, Phone, Trash2, Printer, ChevronsUpDown, X, Tag, PhoneOff, PhoneCall, Ban } from "lucide-react"
import type { Tag as TagType, TagColor } from '@/lib/supabase/tagOperations'
import { cn } from "@/lib/utils"

interface LeadDetailsHeaderProps {
  leadName: string
  leadEmail?: string | null
  leadPhone?: string | null
  isOwner: boolean
  isAdmin: boolean
  isDepartmentPipeline: boolean
  showActionCheckboxes: boolean
  isCurierPipeline: boolean
  isReceptiePipeline: boolean
  isVanzariPipeline: boolean
  
  // Tags
  allTags: TagType[]
  selectedTagIds: string[]
  onToggleTag: (tagId: string) => void
  tagClass: (color: TagColor) => string
  isDepartmentTag: (tagName: string) => boolean
  getDepartmentBadgeStyle: (tagName: string) => string
  
  // Checkbox-uri generale
  callBack: boolean
  nuRaspunde: boolean
  noDeal: boolean
  onCallBackChange: (checked: boolean) => void
  onNuRaspundeChange: (checked: boolean) => void
  onNoDealChange: (checked: boolean) => void
  
  // Checkbox-uri Curier
  coletAjuns: boolean
  curierRetur: boolean
  coletTrimis: boolean
  asteptRidicarea: boolean
  ridicPersonal: boolean
  onColetAjunsChange: (checked: boolean) => void
  onCurierReturChange: (checked: boolean) => void
  onColetTrimisChange: (checked: boolean) => void
  onAsteptRidicareaChange: (checked: boolean) => void
  onRidicPersonalChange: (checked: boolean) => void
  
  // Handlers
  onEmailClick: (email: string) => void
  onPhoneClick: (phone: string) => void
  onDeleteClick: () => void
  onClose: () => void
}

export function LeadDetailsHeader({
  leadName,
  leadEmail,
  leadPhone,
  isOwner,
  isAdmin,
  isDepartmentPipeline,
  showActionCheckboxes,
  isCurierPipeline,
  isReceptiePipeline,
  isVanzariPipeline,
  allTags,
  selectedTagIds,
  onToggleTag,
  tagClass,
  isDepartmentTag,
  getDepartmentBadgeStyle,
  callBack,
  nuRaspunde,
  noDeal,
  onCallBackChange,
  onNuRaspundeChange,
  onNoDealChange,
  coletAjuns,
  curierRetur,
  coletTrimis,
  asteptRidicarea,
  ridicPersonal,
  onColetAjunsChange,
  onCurierReturChange,
  onColetTrimisChange,
  onAsteptRidicareaChange,
  onRidicPersonalChange,
  onEmailClick,
  onPhoneClick,
  onDeleteClick,
  onClose,
}: LeadDetailsHeaderProps) {
  return (
    <header className="bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border-b border-slate-200 dark:border-slate-700">
      {/* Main Header Row */}
      <div className="px-4 py-3 flex items-center justify-between gap-4">
        {/* Left: Name & Tags */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Avatar */}
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-primary">
              {leadName.charAt(0).toUpperCase()}
            </span>
          </div>
          
          {/* Name & Tags Dropdown */}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
              {leadName}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {/* Tags Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                    disabled={!isAdmin}
                  >
                    <Tag className="h-3 w-3" />
                    Etichete
                    <ChevronsUpDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[240px]">
                  {allTags
                    .filter(tag => !isDepartmentTag(tag.name))
                    .map(tag => (
                      <DropdownMenuCheckboxItem
                        key={tag.id}
                        checked={selectedTagIds.includes(tag.id)}
                        onCheckedChange={() => onToggleTag(tag.id)}
                        onSelect={(e) => e.preventDefault()}
                      >
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium",
                          tagClass(tag.color)
                        )}>
                          {tag.name}
                        </span>
                      </DropdownMenuCheckboxItem>
                    ))}
                  {allTags.filter(tag => !isDepartmentTag(tag.name)).length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                      Nu există etichete definite
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Selected Tags Pills */}
              <div className="flex flex-wrap gap-1 max-w-[400px]">
                {allTags
                  .filter(t => selectedTagIds.includes(t.id))
                  .map(tag => {
                    const isUrgent = tag.name.toLowerCase() === 'urgent'
                    const isRetur = tag.name === 'RETUR'
                    const isSpecial = isUrgent || isRetur
                    
                    if (isUrgent && isVanzariPipeline) return null
                    
                    if (isDepartmentTag(tag.name)) {
                      return (
                        <span
                          key={tag.id}
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm",
                            getDepartmentBadgeStyle(tag.name),
                            isSpecial && "animate-pulse"
                          )}
                        >
                          {tag.name}
                        </span>
                      )
                    }
                    
                    if (isSpecial) {
                      return (
                        <span
                          key={tag.id}
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white animate-pulse"
                        >
                          {tag.name}
                        </span>
                      )
                    }
                    
                    return (
                      <span
                        key={tag.id}
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium",
                          tagClass(tag.color)
                        )}
                      >
                        {tag.name}
                      </span>
                    )
                  })}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isDepartmentPipeline && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.print()}
                className="h-8 gap-1.5 text-xs border-slate-200 dark:border-slate-700"
              >
                <Printer className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Print</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => leadEmail && onEmailClick(leadEmail)}
                disabled={!leadEmail}
                className="h-8 gap-1.5 text-xs border-slate-200 dark:border-slate-700"
              >
                <Mail className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Email</span>
              </Button>
            </>
          )}
          {isOwner && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onDeleteClick}
              className="h-8 gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 dark:border-red-900 dark:hover:bg-red-950"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Șterge</span>
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onClose} 
            className="h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Action Checkboxes Row */}
      {showActionCheckboxes && !isCurierPipeline && (
        <div className="px-4 pb-3 flex items-center gap-3">
          {isReceptiePipeline ? (
            <ActionCheckbox
              checked={callBack}
              onChange={onCallBackChange}
              disabled={!isAdmin}
              icon={<PhoneCall className="h-3.5 w-3.5" />}
              label="Call Back"
              color="blue"
            />
          ) : (
            <>
              <ActionCheckbox
                checked={noDeal}
                onChange={onNoDealChange}
                disabled={!isAdmin}
                icon={<Ban className="h-3.5 w-3.5" />}
                label="No Deal"
                color="red"
              />
              <ActionCheckbox
                checked={callBack}
                onChange={onCallBackChange}
                disabled={!isAdmin}
                icon={<PhoneCall className="h-3.5 w-3.5" />}
                label="Call Back"
                color="blue"
              />
              <ActionCheckbox
                checked={nuRaspunde}
                onChange={onNuRaspundeChange}
                disabled={!isAdmin}
                icon={<PhoneOff className="h-3.5 w-3.5" />}
                label="Nu răspunde"
                color="amber"
              />
            </>
          )}
        </div>
      )}
    </header>
  )
}

// Componentă helper pentru checkbox-uri stilizate
function ActionCheckbox({ 
  checked, 
  onChange, 
  disabled,
  icon, 
  label, 
  color 
}: { 
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  icon: React.ReactNode
  label: string
  color: 'red' | 'blue' | 'amber' | 'green'
}) {
  const colorClasses = {
    red: {
      base: 'border-red-200 dark:border-red-800',
      checked: 'bg-red-50 border-red-300 dark:bg-red-950 dark:border-red-700',
      text: 'text-red-700 dark:text-red-300',
      checkbox: 'data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500'
    },
    blue: {
      base: 'border-blue-200 dark:border-blue-800',
      checked: 'bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-700',
      text: 'text-blue-700 dark:text-blue-300',
      checkbox: 'data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500'
    },
    amber: {
      base: 'border-amber-200 dark:border-amber-800',
      checked: 'bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-700',
      text: 'text-amber-700 dark:text-amber-300',
      checkbox: 'data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500'
    },
    green: {
      base: 'border-green-200 dark:border-green-800',
      checked: 'bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-700',
      text: 'text-green-700 dark:text-green-300',
      checkbox: 'data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500'
    }
  }

  const classes = colorClasses[color]

  return (
    <label 
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all",
        !disabled ? "cursor-pointer" : "cursor-default opacity-60",
        classes.base,
        checked && classes.checked
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(c: any) => !disabled && onChange(!!c)}
        disabled={disabled}
        className={classes.checkbox}
      />
      <span className={cn(
        "flex items-center gap-1.5 text-xs font-medium",
        checked ? classes.text : "text-muted-foreground"
      )}>
        {icon}
        {label}
      </span>
    </label>
  )
}
