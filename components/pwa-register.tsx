'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

// Module-level — captures prompt even before component mounts
let deferredPrompt: Event | null = null

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    window.dispatchEvent(new CustomEvent('pwa-prompt-ready'))
  })
}

export function getDeferredPrompt() {
  return deferredPrompt
}

export function clearDeferredPrompt() {
  deferredPrompt = null
}

export function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        // Detect new SW waiting → prompt user to update
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing
          if (!newSW) return

          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              toast('ມີອັບເດດໃໝ່', {
                description: 'ກົດເພື່ອໂຫຼດໜ້າໃໝ່',
                action: {
                  label: 'ອັບເດດ',
                  onClick: () => {
                    newSW.postMessage('SKIP_WAITING')
                    window.location.reload()
                  },
                },
                duration: Infinity,
              })
            }
          })
        })
      })
      .catch((err) => console.error('[SW] registration failed:', err))
  }, [])

  return null
}
