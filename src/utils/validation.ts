import { Reminder } from '../types/reminder';

export function isValidReminderData(data: unknown): data is Array<Array<string>> {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return true;
  
  return data.every(row => 
    Array.isArray(row) && 
    row.length >= 4 && 
    row.every(cell => typeof cell === 'string')
  );
}

export function validateReminder(reminder: Reminder): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  return (
    typeof reminder.id === 'string' &&
    typeof reminder.item === 'string' &&
    dateRegex.test(reminder.date) &&
    timeRegex.test(reminder.time) &&
    typeof reminder.notified === 'boolean'
  );
}