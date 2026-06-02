import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const isProd = process.env.NEXT_PUBLIC_DEPLOY_TARGET === 'production'

const firebaseConfig = {
  apiKey: "AIzaSyBOz7kNhNpXqPjezyPTP2olrDtSsxyxR6c",
  authDomain: "hrm-ssmi.firebaseapp.com",
  projectId: "hrm-ssmi",
  storageBucket: "hrm-ssmi.firebasestorage.app",
  messagingSenderId: "39051360088",
  // deploy     → production
  // deploy_dev → staging
  appId: isProd
    ? "1:39051360088:web:ccaec7f7b0e287f6f6572d"
    : "1:39051360088:web:86b1af09f33f72daf6572d",
  measurementId: isProd
    ? "G-Z2HPQ9CPEV"
    : "G-ZXD0LQ9QW4",
}

// Lightweight auth-only module — does NOT import firebase/firestore or firebase/storage
// This keeps them out of the login-page bundle to reduce TBT and initial parse time.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

export const auth = getAuth(app)
export default app
