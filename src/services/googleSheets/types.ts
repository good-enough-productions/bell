export interface GoogleSheetsResponse {
  values: string[][];
}

export interface GoogleSheetsErrorResponse {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}