importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// TODO: Replace with your actual Firebase project config from Firebase Console
// Project: ai-assistant-438903
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "ai-assistant-438903",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'New Ping!';
  const notificationOptions = {
    body: payload.notification?.body || 'Someone pinged you.',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: payload.data
  };
  
  self.registration.showNotification(notificationTitle, notificationOptions);
});
