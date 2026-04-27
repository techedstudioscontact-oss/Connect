import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, memoryLocalCache } from "firebase/firestore";
import { getMessaging } from "firebase/messaging";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAjyfSNtwEXKgDm1tKQbAlFTfNG1a2DuwM",
  authDomain: "microinfluencerhub.firebaseapp.com",
  databaseURL: "https://microinfluencerhub-default-rtdb.firebaseio.com",
  projectId: "microinfluencerhub",
  messagingSenderId: "696533957067",
  appId: "1:696533957067:web:42dc313ae873db33165e4e",
  measurementId: "G-4EDHTQ6ZXD"
};

const app = initializeApp(firebaseConfig);

// Initialize services
try {
  getAnalytics(app);
} catch (e) {
  console.warn("Firebase Analytics could not be initialized:", e);
}

export const auth = getAuth(app);

let messagingInstance: any = null;
try {
  messagingInstance = getMessaging(app);
} catch (e) {
  console.warn("Firebase Messaging is not supported in this environment:", e);
}
export const messaging = messagingInstance;

// Initialize Firestore. 
// The previous complex logic for persistent cache was brittle and a likely source of errors.
// Using memory cache is safer and guarantees Firestore initializes correctly.
// Write operations will still work, they just won't be available offline.
export const db = initializeFirestore(app, {
    localCache: memoryLocalCache()
});