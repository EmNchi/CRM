'use client'

import { useState, useCallback, useRef } from 'react'
import { getPipelinesWithStages } from '@/lib/supabase/leadOperations'

const CACHE_DURATION = 5 * 60 * 1000 // 5 minute

interface CachedData {
  data: any[]
  timestamp: number
}

export function usePipelinesCache() {
  const [cachedData, setCachedData] = useState<CachedData | null>(null)
  const [loading, setLoading] = useState(false)
  const fetchPromiseRef = useRef<Promise<any> | null>(null)

  const getPipelines = useCallback(async (forceRefresh = false): Promise<any[]> => {
    const now = Date.now()

    // Verifică cache-ul
    if (!forceRefresh && cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
      return cachedData.data
    }

    // Dacă există deja un fetch în progres, așteaptă-l
    if (fetchPromiseRef.current) {
      return fetchPromiseRef.current
    }

    // Fetch nou
    setLoading(true)
    const promise = getPipelinesWithStages().then(({ data, error }) => {
      if (error) throw error
      if (data) {
        setCachedData({ data, timestamp: now })
      }
      return data || []
    }).finally(() => {
      setLoading(false)
      fetchPromiseRef.current = null
    })

    fetchPromiseRef.current = promise
    return promise
  }, [cachedData])

  const invalidateCache = useCallback(() => {
    setCachedData(null)
    fetchPromiseRef.current = null
  }, [])

  return { getPipelines, invalidateCache, loading, cachedData: cachedData?.data }
}

