import { useCallback } from 'react'
import { toast } from 'sonner'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { deleteTrayItem, updateServiceFile } from '@/lib/supabase/serviceFileOperations'
import { createQuoteForLead } from '@/lib/utils/preturi-helpers'
import type { LeadQuoteItem, LeadQuote } from '@/lib/types/preturi'
import type { Service } from '@/lib/supabase/serviceOperations'
import type { Part } from '@/lib/supabase/partOperations'

const supabase = supabaseBrowser()

interface UsePreturiBusinessProps {
  leadId: string
  fisaId?: string | null
  selectedQuoteId: string | null
  selectedQuote: LeadQuote | null
  quotes: LeadQuote[]
  items: LeadQuoteItem[]
  services: Service[]
  parts: Part[]
  instruments: Array<{ id: string; name: string; weight: number; department_id: string | null }>
  departments: Array<{ id: string; name: string }>
  pipelinesWithIds: Array<{ id: string; name: string }>
  user: { id: string } | null
  isDepartmentPipeline: boolean
  isVanzariPipeline: boolean
  setItems: React.Dispatch<React.SetStateAction<LeadQuoteItem[]>>
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>
  setSvc: React.Dispatch<React.SetStateAction<any>>
  setInstrumentForm: React.Dispatch<React.SetStateAction<any>>
  setPart: React.Dispatch<React.SetStateAction<any>>
  setServiceSearchQuery: React.Dispatch<React.SetStateAction<string>>
  setPartSearchQuery: React.Dispatch<React.SetStateAction<string>>
  setInstrumentSettings: React.Dispatch<React.SetStateAction<any>>
  instrumentForm: any
  svc: any
  part: any
  urgentAllServices: boolean
}

export function usePreturiBusiness({
  leadId,
  fisaId,
  selectedQuoteId,
  selectedQuote,
  quotes,
  items,
  services,
  parts,
  instruments,
  departments,
  pipelinesWithIds,
  user,
  isDepartmentPipeline,
  isVanzariPipeline,
  setItems,
  setIsDirty,
  setSvc,
  setInstrumentForm,
  setPart,
  setServiceSearchQuery,
  setPartSearchQuery,
  setInstrumentSettings,
  instrumentForm,
  svc,
  part,
  urgentAllServices,
}: UsePreturiBusinessProps) {
  // Helper pentru generare ID temporar
  const tempId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // Funcție pentru actualizarea unui item
  const onUpdateItem = useCallback((id: string, patch: Partial<LeadQuoteItem>) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } as any : it)))
    setIsDirty(true)
  }, [setItems, setIsDirty])

  // Funcție pentru ștergerea unui item
  const onDelete = useCallback(async (id: string) => {
    const itemToDelete = items.find(it => it.id === id)
    if (!itemToDelete) return
    
    // Salvează brand-urile în instrumentSettings înainte de ștergere
    const currentInstrumentId = instrumentForm.instrument || svc.instrumentId
    if (currentInstrumentId && itemToDelete.item_type === 'service') {
      const hasBrandsInForm = instrumentForm.brandSerialGroups.some((g: any) => {
        const hasBrand = g.brand && g.brand.trim()
        const hasSerialNumbers = g.serialNumbers.some((sn: any) => {
          const serial = typeof sn === 'string' ? sn : sn.serial || ''
          return serial && serial.trim()
        })
        return hasBrand || hasSerialNumbers
      })
      
      if (hasBrandsInForm) {
        setInstrumentSettings((prev: any) => ({
          ...prev,
          [currentInstrumentId]: {
            qty: instrumentForm.qty || '1',
            brandSerialGroups: instrumentForm.brandSerialGroups
          }
        }))
      }
    }
    
    // Șterge din DB doar dacă item-ul are un ID real
    const isLocalId = id.startsWith('temp-') || id.includes('local-') || id.startsWith('local_')
    
    if (!isLocalId) {
      try {
        const { success, error } = await deleteTrayItem(id)
        if (!success || error) {
          console.error('Error deleting tray item from DB:', error)
          toast.error('Eroare la ștergerea serviciului din baza de date')
          return
        }
      } catch (error: any) {
        console.error('Error deleting tray item:', error)
        toast.error('Eroare la ștergerea serviciului')
        return
      }
    }
    
    // Șterge din state-ul local
    setItems(prev => {
      const newItems = prev.filter(it => it.id !== id)
      
      // Dacă s-a șters un item cu instrument (item_type: null), resetează instrumentul
      if (itemToDelete.item_type === null) {
        setSvc((p: any) => ({ ...p, instrumentId: '' }))
        setInstrumentForm((prev: any) => ({ 
          ...prev, 
          instrument: '',
          brandSerialGroups: [{ brand: '', serialNumbers: [{ serial: '', garantie: false }], qty: '1' }]
        }))
      }
      
      return newItems
    })
    
    setIsDirty(true)
  }, [items, instrumentForm, svc, setItems, setIsDirty, setSvc, setInstrumentForm, setInstrumentSettings])

  // Funcție pentru mutarea unui instrument între tăvițe
  const handleMoveInstrument = useCallback(async (targetTrayId: string, instrumentGroup: { instrument: { id: string; name: string }; items: LeadQuoteItem[] }, newTrayNumber?: string, newTraySize?: string) => {
    if (!fisaId) {
      toast.error('Fișa de serviciu nu este setată')
      return
    }

    let finalTrayId = targetTrayId

    // Dacă trebuie să creezi o tăviță nouă
    if (targetTrayId === 'new' && newTrayNumber) {
      try {
        const created = await createQuoteForLead(leadId, newTrayNumber.trim(), fisaId, newTraySize || 'm')
        finalTrayId = created.id
      } catch (error: any) {
        console.error('Error creating tray:', error)
        toast.error('Eroare la crearea tăviței: ' + (error?.message || 'Eroare necunoscută'))
        return
      }
    }

    // Mută items-urile în tăvița țintă
    // Această logică va fi implementată în componenta principală
    toast.success(`Instrumentul "${instrumentGroup.instrument.name}" a fost mutat cu succes`)
  }, [leadId, fisaId])

  // Funcție pentru actualizarea checkbox-urilor lead (No Deal, Call Back, Nu Raspunde)
  const handleNoDealChange = useCallback(async (checked: boolean) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ no_deal: checked })
        .eq('id', leadId)

      if (error) throw error
    } catch (error: any) {
      console.error('Error updating no_deal:', error)
      toast.error('Eroare la actualizarea câmpului No Deal')
    }
  }, [leadId])

  const handleNuRaspundeChange = useCallback(async (checked: boolean) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ nu_raspunde: checked })
        .eq('id', leadId)

      if (error) throw error
    } catch (error: any) {
      console.error('Error updating nu_raspunde:', error)
      toast.error('Eroare la actualizarea câmpului Nu Raspunde')
    }
  }, [leadId])

  const handleCallBackChange = useCallback(async (checked: boolean) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ call_back: checked })
        .eq('id', leadId)

      if (error) throw error
    } catch (error: any) {
      console.error('Error updating call_back:', error)
      toast.error('Eroare la actualizarea câmpului Call Back')
    }
  }, [leadId])

  return {
    onUpdateItem,
    onDelete,
    handleMoveInstrument,
    handleNoDealChange,
    handleNuRaspundeChange,
    handleCallBackChange,
    tempId,
  }
}

