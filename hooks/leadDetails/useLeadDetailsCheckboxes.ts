/**
 * Hook pentru gestionarea checkbox-urilor în componenta LeadDetailsPanel
 */

import { useEffect, useCallback } from 'react'
import { toast } from 'sonner'

interface UseLeadDetailsCheckboxesProps {
  lead: {
    id: string
    stage?: string
    [key: string]: any
  } | null
  isVanzariPipeline: boolean
  stages: string[]
  
  // State-uri pentru checkbox-uri generale
  callBack: boolean
  setCallBack: React.Dispatch<React.SetStateAction<boolean>>
  nuRaspunde: boolean
  setNuRaspunde: React.Dispatch<React.SetStateAction<boolean>>
  noDeal: boolean
  setNoDeal: React.Dispatch<React.SetStateAction<boolean>>
  
  // State-uri pentru checkbox-uri Curier
  coletAjuns: boolean
  setColetAjuns: React.Dispatch<React.SetStateAction<boolean>>
  curierRetur: boolean
  setCurierRetur: React.Dispatch<React.SetStateAction<boolean>>
  coletTrimis: boolean
  setColetTrimis: React.Dispatch<React.SetStateAction<boolean>>
  asteptRidicarea: boolean
  setAsteptRidicarea: React.Dispatch<React.SetStateAction<boolean>>
  ridicPersonal: boolean
  setRidicPersonal: React.Dispatch<React.SetStateAction<boolean>>
  
  // Funcții helper
  getLeadId: () => string | null
  handleStageChange: (newStage: string) => void
  setStage: React.Dispatch<React.SetStateAction<string>>
}

export function useLeadDetailsCheckboxes({
  lead,
  isVanzariPipeline,
  stages,
  callBack,
  setCallBack,
  nuRaspunde,
  setNuRaspunde,
  noDeal,
  setNoDeal,
  coletAjuns,
  setColetAjuns,
  curierRetur,
  setCurierRetur,
  coletTrimis,
  setColetTrimis,
  asteptRidicarea,
  setAsteptRidicarea,
  ridicPersonal,
  setRidicPersonal,
  getLeadId,
  handleStageChange,
  setStage,
}: UseLeadDetailsCheckboxesProps) {
  
  // Setează starea checkbox-urilor pe baza stage-ului curent (doar în Vânzări)
  useEffect(() => {
    if (!lead) return
    setStage(lead.stage || '')
    
    if (isVanzariPipeline) {
      const currentStage = lead.stage?.toUpperCase() || ''
      
      // Verifică dacă stage-ul curent corespunde unuia dintre checkbox-uri
      if (currentStage.includes('NO DEAL') || currentStage.includes('NO-DEAL')) {
        setNoDeal(true)
        setCallBack(false)
        setNuRaspunde(false)
      } else if (currentStage.includes('CALLBACK') || currentStage.includes('CALL BACK') || currentStage.includes('CALL-BACK')) {
        setNoDeal(false)
        setCallBack(true)
        setNuRaspunde(false)
      } else if (currentStage.includes('RASPUNDE') || currentStage.includes('RASUNDE')) {
        setNoDeal(false)
        setCallBack(false)
        setNuRaspunde(true)
      } else {
        // Dacă stage-ul nu corespunde niciunui checkbox, dezactivează toate
        setNoDeal(false)
        setCallBack(false)
        setNuRaspunde(false)
      }
    }
  }, [lead?.id, lead?.stage, isVanzariPipeline, setStage, setNoDeal, setCallBack, setNuRaspunde])

  // Funcție pentru gestionarea checkbox-ului "Nu raspunde"
  const handleNuRaspundeChange = useCallback((checked: boolean) => {
    if (checked) {
      setNoDeal(false)
      setCallBack(false)
      setNuRaspunde(true)
      
      if (isVanzariPipeline) {
        const nuRaspundeStage = stages.find(stage => 
          stage.toUpperCase() === 'NU RASPUNDE' || 
          stage.toUpperCase() === 'NU RASUNDE' ||
          stage.toUpperCase().includes('RASPUNDE')
        )
        if (nuRaspundeStage) {
          handleStageChange(nuRaspundeStage)
          toast.success('Card mutat în ' + nuRaspundeStage)
        }
      }
    } else {
      setNuRaspunde(false)
    }
  }, [isVanzariPipeline, stages, handleStageChange, setNoDeal, setCallBack, setNuRaspunde])

  // Funcție pentru gestionarea checkbox-ului "No Deal"
  const handleNoDealChange = useCallback((checked: boolean) => {
    if (checked) {
      setNuRaspunde(false)
      setCallBack(false)
      setNoDeal(true)
      
      if (isVanzariPipeline) {
        const noDealStage = stages.find(stage => 
          stage.toUpperCase() === 'NO DEAL' || 
          stage.toUpperCase() === 'NO-DEAL' ||
          stage.toUpperCase().includes('NO DEAL')
        )
        if (noDealStage) {
          handleStageChange(noDealStage)
          toast.success('Card mutat în ' + noDealStage)
        }
      }
    } else {
      setNoDeal(false)
    }
  }, [isVanzariPipeline, stages, handleStageChange, setNuRaspunde, setCallBack, setNoDeal])

  // Funcție pentru gestionarea checkbox-ului "Call Back"
  const handleCallBackChange = useCallback((checked: boolean) => {
    if (checked) {
      setNoDeal(false)
      setNuRaspunde(false)
      setCallBack(true)
      
      if (isVanzariPipeline) {
        const callBackStage = stages.find(stage => 
          stage.toUpperCase() === 'CALLBACK' || 
          stage.toUpperCase() === 'CALL BACK' ||
          stage.toUpperCase() === 'CALL-BACK' ||
          stage.toUpperCase().includes('CALLBACK')
        )
        if (callBackStage) {
          handleStageChange(callBackStage)
          toast.success('Card mutat în ' + callBackStage)
        }
      }
    } else {
      setCallBack(false)
    }
  }, [isVanzariPipeline, stages, handleStageChange, setNoDeal, setNuRaspunde, setCallBack])

  return {
    // Handlers pentru checkbox-uri generale
    handleNoDealChange,
    handleNuRaspundeChange,
    handleCallBackChange,
    
    // State-uri pentru checkbox-uri Curier (doar pentru afișare, nu sunt salvate)
    coletAjuns,
    setColetAjuns,
    curierRetur,
    setCurierRetur,
    coletTrimis,
    setColetTrimis,
    asteptRidicarea,
    setAsteptRidicarea,
    ridicPersonal,
    setRidicPersonal,
  }
}


