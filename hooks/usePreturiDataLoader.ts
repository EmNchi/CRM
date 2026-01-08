/**
 * Hook pentru încărcarea datelor inițiale în componenta Preturi
 */

import { useEffect, useCallback } from 'react'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { listServices } from '@/lib/supabase/serviceOperations'
import { listParts } from '@/lib/supabase/partOperations'
import { listTraysForServiceFile } from '@/lib/supabase/serviceFileOperations'
import { listQuotesForLead } from '@/lib/utils/preturi-helpers'
import { getPipelinesWithStages } from '@/lib/supabase/leadOperations'
import type { Service } from '@/lib/supabase/serviceOperations'
import type { Part } from '@/lib/supabase/partOperations'
import type { LeadQuote } from '@/lib/types/preturi'

const supabase = supabaseBrowser()

interface UsePreturiDataLoaderProps {
  leadId: string
  fisaId?: string | null
  initialQuoteId?: string | null
  setLoading: (loading: boolean) => void
  setServices: (services: Service[]) => void
  setParts: (parts: Part[]) => void
  setInstruments: (instruments: Array<{ id: string; name: string; weight: number; department_id: string | null }>) => void
  setTechnicians: (technicians: Array<{ id: string; name: string }>) => void
  setDepartments: (departments: Array<{ id: string; name: string }>) => void
  setPipelines: (pipelines: string[]) => void
  setPipelinesWithIds: (pipelines: Array<{ id: string; name: string }>) => void
  setPipeLoading: (loading: boolean) => void
  setQuotes: (quotes: LeadQuote[]) => void
  setSelectedQuoteId: (id: string | null) => void
}

export function usePreturiDataLoader({
  leadId,
  fisaId,
  initialQuoteId,
  setLoading,
  setServices,
  setParts,
  setInstruments,
  setTechnicians,
  setDepartments,
  setPipelines,
  setPipelinesWithIds,
  setPipeLoading,
  setQuotes,
  setSelectedQuoteId,
}: UsePreturiDataLoaderProps) {
  
  // Funcție pentru refresh pipelines
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

  // Funcție pentru refresh departments
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

  // Încarcă toate datele inițiale
  useEffect(() => {
    let mounted = true

    const loadAllData = async () => {
      setLoading(true)
      try {
        // Load services, parts, instruments, technicians, pipelines, departments în paralel
        const [
          servicesData,
          partsData,
          instrumentsData,
          techniciansData,
          pipelinesData,
        ] = await Promise.all([
          listServices(),
          listParts(),
          supabase.from('instruments').select('id,name,weight,department_id,pipeline').order('name'),
          supabase
            .from('app_members')
            .select('user_id, name')
            .order('name', { ascending: true }),
          getPipelinesWithStages(),
        ])

        if (!mounted) return

        // Set services
        if (servicesData) {
          setServices(servicesData)
        }

        // Set parts
        if (partsData) {
          setParts(partsData)
        }

        // Set instruments
        if (instrumentsData.data) {
          setInstruments(
            instrumentsData.data.map((inst: any) => ({
              id: inst.id,
              name: inst.name,
              weight: inst.weight || 0,
              department_id: inst.department_id,
              pipeline: inst.pipeline,
            }))
          )
        }

        // Set technicians
        if (techniciansData.data) {
          setTechnicians(
            techniciansData.data.map((m: any) => ({
              id: m.user_id,
              name: m.users?.name || 'Unknown',
            }))
          )
        }

        // Set pipelines
        if (pipelinesData && pipelinesData.data && Array.isArray(pipelinesData.data)) {
          const pipelinesList = pipelinesData.data as Array<{ id: string; name: string }>
          setPipelinesWithIds(pipelinesList.map(p => ({ id: p.id, name: p.name })))
          setPipelines(pipelinesList.map(p => p.name))
        }

        // Load departments
        await refreshDepartments()

        // Load quotes (tăvițe)
        const quotesData = fisaId 
          ? await listTraysForServiceFile(fisaId)
          : await listQuotesForLead(leadId)
        
        if (!mounted) return

        let quotesArray = Array.isArray(quotesData) ? quotesData : (quotesData as any)?.data || []
        
        // Dacă există fisaId dar nu există tăvițe, creează automat o tăviță "undefined"
        if (fisaId && quotesArray.length === 0) {
          try {
            const { createTray } = await import('@/lib/supabase/serviceFileOperations')
            const { data: undefinedTray, error: trayError } = await createTray({
              number: '', // Tăviță "undefined" - fără număr
              size: 'm',
              service_file_id: fisaId,
              status: 'in_receptie',
            })
            
            if (!trayError && undefinedTray) {
              quotesArray = [undefinedTray]
            } else if (trayError) {
              console.error('Error creating undefined tray:', trayError?.message || trayError)
            }
          } catch (trayErr) {
            console.error('Error importing or creating undefined tray:', trayErr)
          }
        }
        
        // Actualizează quotes doar dacă s-au schimbat
        setQuotes(prevQuotes => {
          // Compară dacă array-urile sunt diferite
          const prevQuotesArray = Array.isArray(prevQuotes) ? prevQuotes : []
          if (prevQuotesArray.length !== quotesArray.length) {
            return quotesArray
          }
          const idsMatch = prevQuotesArray.every((q, idx) => q && q.id === quotesArray[idx]?.id)
          return idsMatch ? prevQuotesArray : quotesArray
        })
        
        // Selectează prima tăviță sau cea specificată
        if (quotesArray && quotesArray.length > 0) {
          // Prioritizează tăvița "undefined" (fără număr) dacă există
          const undefinedTray = quotesArray.find((q: any) => !q.number || q.number === '')
          const quoteToSelect = initialQuoteId 
            ? quotesArray.find((q: any) => q.id === initialQuoteId) || undefinedTray || quotesArray[0]
            : undefinedTray || quotesArray[0]
          setSelectedQuoteId(quoteToSelect.id)
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadAllData()

    return () => {
      mounted = false
    }
  }, [
    leadId,
    fisaId,
    initialQuoteId,
    refreshDepartments,
    setLoading,
    setServices,
    setParts,
    setInstruments,
    setTechnicians,
    setPipelines,
    setPipelinesWithIds,
    setQuotes,
    setSelectedQuoteId,
  ])

  return {
    refreshPipelines,
    refreshDepartments,
  }
}
