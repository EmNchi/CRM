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
  trayImages,
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

  return (
    <div className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/30">
      <div className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              Imagini Tăviță ({trayImages.length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            {trayImages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDownloadAll}
                className="h-7 text-xs"
              >
                <Download className="h-3 w-3 mr-1" />
                Descarcă toate
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpanded}
              className="h-7 w-7 p-0"
              title={isImagesExpanded ? 'Minimizează' : 'Maximizează'}
            >
              {isImagesExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {isImagesExpanded && (
          <div className="space-y-3">
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
                  className="flex items-center justify-center w-full h-24 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 transition-colors group"
                >
                  {uploadingImage ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Se încarcă...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <ImagePlus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="text-xs text-muted-foreground group-hover:text-foreground">
                        Click pentru a încărca imagine
                      </span>
                    </div>
                  )}
                </label>
              </div>
            )}

            {/* Images grid */}
            {trayImages.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {trayImages.map((image, idx) => (
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
                <ImageIcon className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nu există imagini încărcate
                </p>
                {canAddTrayImages && (
                  <p className="text-xs text-muted-foreground mt-1">
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

