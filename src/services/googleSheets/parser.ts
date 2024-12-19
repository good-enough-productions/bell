import { Reminder } from '../../types/reminder';
import { GoogleSheetsError } from './errors';
import { isValidReminderData } from '../../utils/validation';
import { GoogleSheetsResponse } from './types';

export function parseSheetData(data: GoogleSheetsResponse): Reminder[] {
  if (!data.values || !isValidReminderData(data.values)) {
    throw new GoogleSheetsError(
      'Invalid spreadsheet format. Please ensure your sheet has the following columns:\n' +
      '- Column A: item (text)\n' +
      '- Column B: date (YYYY-MM-DD)\n' +
      '- Column C: time (HH:mm)\n' +
      '- Column D: notified (true/false)'
    );
  }

  const rows = data.values.slice(1); // Skip header row
  return rows.map(parseRow);
}

function parseRow(row: string[]): Reminder {
  return {
    id: crypto.randomUUID(),
    item: row[0]?.trim() ?? '',
    date: row[1]?.trim() ?? '',
    time: row[2]?.trim() ?? '',
    notified: row[3]?.toLowerCase() === 'true',
  };
}