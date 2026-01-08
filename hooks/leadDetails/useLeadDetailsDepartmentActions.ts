/**
 * Hook pentru acțiunile specifice pipeline-urilor departament
 */

import { useCallback } from 'react'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { moveItemToStage, addServiceFileToPipeline } from '@/lib/supabase/pipelineOperations'
import { toast } from 'sonner'

interface UseLeadDetailsDepartmentActionsProps {
  lead: {
    id: string
    stage?: string
    [key: string]: any
  } | null
  stages: string[]
  isDepartmentPipeline: boolean
  handleStageChange: (newStage: string) => void
  setStage: React.Dispatch<React.SetStateAction<string>>
  user: { id: string } | null
}

export function useLeadDetailsDepartmentActions({
  lead,
  stages,
  isDepartmentPipeline,
  handleStageChange,
  setStage,
  user,
}: UseLeadDetailsDepartmentActionsProps) {
  const supabase = supabaseBrowser()

  // Handler pentru butonul "Finalizare" (mută în stage-ul Finalizare)
  const handleFinalizare = useCallback(async () => {
    const leadAny = lead as any
    
    const finalizareStage = stages.find(s => 
      s.toUpperCase() === 'FINALIZATA'
    )
    
    if (!finalizareStage) {
      toast.error('Stage-ul FINALIZATA nu există în acest pipeline')
      return
    }

    if (isDepartmentPipeline && leadAny?.type === 'tray' && leadAny?.pipelineId) {
      try {
        const { data: stageData, error: stageError } = await supabase
          .from('stages')
          .select('id')
          .eq('pipeline_id', leadAny.pipelineId)
          .eq('name', finalizareStage)
          .single()
        
        if (stageError || !stageData) {
          console.error('Error finding stage:', stageError, 'Looking for:', finalizareStage)
          toast.error('Nu s-a putut găsi stage-ul în baza de date')
          return
        }

        const { error } = await moveItemToStage(
          'tray',
          leadAny.id,
          leadAny.pipelineId,
          (stageData as any).id,
          leadAny.stageId
        )
        
        if (error) {
          toast.error('Eroare la mutarea cardului')
          console.error('Error moving to Finalizare:', error)
          return
        }
        
        toast.success('Card mutat în FINALIZATA')
        setStage(finalizareStage)
      } catch (error) {
        console.error('Error moving to Finalizare:', error)
        toast.error('Eroare la mutarea cardului')
      }
    } else {
      handleStageChange(finalizareStage)
      toast.success('Card mutat în Finalizare')
    }
  }, [lead, stages, isDepartmentPipeline, handleStageChange, setStage, supabase])

  // Handler pentru butonul "Aștept piese" (pentru Reparații)
  const handleAsteptPiese = useCallback(async () => {
    const leadAny = lead as any
    
    const asteptPieseStage = stages.find(s => 
      s.toUpperCase() === 'ASTEPT PIESE'
    )
    
    if (!asteptPieseStage) {
      toast.error('Stage-ul ASTEPT PIESE nu există în acest pipeline')
      return
    }

    if (isDepartmentPipeline && leadAny?.type === 'tray' && leadAny?.pipelineId) {
      try {
        const { data: stageData, error: stageError } = await supabase
          .from('stages')
          .select('id')
          .eq('pipeline_id', leadAny.pipelineId)
          .eq('name', asteptPieseStage)
          .single()
        
        if (stageError || !stageData) {
          console.error('Error finding stage:', stageError, 'Looking for:', asteptPieseStage)
          toast.error('Nu s-a putut găsi stage-ul în baza de date')
          return
        }

        const { error } = await moveItemToStage(
          'tray',
          leadAny.id,
          leadAny.pipelineId,
          (stageData as any).id,
          leadAny.stageId
        )
        
        if (error) {
          toast.error('Eroare la mutarea cardului')
          console.error('Error moving to Astept piese:', error)
          return
        }
        
        toast.success('Card mutat în ASTEPT PIESE')
        setStage(asteptPieseStage)
      } catch (error) {
        console.error('Error moving to Astept piese:', error)
        toast.error('Eroare la mutarea cardului')
      }
    } else {
      handleStageChange(asteptPieseStage)
      toast.success('Card mutat în Aștept piese')
    }
  }, [lead, stages, isDepartmentPipeline, handleStageChange, setStage, supabase])

  // Handler pentru butonul "În așteptare" (pentru Saloane/Horeca/Frizerii)
  const handleInAsteptare = useCallback(async () => {
    const leadAny = lead as any
    
    const inAsteptareStage = stages.find(s => 
      s.toUpperCase() === 'IN ASTEPTARE'
    )
    
    if (!inAsteptareStage) {
      toast.error('Stage-ul IN ASTEPTARE nu există în acest pipeline')
      return
    }

    if (isDepartmentPipeline && leadAny?.type === 'tray' && leadAny?.pipelineId) {
      try {
        const { data: stageData, error: stageError } = await supabase
          .from('stages')
          .select('id')
          .eq('pipeline_id', leadAny.pipelineId)
          .eq('name', inAsteptareStage)
          .single()
        
        if (stageError || !stageData) {
          console.error('Error finding stage:', stageError, 'Looking for:', inAsteptareStage)
          toast.error('Nu s-a putut găsi stage-ul în baza de date')
          return
        }

        const { error } = await moveItemToStage(
          'tray',
          leadAny.id,
          leadAny.pipelineId,
          (stageData as any).id,
          leadAny.stageId
        )
        
        if (error) {
          toast.error('Eroare la mutarea cardului')
          console.error('Error moving to In asteptare:', error)
          return
        }
        
        toast.success('Card mutat în IN ASTEPTARE')
        setStage(inAsteptareStage)
      } catch (error) {
        console.error('Error moving to In asteptare:', error)
        toast.error('Eroare la mutarea cardului')
      }
    } else {
      handleStageChange(inAsteptareStage)
      toast.success('Card mutat în În așteptare')
    }
  }, [lead, stages, isDepartmentPipeline, handleStageChange, setStage, supabase])

  // Handler pentru butonul "În lucru" (atribuie tăvița utilizatorului curent)
  const handleInLucru = useCallback(async () => {
    const leadAny = lead as any
    
    const inLucruStage = stages.find(s => 
      s.toUpperCase() === 'IN LUCRU'
    )
    
    if (!inLucruStage) {
      toast.error('Stage-ul IN LUCRU nu există în acest pipeline')
      return
    }

    if (isDepartmentPipeline && leadAny?.type === 'tray' && leadAny?.pipelineId) {
      try {
        if (!user?.id) {
          toast.error('Utilizatorul nu este autentificat')
          return
        }

        const { data: stageData, error: stageError } = await supabase
          .from('stages')
          .select('id')
          .eq('pipeline_id', leadAny.pipelineId)
          .eq('name', inLucruStage)
          .single()
        
        if (stageError || !stageData) {
          console.error('Error finding stage:', stageError, 'Looking for:', inLucruStage)
          toast.error('Nu s-a putut găsi stage-ul în baza de date')
          return
        }

        const { error: moveError } = await moveItemToStage(
          'tray',
          leadAny.id,
          leadAny.pipelineId,
          (stageData as any).id,
          leadAny.stageId
        )
        
        if (moveError) {
          toast.error('Eroare la mutarea cardului')
          console.error('Error moving to In lucru:', moveError)
          return
        }

        const { error: updateError } = await supabase
          .from('tray_items')
          .update({ technician_id: user.id } as any)
          .eq('tray_id', leadAny.id)
        
        if (updateError) {
          console.error('Error assigning tray to user:', updateError)
          toast.error('Eroare la atribuirea tăviței')
          return
        }

        // Mută și cardul fișei (service_file) din pipeline-ul "Recepție" în stage-ul "În lucru" al pipeline-ului departamentului
        try {
          // Obține service_file_id din tăviță
          const { data: trayData, error: trayFetchError } = await supabase
            .from('trays')
            .select('service_file_id')
            .eq('id', leadAny.id)
            .single()
          
          if (trayFetchError || !trayData?.service_file_id) {
            console.warn('Nu s-a putut obține service_file_id din tăviță:', trayFetchError)
          } else {
            // IMPORTANT: Adaugă mai întâi cardul fișei în pipeline-ul departamentului
            // Apoi șterge din Recepție doar dacă adăugarea a reușit
            const { data: addResult, error: addServiceFileError } = await addServiceFileToPipeline(
              trayData.service_file_id,
              leadAny.pipelineId, // Pipeline-ul departamentului
              (stageData as any).id // Stage-ul "În lucru" din pipeline-ul departamentului
            )
            
            if (addServiceFileError || !addResult) {
              console.error('Eroare la adăugarea cardului fișei în pipeline-ul departamentului:', addServiceFileError)
              toast.error('Eroare la mutarea cardului fișei în departament')
              // Nu continuăm cu ștergerea dacă adăugarea a eșuat
            } else {
              // Doar dacă adăugarea a reușit, șterge din Recepție
              const { data: receptiePipeline, error: receptieError } = await supabase
                .from('pipelines')
                .select('id')
                .ilike('name', '%receptie%')
                .single()
              
              if (!receptieError && receptiePipeline) {
                // Șterge pipeline_item-ul din pipeline-ul "Recepție" (dacă există)
                const { error: deleteError } = await supabase
                  .from('pipeline_items')
                  .delete()
                  .eq('type', 'service_file')
                  .eq('item_id', trayData.service_file_id)
                  .eq('pipeline_id', receptiePipeline.id)
                
                if (deleteError) {
                  console.warn('Eroare la ștergerea cardului fișei din Recepție:', deleteError)
                  // Nu aruncăm eroare - cardul a fost deja adăugat în departament
                }
              }
            }
          }
        } catch (serviceFileError) {
          console.error('Eroare la mutarea cardului fișei:', serviceFileError)
          toast.error('Eroare la mutarea cardului fișei')
        }
        
        toast.success('Tăvița a fost atribuită și mutată în IN LUCRU')
        setStage(inLucruStage)
      } catch (error) {
        console.error('Error moving to In lucru:', error)
        toast.error('Eroare la mutarea cardului')
      }
    } else {
      handleStageChange(inLucruStage)
      toast.success('Card mutat în IN LUCRU')
    }
  }, [lead, stages, isDepartmentPipeline, handleStageChange, setStage, supabase, user])

  return {
    handleFinalizare,
    handleAsteptPiese,
    handleInAsteptare,
    handleInLucru,
  }
}


