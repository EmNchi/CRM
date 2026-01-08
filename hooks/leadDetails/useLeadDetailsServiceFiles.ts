/**
 * Hook pentru gestionarea service files-urilor în componenta LeadDetailsPanel
 */

import { useCallback } from 'react'
import { toast } from 'sonner'
import { 
  createServiceFile,
  createTray,
  getNextGlobalServiceFileNumber,
} from '@/lib/supabase/serviceFileOperations'

interface UseLeadDetailsServiceFilesProps {
  getLeadId: () => string | null
  setServiceSheets: React.Dispatch<React.SetStateAction<any[]>>
  setSelectedFisaId: React.Dispatch<React.SetStateAction<string | null>>
  setLoadingSheets: React.Dispatch<React.SetStateAction<boolean>>
  loadServiceSheets: (leadId: string) => Promise<any[]>
}

// Funcție helper pentru crearea unei fișe de serviciu
const createServiceSheet = async (leadId: string, name?: string): Promise<string> => {
  // Generează un număr global pentru fișă (nu local pentru lead)
  const { data: nextGlobalNumber, error: numberError } = await getNextGlobalServiceFileNumber()
  
  if (numberError || nextGlobalNumber === null) {
    console.error('Error getting next global service file number:', numberError)
    throw numberError || new Error('Failed to get next global service file number')
  }
  
  const serviceFileData = {
    lead_id: leadId,
    number: name || `Fisa ${nextGlobalNumber}`,
    date: new Date().toISOString().split('T')[0],
    status: 'noua' as const,
    notes: null,
  }
  
  const { data, error } = await createServiceFile(serviceFileData)
  if (error || !data) {
    console.error('Error creating service file:', error)
    throw error || new Error('Failed to create service file')
  }
  
  // Creează automat o tăviță "undefined" (fără număr) pentru fișa de serviciu nou creată
  try {
    const { data: undefinedTray, error: trayError } = await createTray({
      number: '', // Tăviță "undefined" - fără număr
      size: 'm',
      service_file_id: data.id,
      status: 'in_receptie',
    })
    
    if (trayError) {
      console.error('Error creating undefined tray:', trayError)
      // Nu aruncăm eroarea, doar logăm - fișa de serviciu a fost creată cu succes
    }
  } catch (trayErr) {
    console.error('Error creating undefined tray:', trayErr)
    // Nu aruncăm eroarea, doar logăm
  }
  
  return data.id // Returnează fisa_id
}

export function useLeadDetailsServiceFiles({
  getLeadId,
  setServiceSheets,
  setSelectedFisaId,
  setLoadingSheets,
  loadServiceSheets,
}: UseLeadDetailsServiceFilesProps) {
  
  // Funcție pentru crearea unei fișe noi
  const handleCreateServiceSheet = useCallback(async () => {
    const leadId = getLeadId()
    if (!leadId) {
      console.warn('Cannot create service sheet: no lead ID')
      toast.error('Nu s-a putut obține ID-ul lead-ului')
      return
    }
    
    try {
      setLoadingSheets(true)
      
      const fisaId = await createServiceSheet(leadId)
      
      // Reîncarcă fișele folosind funcția helper
      const sheets = await loadServiceSheets(leadId)
      
      setServiceSheets(sheets)
      setSelectedFisaId(fisaId)
      
      // Verifică dacă fișa a fost adăugată în listă
      const createdSheet = sheets.find(s => s.id === fisaId)
      if (!createdSheet) {
        console.warn('Created sheet not found in loaded sheets')
      }
      
      toast.success('Fișă de serviciu creată cu succes')
    } catch (error: any) {
      console.error('Error creating service sheet:', error)
      const errorMessage = error?.message || 'Te rog încearcă din nou'
      
      // Verifică dacă eroarea este legată de coloana lipsă
      if (errorMessage.includes('fisa_id') || errorMessage.includes('column')) {
        toast.error('Coloana fisa_id lipsește', {
          description: 'Te rog adaugă coloana fisa_id (UUID, nullable) în tabelul service_files din Supabase'
        })
      } else {
        toast.error('Eroare la crearea fișei', {
          description: errorMessage
        })
      }
    } finally {
      setLoadingSheets(false)
    }
  }, [getLeadId, loadServiceSheets, setServiceSheets, setSelectedFisaId, setLoadingSheets])

  return {
    handleCreateServiceSheet,
    createServiceSheet,
  }
}

// Export funcție helper pentru utilizare în alte hook-uri
export { createServiceSheet }


