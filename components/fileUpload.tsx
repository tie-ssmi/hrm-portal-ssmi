'use client'

import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Capacitor } from '@capacitor/core'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  file: File | null
  onFileSelect: (file: File | null) => void
  allowedMimes?: string[]
  maxSizeMB?: number
  className?: string
}

const DEFAULT_ALLOWED = ['application/pdf', 'image/jpeg', 'image/png']

async function base64ToFile(base64: string, name: string, mimeType: string): Promise<File> {
  const res = await fetch(`data:${mimeType};base64,${base64}`)
  const blob = await res.blob()
  return new File([blob], name, { type: mimeType })
}

export default function FileUpload({
  file,
  onFileSelect,
  allowedMimes = DEFAULT_ALLOWED,
  maxSizeMB = 10,
  className,
}: FileUploadProps) {
  const validate = (f: File): boolean => {
    if (allowedMimes.length > 0 && !allowedMimes.includes(f.type)) {
      toast.error('ອະນຸຍາດສະເພາະ PDF, JPG, PNG ເທົ່ານັ້ນ')
      return false
    }
    if (f.size > maxSizeMB * 1024 * 1024) {
      toast.error(`ໄຟລ໌ໃຫຍ່ເກີນ ${maxSizeMB}MB ກະລຸນາເລືອກໄຟລ໌ໃໝ່`)
      return false
    }
    return true
  }

  const handleWebChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null
    e.target.value = ''
    if (!selected) return
    if (validate(selected)) onFileSelect(selected)
  }

  const handleNativeClick = async () => {
    try {
      const { FilePicker } = await import('@capawesome/capacitor-file-picker')
      const result = await FilePicker.pickFiles({ types: allowedMimes, limit: 1, readData: true })
      const picked = result.files[0]
      if (!picked?.data) return
      const f = await base64ToFile(picked.data, picked.name, picked.mimeType)
      if (validate(f)) onFileSelect(f)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.toLowerCase().includes('cancel')) {
        console.error('[FileUpload] FilePicker error:', err)
        toast.error('ເກີດຂໍ້ຜິດພາດ: ' + msg)
      }
    }
  }

  const areaClass = cn(
    'relative w-full h-auto flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 transition-colors bg-background',
    file ? 'border-primary bg-primary/5' : 'border-input',
  )

  const content = (
    <>
      <Upload className="h-5 w-5 text-muted-foreground" />
      {file ? (
        <div className="text-center">
          <p className="text-sm font-medium text-primary truncate max-w-56">{file.name}</p>
          <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">ກົດເພື່ອເລືອກໄຟລ໌</p>
          <p className="text-xs text-muted-foreground">PDF, JPG, PNG (ສູງສຸດ {maxSizeMB}MB)</p>
        </div>
      )}
    </>
  )

  // Native Capacitor app → use native file picker plugin
  if (Capacitor.isNativePlatform()) {
    return (
      <div className={cn('relative', className)}>
        <Button
          type="button"
          variant="outline"
          onClick={handleNativeClick}
          className={areaClass}
        >
          {content}
        </Button>
      </div>
    )
  }

  // Web / mobile browser → transparent <input> covers the outer div.
  // No `accept` attr: Android Chrome blocks the picker when accept has mixed MIME types
  // (same Android intent issue as Capacitor WebView). JS validation filters after selection.
  return (
    <div className={cn('relative', className)}>
      <input
        type="file"
        onChange={handleWebChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        style={{ zIndex: 10 }}
      />
      <div className={cn('pointer-events-none', areaClass)}>
        {content}
      </div>
    </div>
  )
}
