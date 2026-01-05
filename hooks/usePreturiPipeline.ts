import { useMemo } from 'react'

/**
 * Hook pentru verificări și restricții bazate pe pipeline
 */
export function usePreturiPipeline(pipelineSlug?: string, isDepartmentPipeline?: boolean) {
  // Verifică dacă suntem în pipeline-ul Vânzări
  const isVanzariPipeline = useMemo(() => {
    if (!pipelineSlug) return false
    return pipelineSlug.toLowerCase().includes('vanzari') || pipelineSlug.toLowerCase().includes('sales')
  }, [pipelineSlug])

  // Verifică dacă suntem în pipeline-ul Reparații
  const isReparatiiPipeline = useMemo(() => {
    if (!pipelineSlug) return false
    return pipelineSlug.toLowerCase().includes('reparatii') || pipelineSlug.toLowerCase().includes('repair')
  }, [pipelineSlug])

  // Verifică dacă suntem în pipeline-ul Recepție
  const isReceptiePipeline = useMemo(() => {
    if (!pipelineSlug) return false
    return pipelineSlug.toLowerCase().includes('receptie') || pipelineSlug.toLowerCase().includes('reception')
  }, [pipelineSlug])

  // Verifică dacă suntem în pipeline-ul Curier
  const isCurierPipeline = useMemo(() => {
    if (!pipelineSlug) return false
    return pipelineSlug.toLowerCase().includes('curier')
  }, [pipelineSlug])

  // Verifică dacă pipeline-ul permite adăugarea de imagini (Saloane, Frizerii, Horeca, Reparatii)
  // Receptie poate doar VIZUALIZA imagini, nu le poate adăuga
  const canAddTrayImages = useMemo(() => {
    if (!pipelineSlug) return false
    const slug = pipelineSlug.toLowerCase()
    return slug.includes('saloane') || 
           slug.includes('frizerii') || 
           slug.includes('horeca') || 
           slug.includes('reparatii')
  }, [pipelineSlug])
  
  // Verifică dacă pipeline-ul permite VIZUALIZAREA imaginilor (Receptie poate vedea, dar nu adăuga)
  const canViewTrayImages = useMemo(() => {
    if (!pipelineSlug) return false
    const slug = pipelineSlug.toLowerCase()
    return canAddTrayImages || slug.includes('receptie') || slug.includes('reception')
  }, [pipelineSlug, canAddTrayImages])

  // Pipeline-uri comerciale unde vrem să afișăm detalii de tăviță în Fișa de serviciu
  const isCommercialPipeline = useMemo(() => {
    return isVanzariPipeline || isReceptiePipeline || isCurierPipeline
  }, [isVanzariPipeline, isReceptiePipeline, isCurierPipeline])

  // Restricții pentru tehnicieni în pipeline-urile departament
  // Urgent și Abonament sunt disponibile doar în Recepție/Vânzări/Curier (NU pentru tehnicieni în departament)
  const canEditUrgentAndSubscription = useMemo(() => {
    // În pipeline departament, tehnicianul nu poate modifica Urgent sau Abonament
    if (isDepartmentPipeline) return false
    // În alte pipeline-uri (Recepție, Vânzări, Curier), toți pot modifica
    return true
  }, [isDepartmentPipeline])

  // Tehnicianul poate adăuga piese doar în Reparații
  const canAddParts = useMemo(() => {
    if (isDepartmentPipeline) {
      return isReparatiiPipeline
    }
    return true // În alte pipeline-uri se pot adăuga piese
  }, [isDepartmentPipeline, isReparatiiPipeline])

  return {
    isVanzariPipeline,
    isReparatiiPipeline,
    isReceptiePipeline,
    isCurierPipeline,
    canAddTrayImages,
    canViewTrayImages,
    isCommercialPipeline,
    canEditUrgentAndSubscription,
    canAddParts,
  }
}

