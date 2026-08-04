/**
 * Bell PWA - Google Apps Script Backend
 *
 * SETUP:
 * 1. Open Google Sheet > Extensions > Apps Script
 * 2. Paste this into Code.gs and save
 * 3. Deploy > New deployment > Web app
 *    Execute as: Me | Who has access: Anyone
 * 4. Copy the Web App URL into Bell Settings > Google Sheet Backend URL
 * 5. After any code change: Manage deployments > Edit > New Version
 */

const SHEET_NAME = 'Bell_History';

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const h = [['ID','Timestamp','Sender','Message','Status','CompletedAt','DurationSeconds','Response']];
    sheet.getRange(1,1,1,h[0].length).setValues(h).setFontWeight('bold').setBackground('#e0e7ff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return responseJSON({ active: null, history: [] });

    const history = data.slice(1).map(row => ({
      id: String(row[0] || ''),
      timestamp: row[1] ? new Date(row[1]).toISOString() : '',
      sender: String(row[2] || ''),
      message: String(row[3] || ''),
      status: String(row[4] || 'PENDING'),
      completedAt: row[5] ? new Date(row[5]).toISOString() : '',
      durationSeconds: row[6] ? Number(row[6]) : null,
      response: String(row[7] || '')
    }));

    const active = history.slice().reverse().find(
      r => r.status === 'PENDING' || r.status.startsWith('RESPONDED')
    ) || null;

    return responseJSON({ active, history: history.reverse() });
  } catch(err) {
    return responseJSON({ error: err.toString() });
  }
}

function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents);
    const sheet = getOrCreateSheet();

    if (p.action === 'ring') {
      const id = p.id || ('ring_' + Date.now() + '_' + Math.random().toString(36).substr(2,5));
      const ts = new Date().toISOString();
      sheet.appendRow([id, ts, p.sender || 'Partner 1', p.message || '', 'PENDING', '', '', '']);
      return responseJSON({ success: true, id });
    }

    if (p.action === 'complete') {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(p.id)) {
          const now = new Date();
          const dur = Math.round((now - new Date(data[i][1])) / 1000);
          const resp = p.response || 'Done';
          const isDone = resp === 'Done' || resp === 'cancelled';
          const status = isDone ? 'COMPLETED' : ('RESPONDED: ' + resp);
          sheet.getRange(i+1,5).setValue(status);
          sheet.getRange(i+1,8).setValue(resp);
          if (isDone) {
            sheet.getRange(i+1,6).setValue(now.toISOString());
            sheet.getRange(i+1,7).setValue(dur);
          }
          return responseJSON({ success: true });
        }
      }
      return responseJSON({ success: false });
    }

    if (p.action === 'feedback') {
      const fbSheet = getOrCreateFeedbackSheet();
      fbSheet.appendRow([new Date().toISOString(), p.sender || 'Unknown', p.message || '']);
      return responseJSON({ success: true });
    }

    return responseJSON({ error: 'Unknown action' });
  } catch(err) {
    return responseJSON({ error: err.toString() });
  }
}

function getOrCreateFeedbackSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Feedback');
  if (!sheet) {
    sheet = ss.insertSheet('Feedback');
    const headers = [['Timestamp', 'User', 'FeedbackMessage']];
    sheet.getRange(1, 1, 1, headers[0].length).setValues(headers).setFontWeight('bold').setBackground('#fed7aa');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}