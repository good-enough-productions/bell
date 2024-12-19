// Google Sheets API configuration
export const config = {
  googleSheetsApiKey: import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || '',
  spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID || '',
  sheetName: 'Sheet1',
};

// Validation function for configuration
export function validateConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.googleSheetsApiKey) {
    errors.push('Google Sheets API key is missing. Please check your .env file.');
  }

  if (!config.spreadsheetId) {
    errors.push('Spreadsheet ID is missing. Please check your .env file.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}