'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Gift } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth-context'
import {
  birthdayShownStorageKey,
  getBirthdayGreeting,
  type BirthdayGreeting,
} from '@/lib/birthday'
import { getVientianeIsoDate } from '@/lib/server-time'
import { useOfficialHolidays } from '@/lib/use-official-holidays-query'
import { buildHolidayDateKeySet } from '@/services/officialHolidays'

// Missing file is fine — play() rejects and the popup still works.
const BIRTHDAY_SOUND = '/mp3/birthday.mp3'

function readShown(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function markShown(key: string) {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // storage blocked (private mode) — popup may show again, harmless
  }
}

async function fireConfetti() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const { default: confetti } = await import('canvas-confetti')
  const end = Date.now() + 2500
  const frame = () => {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, zIndex: 9999 })
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, zIndex: 9999 })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }, zIndex: 9999 })
  frame()
}

function formatDayMonth(dateKey: string): string {
  const [, month, day] = dateKey.split('-')
  return `${day}/${month}`
}

export function BirthdayDialog() {
  const { user } = useAuth()
  const { data: holidays = [], isLoading: isLoadingHolidays } = useOfficialHolidays()
  const [greeting, setGreeting] = useState<BirthdayGreeting | null>(null)
  const [open, setOpen] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const uid = user?.uid || user?.id || ''
  const workLocationUuid =
    typeof user?.workLocation === 'object' ? user.workLocation?.uuid : undefined

  const holidaySet = useMemo(
    () => buildHolidayDateKeySet(holidays, workLocationUuid),
    [holidays, workLocationUuid],
  )

  // Wait for holidays so the belated window is computed against the real calendar.
  useEffect(() => {
    if (!uid || !user?.dateOfBirth || isLoadingHolidays) return
    const result = getBirthdayGreeting(user.dateOfBirth, getVientianeIsoDate(), holidaySet)
    if (!result) return
    if (readShown(birthdayShownStorageKey(uid, result.birthdayKey.slice(0, 4)))) return
    setGreeting(result)
    setOpen(true)
  }, [uid, user?.dateOfBirth, isLoadingHolidays, holidaySet])

  useEffect(() => {
    if (!open) return
    const audio = new Audio(BIRTHDAY_SOUND)
    audio.preload = 'auto'
    audioRef.current = audio
    return () => {
      audio.pause()
      audioRef.current = null
    }
  }, [open])

  if (!greeting || !user) return null

  // Browsers block autoplay — sound and confetti start from this tap.
  const handleReveal = () => {
    setRevealed(true)
    audioRef.current?.play().catch(() => {})
    void fireConfetti()
  }

  // X / overlay / Esc only close — the popup comes back next app open
  // until the employee taps "ຂອບໃຈ".
  const handleOpenChange = (next: boolean) => {
    if (!next) setOpen(false)
  }

  const handleThanks = () => {
    markShown(birthdayShownStorageKey(uid, greeting.birthdayKey.slice(0, 4)))
    setOpen(false)
  }

  const displayName =
    [user.firstNameLo, user.lastNameLo].filter(Boolean).join(' ') ||
    [user.firstName, user.lastName].filter(Boolean).join(' ')
  const avatarSrc = user.profileImage || user.avatar

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm text-center" showCloseButton={revealed}>
        {!revealed ? (
          <>
            <DialogHeader className="items-center text-center">
              <DialogTitle className="text-xl">ມີຂອງຂວັນສຳລັບທ່ານ 🎁</DialogTitle>
              <DialogDescription>{displayName} ແຕະເພື່ອເປີດຂອງຂວັນ</DialogDescription>
            </DialogHeader>
            <button
              type="button"
              onClick={handleReveal}
              className="mx-auto my-4 flex h-28 w-28 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform hover:scale-105 active:scale-95 animate-bounce"
              aria-label="ເປີດຂອງຂວັນ"
            >
              <Gift className="h-14 w-14" />
            </button>
            <DialogFooter className="sm:justify-center">
              <Button onClick={handleReveal} className="w-full">
                ເປີດຂອງຂວັນ
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <Avatar className="mx-auto mt-2 h-24 w-24 ring-4 ring-primary/20">
              <AvatarImage src={avatarSrc} alt={displayName} />
              <AvatarFallback className="text-2xl">{displayName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <DialogHeader className="items-center text-center">
              <DialogTitle className="text-2xl">🎂 ສຸກສັນວັນເກີດ 🎂</DialogTitle>
              <p className="text-lg font-semibold">{displayName}</p>
              {greeting.isBelated && (
                <p className="text-sm text-muted-foreground">
                  ອວຍພອນຍ້ອນຫຼັງ — ວັນທີ {formatDayMonth(greeting.birthdayKey)}
                </p>
              )}
              <DialogDescription className="pt-2">
                ບໍລິສັດຂໍອວຍພອນໃຫ້ທ່ານມີສຸຂະພາບແຂງແຮງ ມີຄວາມສຸກ
                ແລະ ປະສົບຜົນສຳເລັດໃນໜ້າທີ່ການງານ ຕະຫຼອດໄປ
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center">
              <Button onClick={handleThanks} className="w-full">
                ຂອບໃຈ 🙏
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
