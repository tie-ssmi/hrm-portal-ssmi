import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAuth } from 'firebase/auth'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

// Initialize Firebase (prevent re-initialization in development)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

// App Check — scaffold only, NOT enforced server-side yet (see functions/src/index.ts,
// recordCheckIn/recordCheckOut log-only "shadow mode"). Inert until
// NEXT_PUBLIC_RECAPTCHA_SITE_KEY is set and a reCAPTCHA v3 provider is registered for
// this app in Firebase Console > App Check. Do not flip `enforceAppCheck: true` on the
// callables until Cloud Logging shows requests consistently arriving with a valid token.
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
  if (process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN) {
    // Lets local/dev builds pass App Check without a real reCAPTCHA challenge.
    // Register the printed token as a debug token in Firebase Console > App Check.
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  })
}

function createFirestore(firebaseApp: FirebaseApp) {
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager({ forceOwnership: true }),
      }),
    })
  } catch {
    return getFirestore(firebaseApp)
  }
}

// Firebase services
export const auth = getAuth(app)
export const db = createFirestore(app)
export const storage = getStorage(app)

// Keep analytics disabled by default to reduce initial JS and third-party script loading.
export const analytics = null

export default app