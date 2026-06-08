export const runtime = 'nodejs' // web-push requires Node.js runtime (not Edge)
export const dynamic = 'force-static'

import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import webpush from 'web-push'

export async function GET(request: Request) {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }
  webpush.setVapidDetails('mailto:admin@yourdomain.com', vapidPublicKey, vapidPrivateKey)

  // Bug #4 fixed: secret via Authorization header instead of query param
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    // Bug #2 fixed: always specify timeZone so server UTC does not shift the date
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Vientiane' })
    console.log(`[Attendance Cron]: checking not-checked-in for ${today}`)

    const snapshot = await getDocs(
      query(
        collection(db, 'attendances'),
        where('date', '==', today),
        where('status', '==', 'not_checked_in')
      )
    )

    if (snapshot.empty) {
      return NextResponse.json({ success: true, notified: 0 })
    }

    // Bug #3 fixed: collect all UIDs first, then batch-query users
    const userUids = [
      ...new Set(
        snapshot.docs
          .map(doc => doc.data().createdByUid || doc.data().userUid)
          .filter(Boolean) as string[]
      ),
    ]

    if (userUids.length === 0) {
      return NextResponse.json({ success: true, notified: 0 })
    }

    // Firestore 'in' supports max 30 items per query — chunk if needed
    const CHUNK = 30
    const userMap = new Map<string, { pushSubscription?: PushSubscription }>()

    for (let i = 0; i < userUids.length; i += CHUNK) {
      const chunk = userUids.slice(i, i + CHUNK)
      const userSnap = await getDocs(
        query(collection(db, 'users'), where('uid', 'in', chunk))
      )
      userSnap.docs.forEach(doc => {
        const data = doc.data()
        userMap.set(data.uid, data)
      })
    }

    const payload = JSON.stringify({
      title: '🚨 ເຕືອນ Check-in ເຂົ້າວຽກ!',
      body: 'ຮອດເວລາແລ້ວ! ກະລຸນາກົດບັນທຶກເວລາເຂົ້າວຽກຂອງທ່ານຕອນນີ້.',
      icon: '/apple-icon.png',
      badge: '/icon0.svg',
      url: '/dashboard/attendance',
    })

    const results = await Promise.all(
      userUids.map(async uid => {
        const userData = userMap.get(uid)
        if (!userData?.pushSubscription) return false

        return webpush
          .sendNotification(userData.pushSubscription as any, payload)
          .then(() => true)
          .catch(err => {
            console.error(`Failed to notify user ${uid}:`, err)
            return false
          })
      })
    )

    const notified = results.filter(Boolean).length

    return NextResponse.json({
      success: true,
      notified,
      total: snapshot.size,
      message: `Notified ${notified} / ${snapshot.size} users`,
    })

    // Bug #5 fixed: no more `error: any`
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Cron Handler Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
