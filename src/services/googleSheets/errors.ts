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