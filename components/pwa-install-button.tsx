'use client'

// ** core
import { useEffect, useState } from 'react'

// ** assets / icons
import { Download, Share } from 'lucide-react'

// ** shared components
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { getDeferredPrompt } from '@/components/pwa-register'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallButton({ className }: { className?: string }) {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOSDevice, setIsIOSDevice] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in window.navigator && (window.navigator as any).standalone === true)

    if (standalone) { setIsInstalled(true); return }

    setIsIOSDevice(/iphone|ipad|ipod/i.test(navigator.userAgent))

    // Pick up prompt captured at module level (before component mounted)
    const existing = getDeferredPrompt()
    if (existing) setPrompt(existing as BeforeInstallPromptEvent)

    // Also listen for future fires
    const handler = () => {
      const p = getDeferredPrompt()
      if (p) setPrompt(p as BeforeInstallPromptEvent)
    }
    window.addEventListener('pwa-prompt-ready', handler)
    return () => window.removeEventListener('pwa-prompt-ready', handler)
  }, [])

  const handleAndroidInstall = async () => {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setPrompt(null)
      setIsInstalled(true)
    }
  }

  // Already installed — hide
  if (isInstalled) return null

  // iOS — show guide button
  if (isIOSDevice) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowIOSGuide(true)}
          className={className ?? "gap-2"}
        >
          <Download className="h-4 w-4" />
          ຕິດຕັ້ງແອັບ
        </Button>

        <Dialog open={showIOSGuide} onOpenChange={setShowIOSGuide}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>ຕິດຕັ້ງ SSMI HRM</DialogTitle>
              <DialogDescription>
                ເພີ່ມໃສ່ໜ້າຈໍຫຼັກຂອງ iPhone / iPad
              </DialogDescription>
            </DialogHeader>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                <span>ກົດປຸ່ມ <Share className="inline h-4 w-4" /> <strong>Share</strong> ທີ່ແຖບດ້ານລຸ່ມຂອງ Safari</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                <span>ເລື່ອນລົງ ແລ້ວກົດ <strong>"Add to Home Screen"</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                <span>ກົດ <strong>"Add"</strong> ມຸມຂວາເທິງ</span>
              </li>
            </ol>
            <p className="text-xs text-muted-foreground mt-2">
              * ໃຊ້ Safari ເທົ່ານັ້ນ — Chrome iOS ບໍ່ຮອງຮັບ
            </p>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // Android / Desktop Chrome — show install button when prompt is ready
  if (!prompt) return null

  return (
    <Button variant="outline" size="sm" onClick={handleAndroidInstall} className={className ?? "gap-2"}>
      <Download className="h-4 w-4" />
      ຕິດຕັ້ງແອັບ
    </Button>
  )
}
