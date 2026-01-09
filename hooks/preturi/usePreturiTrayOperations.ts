/**
 * Hook pentru operațiile cu tăvițe (create, update, delete, move, validate, send to pipeline)
 */

import { useCallback } from 'react'
import { toast } from 'sonner'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { 
  listTraysForServiceFile,
  deleteTray,
  deleteTrayItem,
} from '@/lib/supabase/serviceFileOperations'
import { listTrayImages } from '@/lib/supabase/imageOperations'
import { addTrayToPipeline } from '@/lib/supabase/pipelineOperations'
import { notifyTechniciansAboutNewTrays } from '@/lib/supabase/notificationOperations'
import { 
  createQuoteForLead,
  updateQuote,
  listQuotesForLead,
  listQuoteItems,
} from '@/lib/utils/preturi-helpers'
import type { LeadQuote, LeadQuoteItem } from '@/lib/types/preturi'
import type { Service } from '@/lib/supabase/serviceOperations'

const supabase = supabaseBrowser()

interface UsePreturiTrayOperationsProps {
  leadId: string
  fisaId?: string | null
  selectedQuoteId: string | null
  selectedQuote: LeadQuote | null
  quotes: LeadQuote[]
  services: Service[]
  instruments: Array<{ id: string; name: string; weight: number; department_id: string | null }>
  pipelinesWithIds: Array<{ id: string; name: string }>
  isReceptiePipeline: boolean
  
  // State setters
  setQuotes: React.Dispatch<React.SetStateAction<LeadQuote[]>>
  setSelectedQuoteId: React.Dispatch<React.SetStateAction<string | null>>
  setItems: React.Dispatch<React.SetStateAction<LeadQuoteItem[]>>
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
  setCreatingTray: React.Dispatch<React.SetStateAction<boolean>>
  setUpdatingTray: React.Dispatch<React.SetStateAction<boolean>>
  setDeletingTray: React.Dispatch<React.SetStateAction<boolean>>
  setMovingInstrument: React.Dispatch<React.SetStateAction<boolean>>
  setSendingTrays: React.Dispatch<React.SetStateAction<boolean>>
  setShowCreateTrayDialog: React.Dispatch<React.SetStateAction<boolean>>
  setShowEditTrayDialog: React.Dispatch<React.SetStateAction<boolean>>
  setShowMoveInstrumentDialog: React.Dispatch<React.SetStateAction<boolean>>
  setShowSendConfirmation: React.Dispatch<React.SetStateAction<boolean>>
  setShowDeleteTrayConfirmation: React.Dispatch<React.SetStateAction<boolean>>
  setTrayToDelete: React.Dispatch<React.SetStateAction<string | null>>
  setTraysAlreadyInDepartments: React.Dispatch<React.SetStateAction<boolean>>
  setNewTrayNumber: React.Dispatch<React.SetStateAction<string>>
  setNewTraySize: React.Dispatch<React.SetStateAction<string>>
  setEditingTrayNumber: React.Dispatch<React.SetStateAction<string>>
  setEditingTraySize: React.Dispatch<React.SetStateAction<string>>
  setInstrumentToMove: React.Dispatch<React.SetStateAction<{ 
    instrument: { id: string; name: string }
    items: LeadQuoteItem[] 
  } | null>>
  setTargetTrayId: React.Dispatch<React.SetStateAction<string>>
  
  // State values
  newTrayNumber: string
  newTraySize: string
  editingTrayNumber: string
  editingTraySize: string
  trayToDelete: string | null
  instrumentToMove: { 
    instrument: { id: string; name: string }
    items: LeadQuoteItem[] 
  } | null
  targetTrayId: string
  
  // Callbacks
  recalcAllSheetsTotal: (quotes: LeadQuote[]) => Promise<void>
}

