'use client'

// ** core
import { useRef, useState } from 'react'

// ** assets / icons
import { Camera } from 'lucide-react'

// ** shared components
import { Button } from '@/components/ui/button'

// ** third party
import { toast } from 'sonner'

// ** config / utils / types / hooks
import { cn } from '@/lib/utils'
import { updateEmployeeProfileImage } from '@/lib/employees'
import { checkFileIntegrity, FileTruncatedError } from '@/lib/file-integrity'
import type { Employee } from '@/lib/types'

// ** services
import { uploadAttachment, UploadTruncatedError } from '@/services/attachment-upload'

type CameraUploadActor = {
  name?: string
  roleUuid?: string
  roleName?: string
  workLocation?: Employee['workLocation']
}

type CameraUploadProps = {
  uid: string
  folder?: string
  onUploaded?: (url: string) => void
  className?: string
  actor?: CameraUploadActor
}

// Android file pickers routinely hand back a File with an empty `type`, so
// falling straight back to image/jpeg would store a PDF as an image and the
// browser would refuse to display it when the download URL is opened.
const EXT_CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
}

function resolveContentType(file: File, ext: string): string {
  if (file.type) return file.type
  return EXT_CONTENT_TYPES[ext.toLowerCase()] || 'application/octet-stream'
}

export async function uploadImageFile(params: {
  file: File
  uid: string
  folder?: string
  onProgress?: (percent: number) => void
}): Promise<string> {
  const { file, uid, folder = 'profile-images', onProgress } = params
  const ext = file.name.split('.').pop() || 'jpg'
  const fileName = `${uid}-${Date.now()}.${ext}`

  // Every profile document and photo goes through here, and it produced 89 of
  // the 92 truncated objects in the bucket (see lib/file-integrity.ts), so both
  // callers are guarded by checking once in this function.
  if ((await checkFileIntegrity(file)) === 'truncated') {
    throw new FileTruncatedError()
  }

  // Always pass a progress callback: it selects the resumable uploader this
  // function has always used, and both callers show a percentage.
  return uploadAttachment(
    `${folder}/${uid}/${fileName}`,
    file,
    (percent) => onProgress?.(percent),
    {
      contentType: resolveContentType(file, ext),
      cacheControl: 'public,max-age=3600',
    },
  )
}

// A truncated file won't upload correctly on retry, so these errors surface
// their own "pick the file again" message instead of the generic failure.
export function isFileIntegrityError(
  err: unknown,
): err is FileTruncatedError | UploadTruncatedError {
  return err instanceof FileTruncatedError || err instanceof UploadTruncatedError
}

export default function CameraUpload({ uid, folder, onUploaded, className, actor }: CameraUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleSelect = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    try {
      setUploading(true)
      setProgress(0)
      const url = await uploadImageFile({
        file,
        uid,
        folder,
        onProgress: setProgress,
      })

      await updateEmployeeProfileImage(uid, url, actor)
      onUploaded?.(url)
      toast.success('Image uploaded successfully')
    } catch (error) {
      console.error(error)
      toast.error(isFileIntegrityError(error) ? error.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="items-center">
        <Button
          type="button"
          variant="ghost"
          disabled={uploading}
          onClick={() => cameraInputRef.current?.click()}
          className={cn(
            'h-8 w-8 rounded-full border border-white/35 bg-black/55 p-0 text-white shadow transition-colors hover:bg-black/70 hover:text-white',
            className
          )}
          aria-label="Upload profile photo"
        >
          {uploading ? <span className="text-[10px] font-medium">{progress}%</span> : <Camera className="h-4 w-4" />}
        </Button>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        // capture="environment"
        className="hidden"
        onChange={(e) => handleSelect(e.target.files?.[0])}
      />
    </div>
  )
}