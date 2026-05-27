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
//Prodution
  // appId: "1:39051360088:web:ccaec7f7b0e287f6f6572d",
  
  // measurementId: "G-Z2HPQ9CPEV"
  //Staging
  appId: "1:39051360088:web:86b1af09f33f72daf6572d",
  measurementId: "G-ZXD0LQ9QW4"
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