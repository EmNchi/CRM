'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ImagePlus, Image as ImageIcon, Loader2, Download, ChevronDown, ChevronUp, X as XIcon } from 'lucide-react'
import type { TrayImage } from '@/lib/supabase/imageOperations'

interface TrayImagesSectionProps {
  trayImages: TrayImage[]
  uploadingImage: boolean
  isImagesExpanded: boolean
  canAddTrayImages: boolean
  canViewTrayImages: boolean
  selectedQuoteId: string | null
  onToggleExpanded: () => void
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  onDownloadAll: () => void
  onImageDelete: (imageId: string, filePath: string) => void
}

export function TrayImagesSection({
  trayImages = [],
  uploadingImage,
  isImagesExpanded,
  canAddTrayImages,
  canViewTrayImages,
  selectedQuoteId,
  onToggleExpanded,
  onImageUpload,
  onDownloadAll,
  onImageDelete,
}: TrayImagesSectionProps) {
  if (!canViewTrayImages || !selectedQuoteId) {
    return null
  }

  const imagesArray = Array.isArray(trayImages) ? trayImages : []

  return (
    <div className="mx-2 sm:mx-4">
      <div className="rounded-xl border-2 border-slate-200/80 dark:border-slate-700/50 
        bg-gradient-to-br from-orange-50 via-orange-100/40 to-slate-50 
        dark:from-orange-950/30 dark:via-orange-900/20 dark:to-slate-950/20 
        shadow-sm overflow-hidden">

        {/* Header */}
        <div className="px-4 py-3 
          bg-gradient-to-r from-orange-100/80 to-slate-100/60 
          dark:from-orange-900/40 dark:to-slate-900/30 
          border-b border-orange-200/60 dark:border-orange-700/40">

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl 
                bg-gradient-to-br from-orange-400 to-orange-500 
                flex items-center justify-center shadow-sm">
                <ImageIcon className="h-4.5 w-4.5 text-white" />
              </div>

              <div>
                <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  Imagini Tăviță ({imagesArray.length})
                </h3>
                <p className="text-[11px] text-slate-700/80 dark:text-slate-300/70">
                  Galerie imagini pentru tăviță • {imagesArray.length === 0
                    ? 'Nu există imagini'
                    : `${imagesArray.length} imagine${imagesArray.length === 1 ? '' : 'i'}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {imagesArray.length > 0 && isImagesExpanded && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDownloadAll}
                  className="h-7 text-xs 
                    border-orange-200 dark:border-orange-700 
                    hover:bg-orange-50 dark:hover:bg-orange-900/30">
                  <Download className="h-3 w-3 mr-1" />
                  Descarcă toate
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpanded}
                className="h-7 w-7 p-0"
                title={isImagesExpanded ? 'Minimizează' : 'Maximizează'}>
                {isImagesExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        {isImagesExpanded && (
          <div className="p-4 space-y-3">
            {/* Upload button */}
            {canAddTrayImages && (
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={onImageUpload}
                  disabled={uploadingImage}
                  className="hidden"
                  id="tray-image-upload"
                />
                <label
                  htmlFor="tray-image-upload"
                  className="flex items-center justify-center w-full h-24 border-2 border-dashed border-blue-200/80 dark:border-blue-700/50 rounded-lg cursor-pointer hover:border-blue-400/50 dark:hover:border-blue-500/50 transition-colors group bg-white/90 dark:bg-slate-950/60"
                >
                  {uploadingImage ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                      <span className="text-xs text-blue-700/80 dark:text-blue-300/70">Se încarcă...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <ImagePlus className="h-6 w-6 text-blue-600/60 dark:text-blue-400/60 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" />
                      <span className="text-xs text-blue-700/80 dark:text-blue-300/70 group-hover:text-blue-900 dark:group-hover:text-blue-100">
                        Click pentru a încărca imagine
                      </span>
                    </div>
                  )}
                </label>
              </div>
            )}

            {/* Images grid */}
            {imagesArray.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {imagesArray.map((image, idx) => (
                  <div
                    key={image.id}
                    className="relative group aspect-square rounded-lg overflow-hidden border bg-muted"
                  >
                    <img
                      src={image.url}
                      alt={image.filename || `Imagine ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {canAddTrayImages && (
                      <button
                        onClick={() => onImageDelete(image.id, image.file_path)}
                        className="absolute top-1 right-1 p-1 bg-destructive/80 hover:bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Șterge imagine"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
                      {image.filename}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ImageIcon className="h-8 w-8 text-blue-400/40 dark:text-blue-500/40 mb-2" />
                <p className="text-sm text-blue-700/80 dark:text-blue-300/70">
                  Nu există imagini încărcate
                </p>
                {canAddTrayImages && (
                  <p className="text-xs text-blue-600/60 dark:text-blue-400/60 mt-1">
                    Click pe butonul de mai sus pentru a încărca imagini
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
