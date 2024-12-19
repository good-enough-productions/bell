import { config, validateConfig } from '../../config/config';
import { GoogleSheetsError } from './errors';
import { parseSheetData } from './parser';
import { Reminder } from '../../types/reminder';
import { GoogleSheetsResponse } from './types';

export async function fetchSheetData(): Promise<Reminder[]> {
  const configValidation = validateConfig();
  
  if (!configValidation.isValid) {
    throw new GoogleSheetsError(configValidation.errors.join('\n'));
  }

  try {
    const response = await fetch(buildApiUrl());
    const responseText = await response.text();
    
    if (!response.ok) {
      throw GoogleSheetsError.fromResponse(response, responseText);
    }

    const data = parseResponseData(responseText);
    return parseSheetData(data);
  } catch (error) {
    if (error instanceof GoogleSheetsError) {
      throw error;
    }
    throw new GoogleSheetsError('Failed to fetch sheet data', error);
  }
}

function buildApiUrl(): string {
  const baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  const { spreadsheetId, sheetName, googleSheetsApiKey } = config;
  
  return `${baseUrl}/${spreadsheetId}/values/${sheetName}?key=${googleSheetsApiKey}`;
}

function parseResponseData(responseText: string): GoogleSheetsResponse {
  try {
    return JSON.parse(responseText);
  } catch (e) {
    throw new GoogleSheetsError('Invalid response format from Google Sheets API');
  }
}