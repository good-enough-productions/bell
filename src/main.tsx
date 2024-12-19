import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { requestNotificationPermission } from './services/notifications';

requestNotificationPermission().then(permission => {
  console.log('Notification permission granted:', permission);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
