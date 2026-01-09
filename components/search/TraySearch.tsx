'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Search, Loader2, Package, Phone, Mail, FileText, ChevronRight, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TraySearchResult } from '@/lib/supabase/traySearchOperations'

interface TraySearchProps {
  onSelectTray?: (result: TraySearchResult) => void
  placeholder?: string
  className?: string
}

export function TraySearch({ onSelectTray, placeholder, className }: TraySearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TraySearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimer = useRef<NodeJS.Timeout>()

  // Funcție de căutare
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/search/trays?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()

      if (!data.success) {
        setError(data.error || 'Eroare la căutare')
        setResults([])
      } else {
        setResults(data.data)
        setError(null)
      }
    } catch (err: any) {
      setError('Eroare la conectare')
      setResults([])
      console.error('[TraySearch] Error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce search
  const handleInputChange = useCallback((value: string) => {
    setQuery(value)
    setIsOpen(true)

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      performSearch(value)
    }, 300)
  }, [performSearch])

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectResult = (result: TraySearchResult) => {
    setQuery('')
    setResults([])
    setIsOpen(false)
    onSelectTray?.(result)
  }

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder || 'Caută tăviță (număr, serial, brand)...'}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => query && setIsOpen(true)}
          className="pl-10 pr-10"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />
        )}
        {query && !loading && (
          <button
            onClick={() => {
              setQuery('')
              setResults([])
              setError(null)
              inputRef.current?.focus()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown rezultate */}
      {isOpen && (query.length > 0) && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 max-h-96 overflow-y-auto shadow-xl">
          <CardContent className="p-0">
            {loading && (
              <div className="p-8 text-center">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-blue-500" />
                <p className="text-sm text-muted-foreground mt-2">Se caută...</p>
              </div>
            )}

            {error && (
              <div className="p-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20">
                {error}
              </div>
            )}

            {!loading && !error && results.length === 0 && query.length >= 2 && (
              <div className="p-8 text-center">
                <Package className="h-10 w-10 mx-auto text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground mt-2">Nu s-au găsit tăvițe</p>
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="divide-y divide-border">
                {results.map((result) => (
                  <button
                    key={result.trayId}
                    onClick={() => handleSelectResult(result)}
                    className="w-full text-left p-3 hover:bg-accent/50 transition-colors flex items-start gap-3"
                  >
                    {/* Icon bazat pe match type */}
                    <div className="flex-shrink-0 mt-1">
                      <div className={cn(
                        'h-8 w-8 rounded flex items-center justify-center',
                        result.matchType === 'tray_number' && 'bg-blue-100 dark:bg-blue-900/30',
                        result.matchType === 'serial_number' && 'bg-purple-100 dark:bg-purple-900/30',
                        result.matchType === 'brand' && 'bg-orange-100 dark:bg-orange-900/30'
                      )}>
                        {result.matchType === 'tray_number' && <Package className="h-4 w-4 text-blue-600" />}
                        {result.matchType === 'serial_number' && <Zap className="h-4 w-4 text-purple-600" />}
                        {result.matchType === 'brand' && <FileText className="h-4 w-4 text-orange-600" />}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <p className="font-semibold text-sm truncate">
                          Tăviță: {result.trayNumber} ({result.traySize})
                        </p>
                        <span className={cn(
                          'text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0',
                          result.matchType === 'tray_number' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                          result.matchType === 'serial_number' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                          result.matchType === 'brand' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        )}>
                          {result.matchType === 'tray_number' && 'Număr'}
                          {result.matchType === 'serial_number' && 'Serial'}
                          {result.matchType === 'brand' && 'Brand'}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground mb-2">
                        {result.matchDetails}
                      </p>

                      {/* Lead info */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-foreground">{result.leadName}</span>
                        </div>
                        {result.leadPhone && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{result.leadPhone}</span>
                          </div>
                        )}
                        {result.leadEmail && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{result.leadEmail}</span>
                          </div>
                        )}
                      </div>

                      {/* Fişă de serviciu */}
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          Fişă: <span className="font-mono font-semibold">{result.serviceFileNumber}</span>
                        </p>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

