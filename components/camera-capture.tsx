'use client'

// ** core
import { useCallback, useEffect, useRef, useState } from 'react'

// ** assets / icons
import { Camera, RotateCcw, Check, X } from 'lucide-react'

// ** shared components
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

type CameraCaptureProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCapture: (file: File) => void
  title?: string
}

/**
 * CameraCapture — opens the device camera via getUserMedia (works on Desktop & Mobile).
 * Returns a captured image as a File object.
 *
 * Uses MediaDevices API directly to guarantee camera-only access
 * (no file picker fallback).
 */
export function CameraCapture({
  open,
  onOpenChange,
  onCapture,
  title = 'ຖ່າຍຮູບ',
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Abort flag — prevents stale getUserMedia results from being used
  const abortRef = useRef(false)

  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')

  // Attach stream to video element (with retry for Portal mount timing)
  const attachStream = useCallback((stream: MediaStream) => {
    const video = videoRef.current
    if (video) {
      video.srcObject = stream
      video.play().catch(() => {
        // play() can throw if element is not visible yet — ignore, autoPlay handles it
      })
      return true
    }
    return false
  }, [])

  // Stop all tracks and clear video
  const stopCamera = useCallback(() => {
    abortRef.current = true
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // Start camera stream with abort-safe logic
  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    // Stop any existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    abortRef.current = false
    setIsStarting(true)
    setCameraError(null)
    setCapturedImage(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      })

      // If stopCamera was called while getUserMedia was pending, discard the stream
      if (abortRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      streamRef.current = stream

      // Try to attach immediately; if videoRef isn't ready yet (Portal timing),
      // retry after a short delay to let the DOM settle
      if (!attachStream(stream)) {
        await new Promise((r) => setTimeout(r, 100))
        if (!abortRef.current) {
          attachStream(stream)
        }
      }
    } catch (err) {
      if (abortRef.current) return

      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'ກະລຸນາອະນຸຍາດການເຂົ້າເຖິງກ້ອງຖ່າຍຮູບ.'
          : err instanceof DOMException && err.name === 'NotFoundError'
            ? 'ບໍ່ພົບກ້ອງຖ່າຍຮູບໃນອຸປະກອນນີ້.'
            : 'ເກີດຂໍ້ຜິດພາດໃນການເປີດກ້ອງ.'
      setCameraError(msg)
    } finally {
      if (!abortRef.current) {
        setIsStarting(false)
      }
    }
  }, [attachStream])

  // Start camera when dialog opens, stop when it closes
  useEffect(() => {
    if (open) {
      // Small delay to ensure Dialog Portal has mounted the <video> element
      const timer = setTimeout(() => startCamera(facingMode), 150)
      return () => {
        clearTimeout(timer)
        stopCamera()
      }
    } else {
      stopCamera()
      setCapturedImage(null)
      setCameraError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Capture photo from video stream
  const takePhoto = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Mirror the image if using front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0)

    setCapturedImage(canvas.toDataURL('image/jpeg', 0.85))
    stopCamera()
  }, [facingMode, stopCamera])

  // Re-take — restart camera
  const retake = useCallback(() => {
    setCapturedImage(null)
    startCamera(facingMode)
  }, [facingMode, startCamera])

  // Confirm captured image
  const confirmPhoto = useCallback(() => {
    if (!capturedImage) return

    // Convert data URL to File
    const arr = capturedImage.split(',')
    const mime = arr[0].match(/:(.*?);/)?.[1] ?? 'image/jpeg'
    const bstr = atob(arr[1])
    const u8arr = new Uint8Array(bstr.length)
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i)

    const file = new File([u8arr], `capture-${Date.now()}.jpg`, { type: mime })
    onCapture(file)
    onOpenChange(false)
  }, [capturedImage, onCapture, onOpenChange])

  // Switch between front/back camera
  const switchCamera = useCallback(() => {
    const next = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(next)
    if (!capturedImage) startCamera(next)
  }, [facingMode, capturedImage, startCamera])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>ຖ່າຍຮູບຈາກກ້ອງເພື່ອຢືນຢັນ</DialogDescription>
        </DialogHeader>

        <div className="relative aspect-[4/3] w-full bg-black">
          {/* Live video preview — always mounted so ref is stable */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`h-full w-full object-cover ${capturedImage ? 'hidden' : ''}`}
            style={facingMode === 'user' ? { transform: 'scaleX(-1)' } : undefined}
          />

          {/* Captured image preview */}
          {capturedImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={capturedImage}
              alt="ຮູບທີ່ຖ່າຍ"
              className="h-full w-full object-cover"
            />
          )}

          {/* Loading overlay */}
          {isStarting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="flex flex-col items-center gap-2 text-white">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span className="text-sm">ກຳລັງເປີດກ້ອງ...</span>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="flex flex-col items-center gap-3 px-6 text-center text-white">
                <Camera className="h-10 w-10 opacity-50" />
                <p className="text-sm">{cameraError}</p>
                <Button size="sm" variant="secondary" onClick={() => startCamera(facingMode)}>
                  ລອງໃໝ່
                </Button>
              </div>
            </div>
          )}

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <DialogFooter className="flex-row justify-center gap-3 px-4 pb-4">
          {!capturedImage ? (
            <>
              {/* Cancel */}
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-5 w-5" />
              </Button>

              {/* Capture */}
              <Button
                size="icon"
                className="h-14 w-14 rounded-full bg-white hover:bg-gray-100 text-black border-4 border-primary"
                onClick={takePhoto}
                disabled={isStarting || !!cameraError}
              >
                <Camera className="h-6 w-6" />
              </Button>

              {/* Switch camera */}
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={switchCamera}
              >
                <RotateCcw className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <>
              {/* Retake */}
              <Button variant="outline" className="gap-2" onClick={retake}>
                <RotateCcw className="h-4 w-4" />
                ຖ່າຍໃໝ່
              </Button>

              {/* Confirm */}
              <Button className="gap-2" onClick={confirmPhoto}>
                <Check className="h-4 w-4" />
                ຢືນຢັນ
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
