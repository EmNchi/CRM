/**
 * Hook pentru operațiile cu livrare și pipeline (delivery checkboxes, refresh pipelines/departments)
 */

import { useCallback } from 'react'
import { toast } from 'sonner'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { updateServiceFile } from '@/lib/supabase/serviceFileOperations'
import { moveServiceFileToPipeline, addServiceFileToPipeline } from '@/lib/supabase/pipelineOperations'
import { getPipelinesWithStages } from '@/lib/supabase/leadOperations'

const supabase = supabaseBrowser()

interface UsePreturiDeliveryOperationsProps {
  fisaId?: string | null
  pipelinesWithIds: Array<{ id: string; name: string }>
  setPipelines: React.Dispatch<React.SetStateAction<string[]>>
  setPipelinesWithIds: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string }>>>
  setDepartments: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string }>>>
  setPipeLoading: React.Dispatch<React.SetStateAction<boolean>>
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>
  setOfficeDirect: React.Dispatch<React.SetStateAction<boolean>>
  setCurierTrimis: React.Dispatch<React.SetStateAction<boolean>>
}

export function usePreturiDeliveryOperations({
  fisaId,
  pipelinesWithIds,
  setPipelines,
  setPipelinesWithIds,
  setDepartments,
  setPipeLoading,
  setIsDirty,
  setOfficeDirect,
  setCurierTrimis,
}: UsePreturiDeliveryOperationsProps) {

  // Funcție pentru reîmprospătarea pipeline-urilor
  const refreshPipelines = useCallback(async () => {
    setPipeLoading(true)
    try {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id,name,is_active,position')
        .eq('is_active', true)
        .order('position', { ascending: true })
      if (error) throw error
      setPipelines((data ?? []).map((r: any) => r.name))
      setPipelinesWithIds((data ?? []).map((r: any) => ({ id: r.id, name: r.name })))
    } finally { 
      setPipeLoading(false) 
    }
  }, [setPipelines, setPipelinesWithIds, setPipeLoading])

  // Funcție pentru reîmprospătarea departamentelor
  const refreshDepartments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id,name')
        .order('name', { ascending: true })
      if (error) throw error
      setDepartments((data ?? []).map((r: any) => ({ id: r.id, name: r.name })))
    } catch (error) {
      console.error('Error loading departments:', error)
    }
  }, [setDepartments])

  // Mută fișa în pipeline-ul corespunzător când se bifează checkbox-ul Office Direct
  const handleDeliveryCheckboxChange = useCallback(async (isOfficeDirect: boolean) => {
    // IMPORTANT: Actualizează state-ul local IMEDIAT pentru a actualiza UI-ul
    setOfficeDirect(isOfficeDirect)
    setCurierTrimis(!isOfficeDirect)
    setIsDirty(true)
    
    if (!fisaId) {
      console.error('[usePreturiDeliveryOperations] Cannot save delivery - missing fisaId', {
        fisaId,
        isOfficeDirect,
        pipelinesWithIds: pipelinesWithIds.length
      })
      toast.error('Nu se poate salva: lipsește ID-ul fișei. Te rog reîncarcă pagina.')
      // Revert state-ul dacă fisaId lipsește
      setOfficeDirect(!isOfficeDirect)
      setCurierTrimis(isOfficeDirect)
      setIsDirty(false)
      return
    }
    
    // IMPORTANT: Dacă pipelinesWithIds este gol, încearcă să reîmprospăteze pipeline-urile
    let currentPipelinesWithIds = pipelinesWithIds
    if (currentPipelinesWithIds.length === 0) {
      await refreshPipelines()
      // După refresh, trebuie să obținem pipeline-urile actualizate
      // Dar pentru că refreshPipelines folosește setPipelinesWithIds, trebuie să așteptăm
      // Pentru moment, continuăm cu logica existentă și folosim pipeline-urile din context
    }

    try {
      // Actualizează checkbox-urile în baza de date
      const { error: updateError } = await updateServiceFile(fisaId, {
        office_direct: isOfficeDirect,
        curier_trimis: !isOfficeDirect,
      })
      
      if (updateError) {
        toast.error('Eroare la salvarea checkbox-urilor')
        // Revert state-ul dacă a eșuat
        setOfficeDirect(!isOfficeDirect)
        setCurierTrimis(isOfficeDirect)
        setIsDirty(false)
        return
      }

      const { data: pipelinesData } = await getPipelinesWithStages()
      
      // Normalizează numele stage-urilor pentru căutare (elimină spații, cratime, etc.)
      const normalizeStageName = (name: string) => {
        return name.toLowerCase().replace(/[\s\-_]/g, '')
      }

      // 1. Adaugă în pipeline-ul "Receptie" cu stage-ul corespunzător
      const receptiePipeline = pipelinesWithIds.find(p => p.name.toLowerCase().includes('receptie'))
      if (receptiePipeline) {
        const receptiePipelineData = pipelinesData?.find((p: any) => p.id === receptiePipeline.id)
        if (receptiePipelineData?.stages?.length) {
          const targetStageName = isOfficeDirect ? 'officedirect' : 'curiertrimis'
          
          let stage = receptiePipelineData.stages.find((s: any) => {
            if (s.is_active === false) return false
            const normalized = normalizeStageName(s.name)
            return normalized === targetStageName || normalized.includes(targetStageName)
          })

          // Dacă nu găsește exact, încearcă o căutare mai flexibilă
          if (!stage) {
            const searchTerms = isOfficeDirect ? ['office', 'direct'] : ['curier', 'trimis']
            stage = receptiePipelineData.stages.find((s: any) => {
              if (s.is_active === false) return false
              const normalized = normalizeStageName(s.name)
              return searchTerms.every(term => normalized.includes(term))
            })
          }
          
          if (stage) {
            const result = await moveServiceFileToPipeline(fisaId, receptiePipeline.id, stage.id)
            if (!result.ok) {
              console.error('[usePreturiDeliveryOperations] Error adding to Receptie:', result.message || 'Unknown error')
            }
          }
        }
      }

      // 2. Nu mai adăugăm în pipeline-ul Curier - folosim doar Receptie
      // Dacă este "Curier Trimis", rămâne în Receptie cu stage-ul "Curier Trimis"
      if (!isOfficeDirect) {
        toast.success(`Fișa adăugată în Receptie - CURIER TRIMIS`)
      } else {
        toast.success(`Fișa adăugată în Receptie - OFFICE DIRECT`)
      }
    } catch (error: any) {
      toast.error('Eroare la mutarea fișei: ' + (error?.message || 'Eroare necunoscută'))
    }
  }, [fisaId, pipelinesWithIds, setIsDirty, setOfficeDirect, setCurierTrimis])

  // Mută fișa în pipeline-ul corespunzător când se bifează checkbox-ul Curier Trimis
  const handleCurierTrimisChange = useCallback(async (isCurierTrimis: boolean) => {
    // IMPORTANT: Actualizează state-ul local IMEDIAT pentru a actualiza UI-ul
    setCurierTrimis(isCurierTrimis)
    setOfficeDirect(!isCurierTrimis)
    setIsDirty(true)
    
    if (!fisaId) {
      console.error('[usePreturiDeliveryOperations] Cannot save delivery - missing fisaId', {
        fisaId,
        isCurierTrimis,
        pipelinesWithIds: pipelinesWithIds.length
      })
      toast.error('Nu se poate salva: lipsește ID-ul fișei. Te rog reîncarcă pagina.')
      // Revert state-ul dacă fisaId lipsește
      setCurierTrimis(!isCurierTrimis)
      setOfficeDirect(isCurierTrimis)
      setIsDirty(false)
      return
    }
    
    // IMPORTANT: Dacă pipelinesWithIds este gol, încearcă să reîmprospăteze pipeline-urile
    let currentPipelinesWithIds = pipelinesWithIds
    if (currentPipelinesWithIds.length === 0) {
      await refreshPipelines()
      // După refresh, trebuie să obținem pipeline-urile actualizate
      // Dar pentru că refreshPipelines folosește setPipelinesWithIds, trebuie să așteptăm
      // Pentru moment, continuăm cu logica existentă și folosim pipeline-urile din context
    }

    // IMPORTANT: Actualizează state-ul local IMEDIAT pentru a actualiza UI-ul
    setCurierTrimis(isCurierTrimis)
    setOfficeDirect(!isCurierTrimis)
    setIsDirty(true)

    try {
      // Actualizează checkbox-urile în baza de date
      const { error: updateError } = await updateServiceFile(fisaId, {
        office_direct: !isCurierTrimis,
        curier_trimis: isCurierTrimis,
      })
      
      if (updateError) {
        toast.error('Eroare la salvarea checkbox-urilor')
        // Revert state-ul dacă a eșuat
        setCurierTrimis(!isCurierTrimis)
        setOfficeDirect(isCurierTrimis)
        setIsDirty(false)
        return
      }

      const { data: pipelinesData } = await getPipelinesWithStages()
      
      // Normalizează numele stage-urilor pentru căutare
      const normalizeStageName = (name: string) => {
        return name.toLowerCase().replace(/[\s\-_]/g, '')
      }

      // 1. Adaugă în pipeline-ul "Receptie" cu stage-ul corespunzător
      const receptiePipeline = pipelinesWithIds.find(p => p.name.toLowerCase().includes('receptie'))
      if (receptiePipeline) {
        const receptiePipelineData = pipelinesData?.find((p: any) => p.id === receptiePipeline.id)
        if (receptiePipelineData?.stages?.length) {
          const targetStageName = isCurierTrimis ? 'curiertrimis' : 'officedirect'
          
          let stage = receptiePipelineData.stages.find((s: any) => {
            if (s.is_active === false) return false
            const normalized = normalizeStageName(s.name)
            return normalized === targetStageName || normalized.includes(targetStageName)
          })

          // Dacă nu găsește exact, încearcă o căutare mai flexibilă
          if (!stage) {
            const searchTerms = isCurierTrimis ? ['curier', 'trimis'] : ['office', 'direct']
            stage = receptiePipelineData.stages.find((s: any) => {
              if (s.is_active === false) return false
              const normalized = normalizeStageName(s.name)
              return searchTerms.every(term => normalized.includes(term))
            })
          }
          
          if (stage) {
            const { error: pipelineError } = await addServiceFileToPipeline(fisaId, receptiePipeline.id, stage.id)
            if (pipelineError) {
              console.error('[usePreturiDeliveryOperations] Error adding to Receptie pipeline:', pipelineError?.message || 'Unknown error')
            }
          }
        }
      }
      
      // 2. Nu mai adăugăm în pipeline-ul Curier - folosim doar Receptie
      // Dacă este "Curier Trimis", rămâne în Receptie cu stage-ul "Curier Trimis"
      if (isCurierTrimis) {
        toast.success(`Fișa adăugată în Receptie - CURIER TRIMIS`)
      } else {
        toast.success(`Fișa adăugată în Receptie - OFFICE DIRECT`)
      }
    } catch (error: any) {
      toast.error('Eroare la mutarea fișei: ' + (error?.message || 'Eroare necunoscută'))
    }
  }, [fisaId, pipelinesWithIds, setIsDirty, setOfficeDirect, setCurierTrimis])

  return {
    refreshPipelines,
    refreshDepartments,
    handleDeliveryCheckboxChange,
    handleCurierTrimisChange,
  }
}