export function usePreturiTrayOperations({
  leadId,
  fisaId,
  selectedQuoteId,
  selectedQuote,
  quotes,
  services,
  instruments,
  pipelinesWithIds,
  isReceptiePipeline,
  setQuotes,
  setSelectedQuoteId,
  setItems,
  setLoading,
  setCreatingTray,
  setUpdatingTray,
  setDeletingTray,
  setMovingInstrument,
  setSendingTrays,
  setShowCreateTrayDialog,
  setShowEditTrayDialog,
  setShowMoveInstrumentDialog,
  setShowSendConfirmation,
  setShowDeleteTrayConfirmation,
  setTrayToDelete,
  setTraysAlreadyInDepartments,
  setNewTrayNumber,
  setNewTraySize,
  setEditingTrayNumber,
  setEditingTraySize,
  setInstrumentToMove,
  setTargetTrayId,
  newTrayNumber,
  newTraySize,
  editingTrayNumber,
  editingTraySize,
  trayToDelete,
  instrumentToMove,
  targetTrayId,
  recalcAllSheetsTotal,
}: UsePreturiTrayOperationsProps) {

  // Funcție pentru deschiderea dialog-ului de creare tăviță
  const onAddSheet = useCallback(async () => {
    if (!fisaId) {
      console.error('[usePreturiTrayOperations] Cannot create tray - missing fisaId')
      toast.error('Nu există fișă de serviciu selectată. Te rog selectează sau creează o fișă de serviciu.')
      return
    }
    setNewTrayNumber('')
    setNewTraySize('m')
    setShowCreateTrayDialog(true)
  }, [fisaId, leadId, setNewTrayNumber, setNewTraySize, setShowCreateTrayDialog])

  // Funcție pentru crearea unei tăvițe noi
  const handleCreateTray = useCallback(async () => {
    if (!newTrayNumber.trim()) {
      toast.error('Introduceți numărul tăviței')
      return
    }

    // Verifică disponibilitatea tăviței la nivel global (număr + mărime unice)
    try {
      const { checkTrayAvailability } = await import('@/lib/supabase/serviceFileOperations')
      const { available, error: availError } = await checkTrayAvailability(newTrayNumber.trim(), newTraySize)
      
      if (availError) {
        console.error('Error checking tray availability:', availError)
        toast.error('Eroare la verificarea disponibilității tăviței')
        return
      }
      
      if (!available) {
        toast.error(`Tăvița cu numărul "${newTrayNumber.trim()}" și mărimea "${newTraySize}" este deja înregistrată în sistem. Te rog alege o altă combinație.`)
        return
      }
    } catch (err: any) {
      console.error('Error validating tray availability:', err)
      toast.error('Eroare la validarea tăviței: ' + (err?.message || 'Eroare necunoscută'))
      return
    }

    setCreatingTray(true)
    setLoading(true)
    try {
      const created = await createQuoteForLead(leadId, newTrayNumber.trim(), fisaId || null, newTraySize)
      const next = [...quotes, created].sort((a, b) => (a.sheet_index || 0) - (b.sheet_index || 0))
      setQuotes(next)
      setSelectedQuoteId(created.id)
      setItems([])
      await recalcAllSheetsTotal(next)
      setShowCreateTrayDialog(false)
      setNewTrayNumber('')
      setNewTraySize('m')
      toast.success('Tăvița a fost creată cu succes')
    } catch (error: any) {
      console.error('Error creating tray:', error)
      toast.error('Eroare la crearea tăviței: ' + (error?.message || 'Eroare necunoscută'))
    } finally {
      setCreatingTray(false)
      setLoading(false)
    }
  }, [
    newTrayNumber,
    newTraySize,
    fisaId,
    leadId,
    quotes,
    setCreatingTray,
    setLoading,
    setQuotes,
    setSelectedQuoteId,
    setItems,
    setShowCreateTrayDialog,
    setNewTrayNumber,
    setNewTraySize,
    recalcAllSheetsTotal,
  ])

  // Funcție pentru deschiderea dialog-ului de editare tăviță
  const onEditTray = useCallback(() => {
    if (!selectedQuote) return
    setEditingTrayNumber(selectedQuote.number || '')
    setEditingTraySize(selectedQuote.size || 'm')
    setShowEditTrayDialog(true)
  }, [selectedQuote, setEditingTrayNumber, setEditingTraySize, setShowEditTrayDialog])

  // Funcție pentru salvarea editărilor tăviței
  const handleUpdateTray = useCallback(async () => {
    if (!selectedQuote || !editingTrayNumber.trim()) {
      toast.error('Introduceți numărul tăviței')
      return
    }

    // Verifică dacă numărul nou este diferit de cel curent
    if (editingTrayNumber.trim() !== (selectedQuote.number || '')) {
      // Verifică disponibilitatea tăviței la nivel global, excluzând tăvița curentă
      try {
        const { checkTrayAvailability } = await import('@/lib/supabase/serviceFileOperations')
        const { available, existingTray, error: availError } = await checkTrayAvailability(editingTrayNumber.trim(), editingTraySize)
        
        if (availError) {
          console.error('Error checking tray availability:', availError)
          toast.error('Eroare la verificarea disponibilității tăviței')
          return
        }
        
        // Dacă o tăviță cu acest număr și mărime există și nu e cea curentă, aruncă eroare
        if (!available && existingTray && existingTray.id !== selectedQuote.id) {
          toast.error(`Tăvița cu numărul "${editingTrayNumber.trim()}" și mărimea "${editingTraySize}" este deja înregistrată în sistem. Te rog alege o altă combinație.`)
          return
        }
      } catch (err: any) {
        console.error('Error validating tray availability:', err)
        toast.error('Eroare la validarea tăviței: ' + (err?.message || 'Eroare necunoscută'))
        return
      }
    }

    setUpdatingTray(true)
    setLoading(true)
    try {
      await updateQuote(selectedQuote.id, {
        number: editingTrayNumber.trim(),
        size: editingTraySize,
      })
      
      let updatedQuotes: any[] = []
      if (fisaId) {
        const { data: traysData } = await listTraysForServiceFile(fisaId)
        updatedQuotes = traysData || []
      } else {
        updatedQuotes = await listQuotesForLead(leadId)
      }
      
      setQuotes(updatedQuotes)
      
      const updatedQuote = updatedQuotes.find((q: any) => q.id === selectedQuote.id)
      if (updatedQuote) {
        setSelectedQuoteId(updatedQuote.id)
      }
      
      setShowEditTrayDialog(false)
      setEditingTrayNumber('')
      setEditingTraySize('m')
      toast.success('Tăvița a fost actualizată cu succes')
    } catch (error: any) {
      console.error('Error updating tray:', error)
      toast.error('Eroare la actualizarea tăviței: ' + (error?.message || 'Eroare necunoscută'))
    } finally {
      setUpdatingTray(false)
      setLoading(false)
    }
  }, [
    selectedQuote,
    editingTrayNumber,
    editingTraySize,
    fisaId,
    leadId,
    setUpdatingTray,
    setLoading,
    setQuotes,
    setSelectedQuoteId,
    setShowEditTrayDialog,
    setEditingTrayNumber,
    setEditingTraySize,
  ])

  // Funcție pentru ștergerea unei tăvițe
  const handleDeleteTray = useCallback(async () => {
    if (!trayToDelete) return

    setDeletingTray(true)
    try {
      const trayItems = await listQuoteItems(trayToDelete, services, instruments, pipelinesWithIds)
      
      if (trayItems.length > 0) {
        for (const item of trayItems) {
          await deleteTrayItem(item.id)
        }
      }

      const { success, error } = await deleteTray(trayToDelete)
      
      if (error || !success) {
        toast.error('Eroare la ștergerea tăviței')
        console.error('Error deleting tray:', error)
        return
      }

      toast.success('Tăvița a fost ștearsă')
      
      setQuotes((prev: any) => prev.filter((q: any) => q.id !== trayToDelete))
      
      if (selectedQuoteId === trayToDelete) {
        const remainingQuotes = quotes.filter((q: any) => q.id !== trayToDelete)
        if (remainingQuotes.length > 0) {
          setSelectedQuoteId(remainingQuotes[0].id)
        } else {
          setSelectedQuoteId(null)
        }
      }
    } catch (error) {
      console.error('Error deleting tray:', error)
      toast.error('Eroare la ștergerea tăviței')
    } finally {
      setDeletingTray(false)
      setShowDeleteTrayConfirmation(false)
      setTrayToDelete(null)
    }
  }, [
    trayToDelete,
    selectedQuoteId,
    quotes,
    services,
    instruments,
    pipelinesWithIds,
    setDeletingTray,
    setShowDeleteTrayConfirmation,
    setTrayToDelete,
    setQuotes,
    setSelectedQuoteId,
  ])

  // Funcție pentru mutarea unui instrument între tăvițe
  const handleMoveInstrument = useCallback(async (trayIdOverride?: string) => {
    let actualTrayId = trayIdOverride || targetTrayId
    
    if (!instrumentToMove || !actualTrayId) {
      toast.error('Selectează o tăviță țintă')
      return
    }

    // Dacă trebuie să creezi o tăviță nouă
    if (actualTrayId === 'new') {
      if (!newTrayNumber || !newTrayNumber.trim()) {
        toast.error('Introduceți numărul tăviței')
        return
      }
      
      if (!fisaId) {
        toast.error('Fișa de serviciu nu este setată')
        return
      }

      // Verifică disponibilitatea tăviței la nivel global (număr + mărime unice)
      try {
        const { checkTrayAvailability } = await import('@/lib/supabase/serviceFileOperations')
        const { available, error: availError } = await checkTrayAvailability(newTrayNumber.trim(), newTraySize || 'm')
        
        if (availError) {
          console.error('Error checking tray availability:', availError)
          toast.error('Eroare la verificarea disponibilității tăviței')
          return
        }
        
        if (!available) {
          toast.error(`Tăvița cu numărul "${newTrayNumber.trim()}" și mărimea "${newTraySize || 'm'}" este deja înregistrată în sistem. Te rog alege o altă combinație.`)
          return
        }
      } catch (err: any) {
        console.error('Error validating tray availability:', err)
        toast.error('Eroare la validarea tăviței: ' + (err?.message || 'Eroare necunoscută'))
        return
      }

      setMovingInstrument(true)
      try {
        // Creează tăvița nouă
        const created = await createQuoteForLead(leadId, newTrayNumber.trim(), fisaId, newTraySize || 'm')
        actualTrayId = created.id
        
        // Actualizează lista de tăvițe
        const { data: updatedQuotesData } = await listTraysForServiceFile(fisaId)
        setQuotes(updatedQuotesData || [])
      } catch (createError: any) {
        setMovingInstrument(false)
        // Extrage mesajul de eroare într-un mod sigur
        let errorMsg = 'Eroare la crearea tăviței'
        try {
          if (createError?.message && typeof createError.message === 'string') {
            errorMsg = createError.message
          }
        } catch {
          // Ignoră dacă extragerea eșuează
        }
        toast.error(errorMsg)
        return
      }
    }

    setMovingInstrument(true)
    try {
      // IMPORTANT: Extrage doar ID-urile și numele înainte de a le folosi
      // pentru a evita referințe circulare când se serializează obiectul
      const instrumentName = instrumentToMove.instrument?.name || 'Instrument'
      const itemIds: string[] = []
      
      // Extrage ID-urile într-un mod sigur, fără referințe circulare
      if (Array.isArray(instrumentToMove.items)) {
        for (let i = 0; i < instrumentToMove.items.length; i++) {
          const item = instrumentToMove.items[i]
          if (item && item.id && typeof item.id === 'string') {
            itemIds.push(item.id)
          }
        }
      }
      
      if (itemIds.length === 0) {
        setMovingInstrument(false)
        toast.error('Nu există items de mutat')
        return
      }
      
      // Mută items-urile în tăvița țintă
      // console.log('[handleMoveInstrument] STEP 1: Mutare items', itemIds.length, 'items în tăvița', actualTrayId)
      for (const itemId of itemIds) {
        const { error } = await supabase
          .from('tray_items')
          .update({ tray_id: actualTrayId })
          .eq('id', itemId)
        
        if (error) {
          // Extrage mesajul de eroare într-un mod sigur
          const errorMsg = (error?.message && typeof error.message === 'string') 
            ? error.message 
            : (error?.code && typeof error.code === 'string')
            ? error.code
            : 'Eroare la actualizarea item-ului'
          throw new Error(`Item ${itemId}: ${errorMsg}`)
        }
      }
      // console.log('[handleMoveInstrument] STEP 2: Items mutate cu succes')

      // Folosește doar string-uri simple, nu obiectul instrumentToMove
      // console.log('[handleMoveInstrument] STEP 3: Toast success')
      try {
        toast.success(`Instrumentul "${instrumentName}" și serviciile lui au fost mutate cu succes`)
      } catch (toastError) {
        // console.log('[handleMoveInstrument] Toast error (ignorat)')
      }
      
      // Actualizează lista de tăvițe și items-urile
      // console.log('[handleMoveInstrument] STEP 4: Actualizare tăvițe')
      if (fisaId) {
        const { data: updatedQuotesData } = await listTraysForServiceFile(fisaId)
        const updatedQuotes = updatedQuotesData || []
        // console.log('[handleMoveInstrument] STEP 5: setQuotes cu', updatedQuotes.length, 'tăvițe')
        setQuotes(updatedQuotes)
        
        // Dacă am creat o tăviță nouă, o selectăm automat
        if (actualTrayId && (trayIdOverride === 'new' || targetTrayId === 'new')) {
          // console.log('[handleMoveInstrument] STEP 6: Selectare tăviță nouă')
          setSelectedQuoteId(actualTrayId)
          const qi = await listQuoteItems(actualTrayId, services, instruments, pipelinesWithIds)
          // console.log('[handleMoveInstrument] STEP 7: setItems cu', qi?.length || 0, 'items')
          setItems(qi ?? [])
        } else if (selectedQuoteId) {
          // Altfel, actualizează items-urile pentru tăvița curent selectată
          const qi = await listQuoteItems(selectedQuoteId, services, instruments, pipelinesWithIds)
          setItems(qi ?? [])
        }
        
        // Verificare ștergere tăviță undefined (fără număr) - se aplică în toate pipeline-urile
        const currentUndefinedTray = updatedQuotes.find((q: any) => !q.number || q.number === '')
        
        if (currentUndefinedTray) {
          const [undefinedTrayItems, undefinedTrayImages] = await Promise.all([
            listQuoteItems(currentUndefinedTray.id, services, instruments, pipelinesWithIds),
            listTrayImages(currentUndefinedTray.id)
          ])
          
          // Dacă tăvița undefined MAI ARE items, revenim pe ea pentru a continua distribuirea
          if (undefinedTrayItems && undefinedTrayItems.length > 0) {
            // IMPORTANT: Revenim pe tăvița undefined pentru a continua distribuirea
            setSelectedQuoteId(currentUndefinedTray.id)
            setItems(undefinedTrayItems)
            // Nu ștergem tăvița, mai are items de distribuit
          } else if ((!undefinedTrayItems || undefinedTrayItems.length === 0) && (!undefinedTrayImages || undefinedTrayImages.length === 0)) {
            // Ștergem tăvița undefined DOAR dacă este goală (nu are nici items, nici imagini)
            try {
              const { success, error } = await deleteTray(currentUndefinedTray.id)
              if (success && !error) {
                const { data: refreshedQuotesData } = await listTraysForServiceFile(fisaId)
                const refreshedQuotes = refreshedQuotesData || []
                setQuotes(refreshedQuotes)
                
                // Selectează prima tăviță cu număr
                if (refreshedQuotes.length > 0) {
                  const firstNumberedTray = refreshedQuotes.find((q: any) => q.number && q.number.trim() !== '')
                  setSelectedQuoteId(firstNumberedTray?.id || refreshedQuotes[0].id)
                  const qi = await listQuoteItems(firstNumberedTray?.id || refreshedQuotes[0].id, services, instruments, pipelinesWithIds)
                  setItems(qi ?? [])
                } else {
                  setSelectedQuoteId(null)
                  setItems([])
                }
                toast.success('Toate instrumentele au fost distribuite! Tăvița nesemnată a fost ștearsă.')
              }
            } catch (deleteError: any) {
              // Eroare la ștergerea tăviței - nu blocăm fluxul principal
            }
          }
        }
      }
      
      // Resetează câmpurile pentru tăviță nouă
      // console.log('[handleMoveInstrument] STEP FINAL: Resetare state')
      setNewTrayNumber('')
      setNewTraySize('m')
      setShowMoveInstrumentDialog(false)
      setInstrumentToMove(null)
      setTargetTrayId('')
      // console.log('[handleMoveInstrument] DONE: Mutare completă!')
    } catch (error: any) {
      // IMPORTANT: Nu folosim niciodată obiectul error direct în console.error sau toast
      // pentru a evita referințe circulare (HTMLButtonElement, FiberNode, etc.)
      
      // Extrage mesajul de eroare într-un mod sigur, fără referințe circulare
      let errorDetails = 'Eroare necunoscută'
      try {
        if (error) {
          // Încearcă să extragă mesajul într-un mod sigur
          if (typeof error === 'string') {
            errorDetails = error
          } else if (error?.message && typeof error.message === 'string') {
            errorDetails = error.message
          } else if (error?.code && typeof error.code === 'string') {
            errorDetails = `Cod eroare: ${error.code}`
          }
        }
      } catch {
        // Dacă extragerea eșuează, folosește mesajul default
        errorDetails = 'Eroare la mutarea instrumentului'
      }
      
      // Log doar string-ul, nu obiectul error
      try {
        // Folosim console.log în loc de console.error pentru a evita serializarea automată
        // console.log('[handleMoveInstrument] Eroare:', errorDetails)
      } catch {
        // Ignoră dacă logging-ul eșuează
      }
      
      // Afișează eroarea în toast
      try {
        toast.error(`Eroare la mutarea instrumentului: ${errorDetails}`)
      } catch {
        // Dacă toast.error eșuează, ignoră
      }
    } finally {
      setMovingInstrument(false)
    }
  }, [
    targetTrayId,
    instrumentToMove,
    selectedQuoteId,
    fisaId,
    leadId,
    isReceptiePipeline,
    services,
    instruments,
    pipelinesWithIds,
    newTrayNumber,
    newTraySize,
    setMovingInstrument,
    setShowMoveInstrumentDialog,
    setInstrumentToMove,
    setTargetTrayId,
    setItems,
    setQuotes,
    setSelectedQuoteId,
    setNewTrayNumber,
    setNewTraySize,
  ])

  // NOTE: onChangeSheet este mutat în usePreturiEffects.ts din cauza dependențelor complexe

  // Funcție pentru validarea tăvițelor înainte de trimitere
  const validateTraysBeforeSend = useCallback(async (): Promise<{ valid: boolean; errors: string[] }> => {
    const errors: string[] = []
    
    for (let i = 0; i < quotes.length; i++) {
      const tray = quotes[i]
      
      // Ignoră tăvița "unassigned" (fără număr)
      if (!tray.number || tray.number.trim() === '') {
        continue
      }
      
      const trayItems = await listQuoteItems(tray.id, services, instruments, pipelinesWithIds)
      
      if (trayItems.length === 0) {
        errors.push(`Tăvița ${tray.number} este goală`)
        continue
      }
      
      // NOTE: Nu mai validăm dacă tăvița are servicii.
      // Tehnicienii pot atribui serviciile necesare în departament.
    }
    
    return { valid: errors.length === 0, errors }
  }, [quotes, services, instruments, pipelinesWithIds])

  // Funcție pentru verificarea dacă tăvițele sunt deja în departamente
  const checkTraysInDepartments = useCallback(async (trayIds: string[]) => {
    if (trayIds.length === 0) {
      setTraysAlreadyInDepartments(false)
      return
    }

    try {
      
      const { data: deptPipelines, error: deptError } = await supabase
        .from('pipelines')
        .select('id, name')
        .in('name', ['Saloane', 'Horeca', 'Frizerii', 'Reparatii'])

      if (deptError) {
        console.error('[usePreturiTrayOperations] Error getting department pipelines:', deptError?.message || 'Unknown error')
        setTraysAlreadyInDepartments(false)
        return
      }

      if (!deptPipelines || deptPipelines.length === 0) {
        setTraysAlreadyInDepartments(false)
        return
      }

      const deptPipelineIds = deptPipelines.map((p: any) => p.id)
      
      const { data: pipelineItems, error } = await supabase
        .from('pipeline_items')
        .select('item_id, pipeline_id')
        .eq('type', 'tray')
        .in('item_id', trayIds)
        .in('pipeline_id', deptPipelineIds)

      if (error) {
        console.error('[usePreturiTrayOperations] Error checking trays in departments:', error?.message || 'Unknown error')
        setTraysAlreadyInDepartments(false)
        return
      }

      const hasTraysInDepartments = pipelineItems && pipelineItems.length > 0
      setTraysAlreadyInDepartments(hasTraysInDepartments)
    } catch (error) {
      console.error('❌ Eroare la verificarea tăvițelor în departamente:', error)
      setTraysAlreadyInDepartments(false)
    }
  }, [setTraysAlreadyInDepartments])

  // Funcție pentru trimiterea tuturor tăvițelor în pipeline-urile departamentelor
  const sendAllTraysToPipeline = useCallback(async () => {
    if (quotes.length === 0) {
      toast.error('Nu există tăvițe în această fișă')
      return
    }

    setSendingTrays(true)
    const validation = await validateTraysBeforeSend()
    
    if (!validation.valid) {
      setSendingTrays(false)
      setShowSendConfirmation(false)
      
      const errorMessage = `Nu se pot expedia tăvițele:\n${validation.errors.map(err => `• ${err}`).join('\n')}`
      toast.error(errorMessage, { duration: 5000 })
      return
    }

    let successCount = 0
    let errorCount = 0
    const results: string[] = []

    try {
      for (const tray of quotes) {
        const trayItems = await listQuoteItems(tray.id, services, instruments, pipelinesWithIds)
        
        if (trayItems.length === 0) {
          results.push(`Tăvița ${quotes.indexOf(tray) + 1}: Goală (sărit)`)
          continue
        }

        const instrumentIds = trayItems
          .map((item: any) => item.instrument_id)
          .filter((id: string | null) => id !== null) as string[]
        
        const pipelineCounts: Record<string, number> = {}
        
        if (instrumentIds.length > 0) {
          const { data: instrumentsData, error: instrumentsError } = await supabase
            .from('instruments')
            .select('id, name, pipeline')
            .in('id', instrumentIds)
          
          if (instrumentsError) {
            console.error('Eroare la încărcarea instrumentelor:', instrumentsError)
          } else if (instrumentsData) {
            // Creează map pentru căutare după ID sau după nume
            const pipelineIdToName = new Map<string, string>()
            const pipelineNameToName = new Map<string, string>() // pentru căutare case-insensitive
            pipelinesWithIds.forEach((p: any) => {
              pipelineIdToName.set(p.id, p.name)
              pipelineNameToName.set(p.name.toLowerCase(), p.name)
            })
            
            for (const inst of instrumentsData as Array<{ id: string; name: string; pipeline: string | null }>) {
              if (inst.pipeline) {
                // Încearcă să găsească după ID mai întâi
                let pipelineName = pipelineIdToName.get(inst.pipeline)
                
                // Dacă nu găsește după ID, încearcă după nume (case-insensitive)
                if (!pipelineName) {
                  pipelineName = pipelineNameToName.get(inst.pipeline.toLowerCase())
                }
                
                if (pipelineName) {
                  pipelineCounts[pipelineName] = (pipelineCounts[pipelineName] || 0) + 1
                }
              }
            }
          }
        }

        let targetPipelineName: string | null = null
        let maxCount = 0
        for (const [pipelineName, count] of Object.entries(pipelineCounts)) {
          if (count > maxCount) {
            maxCount = count
            targetPipelineName = pipelineName
          }
        }

        if (!targetPipelineName) {
          // Verifică dacă instrumentele au pipeline setat
          const instrumentsWithoutPipeline = instrumentIds.length > 0 ? await (async () => {
            const { data } = await supabase
              .from('instruments')
              .select('id, name, pipeline')
              .in('id', instrumentIds)
            return (data || []).filter((i: any) => !i.pipeline)
          })() : []
          
          let errorMsg: string
          if (instrumentIds.length === 0) {
            errorMsg = `Tăvița ${quotes.indexOf(tray) + 1}: Nu există instrumente în tăviță. Adaugă cel puțin un instrument.`
          } else if (instrumentsWithoutPipeline.length > 0) {
            const names = instrumentsWithoutPipeline.map((i: any) => i.name).join(', ')
            errorMsg = `Tăvița ${quotes.indexOf(tray) + 1}: Instrumentele "${names}" nu au câmpul Pipeline setat. Mergi la Configurări → Catalog → Instrumente și setează pipeline-ul (Saloane/Horeca/Frizerii/etc).`
          } else {
            // Instrumentele au pipeline setat dar nu corespunde niciunui pipeline cunoscut
            const availablePipelines = pipelinesWithIds.map((p: any) => p.name).join(', ')
            errorMsg = `Tăvița ${quotes.indexOf(tray) + 1}: Pipeline-ul instrumentelor nu corespunde niciunui pipeline disponibil (${availablePipelines}).`
          }
          
          results.push(errorMsg)
          errorCount++
          continue
        }

        const departmentPipeline = pipelinesWithIds.find((p: any) => 
          p.name.toLowerCase() === targetPipelineName.toLowerCase()
        )

        if (!departmentPipeline) {
          results.push(`Tăvița ${quotes.indexOf(tray) + 1}: Pipeline "${targetPipelineName}" negăsit`)
          errorCount++
          continue
        }

        const { data: stages, error: stagesError } = await supabase
          .from('stages')
          .select('id, name, position')
          .eq('pipeline_id', departmentPipeline.id)
          .order('position', { ascending: true })

        if (stagesError || !stages || stages.length === 0) {
          results.push(`Tăvița ${quotes.indexOf(tray) + 1}: Stage-uri negăsite`)
          errorCount++
          continue
        }

        const stagesTyped = stages as Array<{ id: string; name: string; position: number }>
        const nouaStage = stagesTyped.find((s: any) => s.name.toLowerCase() === 'noua') || stagesTyped[0]

        const { data: pipelineItemData, error } = await addTrayToPipeline(
          tray.id,
          departmentPipeline.id,
          nouaStage.id
        )

        if (error) {
          results.push(`Tăvița ${quotes.indexOf(tray) + 1}: Eroare - ${(error as any).message}`)
          errorCount++
        } else {
          results.push(`Tăvița ${quotes.indexOf(tray) + 1} → ${targetPipelineName}`)
          successCount++
        }
      }

      // IMPORTANT: Creează conversație pentru lead indiferent de rezultat (daca cel putin o tăviță a fost trimisă)
      if (successCount > 0) {
        toast.success(`${successCount} tăviț${successCount === 1 ? 'ă transmisă' : 'e transmise'} cu succes!`)
        setTraysAlreadyInDepartments(true)
        
        // 🔔 NOTIFICĂ TEHNICIENII DESPRE TĂVIȚELE NOI
        try {
          const traysToNotify = quotes.map((q: any) => ({
            id: q.id,
            number: q.number || 'Fără număr',
            size: q.size || 'm',
          }))
          
          const notifyResult = await notifyTechniciansAboutNewTrays({
            trays: traysToNotify,
            serviceFileId: fisaId || '',
          })
          
          if (notifyResult.notifiedCount > 0) {
            console.log(`[sendAllTraysToPipeline] ${notifyResult.notifiedCount} tehnicieni notificați`)
          }
          if (notifyResult.errors.length > 0) {
            console.warn('[sendAllTraysToPipeline] Erori notificări:', notifyResult.errors)
          }
        } catch (notifyError: any) {
          // Nu blocăm fluxul principal dacă notificările eșuează
          console.warn('[sendAllTraysToPipeline] Eroare la notificări:', notifyError?.message)
        }
      } else if (successCount > 0 && errorCount > 0) {
        toast.warning(`${successCount} trimise, ${errorCount} erori`)
        const trayIds = quotes.map((q: any) => q.id)
        await checkTraysInDepartments(trayIds)
      } else if (errorCount > 0) {
        // Afișează detalii despre erori
        const errorDetails = results.filter(r => r.includes('Eroare') || r.includes('negăsit') || r.includes('Nu s-a'))
        const detailedMessage = errorDetails.length > 0 
          ? `Erori la trimitere:\n${errorDetails.join('\n')}`
          : `Erori la trimitere: ${errorCount}`
        toast.error(detailedMessage, { duration: 8000 })
        console.error('[sendAllTraysToPipeline] Detalii erori:', results)
      }

    } catch (error: any) {
      console.error('[usePreturiTrayOperations] Error sending trays:', error?.message || 'Unknown error')
      toast.error(`Eroare: ${error?.message || 'Eroare necunoscută'}`)
    } finally {
      setSendingTrays(false)
      setShowSendConfirmation(false)
    }
  }, [
    quotes,
    fisaId,
    services,
    instruments,
    pipelinesWithIds,
    setSendingTrays,
    setShowSendConfirmation,
    setTraysAlreadyInDepartments,
    validateTraysBeforeSend,
    checkTraysInDepartments,
  ])

  return {
    onAddSheet,
    handleCreateTray,
    onEditTray,
    handleUpdateTray,
    handleDeleteTray,
    handleMoveInstrument,
    // NOTE: onChangeSheet este mutat în usePreturiEffects.ts
    validateTraysBeforeSend,
    checkTraysInDepartments,
    sendAllTraysToPipeline,
  } as {
    onAddSheet: () => Promise<void>
    handleCreateTray: () => Promise<void>
    onEditTray: () => void
    handleUpdateTray: () => Promise<void>
    handleDeleteTray: () => Promise<void>
    handleMoveInstrument: (trayIdOverride?: string) => Promise<void>
    validateTraysBeforeSend: () => Promise<{ valid: boolean; errors: string[] }>
    checkTraysInDepartments: (trayIds: string[]) => Promise<void>
    sendAllTraysToPipeline: () => Promise<void>
  }
}

