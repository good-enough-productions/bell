import { useState, useEffect, useCallback } from 'react';
import { Reminder } from '../types/reminder';
import { fetchSheetData } from '../services/googleSheets';
import { sendNotification, NotificationError } from '../services/notifications';
import { getCurrentDate, getCurrentTime, isTimeMatch } from '../utils/date';

export function useReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReminders = useCallback(async () => {
    try {
      const data = await fetchSheetData();
      setReminders(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reminders');
      console.error('Error loading reminders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkReminders = useCallback(() => {
    const currentDate = getCurrentDate();
    const currentTime = getCurrentTime();

    reminders.forEach((reminder) => {
      if (
        !reminder.notified &&
        reminder.date === currentDate &&
        isTimeMatch(reminder.time, currentTime)
      ) {
        try {
          sendNotification(reminder.item, {
            body: `Reminder for ${reminder.date} at ${reminder.time}`,
          });
          setReminders((prev) =>
            prev.map((r) =>
              r.id === reminder.id ? { ...r, notified: true } : r
            )
          );
        } catch (err) {
          if (err instanceof NotificationError) {
            console.error('Failed to send notification:', err.message);
          }
        }
      }
    });
  }, [reminders]);

  useEffect(() => {
    loadReminders();
    const fetchInterval = setInterval(loadReminders, 60000); // Check every minute
    return () => clearInterval(fetchInterval);
  }, [loadReminders]);

  useEffect(() => {
    const notificationInterval = setInterval(checkReminders, 1000);
    return () => clearInterval(notificationInterval);
  }, [checkReminders]);

  return { reminders, loading, error };
}