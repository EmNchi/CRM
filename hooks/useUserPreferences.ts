'use client'

import { useState, useEffect, useCallback } from 'react'

export interface UserPreferences {
  // Customizare stage-uri
  stageOrder?: Record<string, string[]> // pipelineSlug -> ordered stage names
  
  // Tema și culori
  theme?: 'light' | 'dark' | 'system'
  primaryColor?: string
  textColor?: string
  backgroundColor?: string
  
  // Alte preferințe
  compactMode?: boolean
}

const STORAGE_KEY = 'crm_user_preferences'

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    if (typeof window === 'undefined') return {}
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })

  const updatePreferences = useCallback((updates: Partial<UserPreferences>) => {
    setPreferences(prev => {
      const newPrefs = { ...prev, ...updates }
      
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs))
        } catch (error) {
          console.error('Error saving preferences:', error)
        }
      }
      
      return newPrefs
    })
  }, [])

  const getStageOrder = useCallback((pipelineSlug: string, defaultStages: string[]): string[] => {
    if (!preferences.stageOrder?.[pipelineSlug]) {
      return defaultStages
    }
    
    const customOrder = preferences.stageOrder[pipelineSlug]
    // Asigură-te că toate stage-urile default sunt incluse
    const ordered = [...customOrder]
    defaultStages.forEach(stage => {
      if (!ordered.includes(stage)) {
        ordered.push(stage)
      }
    })
    return ordered
  }, [preferences.stageOrder])

  const setStageOrder = useCallback((pipelineSlug: string, orderedStages: string[]) => {
    updatePreferences({
      stageOrder: {
        ...preferences.stageOrder,
        [pipelineSlug]: orderedStages
      }
    })
  }, [preferences.stageOrder, updatePreferences])

  return {
    preferences,
    updatePreferences,
    getStageOrder,
    setStageOrder,
  }
}

