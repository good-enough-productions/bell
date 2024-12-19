# Google Sheets Reminder PWA

This Progressive Web App (PWA) fetches reminders from a Google Sheet and displays notifications at the specified times.

## Setup Instructions

### 1. Google Sheets Setup

1. Create a new Google Sheet with the following columns:
   - Column A: `item` (The reminder text)
   - Column B: `date` (Format: YYYY-MM-DD)
   - Column C: `time` (Format: HH:mm, 24-hour)
   - Column D: `notified` (true/false)

2. Share your Google Sheet:
   - Click "Share" in the top right
   - Change to "Anyone with the link"
   - Copy the spreadsheet ID from the URL (the long string between /d/ and /edit)

### 2. Google Sheets API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Sheets API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"
4. Create API credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the API key

### 3. Environment Setup

1. Create a `.env` file in the root directory with:
   ```
   VITE_GOOGLE_SHEETS_API_KEY=your_api_key_here
   VITE_SPREADSHEET_ID=your_spreadsheet_id_here
   ```

### 4. Running the Application

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

## Troubleshooting

If you see permission errors:
1. Check that your API key is correct
2. Ensure the Google Sheets API is enabled
3. Verify the spreadsheet is shared with "Anyone with the link"
4. Confirm your spreadsheet ID is correct

## Sheet Format Example

| item           | date       | time   | notified |
|----------------|------------|--------|----------|
| Team Meeting   | 2024-02-20 | 14:30  | false    |
| Lunch Break    | 2024-02-20 | 12:00  | false    |