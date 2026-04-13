import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

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

// Keep analytics disabled by default to reduce initial JS and third-party script loading.
export const analytics = null

export default app