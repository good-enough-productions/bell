import { config, validateConfig } from '../config/config';
import { Reminder } from '../types/reminder';
import { isValidReminderData } from '../utils/validation';

export class GoogleSheetsError extends Error {
  constructor(
    message: string, 
    public readonly originalError?: unknown,
    public readonly errorCode?: number
  ) {
    super(message);
    this.name = 'GoogleSheetsError';
  }

  static fromResponse(response: Response, errorText: string): GoogleSheetsError {
    let errorMessage = `Failed to fetch sheet data: ${response.status} ${response.statusText}`;
    let errorCode = response.status;

    try {
      const errorData = JSON.parse(errorText);
      if (errorData.error?.message) {
        errorMessage = this.getReadableErrorMessage(errorData.error.message, response.status);
      }
    } catch (e) {
      // If JSON parsing fails, use the original error message
    }

    return new GoogleSheetsError(errorMessage, errorText, errorCode);
  }

  private static getReadableErrorMessage(message: string, status: number): string {
    switch (status) {
      case 403:
        return 'Access denied. Please make sure:\n' +
               '1. Your Google Sheets API key is correct\n' +
               '2. The API key has access to Google Sheets API\n' +
               '3. The spreadsheet is shared with "Anyone with the link"';
      case 404:
        return 'Spreadsheet not found. Please check your spreadsheet ID.';
      case 429:
        return 'Too many requests. Please try again later.';
      default:
        return message;
    }
  }
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

export async function fetchSheetData(): Promise<Reminder[]> {
  const configValidation = validateConfig();
  
  if (!configValidation.isValid) {
    throw new GoogleSheetsError(configValidation.errors.join('\n'));
  }

  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${config.sheetName}?key=${config.googleSheetsApiKey}`
    );

    const errorText = await response.text();
    
    if (!response.ok) {
      throw GoogleSheetsError.fromResponse(response, errorText);
    }

    let data;
    try {
      data = JSON.parse(errorText);
    } catch (e) {
      throw new GoogleSheetsError('Invalid response format from Google Sheets API');
    }
    
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
  } catch (error) {
    if (error instanceof GoogleSheetsError) {
      throw error;
    }
    throw new GoogleSheetsError('Failed to fetch sheet data', error);
  }
}