import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAnalytics, isSupported } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: "AIzaSyBOz7kNhNpXqPjezyPTP2olrDtSsxyxR6c",
  authDomain: "hrm-ssmi.firebaseapp.com",
  projectId: "hrm-ssmi",
  storageBucket: "hrm-ssmi.firebasestorage.app",
  messagingSenderId: "39051360088",
  appId: "1:39051360088:web:ccaec7f7b0e287f6f6572d",
  measurementId: "G-Z2HPQ9CPEV"
}

// Initialize Firebase (prevent re-initialization in development)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

// Firebase services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

// Analytics (only in browser)
export const analytics = typeof window !== 'undefined' 
  ? isSupported().then(yes => yes ? getAnalytics(app) : null)
  : null

export default app