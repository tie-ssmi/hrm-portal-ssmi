'use client'

import { useRef, useState } from 'react'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Camera } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateEmployeeProfileImage } from '@/lib/employees'

type CameraUploadProps = {
  uid: string
  folder?: string
  onUploaded?: (url: string) => void
  className?: string
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
  const storageRef = ref(storage, `${folder}/${uid}/${fileName}`)

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'image/jpeg',
      cacheControl: 'public,max-age=3600',
    })

    task.on(
      'state_changed',
      (snapshot) => {
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
        onProgress?.(percent)
      },
      (error) => reject(error),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref)
          resolve(url)
        } catch (err) {
          reject(err)
        }
      }
    )
  })
}

export default function CameraUpload({ uid, folder, onUploaded, className }: CameraUploadProps) {
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

      await updateEmployeeProfileImage(uid, url)
      onUploaded?.(url)
      toast.success('Image uploaded successfully')
    } catch (error) {
      console.error(error)
      toast.error('Upload failed')
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