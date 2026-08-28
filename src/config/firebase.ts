import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// TODO: Replace with your actual Firebase project config from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyCDUJbQPaUtYfVNI0SxAjJ1wCry8_Svvow",
  authDomain: "ai-assistant-438903.firebaseapp.com",
  projectId: "ai-assistant-438903",
  storageBucket: "ai-assistant-438903.firebasestorage.app",
  messagingSenderId: "929344479150",
  appId: "1:929344479150:web:9d423d20c7e274ea44f23f"
};

export const app = initializeApp(firebaseConfig);
export const messaging = typeof window !== 'undefined' && 'serviceWorker' in navigator ? getMessaging(app) : null;

// TODO: Replace with your VAPID key from Firebase Console -> Project Settings -> Cloud Messaging -> Web configuration
export const VAPID_KEY = "YOUR_VAPID_KEY";
