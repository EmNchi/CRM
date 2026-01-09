/**
 * Hook pentru gestionarea tray details-urilor în componenta LeadDetailsPanel
 */

import { useCallback, useMemo } from 'react'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { toast } from 'sonner'
import { debounce } from '@/lib/utils'

interface UseLeadDetailsTrayDetailsProps {
  fisaId: string | null
  isVanzariPipeline: boolean
  isReceptiePipeline?: boolean
  trayDetails: string
  setTrayDetails: React.Dispatch<React.SetStateAction<string>>
  setSavingTrayDetails: React.Dispatch<React.SetStateAction<boolean>>
  setLoadingTrayDetails: React.Dispatch<React.SetStateAction<boolean>>
  getServiceFileId: () => Promise<string | null>
}

export function useLeadDetailsTrayDetails({
  fisaId,
  isVanzariPipeline,
  isReceptiePipeline = false,
  trayDetails,
  setTrayDetails,
  setSavingTrayDetails,
  setLoadingTrayDetails,
  getServiceFileId,
}: UseLeadDetailsTrayDetailsProps) {
  const supabase = supabaseBrowser()

  // Funcție pentru salvarea detaliilor
  const saveServiceFileDetails = useCallback(async (details: string) => {
    // IMPORTANT: Detaliile pot fi modificate doar din pipeline-ul Vanzari sau Receptie
    if (!isVanzariPipeline && !isReceptiePipeline) {
      // console.warn('Cannot save details: modifications are only allowed in Vanzari or Receptie pipelines')
      toast.error('Detaliile pot fi modificate doar din pipeline-ul Vânzări sau Recepție')
      return
    }
    
    try {
      const serviceFileId = await getServiceFileId()
      if (!serviceFileId) {
        console.warn('Cannot save details: service file not found')
        return
      }
      
      // IMPORTANT: Salva MEREU ca JSON structure pentru consistency
      const detailsToSave = JSON.stringify({
        text: details || '',
        paymentCash: false,
        paymentCard: false
      })
      
      // Dar dacă exista deja payment info, păstrează-l
      const { data: existingData } = await supabase
        .from('service_files')
        .select('details')
        .eq('id', serviceFileId)
        .single()
      
      let finalDetailsToSave = detailsToSave
      if (existingData?.details) {
        try {
          const parsedDetails = JSON.parse(existingData.details)
          if (typeof parsedDetails === 'object' && parsedDetails !== null && (parsedDetails.paymentCash !== undefined || parsedDetails.paymentCard !== undefined)) {
            // Păstrează payment info existent
            finalDetailsToSave = JSON.stringify({
              text: details || '',
              paymentCash: parsedDetails.paymentCash || false,
              paymentCard: parsedDetails.paymentCard || false
            })
          }
        } catch {
          // Dacă parse eșuează, continuă cu structura noua
        }
      }
      
      const { error } = await supabase
        .from('service_files')
        .update({ details: finalDetailsToSave } as any)
        .eq('id', serviceFileId)
      
      if (error) {
        console.error('[useLeadDetailsTrayDetails] Error saving service file details:', error?.message || 'Unknown error')
        toast.error('Eroare la salvarea automată: ' + error.message)
      }
    } catch (err: any) {
      console.error('Error saving details:', err)
    }
  }, [getServiceFileId, isVanzariPipeline, isReceptiePipeline, supabase])

  // Funcție debounced pentru auto-save
  const debouncedSaveDetails = useMemo(
    () => debounce((details: string) => {
      saveServiceFileDetails(details)
    }, 1000), // 1 secundă delay
    [saveServiceFileDetails]
  )

  return {
    saveServiceFileDetails,
    debouncedSaveDetails,
  }
}


