/**
 * Hook pentru gestionarea tags-urilor în componenta LeadDetailsPanel
 */

import { useCallback } from 'react'
import { toggleLeadTag } from '@/lib/supabase/tagOperations'
import type { Tag, TagColor } from '@/lib/supabase/tagOperations'

interface UseLeadDetailsTagsProps {
  lead: {
    id: string
    tags?: Array<{ id: string }>
    [key: string]: any
  } | null
  allTags: Tag[]
  selectedTagIds: string[]
  setSelectedTagIds: React.Dispatch<React.SetStateAction<string[]>>
  onTagsChange?: (leadId: string, tags: Tag[]) => void
}

export function useLeadDetailsTags({
  lead,
  allTags,
  selectedTagIds,
  setSelectedTagIds,
  onTagsChange,
}: UseLeadDetailsTagsProps) {
  
  // Verifică dacă un tag este tag de departament
  const isDepartmentTag = useCallback((tagName: string) => {
    const departmentTags = ['Horeca', 'Saloane', 'Frizerii', 'Reparatii']
    return departmentTags.includes(tagName)
  }, [])

  // Obține stilul pentru badge-ul de departament
  const getDepartmentBadgeStyle = useCallback((tagName: string) => {
    const styles: Record<string, string> = {
      'Horeca': 'bg-gradient-to-r from-orange-500 to-orange-600 border-orange-300',
      'Saloane': 'bg-gradient-to-r from-emerald-500 to-emerald-600 border-emerald-300',
      'Frizerii': 'bg-gradient-to-r from-amber-500 to-amber-600 border-amber-300',
      'Reparatii': 'bg-gradient-to-r from-blue-500 to-blue-600 border-blue-300',
    }
    return styles[tagName] || 'bg-gradient-to-r from-gray-500 to-gray-600 border-gray-300'
  }, [])

  // Obține clasa CSS pentru tag
  const tagClass = useCallback((c: TagColor) =>
    c === "green" ? "bg-emerald-100 text-emerald-800"
    : c === "yellow" ? "bg-amber-100  text-amber-800"
    : c === "orange" ? "bg-orange-100 text-orange-800"
    : c === "blue" ? "bg-blue-100 text-blue-800"
    :                  "bg-rose-100   text-rose-800"
  , [])

  // Handler pentru toggle tag
  const handleToggleTag = useCallback(async (tagId: string) => {
    if (!lead) return

    // Previne eliminarea tag-urilor de departament
    const tag = allTags.find(t => t.id === tagId)
    if (tag && isDepartmentTag(tag.name)) {
      // Tag-urile de departament nu pot fi eliminate manual
      return
    }
  
    // 1) server change
    await toggleLeadTag(lead.id, tagId)
  
    // 2) compute next selection based on current state
    const nextIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter(id => id !== tagId)
      : [...selectedTagIds, tagId]
  
    // 3) local update
    setSelectedTagIds(nextIds)
  
    // 4) notify parent AFTER local setState (outside render)
    const nextTags = allTags.filter(t => nextIds.includes(t.id))
    onTagsChange?.(lead.id, nextTags)
  }, [lead, allTags, selectedTagIds, setSelectedTagIds, onTagsChange, isDepartmentTag])

  return {
    handleToggleTag,
    isDepartmentTag,
    getDepartmentBadgeStyle,
    tagClass,
  }
}


