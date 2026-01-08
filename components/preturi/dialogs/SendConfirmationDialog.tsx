'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Loader2, Send } from 'lucide-react'

interface SendConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  traysCount: number
  sending: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function SendConfirmationDialog({
  open,
  onOpenChange,
  traysCount,
  sending,
  onConfirm,
  onCancel,
}: SendConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-emerald-600" />
            Trimite tăvițele în departamente
          </AlertDialogTitle>
          <AlertDialogDescription>
            Ești sigur că vrei să trimiți {traysCount} {traysCount === 1 ? 'tăviță' : 'tăvițe'} în departamentele corespunzătoare?
            <br /><br />
            Această acțiune va muta instrumentele și serviciile în pipeline-urile departamentelor bazat pe tipul instrumentului.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={sending}>
            Anulează
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={sending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Se trimit...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Trimite
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}




