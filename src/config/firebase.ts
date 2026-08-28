import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// TODO: Replace with your actual Firebase project config from Firebase Console
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "ai-assistant-438903",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export const app = initializeApp(firebaseConfig);
export const messaging = typeof window !== 'undefined' && 'serviceWorker' in navigator ? getMessaging(app) : null;

// TODO: Replace with your VAPID key from Firebase Console -> Project Settings -> Cloud Messaging -> Web configuration
export const VAPID_KEY = "YOUR_VAPID_KEY";
