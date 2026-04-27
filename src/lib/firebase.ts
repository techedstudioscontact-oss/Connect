import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBgElaiZnuz1eCE7JkqU4LfB1bZl74KPJQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "connect-a5c43.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "connect-a5c43",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "connect-a5c43.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "654556594172",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:654556594172:web:e95490d6bf8d35113fbc79",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-94R12Z3ZBM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export const db = getFirestore(app);
export const auth = getAuth(app);
