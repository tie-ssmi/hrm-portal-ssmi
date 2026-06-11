'use client'

// ** core
import { useState } from 'react'

// ** shared components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import OffsiteRequestForm from '@/components/dashboard/offsite-request-form'

// ** config / utils / types / hooks
import type { OffsiteRequestDoc } from '@/types/workOutside'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  initialData?: OffsiteRequestDoc
}

export function CreateRequestDialog({ open, onOpenChange, onSuccess, initialData }: Props) {
  const [confirmClose, setConfirmClose] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  function handleOpenChange(next: boolean) {
    if (!next && isDirty) {
      setConfirmClose(true)
    } else {
      onOpenChange(next)
      if (!next) setIsDirty(false)
    }
  }

  function handleSuccess() {
    setIsDirty(false)
    onOpenChange(false)
    onSuccess()
  }

  function handleConfirmClose() {
    setConfirmClose(false)
    setIsDirty(false)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-w-2xl w-full max-h-[90dvh] overflow-y-auto"
          showCloseButton={true}
        >
          <DialogHeader>
            <DialogTitle>
              {initialData ? 'ແກ້ໄຂຄຳຂໍ' : 'ສ້າງຄຳຂໍໃໝ່'}
            </DialogTitle>
          </DialogHeader>
          <OffsiteRequestForm
            onSuccess={handleSuccess}
            onDirtyChange={setIsDirty}
            initialData={initialData}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ຍົກເລີກການສ້າງ?</AlertDialogTitle>
            <AlertDialogDescription>
              ຂໍ້ມູນທີ່ກອກໄວ້ຈະຖືກລຶບທັງໝົດ ທ່ານຕ້ອງການປິດຫຼືບໍ່?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ກັບໄປແກ້ໄຂ</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose}>
              ຍົກເລີກ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
