importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// TODO: Replace with your actual Firebase project config from Firebase Console
// Project: ai-assistant-438903
const firebaseConfig = {
  apiKey: "AIzaSyCDUJbQPaUtYfVNI0SxAjJ1wCry8_Svvow",
  authDomain: "ai-assistant-438903.firebaseapp.com",
  projectId: "ai-assistant-438903",
  storageBucket: "ai-assistant-438903.firebasestorage.app",
  messagingSenderId: "929344479150",
  appId: "1:929344479150:web:9d423d20c7e274ea44f23f"
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
