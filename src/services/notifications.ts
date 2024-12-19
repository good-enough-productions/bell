export class NotificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationError';
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    throw new NotificationError('This browser does not support notifications');
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch {
    throw new NotificationError('Failed to request notification permission');
  }
}

export function sendNotification(
  title: string,
  options: NotificationOptions = {}
): void {
  if (Notification.permission !== 'granted') {
    throw new NotificationError('Notification permission not granted');
  }

  try {
    const notification = new Notification(title, {
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      ...options,
    });
    console.log('Notification created successfully:', notification);
  } catch (error) {
    console.error('Error sending notification:', error);
    console.log('Error details:', error);
    throw new NotificationError('Failed to send notification');
  }
}
